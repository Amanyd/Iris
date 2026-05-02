package encryptor

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
)

// Encryptor performs AES-GCM authenticated encryption.
type Encryptor struct {
	key []byte
}

// New creates an Encryptor from a 32-byte hex-encoded key (64 hex chars).
func New(hexKey string) (*Encryptor, error) {
	key, err := hex.DecodeString(hexKey)
	if err != nil {
		return nil, fmt.Errorf("encryptor: invalid hex key: %w", err)
	}
	if len(key) != 32 {
		return nil, fmt.Errorf("encryptor: key must be 32 bytes (64 hex chars), got %d", len(key))
	}
	return &Encryptor{key: key}, nil
}

// Encrypt encrypts plaintext using AES-256-GCM and returns a base64 string
// of the format: nonce || ciphertext.
func (e *Encryptor) Encrypt(plaintext string) (string, error) {
	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", fmt.Errorf("encryptor: create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("encryptor: create GCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("encryptor: generate nonce: %w", err)
	}

	// Seal appends the ciphertext + authentication tag to nonce.
	ciphertext := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(ciphertext), nil
}

// Decrypt decodes a base64 string produced by Encrypt and returns the original plaintext.
func (e *Encryptor) Decrypt(encoded string) (string, error) {
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("encryptor: base64 decode: %w", err)
	}

	block, err := aes.NewCipher(e.key)
	if err != nil {
		return "", fmt.Errorf("encryptor: create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("encryptor: create GCM: %w", err)
	}

	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return "", fmt.Errorf("encryptor: ciphertext too short")
	}

	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("encryptor: decrypt failed (wrong key or tampered data): %w", err)
	}

	return string(plaintext), nil
}
