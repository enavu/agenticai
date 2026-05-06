package handlers

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strings"
	"time"

	anthropic "github.com/anthropics/anthropic-sdk-go"
	"github.com/gin-gonic/gin"

	"enavu-hub/api/internal/models"
	"enavu-hub/api/internal/services"
	"enavu-hub/api/internal/store"
)

type PlaidHandler struct {
	store  *store.Store
	plaid  *services.PlaidClient
	ai     *services.AnthropicClient
}

func NewPlaidHandler(s *store.Store, plaid *services.PlaidClient, ai *services.AnthropicClient) *PlaidHandler {
	return &PlaidHandler{store: s, plaid: plaid, ai: ai}
}

// POST /api/v1/plaid/link-token
func (h *PlaidHandler) LinkToken(c *gin.Context) {
	token, err := h.plaid.CreateLinkToken(c.Request.Context(), "enavu-user")
	if err != nil {
		log.Printf("Plaid link token: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"link_token": token})
}

// POST /api/v1/plaid/exchange
func (h *PlaidHandler) Exchange(c *gin.Context) {
	var body struct {
		PublicToken string `json:"public_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx := c.Request.Context()
	accessToken, itemID, err := h.plaid.ExchangePublicToken(ctx, body.PublicToken)
	if err != nil {
		log.Printf("Plaid exchange: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	institutionName := h.plaid.GetInstitutionName(ctx, accessToken)

	if err := h.store.UpsertPlaidItem(ctx, itemID, accessToken, institutionName); err != nil {
		log.Printf("Plaid store item: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	log.Printf("Plaid: connected %s (%s)", institutionName, itemID)
	c.JSON(http.StatusOK, gin.H{"institution": institutionName, "item_id": itemID})
}

// POST /api/v1/plaid/sync — pull last 90 days of transactions
func (h *PlaidHandler) Sync(c *gin.Context) {
	ctx := c.Request.Context()
	item, err := h.store.GetPlaidItem(ctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no account connected"})
		return
	}

	end := time.Now()
	start := end.AddDate(0, 0, -90)

	rawTxns, err := h.plaid.GetTransactions(ctx, item.AccessToken, start, end)
	if err != nil {
		log.Printf("Plaid sync: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var txns []models.PlaidTransaction
	for _, t := range rawTxns {
		txns = append(txns, models.PlaidTransaction{
			ID:           t.ID,
			ItemID:       item.ItemID,
			AccountID:    t.AccountID,
			Amount:       t.Amount,
			Date:         t.Date,
			Name:         t.Name,
			MerchantName: t.MerchantName,
			Category:     t.Category,
			Pending:      t.Pending,
		})
	}

	inserted, err := h.store.BulkUpsertPlaidTransactions(ctx, txns)
	if err != nil {
		log.Printf("Plaid bulk upsert: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	log.Printf("Plaid sync: %d transactions synced (%d stored)", len(txns), inserted)
	c.JSON(http.StatusOK, gin.H{"synced": len(txns), "stored": inserted})
}

// GET /api/v1/plaid/spending — spending breakdown + AI insights
func (h *PlaidHandler) Spending(c *gin.Context) {
	ctx := c.Request.Context()

	// Check if connected
	item, err := h.store.GetPlaidItem(ctx)
	if err != nil || item == nil {
		c.JSON(http.StatusOK, models.SpendingInsight{Connected: false})
		return
	}

	txns, err := h.store.GetPlaidTransactions(ctx, 90)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Build category totals (use top-level Plaid category)
	catMap := map[string]struct{ total float64; count int }{}
	var totalSpent float64
	for _, t := range txns {
		if t.Amount <= 0 {
			continue // credits/refunds
		}
		cat := "Other"
		if len(t.Category) > 0 {
			cat = t.Category[0]
		}
		entry := catMap[cat]
		entry.total += t.Amount
		entry.count++
		catMap[cat] = entry
		totalSpent += t.Amount
	}

	categories := make([]models.SpendingCategory, 0, len(catMap))
	for cat, v := range catMap {
		categories = append(categories, models.SpendingCategory{
			Category: cat,
			Total:    v.total,
			Count:    v.count,
		})
	}
	sort.Slice(categories, func(i, j int) bool {
		return categories[i].Total > categories[j].Total
	})

	// AI insights
	aiInsights := generateSpendingInsights(ctx, h.ai, categories, txns, totalSpent)

	c.JSON(http.StatusOK, models.SpendingInsight{
		Connected:    true,
		Categories:   categories,
		AIInsights:   aiInsights,
		PeriodDays:   90,
		TotalSpent:   totalSpent,
		Transactions: txns,
	})
}

func generateSpendingInsights(ctx context.Context, ai *services.AnthropicClient, categories []models.SpendingCategory, txns []models.PlaidTransaction, totalSpent float64) string {
	if ai == nil || len(categories) == 0 {
		return ""
	}

	// Build a concise spending summary for Claude
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Here is my spending for the last 90 days (total: $%.0f):\n\n", totalSpent))
	sb.WriteString("Spending by category:\n")
	for _, cat := range categories {
		pct := 0.0
		if totalSpent > 0 {
			pct = (cat.Total / totalSpent) * 100
		}
		sb.WriteString(fmt.Sprintf("- %s: $%.0f (%.1f%%, %d transactions)\n", cat.Category, cat.Total, pct, cat.Count))
	}

	// Add top 10 merchants
	merchantMap := map[string]float64{}
	for _, t := range txns {
		if t.Amount <= 0 {
			continue
		}
		name := t.MerchantName
		if name == "" {
			name = t.Name
		}
		merchantMap[name] += t.Amount
	}
	type merchant struct{ name string; total float64 }
	var merchants []merchant
	for name, total := range merchantMap {
		merchants = append(merchants, merchant{name, total})
	}
	sort.Slice(merchants, func(i, j int) bool { return merchants[i].total > merchants[j].total })

	sb.WriteString("\nTop merchants:\n")
	limit := 10
	if len(merchants) < limit {
		limit = len(merchants)
	}
	for _, m := range merchants[:limit] {
		sb.WriteString(fmt.Sprintf("- %s: $%.0f\n", m.name, m.total))
	}

	prompt := sb.String() + `
Based on this spending data, give me 3-5 concise, actionable insights about:
1. Which categories I should slow down or cut back on (be specific with dollar amounts)
2. Any patterns that stand out (unusually high spend relative to what's typical)
3. One category where I'm doing well or could optimize

Be direct and specific. No fluff. Format as bullet points. Each bullet should be 1-2 sentences max.`

	msg, err := ai.CreateMessage(ctx, anthropic.MessageNewParams{
		Model:     anthropic.Model(ai.Model()),
		MaxTokens: 1024,
		Messages:  []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock(prompt))},
	})
	if err != nil {
		log.Printf("Plaid AI insights: %v", err)
		return ""
	}
	for _, block := range msg.Content {
		if v, ok := block.AsAny().(anthropic.TextBlock); ok && v.Text != "" {
			return v.Text
		}
	}
	return ""
}
