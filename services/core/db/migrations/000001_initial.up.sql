-- ============================================================
-- 000001_initial.up.sql
-- Full Iris schema — consolidated baseline
-- ============================================================

-- Enable gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- relays
-- trigger_type: 'webhook' | 'cron' | 'manual'
-- trigger_config: {"cron": "0 * * * *"} for cron, {} for others
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS relays (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name           TEXT        NOT NULL,
    description    TEXT        NOT NULL DEFAULT '',
    is_active      BOOLEAN     NOT NULL DEFAULT TRUE,
    trigger_type   TEXT        NOT NULL DEFAULT 'webhook',
    trigger_config JSONB,
    next_run_at    TIMESTAMPTZ,
    last_run_at    TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_relays_user     ON relays(user_id);
CREATE INDEX IF NOT EXISTS idx_relays_next_run ON relays(next_run_at) WHERE trigger_type = 'cron' AND is_active = TRUE;

-- ------------------------------------------------------------
-- relay_actions (nodes in the DAG)
-- node_id: stable client-assigned ID (e.g. "node_abc123")
-- order_index: kept for legacy sorting, not used for execution order
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS relay_actions (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    relay_id     UUID        NOT NULL REFERENCES relays(id) ON DELETE CASCADE,
    node_id      TEXT        NOT NULL,
    action_type  TEXT        NOT NULL,
    config       JSONB       NOT NULL DEFAULT '{}',
    order_index  INTEGER     NOT NULL DEFAULT 0,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(relay_id, node_id)
);

CREATE INDEX IF NOT EXISTS idx_relay_actions_relay ON relay_actions(relay_id);

-- ------------------------------------------------------------
-- relay_edges (DAG directed edges between nodes)
-- condition: null = unconditional; {"result": true} = conditional
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS relay_edges (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    relay_id       UUID        NOT NULL REFERENCES relays(id) ON DELETE CASCADE,
    parent_node_id TEXT        NOT NULL,
    child_node_id  TEXT        NOT NULL,
    condition      JSONB,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(relay_id, parent_node_id, child_node_id),
    FOREIGN KEY (relay_id, parent_node_id) REFERENCES relay_actions(relay_id, node_id) ON DELETE CASCADE,
    FOREIGN KEY (relay_id, child_node_id)  REFERENCES relay_actions(relay_id, node_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_relay_edges_relay ON relay_edges(relay_id);
CREATE INDEX IF NOT EXISTS idx_relay_edges_child ON relay_edges(relay_id, child_node_id);

-- ------------------------------------------------------------
-- secrets (AES-GCM encrypted values)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS secrets (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name       TEXT        NOT NULL,
    value      TEXT        NOT NULL, -- AES-GCM base64 ciphertext
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_secrets_user ON secrets(user_id);

-- ------------------------------------------------------------
-- processed_events (deduplication — at-least-once delivery)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS processed_events (
    relay_id     UUID        NOT NULL REFERENCES relays(id) ON DELETE CASCADE,
    event_id     TEXT        NOT NULL,
    processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (relay_id, event_id)
);

-- ------------------------------------------------------------
-- executions (one row per relay run)
-- status: 'running' | 'success' | 'failed'
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS executions (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    relay_id        UUID        NOT NULL REFERENCES relays(id) ON DELETE CASCADE,
    event_id        TEXT,
    status          TEXT        NOT NULL DEFAULT 'running',
    trigger_payload JSONB,
    error_message   TEXT,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_executions_relay  ON executions(relay_id);
CREATE INDEX IF NOT EXISTS idx_executions_status ON executions(status);

-- ------------------------------------------------------------
-- execution_steps (per-node audit trail within one execution)
-- status: 'running' | 'success' | 'failed' | 'skipped'
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS execution_steps (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID        NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    node_id      TEXT,
    action_type  TEXT        NOT NULL,
    status       TEXT        NOT NULL DEFAULT 'running',
    input        JSONB,
    output       JSONB,
    error_message TEXT,
    started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_execution_steps_exec ON execution_steps(execution_id);
