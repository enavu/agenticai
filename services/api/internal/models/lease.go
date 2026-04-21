package models

import "time"

type LeaseAgreement struct {
	ID              string    `json:"id"`
	Name            string    `json:"name"`
	PersonName      string    `json:"person_name"`
	TotalAmount     float64   `json:"total_amount"`
	StartDate       time.Time `json:"start_date"`
	EndDate         time.Time `json:"end_date"`
	ExpectedMonthly float64   `json:"expected_monthly"`
	PaymentDay      int       `json:"payment_day"` // day of month payments are due (e.g. 15)
	Notes           string    `json:"notes"`
	CreatedAt       time.Time `json:"created_at"`
}

// PaymentStatus represents how a payment was received.
type PaymentStatus string

const (
	PaymentOnTime  PaymentStatus = "on_time"
	PaymentLate    PaymentStatus = "late"
	PaymentPartial PaymentStatus = "partial"
	PaymentMissed  PaymentStatus = "missed"
)

type LeasePayment struct {
	ID             string        `json:"id"`
	AgreementID    string        `json:"agreement_id"`
	AmountExpected float64       `json:"amount_expected"`
	AmountPaid     float64       `json:"amount_paid"`
	DueDate        time.Time     `json:"due_date"`
	PaidDate       *time.Time    `json:"paid_date"`
	Status         PaymentStatus `json:"status"`
	Notes          string        `json:"notes"`
	CreatedAt      time.Time     `json:"created_at"`
}

// LeaseStats is computed from the payment history.
type LeaseStats struct {
	TotalPaid        float64 `json:"total_paid"`
	Remaining        float64 `json:"remaining"`
	ProgressPct      float64 `json:"progress_pct"`
	ReliabilityScore int     `json:"reliability_score"` // 0–100
	CountOnTime      int     `json:"count_on_time"`
	CountLate        int     `json:"count_late"`
	CountPartial     int     `json:"count_partial"`
	CountMissed      int     `json:"count_missed"`
}
