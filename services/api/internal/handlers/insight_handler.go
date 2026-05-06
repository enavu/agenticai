package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"

	"enavu-hub/api/internal/agent"
	"enavu-hub/api/internal/models"
	"enavu-hub/api/internal/store"
)

type InsightHandler struct {
	store  *store.Store
	agent  *agent.HAInsightAgent
}

func NewInsightHandler(s *store.Store, a *agent.HAInsightAgent) *InsightHandler {
	return &InsightHandler{store: s, agent: a}
}

// GET /api/v1/home/insights
func (h *InsightHandler) List(c *gin.Context) {
	insights, err := h.store.ListHAInsights(c.Request.Context(), 30)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if insights == nil {
		insights = []models.HAInsight{}
	}
	c.JSON(http.StatusOK, gin.H{"insights": insights})
}

// POST /api/v1/home/insights/generate — manual trigger
func (h *InsightHandler) Generate(c *gin.Context) {
	// Default to yesterday for a full 24h window
	yesterday := time.Now().AddDate(0, 0, -1)

	if err := h.agent.Run(c.Request.Context(), yesterday); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"status": "generated", "date": yesterday.Format("2006-01-02")})
}
