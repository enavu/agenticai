package agent

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	anthropic "github.com/anthropics/anthropic-sdk-go"

	"enavu-hub/api/internal/services"
	"enavu-hub/api/internal/store"
)

type HAInsightAgent struct {
	ai    *services.AnthropicClient
	store *store.Store
}

func NewHAInsightAgent(ai *services.AnthropicClient, s *store.Store) *HAInsightAgent {
	return &HAInsightAgent{ai: ai, store: s}
}

// Run generates a daily life pattern insight for the given date.
// Call with yesterday's date at 8am to get a full 24h picture.
func (a *HAInsightAgent) Run(ctx context.Context, forDate time.Time) error {
	date := forDate.Format("2006-01-02")
	from := time.Date(forDate.Year(), forDate.Month(), forDate.Day(), 0, 0, 0, 0, forDate.Location())
	to := from.Add(24 * time.Hour)

	// Pull yesterday's activity
	activity, err := a.store.GetHAActivitySummary(ctx, from, to)
	if err != nil {
		return fmt.Errorf("ha insight: fetch activity: %w", err)
	}

	totalEvents := 0
	for _, events := range activity {
		totalEvents += len(events)
	}
	if totalEvents == 0 {
		log.Printf("HA insight: no activity data for %s — skipping", date)
		return nil
	}

	// Also pull prior 7 days for context
	priorFrom := from.AddDate(0, 0, -7)
	priorActivity, _ := a.store.GetHAActivitySummary(ctx, priorFrom, from)

	prompt := buildInsightPrompt(date, activity, priorActivity)

	msg, err := a.ai.CreateMessage(ctx, anthropic.MessageNewParams{
		Model:     anthropic.Model(a.ai.Model()),
		MaxTokens: 1024,
		Messages:  []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock(prompt))},
	})
	if err != nil {
		return fmt.Errorf("ha insight: claude: %w", err)
	}

	var summary string
	for _, block := range msg.Content {
		if v, ok := block.AsAny().(anthropic.TextBlock); ok {
			summary = v.Text
			break
		}
	}
	if summary == "" {
		return fmt.Errorf("ha insight: empty response from claude")
	}

	if err := a.store.UpsertHAInsight(ctx, date, summary); err != nil {
		return fmt.Errorf("ha insight: store: %w", err)
	}

	log.Printf("HA insight: generated for %s (%d events)", date, totalEvents)
	return nil
}

func buildInsightPrompt(date string, today, prior map[string][]map[string]string) string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("You are analyzing home activity data for %s.\n\n", date))
	sb.WriteString("Here is the home sensor activity for the day:\n\n")

	categories := []struct{ key, label string }{
		{"person", "Person/Presence"},
		{"motion", "Motion Sensors"},
		{"door", "Doors & Windows"},
		{"lock", "Locks"},
		{"light", "Lights"},
		{"climate", "Climate & Temperature"},
	}

	for _, cat := range categories {
		events := today[cat.key]
		if len(events) == 0 {
			continue
		}
		sb.WriteString(fmt.Sprintf("**%s** (%d events):\n", cat.label, len(events)))
		// Cap at 40 events per category to keep prompt manageable
		limit := 40
		if len(events) < limit {
			limit = len(events)
		}
		for _, e := range events[:limit] {
			sb.WriteString(fmt.Sprintf("  %s — %s → %s\n", e["time"], e["entity"], e["state"]))
		}
		if len(events) > 40 {
			sb.WriteString(fmt.Sprintf("  ... and %d more events\n", len(events)-40))
		}
		sb.WriteString("\n")
	}

	// Add prior week context
	priorMotion := prior["motion"]
	priorDoor := prior["door"]
	sb.WriteString(fmt.Sprintf("Prior 7-day context: %d motion events, %d door events (for pattern comparison).\n\n", len(priorMotion), len(priorDoor)))

	sb.WriteString(`Based on this data, write a concise daily home briefing. Infer meaningful patterns:
- Estimated wake time (first bedroom/hallway motion)
- Estimated departure time (door + no motion after)
- Estimated return time (door open + motion resumes)
- Estimated sleep time (lights off, no motion)
- Any anomalies or unusual events (late night door opens, unusual activity times, etc.)
- Climate or energy notes if relevant

Write it as a natural paragraph or two — like a personal daily digest. Be specific with times.
If data is sparse or ambiguous, say so briefly. Do not mention sensor IDs directly — translate them to plain English (e.g. "front door", "bedroom", "living room").
Keep it under 200 words.`)

	return sb.String()
}
