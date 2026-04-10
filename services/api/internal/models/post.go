package models

import "time"

type PostStatus string

const (
	PostStatusDraft     PostStatus = "draft"
	PostStatusPublished PostStatus = "published"
	PostStatusFailed    PostStatus = "failed"
)

type Post struct {
	ID           string     `json:"id" db:"id"`
	Caption      string     `json:"caption" db:"caption"`
	ImageURL     *string    `json:"image_url,omitempty" db:"image_url"`
	InstagramID  *string    `json:"instagram_id,omitempty" db:"instagram_id"`
	Status       PostStatus `json:"status" db:"status"`
	WorkoutIDs   []string   `json:"workout_ids" db:"workout_ids"`
	AgentRunID   *string    `json:"agent_run_id,omitempty" db:"agent_run_id"`
	PublishedAt  *time.Time `json:"published_at,omitempty" db:"published_at"`
	CreatedAt    time.Time  `json:"created_at" db:"created_at"`
}
