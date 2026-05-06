package models

import "time"

type HAInsight struct {
	ID        string    `json:"id"`
	Date      string    `json:"date"` // YYYY-MM-DD
	Summary   string    `json:"summary"`
	CreatedAt time.Time `json:"created_at"`
}
