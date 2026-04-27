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

type HAClient struct {
	baseURL    string
	token      string
	httpClient *http.Client
}

type HAState struct {
	EntityID    string            `json:"entity_id"`
	State       string            `json:"state"`
	Attributes  map[string]any    `json:"attributes"`
	LastChanged time.Time         `json:"last_changed"`
	LastUpdated time.Time         `json:"last_updated"`
}

type HAServiceCall struct {
	Domain  string         `json:"domain"`
	Service string         `json:"service"`
	Data    map[string]any `json:"service_data,omitempty"`
	Target  *HATarget      `json:"target,omitempty"`
}

type HATarget struct {
	EntityID []string `json:"entity_id,omitempty"`
	AreaID   []string `json:"area_id,omitempty"`
}

func NewHAClient(baseURL, token string) *HAClient {
	return &HAClient{
		baseURL: strings.TrimRight(baseURL, "/"),
		token:   token,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

func (c *HAClient) get(ctx context.Context, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+path, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("HA API error %d: %s", resp.StatusCode, string(body))
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func (c *HAClient) post(ctx context.Context, path string, body any, out any) error {
	b, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+path,
		strings.NewReader(string(b)))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("HA API error %d: %s", resp.StatusCode, string(body))
	}
	if out != nil {
		return json.NewDecoder(resp.Body).Decode(out)
	}
	return nil
}

func (c *HAClient) Ping(ctx context.Context) error {
	var result map[string]any
	return c.get(ctx, "/api/", &result)
}

func (c *HAClient) GetState(ctx context.Context, entityID string) (*HAState, error) {
	var state HAState
	if err := c.get(ctx, "/api/states/"+entityID, &state); err != nil {
		return nil, err
	}
	return &state, nil
}

func (c *HAClient) GetAllStates(ctx context.Context) ([]HAState, error) {
	var states []HAState
	if err := c.get(ctx, "/api/states", &states); err != nil {
		return nil, err
	}
	return states, nil
}

func (c *HAClient) GetLights(ctx context.Context) ([]HAState, error) {
	all, err := c.GetAllStates(ctx)
	if err != nil {
		return nil, err
	}
	var lights []HAState
	for _, s := range all {
		if strings.HasPrefix(s.EntityID, "light.") {
			lights = append(lights, s)
		}
	}
	return lights, nil
}

func (c *HAClient) CallService(ctx context.Context, domain, service string, data map[string]any, target *HATarget) error {
	path := fmt.Sprintf("/api/services/%s/%s", domain, service)
	body := map[string]any{}
	if len(data) > 0 {
		body = data
	}
	if target != nil {
		body["target"] = target
	}
	return c.post(ctx, path, body, nil)
}

func (c *HAClient) TurnOn(ctx context.Context, entityID string, params map[string]any) error {
	if params == nil {
		params = map[string]any{}
	}
	params["entity_id"] = entityID
	return c.CallService(ctx, "homeassistant", "turn_on", params, nil)
}

func (c *HAClient) TurnOff(ctx context.Context, entityID string) error {
	return c.CallService(ctx, "homeassistant", "turn_off",
		map[string]any{"entity_id": entityID}, nil)
}

func (c *HAClient) RunAutomation(ctx context.Context, automationID string) error {
	return c.CallService(ctx, "automation", "trigger",
		map[string]any{"entity_id": automationID}, nil)
}

func (c *HAClient) GetHistoryRange(ctx context.Context, since, until time.Time) ([][]HAState, error) {
	path := fmt.Sprintf("/api/history/period/%s?end_time=%s&significant_changes_only=true",
		since.UTC().Format(time.RFC3339), until.UTC().Format(time.RFC3339))
	var history [][]HAState
	if err := c.get(ctx, path, &history); err != nil {
		return nil, err
	}
	return history, nil
}

func (c *HAClient) GetHistory(ctx context.Context, entityID string, hours int) ([][]HAState, error) {
	since := time.Now().Add(-time.Duration(hours) * time.Hour).Format(time.RFC3339)
	path := fmt.Sprintf("/api/history/period/%s?filter_entity_id=%s&end_time=%s",
		since, entityID, time.Now().Format(time.RFC3339))
	var history [][]HAState
	if err := c.get(ctx, path, &history); err != nil {
		return nil, err
	}
	return history, nil
}
