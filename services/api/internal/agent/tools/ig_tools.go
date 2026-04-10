package tools

import (
	"context"
	"fmt"

	"enavu-hub/api/internal/services"
)

// RegisterInstagramTools adds Instagram posting tools to the registry.
func RegisterInstagramTools(r *Registry, ig *services.InstagramClient) {
	ctx := context.Background()

	r.Register(ToolDef{
		Name:        "post_to_instagram",
		Description: "Post a caption (and optional image URL) to Instagram.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"caption": map[string]any{
					"type":        "string",
					"description": "The Instagram post caption including hashtags.",
				},
				"image_url": map[string]any{
					"type":        "string",
					"description": "Public URL to the image to post. Leave empty to skip image.",
				},
			},
			"required": []string{"caption"},
		},
	}, func(input map[string]any) (string, error) {
		caption := Str(input, "caption")
		imageURL := Str(input, "image_url")

		postID, err := ig.Post(ctx, caption, imageURL)
		if err != nil {
			return "", fmt.Errorf("instagram post failed: %w", err)
		}
		return fmt.Sprintf("Posted to Instagram. Post ID: %s", postID), nil
	})
}
