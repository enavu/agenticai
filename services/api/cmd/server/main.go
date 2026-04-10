package main

import (
	"context"
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
	healthH := handlers.NewHealthHandler(db, haClient, scraperClient)
	workoutH := handlers.NewWorkoutHandler(db, scraperClient)
	homeH := handlers.NewHomeHandler(haClient)
	postH := handlers.NewPostHandler(db, contentAgent)
	agentH := handlers.NewAgentHandler(db)
	chatH := handlers.NewChatHandler(hub, haAgent, db)

	// ─── Router ──────────────────────────────────────────────────────────────
	router := gin.New()
	setupRoutes(router, healthH, workoutH, homeH, postH, agentH, chatH)

	// ─── Scheduler (asynq) ───────────────────────────────────────────────────
	scheduler := setupScheduler(cfg, db, scraperClient, contentAgent)
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
func setupScheduler(cfg *config.Config, db *store.Store, scraper *services.ScraperClient, contentAgent *agent.ContentAgent) *asynq.Scheduler {
	redisOpt := asynq.RedisClientOpt{Addr: redisAddr(cfg.RedisURL)}
	scheduler := asynq.NewScheduler(redisOpt, &asynq.SchedulerOpts{
		Location: time.Local,
	})

	// Daily 6am: scrape Cyclebar
	scheduler.Register("0 6 * * *", asynq.NewTask("cyclebar:sync", nil))

	// Tue + Thu 7pm: generate + post Instagram content
	scheduler.Register("0 19 * * 2,4", asynq.NewTask("content:generate", nil))

	// Start worker to process tasks
	go runWorker(cfg, db, scraper, contentAgent)

	return scheduler
}

func runWorker(cfg *config.Config, db *store.Store, scraper *services.ScraperClient, contentAgent *agent.ContentAgent) {
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
		run, err := contentAgent.Run(ctx, nil)
		if err != nil {
			return err
		}
		log.Printf("Scheduled content: run %s completed with status %s", run.ID, run.Status)
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
