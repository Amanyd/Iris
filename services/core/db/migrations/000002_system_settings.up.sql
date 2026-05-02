-- ============================================================
-- 000002_system_settings.up.sql
-- Key-value store for admin-configurable system settings
-- e.g. telegram_bot_token, telegram_bot_username
-- ============================================================

CREATE TABLE IF NOT EXISTS system_settings (
    key        TEXT        PRIMARY KEY,
    value      TEXT        NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
