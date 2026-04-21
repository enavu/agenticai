package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"

	"enavu-hub/api/internal/models"
	"enavu-hub/api/internal/store"
)

type FinanceHandler struct {
	store *store.Store
}

func NewFinanceHandler(s *store.Store) *FinanceHandler {
	return &FinanceHandler{store: s}
}

// computeStatus derives payment status from amounts and dates automatically.
func computeStatus(amountExpected, amountPaid float64, dueDate time.Time, paidDate *time.Time) models.PaymentStatus {
	if paidDate == nil || amountPaid == 0 {
		return models.PaymentMissed
	}
	if amountPaid < amountExpected {
		return models.PaymentPartial
	}
	if !paidDate.After(dueDate) {
		return models.PaymentOnTime
	}
	return models.PaymentLate
}

// GET /api/v1/finance
func (h *FinanceHandler) Get(c *gin.Context) {
	ctx := c.Request.Context()

	agreement, err := h.store.GetLeaseAgreement(ctx)
	if err == pgx.ErrNoRows {
		c.JSON(http.StatusOK, gin.H{"agreement": nil, "payments": []any{}, "stats": nil})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	payments, err := h.store.ListLeasePayments(ctx, agreement.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if payments == nil {
		payments = []models.LeasePayment{}
	}

	stats, err := h.store.GetLeaseStats(ctx, agreement.ID, agreement.TotalAmount)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"agreement": agreement,
		"payments":  payments,
		"stats":     stats,
	})
}

// POST /api/v1/finance/setup — one-time agreement creation.
func (h *FinanceHandler) Setup(c *gin.Context) {
	var body struct {
		Name            string  `json:"name" binding:"required"`
		PersonName      string  `json:"person_name" binding:"required"`
		TotalAmount     float64 `json:"total_amount" binding:"required"`
		StartDate       string  `json:"start_date" binding:"required"`
		EndDate         string  `json:"end_date" binding:"required"`
		ExpectedMonthly float64 `json:"expected_monthly"`
		PaymentDay      int     `json:"payment_day"` // defaults to 15 if omitted
		Notes           string  `json:"notes"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	start, err := time.Parse("2006-01-02", body.StartDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid start_date, use YYYY-MM-DD"})
		return
	}
	end, err := time.Parse("2006-01-02", body.EndDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid end_date, use YYYY-MM-DD"})
		return
	}

	paymentDay := body.PaymentDay
	if paymentDay < 1 || paymentDay > 28 {
		paymentDay = 15
	}

	a := &models.LeaseAgreement{
		Name:            body.Name,
		PersonName:      body.PersonName,
		TotalAmount:     body.TotalAmount,
		StartDate:       start,
		EndDate:         end,
		ExpectedMonthly: body.ExpectedMonthly,
		PaymentDay:      paymentDay,
		Notes:           body.Notes,
	}
	if err := h.store.CreateLeaseAgreement(c.Request.Context(), a); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, a)
}

// POST /api/v1/finance/payments — log a payment; status is auto-computed.
func (h *FinanceHandler) LogPayment(c *gin.Context) {
	ctx := c.Request.Context()

	agreement, err := h.store.GetLeaseAgreement(ctx)
	if err == pgx.ErrNoRows {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no agreement found — run setup first"})
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var body struct {
		AmountExpected float64 `json:"amount_expected" binding:"required"`
		AmountPaid     float64 `json:"amount_paid"`
		DueDate        string  `json:"due_date" binding:"required"`
		PaidDate       string  `json:"paid_date"` // empty = missed
		Notes          string  `json:"notes"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	dueDate, err := time.Parse("2006-01-02", body.DueDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid due_date, use YYYY-MM-DD"})
		return
	}

	p := &models.LeasePayment{
		AgreementID:    agreement.ID,
		AmountExpected: body.AmountExpected,
		AmountPaid:     body.AmountPaid,
		DueDate:        dueDate,
		Notes:          body.Notes,
	}
	if body.PaidDate != "" {
		t, err := time.Parse("2006-01-02", body.PaidDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid paid_date, use YYYY-MM-DD"})
			return
		}
		p.PaidDate = &t
	}

	p.Status = computeStatus(p.AmountExpected, p.AmountPaid, dueDate, p.PaidDate)

	if err := h.store.CreateLeasePayment(ctx, p); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, p)
}

// PUT /api/v1/finance/payments/:id — edit a payment; status is re-computed.
func (h *FinanceHandler) UpdatePayment(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.Param("id")

	var body struct {
		AmountExpected float64 `json:"amount_expected" binding:"required"`
		AmountPaid     float64 `json:"amount_paid"`
		DueDate        string  `json:"due_date" binding:"required"`
		PaidDate       string  `json:"paid_date"`
		Notes          string  `json:"notes"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	dueDate, err := time.Parse("2006-01-02", body.DueDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid due_date, use YYYY-MM-DD"})
		return
	}

	var paidDate *time.Time
	if body.PaidDate != "" {
		t, err := time.Parse("2006-01-02", body.PaidDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid paid_date, use YYYY-MM-DD"})
			return
		}
		paidDate = &t
	}

	status := computeStatus(body.AmountExpected, body.AmountPaid, dueDate, paidDate)

	if err := h.store.UpdateLeasePayment(ctx, id, body.AmountExpected, body.AmountPaid, dueDate, paidDate, status, body.Notes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": id, "status": string(status)})
}
