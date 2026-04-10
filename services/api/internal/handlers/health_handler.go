package handlers

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"enavu-hub/api/internal/services"
	"enavu-hub/api/internal/store"
)

type HealthHandler struct {
	store  *store.Store
	ha     *services.HAClient
	scraper *services.ScraperClient
}

func NewHealthHandler(s *store.Store, ha *services.HAClient, scraper *services.ScraperClient) *HealthHandler {
	return &HealthHandler{store: s, ha: ha, scraper: scraper}
}

func (h *HealthHandler) Health(c *gin.Context) {
	base := c.Request.Context()

	status := gin.H{
		"status": "ok",
		"time":   time.Now().UTC(),
	}

	check := func(fn func(context.Context) error) error {
		ctx, cancel := context.WithTimeout(base, 3*time.Second)
		defer cancel()
		return fn(ctx)
	}

	// DB check — core dependency
	if err := check(h.store.Ping); err != nil {
		status["db"] = "error: " + err.Error()
		status["status"] = "degraded"
	} else {
		status["db"] = "ok"
	}

	// HA check — external, doesn't affect service health
	if err := check(h.ha.Ping); err != nil {
		status["ha"] = "error: " + err.Error()
	} else {
		status["ha"] = "ok"
	}

	// Scraper check — internal, doesn't affect service health if misconfigured
	if err := check(h.scraper.Ping); err != nil {
		status["scraper"] = "error: " + err.Error()
	} else {
		status["scraper"] = "ok"
	}

	code := http.StatusOK
	if status["status"] == "degraded" {
		code = http.StatusServiceUnavailable
	}
	c.JSON(code, status)
}
