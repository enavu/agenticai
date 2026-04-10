package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"enavu-hub/api/internal/services"
)

type HomeHandler struct {
	ha *services.HAClient
}

func NewHomeHandler(ha *services.HAClient) *HomeHandler {
	return &HomeHandler{ha: ha}
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
