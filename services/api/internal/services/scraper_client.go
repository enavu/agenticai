package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type ScraperClient struct {
	baseURL    string
	httpClient *http.Client
}

type ScrapeResult struct {
	Workouts []ScrapedWorkout `json:"workouts"`
	Error    string           `json:"error,omitempty"`
}

type ScrapedWorkout struct {
	ClassDate   string  `json:"class_date"`
	ClassName   string  `json:"class_name"`
	Instructor  string  `json:"instructor"`
	Studio      string  `json:"studio"`
	Duration    int     `json:"duration_minutes"`
	CalsBurned  *int    `json:"cals_burned"`
	AvgOutput   *int    `json:"avg_output"`
	TotalOutput *int    `json:"total_output"`
	Rank        *string `json:"rank"`
}

func NewScraperClient(baseURL string) *ScraperClient {
	return &ScraperClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		httpClient: &http.Client{
			Timeout: 180 * time.Second, // scraping takes time
		},
	}
}

func (c *ScraperClient) Ping(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/health", nil)
	if err != nil {
		return err
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("scraper health check failed: %d", resp.StatusCode)
	}
	return nil
}

func (c *ScraperClient) ScrapeWorkouts(ctx context.Context) (*ScrapeResult, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/scrape/cyclebar", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("scraper error %d: %s", resp.StatusCode, string(body))
	}

	var result ScrapeResult
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("parse scraper response: %w", err)
	}
	if result.Error != "" {
		return nil, fmt.Errorf("scraper reported error: %s", result.Error)
	}
	return &result, nil
}
