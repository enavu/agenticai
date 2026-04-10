package tools

import (
	"context"
	"encoding/json"

	"enavu-hub/api/internal/store"
)

// RegisterWorkoutTools adds workout data tools to the registry.
func RegisterWorkoutTools(r *Registry, s *store.Store) {
	ctx := context.Background()

	r.Register(ToolDef{
		Name:        "get_recent_workouts",
		Description: "Get the most recent Cyclebar workouts with stats.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"limit": map[string]any{
					"type":        "integer",
					"description": "Number of workouts to return (default 5)",
				},
			},
		},
	}, func(input map[string]any) (string, error) {
		limit := IntVal(input, "limit", 5)
		workouts, err := s.GetRecentWorkouts(ctx, limit)
		if err != nil {
			return "", err
		}
		b, _ := json.MarshalIndent(workouts, "", "  ")
		return string(b), nil
	})
}
