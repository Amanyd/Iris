package queue

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/nats-io/nats.go"
)

const (
	streamName = "EVENTS"
	subjectFmt = "events.%s" // events.<relayID>
)

// ExecutionEvent is the message published to NATS when a relay is triggered.
type ExecutionEvent struct {
	RelayID    string          `json:"relay_id"`
	EventID    string          `json:"event_id"`
	Payload    json.RawMessage `json:"payload"`
	ReceivedAt time.Time       `json:"received_at"`
}

// Publisher publishes relay execution events to NATS JetStream.
type Publisher struct {
	js nats.JetStreamContext
}

// NewPublisher connects to NATS and ensures the EVENTS stream exists.
func NewPublisher(ctx context.Context, natsURL string) (*Publisher, error) {
	nc, err := nats.Connect(natsURL,
		nats.RetryOnFailedConnect(true),
		nats.MaxReconnects(5),
		nats.ReconnectWait(2*time.Second),
	)
	if err != nil {
		return nil, fmt.Errorf("queue: connect to nats: %w", err)
	}

	js, err := nc.JetStream()
	if err != nil {
		nc.Drain()
		return nil, fmt.Errorf("queue: get jetstream context: %w", err)
	}

	// Idempotently create the stream (no-op if it already exists)
	_, err = js.AddStream(&nats.StreamConfig{
		Name:     streamName,
		Subjects: []string{"events.>"},
		Storage:  nats.FileStorage,
		MaxAge:   24 * time.Hour,
	})
	if err != nil && err != nats.ErrStreamNameAlreadyInUse {
		nc.Drain()
		return nil, fmt.Errorf("queue: create stream: %w", err)
	}

	return &Publisher{js: js}, nil
}

// Publish sends a relay execution event to NATS JetStream.
// payload is the raw trigger payload (JSON bytes from the request body, or nil).
func (p *Publisher) Publish(ctx context.Context, event ExecutionEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("queue: marshal event: %w", err)
	}

	subject := fmt.Sprintf(subjectFmt, event.RelayID)
	if _, err := p.js.PublishAsync(subject, data); err != nil {
		return fmt.Errorf("queue: publish to %s: %w", subject, err)
	}
	return nil
}
