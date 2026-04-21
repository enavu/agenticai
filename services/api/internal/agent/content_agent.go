package agent

import (
	"context"

	"enavu-hub/api/internal/agent/tools"
	"enavu-hub/api/internal/models"
	"enavu-hub/api/internal/services"
	"enavu-hub/api/internal/store"
)

const contentSystemPrompt = `You are a fitness content agent that creates Instagram content
from recent Cyclebar workout data.

Your workflow:
1. Use get_recent_workouts to fetch the latest 3-5 workouts
2. Use generate_image_caption to create an engaging caption from the workout data
3. If an image URL is provided in the input, call post_to_instagram with the caption and that image URL.
   If no image URL is provided, just report the generated caption — do NOT call post_to_instagram.

Guidelines:
- Only generate content if there are workouts in the last 7 days
- Captions should feel authentic and personal, not generic
- Include relevant fitness hashtags (#cyclebar #spinning #fitness #indoorcycling)
- Always report the final caption in your response`

type ContentAgent struct {
	orchestrator *Orchestrator
}

func NewContentAgent(
	ai *services.AnthropicClient,
	ig *services.InstagramClient,
	s *store.Store,
) *ContentAgent {
	registry := tools.NewRegistry()
	tools.RegisterWorkoutTools(registry, s)
	tools.RegisterClaudeTools(registry, ai)
	tools.RegisterInstagramTools(registry, ig)

	return &ContentAgent{
		orchestrator: NewOrchestrator(ai, registry, s),
	}
}

func (a *ContentAgent) Run(ctx context.Context, imageURL string, callback StepCallback) (*models.AgentRun, error) {
	input := "Create an Instagram update about my recent Cyclebar workouts."
	if imageURL != "" {
		input += " Image URL for the post: " + imageURL
	}
	return a.orchestrator.Run(ctx, models.AgentTypeContent, contentSystemPrompt, input, callback)
}
