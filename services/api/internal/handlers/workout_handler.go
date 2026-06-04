package handlers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"enavu-hub/api/internal/agent"
	"enavu-hub/api/internal/models"
	"enavu-hub/api/internal/services"
	"enavu-hub/api/internal/store"
)

type WorkoutHandler struct {
	store          *store.Store
	scraper        *services.ScraperClient
	workoutAgent   *agent.WorkoutAgent
}

func NewWorkoutHandler(s *store.Store, scraper *services.ScraperClient) *WorkoutHandler {
	return &WorkoutHandler{store: s, scraper: scraper}
}

func (h *WorkoutHandler) SetAgent(a *agent.WorkoutAgent) {
	h.workoutAgent = a
}

func (h *WorkoutHandler) List(c *gin.Context) {
	ctx := c.Request.Context()
	workouts, err := h.store.ListWorkouts(ctx, 100)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	stats, err := h.store.GetWorkoutStats(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"workouts": workouts,
		"stats":    stats,
	})
}

// Insights returns the latest AI-generated workout pattern insight.
// If the cached insight is older than 24h it regenerates. This endpoint is public.
func (h *WorkoutHandler) Insights(c *gin.Context) {
	ctx := c.Request.Context()

	// Try cached first
	cached, err := h.store.GetLatestWorkoutInsight(ctx)
	if err == nil && time.Since(cached.CreatedAt) < 24*time.Hour {
		c.JSON(http.StatusOK, cached)
		return
	}

	// Generate fresh
	if h.workoutAgent == nil {
		// Return patterns without AI if agent not wired yet
		patterns, perr := h.store.GetWorkoutPatterns(ctx)
		if perr != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": perr.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"patterns": patterns, "summary": ""})
		return
	}

	insight, err := h.workoutAgent.Run(ctx)
	if err != nil {
		// Fall back to cached even if stale
		if cached != nil {
			c.JSON(http.StatusOK, cached)
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, insight)
}

func (h *WorkoutHandler) Sync(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 300*time.Second)
	defer cancel()

	result, err := h.scraper.ScrapeWorkouts(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("scrape failed: %v", err)})
		return
	}

	var synced, skipped int
	for _, sw := range result.Workouts {
		classDate, err := time.Parse("2006-01-02T15:04:05", sw.ClassDate)
		if err != nil {
			classDate, err = time.Parse("2006-01-02", sw.ClassDate)
			if err != nil {
				skipped++
				continue
			}
		}

		w := &models.Workout{
			ClassDate:   classDate,
			ClassName:   sw.ClassName,
			Instructor:  sw.Instructor,
			Studio:      sw.Studio,
			Duration:    sw.Duration,
			CalsBurned:  sw.CalsBurned,
			AvgOutput:   sw.AvgOutput,
			TotalOutput: sw.TotalOutput,
			Rank:        sw.Rank,
		}
		if err := h.store.UpsertWorkout(ctx, w); err != nil {
			skipped++
			continue
		}
		synced++
	}

	c.JSON(http.StatusOK, gin.H{
		"synced":  synced,
		"skipped": skipped,
		"total":   len(result.Workouts),
	})
}
