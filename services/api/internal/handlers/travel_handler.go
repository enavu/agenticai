package handlers

import (
	"context"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"

	"enavu-hub/api/internal/models"
	"enavu-hub/api/internal/services"
	"enavu-hub/api/internal/store"
)

type TravelHandler struct {
	store   *store.Store
	scraper *services.ScraperClient
}

func NewTravelHandler(s *store.Store, scraper *services.ScraperClient) *TravelHandler {
	return &TravelHandler{store: s, scraper: scraper}
}

// GET /api/v1/travel
func (h *TravelHandler) List(c *gin.Context) {
	ctx := c.Request.Context()

	watches, err := h.store.GetTravelWatches(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	type watchOut struct {
		ID          string               `json:"id"`
		Label       string               `json:"label"`
		Type        string               `json:"type"`
		LatestPrice *float64             `json:"latest_price"`
		History     []models.TravelPrice `json:"history"`
	}

	out := make([]watchOut, 0, len(watches))
	for _, w := range watches {
		history, err := h.store.GetPriceHistory(ctx, w.ID, 30)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if history == nil {
			history = []models.TravelPrice{}
		}

		wo := watchOut{
			ID:      w.ID,
			Label:   w.Label,
			Type:    w.Type,
			History: history,
		}
		if len(history) > 0 {
			p := history[0].Price
			wo.LatestPrice = &p
		}
		out = append(out, wo)
	}

	c.JSON(http.StatusOK, gin.H{"watches": out})
}

// POST /api/v1/travel/check — manual trigger (same logic as the cron)
func (h *TravelHandler) Check(c *gin.Context) {
	ctx := context.Background()
	results := gin.H{}

	flightResult, err := h.scraper.ScrapeFlights(ctx)
	if err != nil {
		log.Printf("Travel check (manual): flights error: %v", err)
		results["flights"] = gin.H{"error": err.Error()}
	} else if flightResult.Error != "" {
		log.Printf("Travel check (manual): flights scraper error: %s", flightResult.Error)
		results["flights"] = gin.H{"error": flightResult.Error}
	} else if len(flightResult.Prices) > 0 {
		min := flightResult.Prices[0]
		for _, p := range flightResult.Prices[1:] {
			if p.Price < min.Price {
				min = p
			}
		}
		if err := h.store.AddTravelPrice(ctx, models.TravelPrice{
			WatchID:  "watch-den-cdg-sep26",
			Price:    min.Price,
			Currency: "USD",
			Details:  min.Details,
		}); err != nil {
			results["flights"] = gin.H{"error": err.Error()}
		} else {
			log.Printf("Travel check (manual): flights min=$%.0f", min.Price)
			results["flights"] = gin.H{"min_price": min.Price, "count": len(flightResult.Prices)}
		}
	} else {
		results["flights"] = gin.H{"count": 0}
	}

	ticketResult, err := h.scraper.ScrapeTickets(ctx)
	if err != nil {
		log.Printf("Travel check (manual): tickets error: %v", err)
		results["tickets"] = gin.H{"error": err.Error()}
	} else if ticketResult.Error != "" {
		log.Printf("Travel check (manual): tickets scraper error: %s", ticketResult.Error)
		results["tickets"] = gin.H{"error": ticketResult.Error}
	} else if len(ticketResult.Prices) > 0 {
		min := ticketResult.Prices[0]
		for _, p := range ticketResult.Prices[1:] {
			if p.Price < min.Price {
				min = p
			}
		}
		if err := h.store.AddTravelPrice(ctx, models.TravelPrice{
			WatchID:  "watch-celine-paris-sep26",
			Price:    min.Price,
			Currency: "USD",
			Details:  min.Details,
		}); err != nil {
			results["tickets"] = gin.H{"error": err.Error()}
		} else {
			log.Printf("Travel check (manual): tickets min=$%.0f", min.Price)
			results["tickets"] = gin.H{"min_price": min.Price, "count": len(ticketResult.Prices)}
		}
	} else {
		results["tickets"] = gin.H{"count": 0, "note": "no listings found yet"}
	}

	lvResult, err := h.scraper.ScrapeLasVegasFlights(ctx)
	if err != nil {
		results["lasvegas"] = gin.H{"error": err.Error()}
	} else if lvResult.Error != "" {
		results["lasvegas"] = gin.H{"error": lvResult.Error}
	} else if len(lvResult.Prices) > 0 {
		min := lvResult.Prices[0]
		for _, p := range lvResult.Prices[1:] {
			if p.Price < min.Price {
				min = p
			}
		}
		if err := h.store.AddTravelPrice(ctx, models.TravelPrice{
			WatchID:  "watch-den-las-nov26",
			Price:    min.Price,
			Currency: "USD",
			Details:  min.Details,
		}); err != nil {
			results["lasvegas"] = gin.H{"error": err.Error()}
		} else {
			results["lasvegas"] = gin.H{"min_price": min.Price, "count": len(lvResult.Prices)}
		}
	} else {
		results["lasvegas"] = gin.H{"count": 0}
	}

	lisaResult, err := h.scraper.ScrapeLisaTickets(ctx)
	if err != nil {
		results["lisa"] = gin.H{"error": err.Error()}
	} else if lisaResult.Error != "" {
		results["lisa"] = gin.H{"error": lisaResult.Error}
	} else if len(lisaResult.Prices) > 0 {
		min := lisaResult.Prices[0]
		for _, p := range lisaResult.Prices[1:] {
			if p.Price < min.Price {
				min = p
			}
		}
		if err := h.store.AddTravelPrice(ctx, models.TravelPrice{
			WatchID:  "watch-lisa-vegas-nov26",
			Price:    min.Price,
			Currency: "USD",
			Details:  min.Details,
		}); err != nil {
			results["lisa"] = gin.H{"error": err.Error()}
		} else {
			results["lisa"] = gin.H{"min_price": min.Price, "count": len(lisaResult.Prices)}
		}
	} else {
		results["lisa"] = gin.H{"count": 0}
	}

	baltResult, err := h.scraper.ScrapeBaltimoreFligths(ctx)
	if err != nil {
		results["baltimore"] = gin.H{"error": err.Error()}
	} else if baltResult.Error != "" {
		results["baltimore"] = gin.H{"error": baltResult.Error}
	} else if len(baltResult.Prices) > 0 {
		min := baltResult.Prices[0]
		for _, p := range baltResult.Prices[1:] {
			if p.Price < min.Price {
				min = p
			}
		}
		if err := h.store.AddTravelPrice(ctx, models.TravelPrice{
			WatchID:  "watch-den-bwi-aug26",
			Price:    min.Price,
			Currency: "USD",
			Details:  min.Details,
		}); err != nil {
			results["baltimore"] = gin.H{"error": err.Error()}
		} else {
			results["baltimore"] = gin.H{"min_price": min.Price, "count": len(baltResult.Prices)}
		}
	} else {
		results["baltimore"] = gin.H{"count": 0}
	}

	c.JSON(http.StatusOK, results)
}

// POST /api/v1/travel/:watchId/price — manually log a price observation
func (h *TravelHandler) LogPrice(c *gin.Context) {
	watchID := c.Param("watchId")
	var body struct {
		Price  float64        `json:"price" binding:"required"`
		Notes  string         `json:"notes"`
		Stops  string         `json:"stops"` // e.g. "nonstop", "1 stop"
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	details := map[string]any{}
	if body.Notes != "" {
		details["notes"] = body.Notes
	}
	if body.Stops != "" {
		details["stops"] = body.Stops
	}
	details["source"] = "manual"
	if err := h.store.AddTravelPrice(c.Request.Context(), models.TravelPrice{
		WatchID:  watchID,
		Price:    body.Price,
		Currency: "USD",
		Details:  details,
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}
