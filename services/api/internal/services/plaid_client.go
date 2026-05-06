package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type PlaidClient struct {
	clientID string
	secret   string
	baseURL  string
}

type PlaidTransactionResult struct {
	ID           string
	AccountID    string
	Amount       float64
	Date         string
	Name         string
	MerchantName string
	Category     []string
	Pending      bool
}

func NewPlaidClient(clientID, secret, env string) *PlaidClient {
	baseURL := "https://sandbox.plaid.com"
	if env == "development" {
		baseURL = "https://development.plaid.com"
	} else if env == "production" {
		baseURL = "https://production.plaid.com"
	}
	return &PlaidClient{clientID: clientID, secret: secret, baseURL: baseURL}
}

func (c *PlaidClient) post(ctx context.Context, path string, body, out any) error {
	b, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path, bytes.NewReader(b))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		var e struct{ ErrorMessage string `json:"error_message"` }
		json.NewDecoder(resp.Body).Decode(&e)
		return fmt.Errorf("plaid %s: %s", path, e.ErrorMessage)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func (c *PlaidClient) authBody() map[string]string {
	return map[string]string{"client_id": c.clientID, "secret": c.secret}
}

// CreateLinkToken creates a Plaid Link token for the frontend.
func (c *PlaidClient) CreateLinkToken(ctx context.Context, userID string) (string, error) {
	body := map[string]any{
		"client_id":    c.clientID,
		"secret":       c.secret,
		"client_name":  "enavu-hub",
		"country_codes": []string{"US"},
		"language":     "en",
		"user":         map[string]string{"client_user_id": userID},
		"products":     []string{"transactions"},
	}
	var resp struct {
		LinkToken string `json:"link_token"`
	}
	if err := c.post(ctx, "/link/token/create", body, &resp); err != nil {
		return "", err
	}
	return resp.LinkToken, nil
}

// ExchangePublicToken exchanges a short-lived public token for a permanent access token.
func (c *PlaidClient) ExchangePublicToken(ctx context.Context, publicToken string) (accessToken, itemID string, err error) {
	body := map[string]string{
		"client_id":    c.clientID,
		"secret":       c.secret,
		"public_token": publicToken,
	}
	var resp struct {
		AccessToken string `json:"access_token"`
		ItemID      string `json:"item_id"`
	}
	if err := c.post(ctx, "/item/public_token/exchange", body, &resp); err != nil {
		return "", "", err
	}
	return resp.AccessToken, resp.ItemID, nil
}

// GetInstitutionName returns the institution name for a connected item.
func (c *PlaidClient) GetInstitutionName(ctx context.Context, accessToken string) string {
	body := map[string]string{"client_id": c.clientID, "secret": c.secret, "access_token": accessToken}
	var itemResp struct {
		Item struct{ InstitutionID string `json:"institution_id"` } `json:"item"`
	}
	if err := c.post(ctx, "/item/get", body, &itemResp); err != nil || itemResp.Item.InstitutionID == "" {
		return "Unknown Bank"
	}

	instBody := map[string]any{
		"client_id":      c.clientID,
		"secret":         c.secret,
		"institution_id": itemResp.Item.InstitutionID,
		"country_codes":  []string{"US"},
	}
	var instResp struct {
		Institution struct{ Name string `json:"name"` } `json:"institution"`
	}
	if err := c.post(ctx, "/institutions/get_by_id", instBody, &instResp); err != nil {
		return "Unknown Bank"
	}
	return instResp.Institution.Name
}

// GetTransactions pulls transactions for a date range.
func (c *PlaidClient) GetTransactions(ctx context.Context, accessToken string, startDate, endDate time.Time) ([]PlaidTransactionResult, error) {
	body := map[string]any{
		"client_id":    c.clientID,
		"secret":       c.secret,
		"access_token": accessToken,
		"start_date":   startDate.Format("2006-01-02"),
		"end_date":     endDate.Format("2006-01-02"),
		"options":      map[string]int{"count": 500},
	}
	var resp struct {
		Transactions []struct {
			TransactionID string   `json:"transaction_id"`
			AccountID     string   `json:"account_id"`
			Amount        float64  `json:"amount"`
			Date          string   `json:"date"`
			Name          string   `json:"name"`
			MerchantName  string   `json:"merchant_name"`
			Category      []string `json:"category"`
			Pending       bool     `json:"pending"`
		} `json:"transactions"`
	}
	if err := c.post(ctx, "/transactions/get", body, &resp); err != nil {
		return nil, err
	}

	results := make([]PlaidTransactionResult, 0, len(resp.Transactions))
	for _, t := range resp.Transactions {
		results = append(results, PlaidTransactionResult{
			ID:           t.TransactionID,
			AccountID:    t.AccountID,
			Amount:       t.Amount,
			Date:         t.Date,
			Name:         t.Name,
			MerchantName: t.MerchantName,
			Category:     t.Category,
			Pending:      t.Pending,
		})
	}
	return results, nil
}
