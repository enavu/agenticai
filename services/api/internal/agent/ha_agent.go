package agent

import (
	"context"

	"enavu-hub/api/internal/agent/tools"
	"enavu-hub/api/internal/models"
	"enavu-hub/api/internal/services"
	"enavu-hub/api/internal/store"
)

const haSystemPrompt = `You are an intelligent Home Assistant controller for a smart home.
You have access to tools to query and control Home Assistant entities.

Guidelines:
- Always check the current state before making changes
- Be concise in your final response — the user wants results, not verbose explanations
- When multiple entities need to change, call tools in sequence
- If an entity doesn't exist, say so clearly
- For "rest mode" or "wind down", dim lights to ~10% brightness
- Always confirm what actions you took

Current home: hotel89408.com`

type HAAgent struct {
	orchestrator *Orchestrator
}

func NewHAAgent(ai *services.AnthropicClient, ha *services.HAClient, s *store.Store) *HAAgent {
	registry := tools.NewRegistry()
	tools.RegisterHATools(registry, ha)
	return &HAAgent{
		orchestrator: NewOrchestrator(ai, registry, s),
	}
}

func (a *HAAgent) Run(ctx context.Context, userInput string, callback StepCallback) (*models.AgentRun, error) {
	return a.orchestrator.Run(ctx, models.AgentTypeHA, haSystemPrompt, userInput, callback)
}
