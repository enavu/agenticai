package services

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const igAPIBase = "https://graph.instagram.com/v20.0"

type InstagramClient struct {
	accessToken string
	userID      string
	httpClient  *http.Client
}

type IGMediaResponse struct {
	ID string `json:"id"`
}

type IGPublishResponse struct {
	ID string `json:"id"`
}

func NewInstagramClient(accessToken, userID string) *InstagramClient {
	return &InstagramClient{
		accessToken: accessToken,
		userID:      userID,
		httpClient:  &http.Client{Timeout: 30 * time.Second},
	}
}

func (c *InstagramClient) post(ctx context.Context, path string, params url.Values) (map[string]any, error) {
	params.Set("access_token", c.accessToken)
	reqURL := igAPIBase + path
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL,
		strings.NewReader(params.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 300 {
		return nil, fmt.Errorf("instagram API error %d: %s", resp.StatusCode, string(body))
	}

	var result map[string]any
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, err
	}
	return result, nil
}

// CreateMediaContainer creates an Instagram media container for a caption-only post.
// imageURL is optional; if empty, creates a text-only reel placeholder (not ideal —
// for real use you'd provide a real image URL).
func (c *InstagramClient) CreateMediaContainer(ctx context.Context, caption, imageURL string) (string, error) {
	params := url.Values{}
	params.Set("caption", caption)

	if imageURL != "" {
		params.Set("image_url", imageURL)
		params.Set("media_type", "IMAGE")
	} else {
		// Fallback: create a reel with a placeholder — in practice supply a real image
		params.Set("media_type", "IMAGE")
		params.Set("image_url", imageURL)
	}

	result, err := c.post(ctx, "/"+c.userID+"/media", params)
	if err != nil {
		return "", err
	}
	id, ok := result["id"].(string)
	if !ok {
		return "", fmt.Errorf("unexpected response: %v", result)
	}
	return id, nil
}

// PublishMediaContainer publishes a previously created container.
func (c *InstagramClient) PublishMediaContainer(ctx context.Context, containerID string) (string, error) {
	params := url.Values{}
	params.Set("creation_id", containerID)

	result, err := c.post(ctx, "/"+c.userID+"/media_publish", params)
	if err != nil {
		return "", err
	}
	id, ok := result["id"].(string)
	if !ok {
		return "", fmt.Errorf("unexpected response: %v", result)
	}
	return id, nil
}

// Post creates and publishes an Instagram post in one call.
func (c *InstagramClient) Post(ctx context.Context, caption, imageURL string) (string, error) {
	containerID, err := c.CreateMediaContainer(ctx, caption, imageURL)
	if err != nil {
		return "", fmt.Errorf("create container: %w", err)
	}

	// Brief pause recommended by Meta before publishing
	time.Sleep(2 * time.Second)

	postID, err := c.PublishMediaContainer(ctx, containerID)
	if err != nil {
		return "", fmt.Errorf("publish container: %w", err)
	}
	return postID, nil
}
