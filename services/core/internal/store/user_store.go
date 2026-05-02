package store

import (
	"context"
	"errors"
	"fmt"

	"github.com/eulerbutcooler/iris/services/core/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// UserStore handles all user-related DB queries.
type UserStore struct {
	pool *pgxpool.Pool
}

// NewUserStore creates a UserStore backed by the given pool.
func NewUserStore(pool *pgxpool.Pool) *UserStore {
	return &UserStore{pool: pool}
}

// CreateUser inserts a new user record and returns it.
func (s *UserStore) CreateUser(ctx context.Context, email, passwordHash string) (*models.User, error) {
	row := s.pool.QueryRow(ctx,
		`INSERT INTO users (email, password_hash)
		 VALUES ($1, $2)
		 RETURNING id, email, created_at`,
		email, passwordHash,
	)

	var u models.User
	if err := row.Scan(&u.ID, &u.Email, &u.CreatedAt); err != nil {
		return nil, fmt.Errorf("user_store: create: %w", err)
	}
	return &u, nil
}

// GetUserForAuth returns the fields needed for bcrypt login verification.
// Returns ErrUserNotFound when the email doesn't exist.
func (s *UserStore) GetUserForAuth(ctx context.Context, email string) (id, storedHash string, user *models.User, err error) {
	var u models.User
	var hash string
	row := s.pool.QueryRow(ctx,
		`SELECT id, email, password_hash, created_at
		 FROM users WHERE email = $1`,
		email,
	)
	if err := row.Scan(&u.ID, &u.Email, &hash, &u.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", "", nil, ErrUserNotFound
		}
		return "", "", nil, fmt.Errorf("user_store: get for auth: %w", err)
	}
	return u.ID, hash, &u, nil
}

// GetUserByID returns the public User struct (no password hash).
// Returns ErrUserNotFound when the ID doesn't exist.
func (s *UserStore) GetUserByID(ctx context.Context, id string) (*models.User, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT id, email, created_at FROM users WHERE id = $1`,
		id,
	)

	var u models.User
	if err := row.Scan(&u.ID, &u.Email, &u.CreatedAt); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("user_store: get by id: %w", err)
	}
	return &u, nil
}

// ─── Sentinel errors ─────────────────────────────────────────────────────────

// ErrUserNotFound is returned when a queried user does not exist.
var ErrUserNotFound = errors.New("store: user not found")
