package models

import "time"

type PlaidItem struct {
	ID              string    `json:"id"`
	ItemID          string    `json:"item_id"`
	AccessToken     string    `json:"-"` // never serialized
	InstitutionName string    `json:"institution_name"`
	CreatedAt       time.Time `json:"created_at"`
}

type PlaidTransaction struct {
	ID           string    `json:"id"`
	ItemID       string    `json:"item_id"`
	AccountID    string    `json:"account_id"`
	Amount       float64   `json:"amount"`
	Date         string    `json:"date"` // YYYY-MM-DD
	Name         string    `json:"name"`
	MerchantName string    `json:"merchant_name"`
	Category     []string  `json:"category"`
	Pending      bool      `json:"pending"`
	CreatedAt    time.Time `json:"created_at"`
}

type SpendingCategory struct {
	Category string  `json:"category"`
	Total    float64 `json:"total"`
	Count    int     `json:"count"`
}

type SpendingInsight struct {
	Connected    bool               `json:"connected"`
	Categories   []SpendingCategory `json:"categories"`
	AIInsights   string             `json:"ai_insights"`
	PeriodDays   int                `json:"period_days"`
	TotalSpent   float64            `json:"total_spent"`
	Transactions []PlaidTransaction `json:"transactions"`
}
