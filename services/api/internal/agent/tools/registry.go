package tools

import "fmt"

// ToolHandler is a function that executes a tool given its input JSON.
type ToolHandler func(input map[string]any) (string, error)

// Registry maps tool names to their definitions and handlers.
type Registry struct {
	defs     []ToolDef
	handlers map[string]ToolHandler
}

// ToolDef mirrors anthropic.ToolParam but without the SDK import cycle.
type ToolDef struct {
	Name        string
	Description string
	InputSchema map[string]any
}

func NewRegistry() *Registry {
	return &Registry{
		handlers: make(map[string]ToolHandler),
	}
}

func (r *Registry) Register(def ToolDef, handler ToolHandler) {
	r.defs = append(r.defs, def)
	r.handlers[def.Name] = handler
}

func (r *Registry) Definitions() []ToolDef {
	return r.defs
}

func (r *Registry) Execute(name string, input map[string]any) (string, error) {
	h, ok := r.handlers[name]
	if !ok {
		return "", fmt.Errorf("unknown tool: %s", name)
	}
	return h(input)
}

// ─── helpers ─────────────────────────────────────────────────────────────────

func Str(m map[string]any, key string) string {
	if v, ok := m[key].(string); ok {
		return v
	}
	return ""
}

func IntVal(m map[string]any, key string, def int) int {
	switch v := m[key].(type) {
	case float64:
		return int(v)
	case int:
		return v
	}
	return def
}
