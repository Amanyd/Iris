package api

import (
	"errors"
	"net/http"
	"time"

	"github.com/eulerbutcooler/iris/services/core/internal/models"
	"github.com/eulerbutcooler/iris/services/core/internal/store"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

const jwtExpiry = 168 * time.Hour // 7 days

// Register handles POST /api/v1/auth/register.
func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req models.RegisterRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "email and password are required")
		return
	}
	if len(req.Password) < 8 {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "password must be at least 8 characters")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		h.log.Error("bcrypt hash", "err", err)
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to hash password")
		return
	}

	user, err := h.users.CreateUser(r.Context(), req.Email, string(hash))
	if err != nil {
		if errors.Is(err, store.ErrUserNotFound) {
			// CreateUser shouldn't return this but guard anyway
			writeError(w, http.StatusConflict, "VALIDATION_ERROR", "email already registered")
			return
		}
		// Duplicate email → unique constraint violation surfaced as internal error
		h.log.Error("create user", "err", err)
		writeError(w, http.StatusConflict, "VALIDATION_ERROR", "email already registered")
		return
	}

	token, err := h.signJWT(user.ID)
	if err != nil {
		h.log.Error("sign jwt", "err", err)
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to sign token")
		return
	}

	writeJSON(w, http.StatusCreated, models.AuthResponse{Token: token, User: *user})
}

// Login handles POST /api/v1/auth/login.
func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req models.LoginRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" {
		writeError(w, http.StatusBadRequest, "VALIDATION_ERROR", "email and password are required")
		return
	}

	id, storedHash, user, err := h.users.GetUserForAuth(r.Context(), req.Email)
	if err != nil {
		if errors.Is(err, store.ErrUserNotFound) {
			writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "invalid email or password")
			return
		}
		h.log.Error("get user for auth", "err", err)
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "login failed")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(storedHash), []byte(req.Password)); err != nil {
		writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "invalid email or password")
		return
	}

	token, err := h.signJWT(id)
	if err != nil {
		h.log.Error("sign jwt", "err", err)
		writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "failed to sign token")
		return
	}

	writeJSON(w, http.StatusOK, models.AuthResponse{Token: token, User: *user})
}

// signJWT creates a signed HS256 JWT with sub=userID and 7-day expiry.
func (h *Handler) signJWT(userID string) (string, error) {
	claims := jwt.MapClaims{
		"sub": userID,
		"jti": uuid.New().String(),
		"iat": time.Now().Unix(),
		"exp": time.Now().Add(jwtExpiry).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(h.cfg.JWTSecret))
}
