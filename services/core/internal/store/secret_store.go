package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/eulerbutcooler/iris/services/core/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SecretStore handles encrypted secret storage.
// Values are stored as AES-GCM base64 ciphertext; the handler layer
// is responsible for encrypting before write and decrypting after read.
type SecretStore struct {
	pool *pgxpool.Pool
}

// NewSecretStore creates a SecretStore backed by the given pool.
func NewSecretStore(pool *pgxpool.Pool) *SecretStore {
	return &SecretStore{pool: pool}
}

// CreateSecret inserts a new secret (value must already be encrypted).
// Returns ErrDuplicateSecret if (user_id, name) already exists.
func (s *SecretStore) CreateSecret(ctx context.Context, userID, name, encryptedValue string) (*models.Secret, error) {
	row := s.pool.QueryRow(ctx,
		`INSERT INTO secrets (user_id, name, value)
		 VALUES ($1, $2, $3)
		 RETURNING id, user_id, name, created_at, updated_at`,
		userID, name, encryptedValue,
	)

	var sec models.Secret
	if err := row.Scan(&sec.ID, &sec.UserID, &sec.Name, &sec.CreatedAt, &sec.UpdatedAt); err != nil {
		if isUniqueViolation(err) {
			return nil, ErrDuplicateSecret
		}
		return nil, fmt.Errorf("secret_store: create: %w", err)
	}
	return &sec, nil
}

// GetSecretValue returns the raw encrypted value for a secret identified by
// user and name. The caller must decrypt it before use.
// Returns ErrSecretNotFound if absent.
func (s *SecretStore) GetSecretValue(ctx context.Context, userID, name string) (string, error) {
	var value string
	err := s.pool.QueryRow(ctx,
		`SELECT value FROM secrets WHERE user_id = $1 AND name = $2`,
		userID, name,
	).Scan(&value)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrSecretNotFound
		}
		return "", fmt.Errorf("secret_store: get value: %w", err)
	}
	return value, nil
}

// ListSecrets returns all secrets for a user (never includes the value).
func (s *SecretStore) ListSecrets(ctx context.Context, userID string) ([]models.Secret, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, user_id, name, created_at, updated_at
		 FROM secrets WHERE user_id = $1
		 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, fmt.Errorf("secret_store: list: %w", err)
	}
	defer rows.Close()

	var secrets []models.Secret
	for rows.Next() {
		var sec models.Secret
		if err := rows.Scan(&sec.ID, &sec.UserID, &sec.Name, &sec.CreatedAt, &sec.UpdatedAt); err != nil {
			return nil, fmt.Errorf("secret_store: list scan: %w", err)
		}
		secrets = append(secrets, sec)
	}
	return secrets, rows.Err()
}

// DeleteSecret removes a secret by ID, scoped to the owner.
// Returns ErrSecretNotFound if the secret doesn't belong to the user.
func (s *SecretStore) DeleteSecret(ctx context.Context, id, userID string) error {
	tag, err := s.pool.Exec(ctx,
		`DELETE FROM secrets WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	if err != nil {
		return fmt.Errorf("secret_store: delete: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrSecretNotFound
	}
	return nil
}

// ─── Sentinel errors ─────────────────────────────────────────────────────────

// ErrSecretNotFound is returned when a queried secret does not exist.
var ErrSecretNotFound = errors.New("store: secret not found")

// ErrDuplicateSecret is returned when a (user_id, name) pair already exists.
var ErrDuplicateSecret = errors.New("store: secret name already exists")
