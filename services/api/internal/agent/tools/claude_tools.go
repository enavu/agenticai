package tools

import (
	"context"
	"fmt"

	"github.com/anthropics/anthropic-sdk-go"

	"enavu-hub/api/internal/services"
)

// RegisterClaudeTools adds an inner Claude tool for caption generation.
func RegisterClaudeTools(r *Registry, ai *services.AnthropicClient) {
	ctx := context.Background()

	r.Register(ToolDef{
		Name:        "generate_image_caption",
		Description: "Use AI to generate an engaging Instagram caption from workout data.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"workout_summary": map[string]any{
					"type":        "string",
					"description": "JSON or text summary of the recent workouts to base the caption on.",
				},
				"tone": map[string]any{
					"type":        "string",
					"description": "Desired tone: motivational, casual, humorous, reflective",
					"enum":        []string{"motivational", "casual", "humorous", "reflective"},
				},
			},
			"required": []string{"workout_summary"},
		},
	}, func(input map[string]any) (string, error) {
		summary := Str(input, "workout_summary")
		tone := Str(input, "tone")
		if tone == "" {
			tone = "motivational"
		}

		systemPrompt := fmt.Sprintf(`You are a fitness content creator writing Instagram captions for Cyclebar spin classes.
Write engaging, authentic captions that reflect real workout energy.
Tone: %s
Keep it under 300 characters plus 5-8 relevant hashtags.
Output only the caption text + hashtags, nothing else.`, tone)

		resp, err := ai.CreateMessage(ctx, anthropic.MessageNewParams{
			Model:     anthropic.Model(ai.Model()),
			MaxTokens: 500,
			System:    []anthropic.TextBlockParam{{Text: systemPrompt}},
			Messages: []anthropic.MessageParam{
				anthropic.NewUserMessage(anthropic.NewTextBlock(
					fmt.Sprintf("Write a caption for these workouts:\n%s", summary),
				)),
			},
		})
		if err != nil {
			return "", fmt.Errorf("caption generation failed: %w", err)
		}

		for _, block := range resp.Content {
			if v, ok := block.AsAny().(anthropic.TextBlock); ok && v.Text != "" {
				return v.Text, nil
			}
		}
		return "", fmt.Errorf("no text content in response")
	})
}
