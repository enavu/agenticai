package services

import (
	"context"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

type AnthropicClient struct {
	client *anthropic.Client
	model  string
}

func NewAnthropicClient(apiKey, model string) *AnthropicClient {
	c := anthropic.NewClient(option.WithAPIKey(apiKey))
	return &AnthropicClient{client: &c, model: model}
}

func (c *AnthropicClient) CreateMessage(ctx context.Context, params anthropic.MessageNewParams) (*anthropic.Message, error) {
	return c.client.Messages.New(ctx, params)
}

func (c *AnthropicClient) Model() string {
	return c.model
}
