package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"enavu-hub/api/internal/services"
)

// RegisterHATools adds all Home Assistant tools to the registry.
func RegisterHATools(r *Registry, ha *services.HAClient) {
	ctx := context.Background()

	r.Register(ToolDef{
		Name:        "ha_get_state",
		Description: "Get the current state of a specific Home Assistant entity.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"entity_id": map[string]any{
					"type":        "string",
					"description": "The entity ID, e.g. light.living_room or switch.fan",
				},
			},
			"required": []string{"entity_id"},
		},
	}, func(input map[string]any) (string, error) {
		entityID := Str(input, "entity_id")
		state, err := ha.GetState(ctx, entityID)
		if err != nil {
			return "", err
		}
		b, _ := json.MarshalIndent(state, "", "  ")
		return string(b), nil
	})

	r.Register(ToolDef{
		Name:        "ha_get_all_lights",
		Description: "Get the state of all light entities in Home Assistant.",
		InputSchema: map[string]any{
			"type":       "object",
			"properties": map[string]any{},
		},
	}, func(_ map[string]any) (string, error) {
		lights, err := ha.GetLights(ctx)
		if err != nil {
			return "", err
		}
		b, _ := json.MarshalIndent(lights, "", "  ")
		return string(b), nil
	})

	r.Register(ToolDef{
		Name:        "ha_control_entity",
		Description: "Turn a Home Assistant entity on or off, optionally with parameters like brightness or color_temp.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"entity_id": map[string]any{"type": "string"},
				"action":    map[string]any{"type": "string", "enum": []string{"turn_on", "turn_off"}},
				"brightness": map[string]any{
					"type":        "integer",
					"description": "Brightness 0-255 (only for turn_on)",
				},
				"color_temp": map[string]any{
					"type":        "integer",
					"description": "Color temperature in mireds (only for turn_on)",
				},
			},
			"required": []string{"entity_id", "action"},
		},
	}, func(input map[string]any) (string, error) {
		entityID := Str(input, "entity_id")
		action := Str(input, "action")
		params := map[string]any{}
		if b, ok := input["brightness"]; ok {
			params["brightness"] = b
		}
		if ct, ok := input["color_temp"]; ok {
			params["color_temp"] = ct
		}

		var err error
		if action == "turn_on" {
			err = ha.TurnOn(ctx, entityID, params)
		} else {
			err = ha.TurnOff(ctx, entityID)
		}
		if err != nil {
			return "", err
		}
		return fmt.Sprintf("Successfully executed %s on %s", action, entityID), nil
	})

	r.Register(ToolDef{
		Name:        "ha_run_automation",
		Description: "Trigger a Home Assistant automation by its entity ID.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"automation_id": map[string]any{
					"type":        "string",
					"description": "The automation entity ID, e.g. automation.good_night",
				},
			},
			"required": []string{"automation_id"},
		},
	}, func(input map[string]any) (string, error) {
		automationID := Str(input, "automation_id")
		if err := ha.RunAutomation(ctx, automationID); err != nil {
			return "", err
		}
		return fmt.Sprintf("Triggered automation: %s", automationID), nil
	})

	r.Register(ToolDef{
		Name:        "ha_set_rest_mode",
		Description: "Activate or deactivate rest mode (dims lights, sets calm scene for winding down).",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"enable": map[string]any{
					"type":        "boolean",
					"description": "true to enable rest mode, false to disable",
				},
			},
			"required": []string{"enable"},
		},
	}, func(input map[string]any) (string, error) {
		enable, _ := input["enable"].(bool)
		automationID := "automation.rest_mode_on"
		if !enable {
			automationID = "automation.rest_mode_off"
		}
		if err := ha.RunAutomation(ctx, automationID); err != nil {
			// Fallback: just dim lights directly
			brightness := 255
			if enable {
				brightness = 30
			}
			lights, _ := ha.GetLights(ctx)
			for _, l := range lights {
				if l.State == "on" {
					ha.TurnOn(ctx, l.EntityID, map[string]any{"brightness": brightness})
				}
			}
			return fmt.Sprintf("Rest mode %v applied via direct light control", enable), nil
		}
		return fmt.Sprintf("Rest mode %v", enable), nil
	})

	r.Register(ToolDef{
		Name:        "ha_get_history",
		Description: "Get the state history for an entity over the last N hours.",
		InputSchema: map[string]any{
			"type": "object",
			"properties": map[string]any{
				"entity_id": map[string]any{"type": "string"},
				"hours":     map[string]any{"type": "integer", "description": "Number of hours to look back (default 24)"},
			},
			"required": []string{"entity_id"},
		},
	}, func(input map[string]any) (string, error) {
		entityID := Str(input, "entity_id")
		hours := IntVal(input, "hours", 24)
		history, err := ha.GetHistory(ctx, entityID, hours)
		if err != nil {
			return "", err
		}
		b, _ := json.MarshalIndent(history, "", "  ")
		return string(b), nil
	})
}
