package agent

import (
	"context"

	"enavu-hub/api/internal/agent/tools"
	"enavu-hub/api/internal/models"
	"enavu-hub/api/internal/services"
	"enavu-hub/api/internal/store"
)

const contentSystemPrompt = `You are a fitness content agent that creates and posts Instagram content
from recent Cyclebar workout data.

Your workflow:
1. Use get_recent_workouts to fetch the latest 3-5 workouts
2. Use generate_image_caption to create an engaging caption from the workout data
3. Use post_to_instagram to publish the caption

Guidelines:
- Only post if there are workouts in the last 7 days
- Captions should feel authentic and personal, not generic
- Include relevant fitness hashtags (#cyclebar #spinning #fitness #indoorcycling)
- Report what was posted in your final message`

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

func (a *ContentAgent) Run(ctx context.Context, callback StepCallback) (*models.AgentRun, error) {
	input := "Create and post an Instagram update about my recent Cyclebar workouts."
	return a.orchestrator.Run(ctx, models.AgentTypeContent, contentSystemPrompt, input, callback)
}
