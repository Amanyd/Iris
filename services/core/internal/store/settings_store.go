package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
)

// SettingsStore manages global system settings as a key-value table.
type SettingsStore struct {
	pool *pgxpool.Pool
}

func NewSettingsStore(pool *pgxpool.Pool) *SettingsStore {
	return &SettingsStore{pool: pool}
}

// Get returns the value for a key. Returns ("", nil) if the key doesn't exist.
func (s *SettingsStore) Get(ctx context.Context, key string) (string, error) {
	var value string
	err := s.pool.QueryRow(ctx,
		`SELECT value FROM system_settings WHERE key = $1`, key,
	).Scan(&value)
	if isNotFound(err) {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("settings_store: get %q: %w", key, err)
	}
	return value, nil
}

// Set upserts a key-value pair.
func (s *SettingsStore) Set(ctx context.Context, key, value string) error {
	_, err := s.pool.Exec(ctx,
		`INSERT INTO system_settings (key, value, updated_at)
		 VALUES ($1, $2, NOW())
		 ON CONFLICT (key) DO UPDATE
		   SET value = EXCLUDED.value,
		       updated_at = NOW()`,
		key, value,
	)
	if err != nil {
		return fmt.Errorf("settings_store: set %q: %w", key, err)
	}
	return nil
}

// GetAll returns every setting as a map.
func (s *SettingsStore) GetAll(ctx context.Context) (map[string]string, error) {
	rows, err := s.pool.Query(ctx, `SELECT key, value FROM system_settings ORDER BY key`)
	if err != nil {
		return nil, fmt.Errorf("settings_store: get_all: %w", err)
	}
	defer rows.Close()

	out := make(map[string]string)
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, fmt.Errorf("settings_store: scan: %w", err)
		}
		out[k] = v
	}
	return out, rows.Err()
}
