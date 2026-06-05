package handlers

import (
	"context"
	"log"
	"net/http"
	"time"

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
		ID           string               `json:"id"`
		Label        string               `json:"label"`
		Type         string               `json:"type"`
		LatestPrice  *float64             `json:"latest_price"`
		LatestPrices []models.TravelPrice `json:"latest_prices"` // all results from most recent check
		History      []models.TravelPrice `json:"history"`       // 90 days for analytics
	}

	out := make([]watchOut, 0, len(watches))
	for _, w := range watches {
		// 90 days for day-of-week pattern analysis
		history, err := h.store.GetPriceHistory(ctx, w.ID, 90)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		if history == nil {
			history = []models.TravelPrice{}
		}

		// latest_prices: all entries from the most recent check run (within 10 min of newest)
		latestPrices := []models.TravelPrice{}
		if len(history) > 0 {
			cutoff := history[0].CheckedAt.Add(-10 * time.Minute)
			for _, p := range history {
				if p.CheckedAt.After(cutoff) {
					latestPrices = append(latestPrices, p)
				} else {
					break
				}
			}
		}

		wo := watchOut{
			ID:           w.ID,
			Label:        w.Label,
			Type:         w.Type,
			History:      history,
			LatestPrices: latestPrices,
		}
		if len(latestPrices) > 0 {
			min := latestPrices[0].Price
			for _, p := range latestPrices[1:] {
				if p.Price < min {
					min = p.Price
				}
			}
			wo.LatestPrice = &min
		}
		out = append(out, wo)
	}

	c.JSON(http.StatusOK, gin.H{"watches": out})
}

// storeAll saves every price result for a watch (flight options, not just min)
func (h *TravelHandler) storeAll(ctx context.Context, watchID string, prices []services.ScrapedPrice) error {
	for _, p := range prices {
		if err := h.store.AddTravelPrice(ctx, models.TravelPrice{
			WatchID:  watchID,
			Price:    p.Price,
			Currency: "USD",
			Details:  p.Details,
		}); err != nil {
			return err
		}
	}
	return nil
}

// storeMin saves only the cheapest result (for tickets where we track best available)
func (h *TravelHandler) storeMin(ctx context.Context, watchID string, prices []services.ScrapedPrice) (float64, error) {
	min := prices[0]
	for _, p := range prices[1:] {
		if p.Price < min.Price {
			min = p
		}
	}
	return min.Price, h.store.AddTravelPrice(ctx, models.TravelPrice{
		WatchID:  watchID,
		Price:    min.Price,
		Currency: "USD",
		Details:  min.Details,
	})
}

// POST /api/v1/travel/check — manual trigger (same logic as the cron)
func (h *TravelHandler) Check(c *gin.Context) {
	ctx := context.Background()
	results := gin.H{}

	// Flights: store ALL nonstop options found
	flightResult, err := h.scraper.ScrapeFlights(ctx)
	if err != nil {
		log.Printf("Travel check: flights error: %v", err)
		results["flights"] = gin.H{"error": err.Error()}
	} else if flightResult.Error != "" {
		results["flights"] = gin.H{"error": flightResult.Error}
	} else if len(flightResult.Prices) > 0 {
		if err := h.storeAll(ctx, "watch-den-cdg-sep26", flightResult.Prices); err != nil {
			results["flights"] = gin.H{"error": err.Error()}
		} else {
			log.Printf("Travel check: DEN→CDG %d nonstop options stored", len(flightResult.Prices))
			results["flights"] = gin.H{"count": len(flightResult.Prices)}
		}
	} else {
		results["flights"] = gin.H{"count": 0}
	}

	// Tickets: store min (Celine — single best price)
	ticketResult, err := h.scraper.ScrapeTickets(ctx)
	if err != nil {
		log.Printf("Travel check: tickets error: %v", err)
		results["tickets"] = gin.H{"error": err.Error()}
	} else if ticketResult.Error != "" {
		results["tickets"] = gin.H{"error": ticketResult.Error}
	} else if len(ticketResult.Prices) > 0 {
		minP, err := h.storeMin(ctx, "watch-celine-paris-sep26", ticketResult.Prices)
		if err != nil {
			results["tickets"] = gin.H{"error": err.Error()}
		} else {
			log.Printf("Travel check: Celine min=$%.0f", minP)
			results["tickets"] = gin.H{"min_price": minP, "count": len(ticketResult.Prices)}
		}
	} else {
		results["tickets"] = gin.H{"count": 0}
	}

	// Las Vegas flights: store ALL nonstop options
	lvResult, err := h.scraper.ScrapeLasVegasFlights(ctx)
	if err != nil {
		results["lasvegas"] = gin.H{"error": err.Error()}
	} else if lvResult.Error != "" {
		results["lasvegas"] = gin.H{"error": lvResult.Error}
	} else if len(lvResult.Prices) > 0 {
		if err := h.storeAll(ctx, "watch-den-las-nov26", lvResult.Prices); err != nil {
			results["lasvegas"] = gin.H{"error": err.Error()}
		} else {
			results["lasvegas"] = gin.H{"count": len(lvResult.Prices)}
		}
	} else {
		results["lasvegas"] = gin.H{"count": 0}
	}

	// Lisa tickets: store min
	lisaResult, err := h.scraper.ScrapeLisaTickets(ctx)
	if err != nil {
		results["lisa"] = gin.H{"error": err.Error()}
	} else if lisaResult.Error != "" {
		results["lisa"] = gin.H{"error": lisaResult.Error}
	} else if len(lisaResult.Prices) > 0 {
		minP, err := h.storeMin(ctx, "watch-lisa-vegas-nov26", lisaResult.Prices)
		if err != nil {
			results["lisa"] = gin.H{"error": err.Error()}
		} else {
			results["lisa"] = gin.H{"min_price": minP, "count": len(lisaResult.Prices)}
		}
	} else {
		results["lisa"] = gin.H{"count": 0}
	}

	// Baltimore flights: store ALL nonstop options
	baltResult, err := h.scraper.ScrapeBaltimoreFligths(ctx)
	if err != nil {
		results["baltimore"] = gin.H{"error": err.Error()}
	} else if baltResult.Error != "" {
		results["baltimore"] = gin.H{"error": baltResult.Error}
	} else if len(baltResult.Prices) > 0 {
		if err := h.storeAll(ctx, "watch-den-bwi-aug26", baltResult.Prices); err != nil {
			results["baltimore"] = gin.H{"error": err.Error()}
		} else {
			results["baltimore"] = gin.H{"count": len(baltResult.Prices)}
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
		Price float64 `json:"price" binding:"required"`
		Notes string  `json:"notes"`
		Stops string  `json:"stops"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	details := map[string]any{"source": "manual", "stops": "nonstop"}
	if body.Notes != "" {
		details["notes"] = body.Notes
	}
	if body.Stops != "" {
		details["stops"] = body.Stops
	}
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
