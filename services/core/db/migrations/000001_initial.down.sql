-- ============================================================
-- 000001_initial.down.sql
-- Tears down everything created by 000001_initial.up.sql
-- Drop in reverse dependency order.
-- ============================================================

DROP TABLE IF EXISTS execution_steps;
DROP TABLE IF EXISTS executions;
DROP TABLE IF EXISTS processed_events;
DROP TABLE IF EXISTS secrets;
DROP TABLE IF EXISTS relay_edges;
DROP TABLE IF EXISTS relay_actions;
DROP TABLE IF EXISTS relays;
DROP TABLE IF EXISTS users;
