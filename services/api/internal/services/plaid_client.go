package services

import (
	"context"
	"time"

	plaid "github.com/plaid/plaid-go/v30/plaid"
)

type PlaidClient struct {
	client *plaid.APIClient
	env    plaid.PlaidEnvironment
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
	cfg := plaid.NewConfiguration()
	cfg.AddDefaultHeader("PLAID-CLIENT-ID", clientID)
	cfg.AddDefaultHeader("PLAID-SECRET", secret)

	var plaidEnv plaid.PlaidEnvironment
	switch env {
	case "production":
		plaidEnv = plaid.Production
	case "development":
		plaidEnv = plaid.Development
	default:
		plaidEnv = plaid.Sandbox
	}
	cfg.UseEnvironment(plaidEnv)

	return &PlaidClient{
		client: plaid.NewAPIClient(cfg),
		env:    plaidEnv,
	}
}

// CreateLinkToken creates a Plaid Link token for the frontend to initialize Link.
func (c *PlaidClient) CreateLinkToken(ctx context.Context, userID string) (string, error) {
	user := plaid.LinkTokenCreateRequestUser{
		ClientUserId: userID,
	}
	req := plaid.NewLinkTokenCreateRequest(
		"enavu-hub",
		"en",
		[]plaid.CountryCode{plaid.COUNTRYCODE_US},
		user,
	)
	req.SetProducts([]plaid.Products{plaid.PRODUCTS_TRANSACTIONS})

	resp, _, err := c.client.PlaidApi.LinkTokenCreate(ctx).LinkTokenCreateRequest(*req).Execute()
	if err != nil {
		return "", err
	}
	return resp.GetLinkToken(), nil
}

// ExchangePublicToken exchanges a short-lived public token for a permanent access token.
func (c *PlaidClient) ExchangePublicToken(ctx context.Context, publicToken string) (accessToken, itemID string, err error) {
	req := plaid.NewItemPublicTokenExchangeRequest(publicToken)
	resp, _, err := c.client.PlaidApi.ItemPublicTokenExchange(ctx).ItemPublicTokenExchangeRequest(*req).Execute()
	if err != nil {
		return "", "", err
	}
	return resp.GetAccessToken(), resp.GetItemId(), nil
}

// GetInstitutionName returns the institution name for an item.
func (c *PlaidClient) GetInstitutionName(ctx context.Context, accessToken string) string {
	req := plaid.NewItemGetRequest(accessToken)
	resp, _, err := c.client.PlaidApi.ItemGet(ctx).ItemGetRequest(*req).Execute()
	if err != nil {
		return "Unknown Bank"
	}
	instID := resp.GetItem().GetInstitutionId()
	if instID == "" {
		return "Unknown Bank"
	}

	instReq := plaid.NewInstitutionsGetByIdRequest(instID, []plaid.CountryCode{plaid.COUNTRYCODE_US})
	instResp, _, err := c.client.PlaidApi.InstitutionsGetById(ctx).InstitutionsGetByIdRequest(*instReq).Execute()
	if err != nil {
		return "Unknown Bank"
	}
	return instResp.GetInstitution().GetName()
}

// GetTransactions pulls transactions for a date range.
func (c *PlaidClient) GetTransactions(ctx context.Context, accessToken string, startDate, endDate time.Time) ([]PlaidTransactionResult, error) {
	start := startDate.Format("2006-01-02")
	end := endDate.Format("2006-01-02")

	req := plaid.NewTransactionsGetRequest(accessToken, start, end)
	opts := plaid.TransactionsGetRequestOptions{}
	opts.SetCount(500)
	req.SetOptions(opts)

	resp, _, err := c.client.PlaidApi.TransactionsGet(ctx).TransactionsGetRequest(*req).Execute()
	if err != nil {
		return nil, err
	}

	var results []PlaidTransactionResult
	for _, t := range resp.GetTransactions() {
		cats := t.GetCategory()
		merchant := t.GetMerchantName()

		results = append(results, PlaidTransactionResult{
			ID:           t.GetTransactionId(),
			AccountID:    t.GetAccountId(),
			Amount:       float64(t.GetAmount()),
			Date:         t.GetDate(),
			Name:         t.GetName(),
			MerchantName: merchant,
			Category:     cats,
			Pending:      t.GetPending(),
		})
	}
	return results, nil
}
