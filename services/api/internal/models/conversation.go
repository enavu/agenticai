package models

import "time"

type MessageRole string

const (
	MessageRoleUser      MessageRole = "user"
	MessageRoleAssistant MessageRole = "assistant"
)

type Conversation struct {
	ID        string    `json:"id" db:"id"`
	Messages  []Message `json:"messages" db:"-"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

type Message struct {
	ID             string      `json:"id" db:"id"`
	ConversationID string      `json:"conversation_id" db:"conversation_id"`
	Role           MessageRole `json:"role" db:"role"`
	Content        string      `json:"content" db:"content"`
	AgentRunID     *string     `json:"agent_run_id,omitempty" db:"agent_run_id"`
	CreatedAt      time.Time   `json:"created_at" db:"created_at"`
}
