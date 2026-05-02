package ai

import (
	"context"
	"fmt"

	"github.com/eulerbutcooler/iris/services/core/internal/models"
	openai "github.com/sashabaranov/go-openai"
	"google.golang.org/genai"
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
// Supported providers: "openai", "gemini". Returns an error for unknown providers.
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
	case "gemini":
		if apiKey == "" {
			return nil, fmt.Errorf("ai: LLM_API_KEY is required for gemini provider")
		}
		return newGeminiClient(apiKey, model)
	default:
		return nil, fmt.Errorf("ai: unsupported LLM provider %q (supported: openai, gemini)", provider)
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

// ─── Gemini implementation ────────────────────────────────────────────────────

// geminiClient wraps the google.golang.org/genai SDK.
type geminiClient struct {
	client *genai.Client
	model  string
}

// newGeminiClient initializes a Gemini client using an API key.
func newGeminiClient(apiKey, model string) (*geminiClient, error) {
	client, err := genai.NewClient(context.Background(), &genai.ClientConfig{
		APIKey:  apiKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		return nil, fmt.Errorf("ai: gemini client init: %w", err)
	}
	if model == "" {
		model = "gemini-2.0-flash"
	}
	return &geminiClient{client: client, model: model}, nil
}

// Chat sends a multi-turn conversation to the Gemini API.
// The system prompt (role="system") is extracted and passed as a system instruction.
// All other turns are passed as user/model content parts.
func (c *geminiClient) Chat(ctx context.Context, messages []models.AIMessage) (string, error) {
	// Separate system prompt from the conversation history
	var systemPrompt string
	var turns []models.AIMessage

	for _, m := range messages {
		if m.Role == "system" {
			systemPrompt = m.Content
		} else {
			turns = append(turns, m)
		}
	}

	// Build the contents slice (user + model alternating turns)
	contents := make([]*genai.Content, 0, len(turns))
	for _, m := range turns {
		role := "user"
		if m.Role == "assistant" {
			role = "model"
		}
		contents = append(contents, &genai.Content{
			Role:  role,
			Parts: []*genai.Part{{Text: m.Content}},
		})
	}

	// If no user turns yet (shouldn't happen), send an empty prompt
	if len(contents) == 0 {
		contents = append(contents, &genai.Content{
			Role:  "user",
			Parts: []*genai.Part{{Text: "Hello"}},
		})
	}

	cfg := &genai.GenerateContentConfig{
		Temperature: genai.Ptr[float32](0.2),
	}
	// Attach system instruction if present
	if systemPrompt != "" {
		cfg.SystemInstruction = &genai.Content{
			Parts: []*genai.Part{{Text: systemPrompt}},
		}
	}

	resp, err := c.client.Models.GenerateContent(ctx, c.model, contents, cfg)
	if err != nil {
		return "", fmt.Errorf("ai: gemini chat: %w", err)
	}

	text := resp.Text()
	if text == "" {
		return "", fmt.Errorf("ai: gemini returned empty response")
	}
	return text, nil
}
