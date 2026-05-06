package models

import "time"

type TravelWatch struct {
	ID        string         `json:"id"`
	Type      string         `json:"type"`
	Label     string         `json:"label"`
	Config    map[string]any `json:"config"`
	Active    bool           `json:"active"`
	CreatedAt time.Time      `json:"created_at"`
}

type TravelPrice struct {
	ID        string         `json:"id"`
	WatchID   string         `json:"watch_id"`
	Price     float64        `json:"price"`
	Currency  string         `json:"currency"`
	Details   map[string]any `json:"details"`
	CheckedAt time.Time      `json:"checked_at"`
}
