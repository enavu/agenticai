package models

import "time"

type AgentType string
type AgentRunStatus string

const (
	AgentTypeHA      AgentType = "ha"
	AgentTypeContent AgentType = "content"

	AgentRunStatusRunning   AgentRunStatus = "running"
	AgentRunStatusCompleted AgentRunStatus = "completed"
	AgentRunStatusFailed    AgentRunStatus = "failed"
)

type AgentRun struct {
	ID          string         `json:"id" db:"id"`
	AgentType   AgentType      `json:"agent_type" db:"agent_type"`
	Status      AgentRunStatus `json:"status" db:"status"`
	Input       string         `json:"input" db:"input"`
	Output      *string        `json:"output,omitempty" db:"output"`
	Steps       []AgentStep    `json:"steps" db:"-"`
	StepsJSON   []byte         `json:"-" db:"steps_json"`
	Error       *string        `json:"error,omitempty" db:"error"`
	StartedAt   time.Time      `json:"started_at" db:"started_at"`
	CompletedAt *time.Time     `json:"completed_at,omitempty" db:"completed_at"`
}

type AgentStep struct {
	Index      int        `json:"index"`
	Type       string     `json:"type"` // "thinking", "tool_call", "tool_result", "final"
	Content    string     `json:"content"`
	ToolName   *string    `json:"tool_name,omitempty"`
	ToolInput  *string    `json:"tool_input,omitempty"`
	ToolResult *string    `json:"tool_result,omitempty"`
	Timestamp  time.Time  `json:"timestamp"`
}
