package condition

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"github.com/eulerbutcooler/iris/services/worker/internal/engine"
)

// Executor implements engine.ActionExecutor for the "condition" action type.
//
// Supported expr formats:
//
//	true / false                              → literal boolean
//	<value> == <value>                        → equality
//	<value> != <value>                        → inequality
//	<value> > <value>                         → numeric greater-than
//	<value> >= <value>                        → numeric greater-than-or-equal
//	<value> < <value>                         → numeric less-than
//	<value> <= <value>                        → numeric less-than-or-equal
//	<value> contains <substring>              → string contains
//	exists <value>                            → value is non-nil and non-empty
//
// <value> can be a literal (number/string) or a step reference:
//
//	steps['node_id'].output.field
//	steps['node_id'].error
type Executor struct{}

func New() *Executor { return &Executor{} }

func (e *Executor) Execute(
	ctx context.Context,
	config map[string]any,
	payload []byte,
	prevOutputs map[string]engine.StepOutput,
) (json.RawMessage, error) {
	expr, _ := config["expr"].(string)
	if expr == "" {
		return nil, fmt.Errorf("condition: expr is required")
	}

	result, err := evalExpr(strings.TrimSpace(expr), prevOutputs)
	if err != nil {
		return nil, fmt.Errorf("condition: %w", err)
	}

	out, _ := json.Marshal(map[string]any{"result": result, "expr": expr})
	return json.RawMessage(out), nil
}

// ─── Expression evaluator ─────────────────────────────────────────────────────

// operators in order of specificity (longer operators first to avoid prefix ambiguity)
var operators = []string{">=", "<=", "!=", ">", "<", "==", " contains ", " exists"}

func evalExpr(expr string, outputs map[string]engine.StepOutput) (bool, error) {
	lower := strings.ToLower(strings.TrimSpace(expr))

	// Literal booleans
	if lower == "true" {
		return true, nil
	}
	if lower == "false" {
		return false, nil
	}

	// "exists <value>" — check if value is present and non-empty
	if strings.HasPrefix(lower, "exists ") {
		ref := strings.TrimSpace(expr[7:])
		val := resolveValue(ref, outputs)
		return isPresent(val), nil
	}

	// Two-operand operators — require spaces to avoid matching inside step refs or URLs.
	// Check longer operators first (>= before >, <= before <) to avoid prefix ambiguity.
	for _, op := range []string{">=", "<=", "!=", ">", "<", "=="} {
		padded := " " + op + " "
		idx := strings.Index(expr, padded)
		if idx == -1 {
			continue
		}
		left := strings.TrimSpace(expr[:idx])
		right := strings.TrimSpace(expr[idx+len(padded):])
		return compare(left, right, op, outputs)
	}

	// "contains" operator (case-insensitive keyword, not a symbol)
	if ci := strings.Index(strings.ToLower(expr), " contains "); ci != -1 {
		left := strings.TrimSpace(expr[:ci])
		right := strings.TrimSpace(expr[ci+10:])
		lv := fmt.Sprintf("%v", resolveValue(left, outputs))
		rv := unquote(right)
		return strings.Contains(lv, rv), nil
	}

	return false, fmt.Errorf(
		"unsupported expression %q — supported operators: ==, !=, >, >=, <, <=, contains, exists",
		expr,
	)
}

// compare evaluates a two-operand expression with the given operator.
func compare(leftRef, rightRef, op string, outputs map[string]engine.StepOutput) (bool, error) {
	leftVal := resolveValue(leftRef, outputs)
	rightLit := unquote(rightRef)

	leftStr := fmt.Sprintf("%v", leftVal)

	// Try numeric comparison first
	leftNum, leftErr := toFloat(leftStr)
	rightNum, rightErr := toFloat(rightLit)
	numericOK := leftErr == nil && rightErr == nil

	switch op {
	case "==":
		if numericOK {
			return leftNum == rightNum, nil
		}
		return leftStr == rightLit, nil
	case "!=":
		if numericOK {
			return leftNum != rightNum, nil
		}
		return leftStr != rightLit, nil
	case ">":
		if !numericOK {
			return false, fmt.Errorf("operator > requires numeric operands (got %q and %q)", leftStr, rightLit)
		}
		return leftNum > rightNum, nil
	case ">=":
		if !numericOK {
			return false, fmt.Errorf("operator >= requires numeric operands (got %q and %q)", leftStr, rightLit)
		}
		return leftNum >= rightNum, nil
	case "<":
		if !numericOK {
			return false, fmt.Errorf("operator < requires numeric operands (got %q and %q)", leftStr, rightLit)
		}
		return leftNum < rightNum, nil
	case "<=":
		if !numericOK {
			return false, fmt.Errorf("operator <= requires numeric operands (got %q and %q)", leftStr, rightLit)
		}
		return leftNum <= rightNum, nil
	}
	return false, fmt.Errorf("unknown operator %q", op)
}

// ─── Value resolution ─────────────────────────────────────────────────────────

// resolveValue resolves a step output reference or returns the literal string.
func resolveValue(s string, outputs map[string]engine.StepOutput) any {
	s = strings.TrimSpace(s)

	if !strings.HasPrefix(s, "steps[") {
		return s
	}

	start := strings.Index(s, "'")
	end := strings.LastIndex(s, "'")
	if start == -1 || end == start {
		return s
	}
	nodeID := s[start+1 : end]
	rest := s[end+2:] // skip closing ']'

	step, ok := outputs[nodeID]
	if !ok {
		return nil
	}

	if rest == ".error" {
		return step.Error
	}
	if rest == ".output" {
		return step.Output
	}
	if strings.HasPrefix(rest, ".output.") {
		field := strings.TrimPrefix(rest, ".output.")
		val := deepGet(step.Output, strings.Split(field, "."))
		// If the output is a JSON string (from http_request body), try to parse it first
		if val == nil {
			val = deepGetFromBody(step.Output, strings.Split(field, "."))
		}
		return val
	}
	return nil
}

// deepGet traverses a nested map[string]any by path segments.
func deepGet(m map[string]any, path []string) any {
	if m == nil || len(path) == 0 {
		return nil
	}
	val, ok := m[path[0]]
	if !ok {
		return nil
	}
	if len(path) == 1 {
		return val
	}
	if nested, ok := val.(map[string]any); ok {
		return deepGet(nested, path[1:])
	}
	return nil
}

// deepGetFromBody tries to parse the "body" field as JSON then traverse the path.
// This handles the common case where http_request returns body as a JSON string.
func deepGetFromBody(m map[string]any, path []string) any {
	if m == nil {
		return nil
	}
	body, ok := m["body"]
	if !ok {
		return nil
	}
	bodyStr, ok := body.(string)
	if !ok {
		return nil
	}
	var parsed map[string]any
	if err := json.Unmarshal([]byte(bodyStr), &parsed); err != nil {
		return nil
	}
	return deepGet(parsed, path)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func unquote(s string) string {
	s = strings.TrimSpace(s)
	if len(s) >= 2 {
		if (s[0] == '"' && s[len(s)-1] == '"') || (s[0] == '\'' && s[len(s)-1] == '\'') {
			return s[1 : len(s)-1]
		}
	}
	return s
}

func toFloat(s string) (float64, error) {
	return strconv.ParseFloat(strings.TrimSpace(s), 64)
}

func isPresent(val any) bool {
	if val == nil {
		return false
	}
	if s, ok := val.(string); ok {
		return s != ""
	}
	return true
}
