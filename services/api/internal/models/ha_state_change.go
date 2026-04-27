package models

import "time"

type HAStateChange struct {
	ID         string         `json:"id"`
	EntityID   string         `json:"entity_id"`
	State      string         `json:"state"`
	Attributes map[string]any `json:"attributes"`
	ChangedAt  time.Time      `json:"changed_at"`
	RecordedAt time.Time      `json:"recorded_at"`
}
