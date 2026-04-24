package models

import "time"

type HASnapshot struct {
	ID         string           `json:"id"`
	States     []map[string]any `json:"states"`
	CapturedAt time.Time        `json:"captured_at"`
}
