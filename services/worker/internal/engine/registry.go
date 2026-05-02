package engine

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
)

// StepOutput represents the result of a single node's execution.
type StepOutput struct {
	Output  map[string]any
	Error   string
	Skipped bool // true if the node was skipped due to condition mismatch
}

// ActionExecutor defines the interface all plugin executors must implement.
type ActionExecutor interface {
	// Execute runs the action.
	// config: merged & secret-resolved configuration for this node.
	// payload: original raw event payload (e.g. from webhook/schedule).
	// prevOutputs: readonly map of upstream node results.
	Execute(
		ctx context.Context,
		config map[string]any,
		payload []byte,
		prevOutputs map[string]StepOutput,
	) (json.RawMessage, error)
}

// Registry holds the available action executors.
type Registry struct {
	executors map[string]ActionExecutor
	mu        sync.RWMutex
}

// NewRegistry creates an empty registry.
func NewRegistry() *Registry {
	return &Registry{
		executors: make(map[string]ActionExecutor),
	}
}

// Register adds an executor for a given action type.
func (r *Registry) Register(actionType string, exec ActionExecutor) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.executors[actionType] = exec
}

// MustGet returns the executor for the action type, or an error if not found.
func (r *Registry) MustGet(actionType string) (ActionExecutor, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	if ex, ok := r.executors[actionType]; ok {
		return ex, nil
	}
	return nil, fmt.Errorf("unknown action type: %s", actionType)
}

// Count returns the number of registered executors.
func (r *Registry) Count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.executors)
}
