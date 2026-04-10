package agent

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/anthropics/anthropic-sdk-go"

	"enavu-hub/api/internal/agent/tools"
	"enavu-hub/api/internal/models"
	"enavu-hub/api/internal/services"
	"enavu-hub/api/internal/store"
)

const maxSteps = 20

// StepCallback is called after each ReAct step.
type StepCallback func(run *models.AgentRun)

// Orchestrator runs a ReAct (think → act → observe) loop.
type Orchestrator struct {
	ai       *services.AnthropicClient
	registry *tools.Registry
	store    *store.Store
}

func NewOrchestrator(ai *services.AnthropicClient, reg *tools.Registry, s *store.Store) *Orchestrator {
	return &Orchestrator{ai: ai, registry: reg, store: s}
}

func (o *Orchestrator) Run(
	ctx context.Context,
	agentType models.AgentType,
	systemPrompt, userInput string,
	callback StepCallback,
) (*models.AgentRun, error) {
	run := &models.AgentRun{
		AgentType: agentType,
		Status:    models.AgentRunStatusRunning,
		Input:     userInput,
	}
	if err := o.store.CreateAgentRun(ctx, run); err != nil {
		return nil, fmt.Errorf("create agent run: %w", err)
	}

	apiTools := o.buildAPITools()
	messages := []anthropic.MessageParam{
		anthropic.NewUserMessage(anthropic.NewTextBlock(userInput)),
	}

	stepIdx := 0
	for stepIdx < maxSteps {
		resp, err := o.ai.CreateMessage(ctx, anthropic.MessageNewParams{
			Model:     anthropic.Model(o.ai.Model()),
			MaxTokens: 4096,
			System:    []anthropic.TextBlockParam{{Text: systemPrompt}},
			Tools:     apiTools,
			Messages:  messages,
		})
		if err != nil {
			errStr := err.Error()
			run.Status = models.AgentRunStatusFailed
			run.Error = &errStr
			now := time.Now()
			run.CompletedAt = &now
			o.store.UpdateAgentRun(ctx, run)
			return run, err
		}

		// Add assistant turn to history using the SDK's ToParam()
		messages = append(messages, resp.ToParam())

		// Process content blocks
		var toolResults []anthropic.ContentBlockParamUnion
		for _, block := range resp.Content {
			switch v := block.AsAny().(type) {
			case anthropic.TextBlock:
				if v.Text == "" {
					continue
				}
				run.Steps = append(run.Steps, models.AgentStep{
					Index:     stepIdx,
					Type:      "thinking",
					Content:   v.Text,
					Timestamp: time.Now(),
				})
				stepIdx++
				o.store.UpdateAgentRun(ctx, run)
				if callback != nil {
					callback(run)
				}

			case anthropic.ToolUseBlock:
				inputBytes, _ := json.Marshal(v.Input)
				inputStr := string(inputBytes)
				toolName := v.Name

				var toolInput map[string]any
				json.Unmarshal(inputBytes, &toolInput)

				result, execErr := o.registry.Execute(v.Name, toolInput)
				if execErr != nil {
					result = fmt.Sprintf("Error: %v", execErr)
					log.Printf("[agent] tool %s error: %v", v.Name, execErr)
				}

				run.Steps = append(run.Steps, models.AgentStep{
					Index:      stepIdx,
					Type:       "tool_call",
					Content:    fmt.Sprintf("Calling tool: %s", v.Name),
					ToolName:   &toolName,
					ToolInput:  &inputStr,
					ToolResult: &result,
					Timestamp:  time.Now(),
				})
				stepIdx++
				o.store.UpdateAgentRun(ctx, run)
				if callback != nil {
					callback(run)
				}

				toolResults = append(toolResults,
					anthropic.NewToolResultBlock(v.ID, result, false))
			}
		}

		// No tool calls → done
		if len(toolResults) == 0 {
			finalText := extractText(resp.Content)
			run.Output = &finalText
			run.Steps = append(run.Steps, models.AgentStep{
				Index:     stepIdx,
				Type:      "final",
				Content:   finalText,
				Timestamp: time.Now(),
			})
			break
		}

		// Add tool results as next user turn
		messages = append(messages, anthropic.NewUserMessage(toolResults...))
	}

	now := time.Now()
	run.Status = models.AgentRunStatusCompleted
	run.CompletedAt = &now
	o.store.UpdateAgentRun(ctx, run)
	if callback != nil {
		callback(run)
	}
	return run, nil
}

func (o *Orchestrator) buildAPITools() []anthropic.ToolUnionParam {
	defs := o.registry.Definitions()
	out := make([]anthropic.ToolUnionParam, 0, len(defs))
	for _, d := range defs {
		props, _ := d.InputSchema["properties"]
		toolParam := anthropic.ToolParam{
			Name:        d.Name,
			Description: anthropic.String(d.Description),
			InputSchema: anthropic.ToolInputSchemaParam{
				Properties: props,
			},
		}
		out = append(out, anthropic.ToolUnionParam{OfTool: &toolParam})
	}
	return out
}

func extractText(blocks []anthropic.ContentBlockUnion) string {
	for _, b := range blocks {
		if v, ok := b.AsAny().(anthropic.TextBlock); ok && v.Text != "" {
			return v.Text
		}
	}
	return ""
}
