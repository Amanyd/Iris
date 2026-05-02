package templateengine

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// StepOutput holds the result of a completed execution node.
type StepOutput struct {
	Output map[string]any
	Error  string
}

var exprRe = regexp.MustCompile(`\{\{([^}]+)\}\}`)

// Resolve walks every string value in config and replaces {{expr}} patterns.
//
// Supported patterns:
//   - {{payload}}               → full raw trigger payload
//   - {{payload.user.name}}     → deep field in payload JSON
//   - {{steps['id'].output}}    → full output of a completed node
//   - {{steps['id'].output.x}}  → specific field from a node's output
//   - {{steps['id'].error}}     → error message from a failed node
func Resolve(config map[string]any, payload []byte, steps map[string]StepOutput) (map[string]any, error) {
	result, err := resolveValue(config, payload, steps)
	if err != nil {
		return nil, err
	}
	if m, ok := result.(map[string]any); ok {
		return m, nil
	}
	return nil, fmt.Errorf("templateengine: resolve returned non-map type")
}

// resolveValue recursively resolves template expressions in any value type.
func resolveValue(v any, payload []byte, steps map[string]StepOutput) (any, error) {
	switch val := v.(type) {
	case string:
		return resolveString(val, payload, steps), nil
	case map[string]any:
		out := make(map[string]any, len(val))
		for k, inner := range val {
			resolved, err := resolveValue(inner, payload, steps)
			if err != nil {
				return nil, err
			}
			out[k] = resolved
		}
		return out, nil
	case []any:
		out := make([]any, len(val))
		for i, inner := range val {
			resolved, err := resolveValue(inner, payload, steps)
			if err != nil {
				return nil, err
			}
			out[i] = resolved
		}
		return out, nil
	default:
		return v, nil
	}
}

// resolveString replaces all {{expr}} occurrences in a single string value.
// If resolution fails, the original {{expr}} is kept (fail-open, no panic).
func resolveString(s string, payload []byte, steps map[string]StepOutput) string {
	return exprRe.ReplaceAllStringFunc(s, func(match string) string {
		// Strip {{ and }}
		expr := strings.TrimSpace(match[2 : len(match)-2])
		resolved, ok := resolveExpr(expr, payload, steps)
		if !ok {
			return match // keep original on failure
		}
		return fmt.Sprintf("%v", resolved)
	})
}

// resolveExpr evaluates a single expression string.
func resolveExpr(expr string, payload []byte, steps map[string]StepOutput) (any, bool) {
	// Unmarshal payload into a generic map once.
	var payloadMap map[string]any
	if len(payload) > 0 {
		_ = json.Unmarshal(payload, &payloadMap)
	}

	// {{payload}}
	if expr == "payload" {
		if payloadMap != nil {
			return payloadMap, true
		}
		return string(payload), true
	}

	// {{payload.x.y}}
	if strings.HasPrefix(expr, "payload.") {
		path := strings.TrimPrefix(expr, "payload.")
		val, ok := deepGet(payloadMap, strings.Split(path, "."))
		return val, ok
	}

	// {{steps['nodeID'].output}} or {{steps['nodeID'].output.field}} or {{steps['nodeID'].error}}
	if strings.HasPrefix(expr, "steps[") {
		return resolveStepExpr(expr, steps)
	}

	return nil, false
}

// resolveStepExpr handles steps['id']... expressions.
func resolveStepExpr(expr string, steps map[string]StepOutput) (any, bool) {
	// Extract the node ID from steps['<id>']
	start := strings.Index(expr, "'")
	end := strings.LastIndex(expr, "'")
	if start == -1 || end == -1 || start == end {
		return nil, false
	}
	nodeID := expr[start+1 : end]

	step, ok := steps[nodeID]
	if !ok {
		return nil, false
	}

	// Remainder after steps['nodeID']
	rest := expr[end+2:] // skip closing ']'

	// {{steps['id'].error}}
	if rest == ".error" {
		return step.Error, true
	}

	// {{steps['id'].output}}
	if rest == ".output" {
		return step.Output, true
	}

	// {{steps['id'].output.field.subfield}}
	if strings.HasPrefix(rest, ".output.") {
		path := strings.TrimPrefix(rest, ".output.")
		val, ok := deepGet(step.Output, strings.Split(path, "."))
		return val, ok
	}

	return nil, false
}

// deepGet traverses a nested structure (map or slice) by path segments.
func deepGet(v any, path []string) (any, bool) {
	if len(path) == 0 {
		return nil, false
	}

	switch val := v.(type) {
	case map[string]any:
		next, ok := val[path[0]]
		if !ok {
			return nil, false
		}
		if len(path) == 1 {
			return next, true
		}
		return deepGet(next, path[1:])

	case []any:
		idx, err := strconv.Atoi(path[0])
		if err != nil || idx < 0 || idx >= len(val) {
			return nil, false
		}
		next := val[idx]
		if len(path) == 1 {
			return next, true
		}
		return deepGet(next, path[1:])

	default:
		return nil, false
	}
}
