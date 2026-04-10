package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"enavu-hub/api/internal/store"
)

type AgentHandler struct {
	store *store.Store
}

func NewAgentHandler(s *store.Store) *AgentHandler {
	return &AgentHandler{store: s}
}

func (h *AgentHandler) ListRuns(c *gin.Context) {
	runs, err := h.store.ListAgentRuns(c.Request.Context(), 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"runs": runs})
}

func (h *AgentHandler) GetRun(c *gin.Context) {
	id := c.Param("id")
	run, err := h.store.GetAgentRun(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}
	c.JSON(http.StatusOK, run)
}
