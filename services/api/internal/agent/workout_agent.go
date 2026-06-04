package agent

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	anthropic "github.com/anthropics/anthropic-sdk-go"

	"enavu-hub/api/internal/models"
	"enavu-hub/api/internal/services"
	"enavu-hub/api/internal/store"
)

const workoutSystemPrompt = `You are a sharp, direct personal fitness coach. 
Analyze the workout pattern data and write ONE insight (2–4 sentences max).

Rules:
- Be specific: use real numbers, dates, instructor names from the data
- Detect boredom: same instructor 80%+ of the time → suggest trying someone new
- Detect overtraining: workouts every single day with no rest → suggest active recovery
- Detect drift: avg gap > 4 days or missed many this month → light nudge, not guilt
- Detect a rut: only 1–2 class varieties → suggest trying a different class type
- Detect greatness: strong streak or low days-missed → acknowledge it specifically
- Never be preachy. One concrete observation + one concrete suggestion.
- Write as plain text, no markdown, no bullet points.`

type WorkoutAgent struct {
	ai    *services.AnthropicClient
	store *store.Store
}

func NewWorkoutAgent(ai *services.AnthropicClient, s *store.Store) *WorkoutAgent {
	return &WorkoutAgent{ai: ai, store: s}
}

// Run generates a workout pattern insight and caches it.
func (a *WorkoutAgent) Run(ctx context.Context) (*models.WorkoutInsight, error) {
	patterns, err := a.store.GetWorkoutPatterns(ctx)
	if err != nil {
		return nil, fmt.Errorf("workout agent: get patterns: %w", err)
	}

	prompt := buildWorkoutPrompt(patterns)

	msg, err := a.ai.CreateMessage(ctx, anthropic.MessageNewParams{
		Model:     anthropic.Model(a.ai.Model()),
		MaxTokens: 512,
		System:    []anthropic.TextBlockParam{{Text: workoutSystemPrompt}},
		Messages:  []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock(prompt))},
	})
	if err != nil {
		return nil, fmt.Errorf("workout agent: claude: %w", err)
	}

	var summary string
	for _, block := range msg.Content {
		if v, ok := block.AsAny().(anthropic.TextBlock); ok && v.Text != "" {
			summary = v.Text
			break
		}
	}
	if summary == "" {
		return nil, fmt.Errorf("workout agent: empty response")
	}

	insight, err := a.store.UpsertWorkoutInsight(ctx, summary, patterns)
	if err != nil {
		return nil, fmt.Errorf("workout agent: store: %w", err)
	}

	log.Printf("WorkoutAgent: insight generated (streak=%d, missed=%d, variety=%d instructors)",
		patterns.CurrentStreak, patterns.DaysMissedThisMonth, patterns.InstructorVariety)
	return insight, nil
}

func buildWorkoutPrompt(p *models.WorkoutPatterns) string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("Today: %s\n\n", time.Now().Format("January 2, 2006")))
	sb.WriteString("Workout pattern data (last 30–90 days):\n")
	sb.WriteString(fmt.Sprintf("- Workouts this month: %d\n", p.WorkoutsThisMonth))
	sb.WriteString(fmt.Sprintf("- Days missed this month: %d\n", p.DaysMissedThisMonth))
	sb.WriteString(fmt.Sprintf("- Current streak: %d consecutive days\n", p.CurrentStreak))
	sb.WriteString(fmt.Sprintf("- Days since last workout: %d\n", p.DaysSinceLastWorkout))
	sb.WriteString(fmt.Sprintf("- Avg days between workouts: %.1f\n", p.AvgDaysBetween))
	sb.WriteString(fmt.Sprintf("- Unique instructors (30d): %d\n", p.InstructorVariety))
	sb.WriteString(fmt.Sprintf("- Unique class types (30d): %d\n", p.ClassVariety))
	if p.TopInstructor != "" {
		sb.WriteString(fmt.Sprintf("- Most frequent instructor: %s\n", p.TopInstructor))
	}
	if p.TopClass != "" {
		sb.WriteString(fmt.Sprintf("- Most frequent class: %s\n", p.TopClass))
	}
	sb.WriteString("\nWrite your coach insight now:")
	return sb.String()
}
