package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"enavu-hub/api/internal/models"
	"enavu-hub/api/internal/services"
	"enavu-hub/api/internal/store"
)

type HomeHandler struct {
	ha *services.HAClient
	db *store.Store
}

func NewHomeHandler(ha *services.HAClient, db *store.Store) *HomeHandler {
	return &HomeHandler{ha: ha, db: db}
}

func (h *HomeHandler) State(c *gin.Context) {
	states, err := h.ha.GetAllStates(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Filter to interesting domains only
	domains := map[string]bool{
		"light": true, "switch": true, "sensor": true, "binary_sensor": true,
		"climate": true, "media_player": true, "input_boolean": true, "automation": true,
	}

	var filtered []services.HAState
	for _, s := range states {
		parts := strings.SplitN(s.EntityID, ".", 2)
		if len(parts) == 2 && domains[parts[0]] {
			filtered = append(filtered, s)
		}
	}

	c.JSON(http.StatusOK, gin.H{"states": filtered, "count": len(filtered)})
}

func (h *HomeHandler) Lights(c *gin.Context) {
	lights, err := h.ha.GetLights(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"lights": lights})
}

func (h *HomeHandler) History(c *gin.Context) {
	hours, _ := strconv.Atoi(c.DefaultQuery("hours", "24"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "96"))
	if hours < 1 || hours > 720 {
		hours = 24
	}
	if limit < 1 || limit > 500 {
		limit = 96
	}

	snapshots, err := h.db.ListHASnapshots(c.Request.Context(), hours, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if snapshots == nil {
		snapshots = []models.HASnapshot{}
	}
	c.JSON(http.StatusOK, gin.H{"snapshots": snapshots, "count": len(snapshots)})
}
