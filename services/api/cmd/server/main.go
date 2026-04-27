package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/hibiken/asynq"

	"enavu-hub/api/internal/agent"
	"enavu-hub/api/internal/config"
	"enavu-hub/api/internal/handlers"
	"enavu-hub/api/internal/models"
	"enavu-hub/api/internal/services"
	"enavu-hub/api/internal/store"
	"enavu-hub/api/internal/ws"
)

func main() {
	cfg := config.Load()

	if cfg.IsProd() {
		gin.SetMode(gin.ReleaseMode)
	}

	ctx := context.Background()

	// ─── Database ────────────────────────────────────────────────────────────
	db, err := store.New(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("connect postgres: %v", err)
	}
	defer db.Close()

	if err := db.Migrate(ctx); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	log.Println("Database ready")

	// ─── External services ───────────────────────────────────────────────────
	haClient := services.NewHAClient(cfg.HA.URL, cfg.HA.Token)
	aiClient := services.NewAnthropicClient(cfg.Anthropic.APIKey, cfg.Anthropic.Model)
	igClient := services.NewInstagramClient(cfg.Instagram.AccessToken, cfg.Instagram.UserID)
	scraperClient := services.NewScraperClient(cfg.ScraperURL)

	// ─── Agents ──────────────────────────────────────────────────────────────
	haAgent := agent.NewHAAgent(aiClient, haClient, db)
	contentAgent := agent.NewContentAgent(aiClient, igClient, db)

	// ─── WebSocket hub ───────────────────────────────────────────────────────
	hub := ws.NewHub()

	// ─── Handlers ────────────────────────────────────────────────────────────
	authH    := handlers.NewAuthHandler(cfg)
	healthH  := handlers.NewHealthHandler(db, haClient, scraperClient)
	workoutH := handlers.NewWorkoutHandler(db, scraperClient)
	homeH    := handlers.NewHomeHandler(haClient, db)
	postH    := handlers.NewPostHandler(db, contentAgent)
	agentH   := handlers.NewAgentHandler(db)
	chatH    := handlers.NewChatHandler(hub, haAgent, db)
	uploadH  := handlers.NewUploadHandler(cfg.UploadDir, cfg.SiteURL)
	financeH := handlers.NewFinanceHandler(db)

	// ─── Router ──────────────────────────────────────────────────────────────
	router := gin.New()
	setupRoutes(router, cfg.JWTSecret, authH, healthH, workoutH, homeH, postH, agentH, chatH, uploadH, financeH, cfg.UploadDir)

	// ─── Scheduler (asynq) ───────────────────────────────────────────────────
	scheduler := setupScheduler(cfg, db, scraperClient, contentAgent, haClient)
	if err := scheduler.Start(); err != nil {
		log.Printf("Warning: scheduler failed to start: %v", err)
	}
	defer scheduler.Shutdown()

	// ─── HTTP server ─────────────────────────────────────────────────────────
	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 180 * time.Second,
	}

	go func() {
		log.Printf("API server listening on :%s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down...")
	shutCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	server.Shutdown(shutCtx)
	log.Println("Server stopped")
}

// setupScheduler wires up cron jobs via asynq.
func setupScheduler(cfg *config.Config, db *store.Store, scraper *services.ScraperClient, contentAgent *agent.ContentAgent, ha *services.HAClient) *asynq.Scheduler {
	redisOpt := asynq.RedisClientOpt{Addr: redisAddr(cfg.RedisURL)}
	scheduler := asynq.NewScheduler(redisOpt, &asynq.SchedulerOpts{
		Location: time.Local,
	})

	// Daily 6am: scrape Cyclebar
	scheduler.Register("0 6 * * *", asynq.NewTask("cyclebar:sync", nil))

	// Tue + Thu 7pm: generate + post Instagram content
	scheduler.Register("0 19 * * 2,4", asynq.NewTask("content:generate", nil))

	// Every 15 min: snapshot Home Assistant state
	scheduler.Register("*/15 * * * *", asynq.NewTask("ha:snapshot", nil))

	// Start worker to process tasks
	go runWorker(cfg, db, scraper, contentAgent, ha)

	return scheduler
}

func runWorker(cfg *config.Config, db *store.Store, scraper *services.ScraperClient, contentAgent *agent.ContentAgent, ha *services.HAClient) {
	redisOpt := asynq.RedisClientOpt{Addr: redisAddr(cfg.RedisURL)}
	srv := asynq.NewServer(redisOpt, asynq.Config{
		Concurrency: 2,
	})

	mux := asynq.NewServeMux()
	mux.HandleFunc("cyclebar:sync", func(ctx context.Context, t *asynq.Task) error {
		log.Println("Scheduled: running Cyclebar scrape")
		result, err := scraper.ScrapeWorkouts(ctx)
		if err != nil {
			return err
		}
		log.Printf("Scheduled scrape: got %d workouts", len(result.Workouts))
		return nil
	})
	mux.HandleFunc("content:generate", func(ctx context.Context, t *asynq.Task) error {
		log.Println("Scheduled: running content agent")
		run, err := contentAgent.Run(ctx, "", nil)
		if err != nil {
			return err
		}
		log.Printf("Scheduled content: run %s completed with status %s", run.ID, run.Status)
		return nil
	})
	mux.HandleFunc("ha:snapshot", func(ctx context.Context, t *asynq.Task) error {
		// Watermark: pull from last recorded change (or 16 min ago on first run)
		since, err := db.GetLatestHAChangeTime(ctx)
		if err != nil || since.IsZero() || since.Year() == 1970 {
			since = time.Now().Add(-16 * time.Minute)
		}
		until := time.Now()

		// HA history API can be slow for all entities — give it 60s
		histCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
		defer cancel()

		history, err := ha.GetHistoryRange(histCtx, since, until)
		if err != nil {
			return fmt.Errorf("ha history: fetch: %w", err)
		}

		// Flatten entity histories into individual state changes
		var changes []models.HAStateChange
		for _, entityHistory := range history {
			for _, s := range entityHistory {
				changes = append(changes, models.HAStateChange{
					EntityID:   s.EntityID,
					State:      s.State,
					Attributes: s.Attributes,
					ChangedAt:  s.LastChanged,
				})
			}
		}

		inserted, err := db.BulkInsertHAStateChanges(ctx, changes)
		if err != nil {
			return fmt.Errorf("ha history: store: %w", err)
		}
		log.Printf("HA history: %d new state changes from %d entities (%s → %s)",
			inserted, len(history), since.Format("15:04:05"), until.Format("15:04:05"))
		return nil
	})

	if err := srv.Run(mux); err != nil {
		log.Printf("asynq worker stopped: %v", err)
	}
}

func redisAddr(redisURL string) string {
	// Strip redis:// prefix
	addr := redisURL
	for _, prefix := range []string{"redis://", "rediss://"} {
		if len(addr) > len(prefix) && addr[:len(prefix)] == prefix {
			addr = addr[len(prefix):]
			break
		}
	}
	return addr
}
