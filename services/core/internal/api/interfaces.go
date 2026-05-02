package api

import (
	"context"

	"github.com/eulerbutcooler/iris/services/core/internal/models"
)

// RelayStore is the interface the relay handlers depend on.
// All methods are user-scoped (userID is an explicit param where applicable).
type RelayStore interface {
	CreateRelay(ctx context.Context, userID string, req models.CreateRelayRequest, nextRunAt *string) (*models.RelayWithActions, error)
	GetRelay(ctx context.Context, id, userID string) (*models.RelayWithActions, error)
	GetAllRelays(ctx context.Context, userID string) ([]models.Relay, error)
	UpdateRelay(ctx context.Context, id, userID string, req models.UpdateRelayRequest, nextRunAt *string) (*models.Relay, error)
	UpdateRelayActions(ctx context.Context, relayID, userID string, req models.UpdateRelayActionsRequest) (*models.RelayWithActions, error)
	DeleteRelay(ctx context.Context, id, userID string) error

	GetExecutions(ctx context.Context, relayID, userID string) ([]models.Execution, error)
	GetExecution(ctx context.Context, id, userID string) (*models.Execution, error)
	GetExecutionSteps(ctx context.Context, executionID, userID string) ([]models.ExecutionStep, error)
	DeleteExecution(ctx context.Context, id, userID string) error
}

// SecretStore is the interface the secret handlers depend on.
type SecretStore interface {
	CreateSecret(ctx context.Context, userID, name, encryptedValue string) (*models.Secret, error)
	GetSecretValue(ctx context.Context, userID, name string) (string, error)
	ListSecrets(ctx context.Context, userID string) ([]models.Secret, error)
	DeleteSecret(ctx context.Context, id, userID string) error
}

// UserStore is the interface the auth handlers depend on.
// GetUserForAuth returns the user's ID, email, and bcrypt password hash.
type UserStore interface {
	CreateUser(ctx context.Context, email, passwordHash string) (*models.User, error)
	GetUserForAuth(ctx context.Context, email string) (id, storedHash string, user *models.User, err error)
	GetUserByID(ctx context.Context, id string) (*models.User, error)
}
