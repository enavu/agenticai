package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"enavu-hub/api/internal/agent"
	"enavu-hub/api/internal/store"
)

type PostHandler struct {
	store        *store.Store
	contentAgent *agent.ContentAgent
}

func NewPostHandler(s *store.Store, contentAgent *agent.ContentAgent) *PostHandler {
	return &PostHandler{store: s, contentAgent: contentAgent}
}

func (h *PostHandler) List(c *gin.Context) {
	posts, err := h.store.ListPosts(c.Request.Context(), 50)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"posts": posts})
}

func (h *PostHandler) Generate(c *gin.Context) {
	// Run the content agent synchronously (can take 30-60s)
	run, err := h.contentAgent.Run(c.Request.Context(), nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":       err.Error(),
			"agent_run_id": run.ID,
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"agent_run_id": run.ID,
		"status":       run.Status,
		"output":       run.Output,
	})
}
