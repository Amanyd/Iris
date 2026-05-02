package ai

import (
	"context"
	"fmt"

	"github.com/eulerbutcooler/iris/services/core/internal/models"
	openai "github.com/sashabaranov/go-openai"
)

// LLMClient is the interface for multi-turn LLM chat completions.
// Implementations must be safe for concurrent use.
type LLMClient interface {
	// Chat sends a conversation and returns the assistant's raw text response.
	Chat(ctx context.Context, messages []models.AIMessage) (string, error)
}

// ─── OpenAI implementation ────────────────────────────────────────────────────

// openAIClient wraps the go-openai SDK.
type openAIClient struct {
	client *openai.Client
	model  string
}

// NewClient constructs the appropriate LLMClient for the given provider.
// Supported providers: "openai". Returns an error for unknown providers.
func NewClient(provider, apiKey, model string) (LLMClient, error) {
	switch provider {
	case "openai":
		if apiKey == "" {
			return nil, fmt.Errorf("ai: LLM_API_KEY is required for openai provider")
		}
		return &openAIClient{
			client: openai.NewClient(apiKey),
			model:  model,
		}, nil
	default:
		return nil, fmt.Errorf("ai: unsupported LLM provider %q (supported: openai)", provider)
	}
}

// Chat sends a conversation to the OpenAI Chat Completions API.
func (c *openAIClient) Chat(ctx context.Context, messages []models.AIMessage) (string, error) {
	oaiMessages := make([]openai.ChatCompletionMessage, len(messages))
	for i, m := range messages {
		oaiMessages[i] = openai.ChatCompletionMessage{
			Role:    m.Role,
			Content: m.Content,
		}
	}

	resp, err := c.client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
		Model:       c.model,
		Messages:    oaiMessages,
		Temperature: 0.2, // low temperature for structured JSON output
	})
	if err != nil {
		return "", fmt.Errorf("ai: openai chat: %w", err)
	}
	if len(resp.Choices) == 0 {
		return "", fmt.Errorf("ai: openai returned no choices")
	}
	return resp.Choices[0].Message.Content, nil
}
