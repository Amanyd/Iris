# IRIS — Exhaustive Build Roadmap

> **Iris** is the evolution of Hermes: a self-hosted, intelligent workflow automation platform with a Telegram bot interface, embedded LLM relay builder, visual DAG editor, and a fully revamped frontend. Named after the Greek goddess of the rainbow and messenger of the gods — Iris connects everything.

---

## Table of Contents

1. [What Is Iris?](#1-what-is-iris)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Design Philosophy & Best Practices](#3-design-philosophy--best-practices)
4. [Technology Stack](#4-technology-stack)
5. [Iris Design System — Color Scheme & Brand](#5-iris-design-system--color-scheme--brand)
6. [Monorepo Structure](#6-monorepo-structure)
7. [Database Schema — Full Evolution](#7-database-schema--full-evolution)
8. [Phase 0 — Foundation & Repository Setup](#8-phase-0--foundation--repository-setup)
9. [Phase 1 — Shared Library (`iris-common`)](#9-phase-1--shared-library-iris-common)
10. [Phase 2 — `iris-core` (REST API)](#10-phase-2--iris-core-rest-api)
11. [Phase 3 — `iris-hooks` (Webhook Ingestion)](#11-phase-3--iris-hooks-webhook-ingestion)
12. [Phase 4 — `iris-worker` (Execution Engine)](#12-phase-4--iris-worker-execution-engine)
13. [Phase 5 — Frontend Revamp](#13-phase-5--frontend-revamp)
14. [Phase 6 — LLM Embedded on Web (Chat-to-Relay)](#14-phase-6--llm-embedded-on-web-chat-to-relay)
15. [Phase 7 — `iris-telegram` (Telegram Bot + LLM)](#15-phase-7--iris-telegram-telegram-bot--llm)
16. [Phase 8 — Notifications & Real-Time Events](#16-phase-8--notifications--real-time-events)
17. [Phase 9 — Testing & Hardening](#17-phase-9--testing--hardening)
18. [Phase 10 — Infrastructure, Docker & Deployment](#18-phase-10--infrastructure-docker--deployment)
19. [Development Order Summary](#19-development-order-summary)
20. [Migration Timeline](#20-migration-timeline)
21. [Files Created / Changed Summary](#21-files-created--changed-summary)
22. [Open Questions & Future Roadmap](#22-open-questions--future-roadmap)

---

## 1. What Is Iris?

Iris is a **self-hosted, intelligent workflow automation platform** — think Zapier or Make.com, but one you own, run yourself, and talk to in plain English.

The core primitive is a **Relay**: a named workflow with one trigger (webhook, cron, or manual) and one or more action nodes wired together in a **Directed Acyclic Graph (DAG)**. When a trigger fires, Iris executes the DAG in topologically sorted, wave-parallel order.

**What makes Iris different from its Hermes predecessor:**

| Capability | Hermes | Iris |
|---|---|---|
| Workflow structure | Linear (`order_index`) | Full DAG (fan-out, fan-in, parallel) |
| Relay creation | Manual UI form | UI form + LLM chat + Telegram bot |
| Frontend design | Orange / dark (Hermes brand) | Violet-indigo / deep dark (Iris brand) |
| Telegram integration | ❌ | ✅ Full bot with conversational LLM |
| Web LLM chat | ❌ | ✅ Embedded AI assistant |
| Execution notifications | ❌ | ✅ Telegram push notifications |
| Project name | Hermes | **Iris** |

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Browser / Client                                │
│              (Next.js — Iris Design System)                             │
│                                                                         │
│   ┌──────────────────────────────────────────────────────────────┐      │
│   │  Dashboard · DAG Builder · Relay List · Secrets · Connections │      │
│   │                        +                                      │      │
│   │         🤖 Iris AI Chat (LLM relay builder in sidebar)       │      │
│   └──────────────────────────────────────────────────────────────┘      │
└────────────────────┬────────────────────────────────┬───────────────────┘
                     │ REST API                        │ Webhook POST
                     ▼                                 ▼
       ┌─────────────────────────┐      ┌──────────────────────────────┐
       │       iris-core          │      │         iris-hooks            │
       │  Auth · Relay CRUD ·    │      │  Webhook ingestion ·          │
       │  Secrets · Connections  │      │  NATS publisher               │
       │  Executions · AI Relay  │      │  (no DB access)               │
       │  Creation endpoint      │      │                               │
       └────────────┬────────────┘      └──────────────┬───────────────┘
                    │ publishes events.>               │ publishes events.>
                    └──────────────┬───────────────────┘
                                   ▼
                      ┌─────────────────────┐
                      │    NATS JetStream    │
                      │   (message broker)   │
                      └──────────┬──────────┘
                                 │ consumes
                                 ▼
                      ┌─────────────────────┐
                      │    iris-worker       │
                      │  WorkerPool (DAG)   │
                      │  CronScheduler      │
                      │  NATS Consumer      │
                      └──────────┬──────────┘
                                 │ reads/writes
                                 ▼
                      ┌─────────────────────┐
                      │     PostgreSQL       │
                      └─────────────────────┘

┌────────────────────────────────────────────────────────────┐
│              iris-telegram (separate Go service)            │
│                                                            │
│   Telegram User ──► Bot Handler ──► Session Manager        │
│                          │                                 │
│                          ▼                                 │
│                    LLM Client (OpenAI / Gemini)            │
│                          │                                 │
│                          ▼                                 │
│                    iris-core REST API                      │
│                    (POST /relays, GET /relays, etc.)       │
│                                                            │
│   Also subscribes to NATS for execution notifications      │
└────────────────────────────────────────────────────────────┘

┌────────────────────────────────────┐
│         iris-common (shared lib)   │
│  dag · templateengine · encryptor  │
│  cronutil · actions · oauth · logger│
└────────────────────────────────────┘
```

---

## 3. Design Philosophy & Best Practices

These principles are baked into every layer of Iris and must be maintained throughout development.

### 3.1 Monorepo with Go Workspaces

- All Go services and packages live in a single repo managed with `go.work`.
- Local packages are referenced by workspace path — no need to push before testing changes to `iris-common`.
- Each service has its own `go.mod` so it can be compiled and deployed independently.

### 3.2 Layered Architecture (per service)

Every backend service follows the same internal structure:

```
cmd/         → Entry point only (wire everything together, no logic)
internal/
  config/    → Env-based config with validation at startup
  api/       → HTTP handlers, middleware, router (thin layer, no business logic)
  store/     → All DB queries (raw SQL via pgx/pgxpool, no ORM)
  models/    → Request/response structs (shared via iris-common where needed)
  engine/    → Business logic, worker pools, schedulers
  integrations/ → Plugin implementations (one package per integration)
```

**Why:** Keeps concerns separated. Handlers don't know about SQL. Store doesn't know about HTTP. Business logic is testable in isolation.

### 3.3 Interface-Driven Design

Every major dependency is expressed as an interface:

```
ActionExecutor interface { Execute(...) }
RelayStore interface { CreateRelay(...), GetRelay(...), ... }
SecretStore interface { GetSecret(...), ... }
LLMClient interface { Chat(...) }
```

**Why:** Enables mocking in tests, swapping implementations (e.g. switching LLM providers), and parallel development.

### 3.4 Fail Fast at the Boundary

- DAG cycle detection runs at API layer (before DB write), not just at execution time.
- Config validation runs when a relay is created/updated.
- Invalid requests get a descriptive `400` with a machine-readable `code` field (`VALIDATION_ERROR`, `CYCLE_DETECTED`, etc.).

### 3.5 Secrets — Never in Plaintext

- Secret values are encrypted with AES-GCM before writing to the DB.
- Decryption happens only at execution time inside the worker.
- `redactConfig()` strips secret-ref fields from logs before they are persisted.
- The `_ref` suffix convention (`"webhook_url_ref": "my_secret_name"`) makes it clear in configs that a field is a secret reference, not a literal value.

### 3.6 At-Least-Once Delivery with Deduplication

- NATS JetStream guarantees at-least-once delivery of webhook events.
- `processed_events` table with `UNIQUE(relay_id, event_id)` prevents duplicate execution.
- On duplicate, the worker silently skips (no error, no re-execution).

### 3.7 Graceful Shutdown Order

```
1. Stop NATS consumer  → no new messages enter the job channel
2. Stop cron scheduler → no new cron jobs enqueued
3. Shutdown worker pool → wait for in-flight jobs to complete
4. Close DB pool        → clean connection teardown
```

This order is critical: producers must stop before consumers, and consumers must drain before the DB is closed.

### 3.8 Structured Logging

- All services use `slog`-based structured logging from `iris-common/pkg/logger`.
- Every log entry carries service name, request ID, user ID (where applicable), relay ID, execution ID.
- Log levels: `DEBUG` (dev), `INFO` (prod default), `WARN` / `ERROR` (always emitted).

### 3.9 SQL-First, No ORM

- All DB access is raw SQL via `pgx/pgxpool`.
- Migrations are plain `.sql` files managed by `golang-migrate`.
- Queries are in the `store/` layer, one file per entity (e.g. `relay_store.go`, `user_store.go`).
- **Why:** Full control over query shapes, indexes, and JSONB operators. ORMs hide performance problems.

### 3.10 Frontend Best Practices

- Next.js App Router with TypeScript.
- `@tanstack/react-query` for all server state (no manual fetch state).
- `zod` for form validation schemas.
- `react-hook-form` + `@hookform/resolvers` for forms.
- `@xyflow/react` for the visual DAG builder.
- `Biome` for formatting and linting (replaces ESLint + Prettier).
- All API calls in `src/lib/api.ts` (one source of truth for HTTP).
- Component co-location: page-specific components live next to their page file.

---

## 4. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Backend language | **Go 1.22+** | Minimal overhead, strong concurrency, fast compile |
| Frontend | **Next.js 15+ (App Router) + TypeScript** | Full-stack React with type safety |
| HTTP router | **chi** | Lightweight idiomatic Go router, composable middleware |
| Message broker | **NATS JetStream** | Persistent at-least-once delivery, durable consumers, low latency |
| Database | **PostgreSQL 16** | JSONB for flexible configs, FK integrity for graph edges |
| DB driver | **pgx / pgxpool** | High-perf native Go driver, connection pooling |
| DB migrations | **golang-migrate** (SQL files) | Plain SQL, easy inspection and rollback |
| Auth | **JWT (golang-jwt, HS256, 168h expiry)** | Stateless, fast to verify |
| Password hashing | **bcrypt** | Standard adaptive hashing |
| Secret encryption | **AES-GCM** | Authenticated encryption, tamper-evident |
| OAuth | **Google + Microsoft** | Email integration via OAuth2 PKCE |
| LLM (backend) | **OpenAI API / Gemini API** | Structured JSON output for relay generation |
| LLM (Go client) | **go-openai** or official Gemini SDK | Provider-swappable via `LLMClient` interface |
| Telegram bot | **go-telegram-bot-api/v5** | Official Telegram Bot API Go client |
| Containerisation | **Docker + Docker Compose** | Dev/prod parity |
| Frontend linting | **Biome** | Fast JS/TS formatter + linter in one tool |
| Monorepo (Go) | **go.work (Go workspaces)** | Local module cross-referencing |
| Node graph UI | **@xyflow/react (React Flow)** | Standard for visual workflow editors |
| State management | **@tanstack/react-query** | Server state, caching, invalidation |
| Form validation | **zod + react-hook-form** | Type-safe schema-driven forms |

---

## 5. Iris Design System — Color Scheme & Brand

### 5.1 The Iris Brand

Iris is named after the Greek goddess of the rainbow and divine messenger. The visual identity reflects:
- **Depth**: Deep, dark backgrounds (near-black with blue undertones)
- **Intelligence**: Violet and indigo primaries (AI, mystery, precision)
- **Speed**: Cyan and teal accents (connection, data flow, velocity)
- **Status**: Green (success), Amber (warning), Red (error)

### 5.2 Color Palette

```
/* Iris Design Tokens — globals.css */

:root {
  /* Backgrounds */
  --iris-bg-base:      #080810;   /* Page background — deepest dark */
  --iris-bg-surface:   #0E0E1A;   /* Cards, panels */
  --iris-bg-elevated:  #14142A;   /* Dropdowns, modals, tooltips */
  --iris-bg-overlay:   #1C1C3A;   /* Hover states, selected rows */

  /* Primary — Violet */
  --iris-violet-300:   #C4B5FD;   /* Light text on dark */
  --iris-violet-400:   #A78BFA;   /* Subtle accent, tags */
  --iris-violet-500:   #8B5CF6;   /* Primary interactive (buttons, links) */
  --iris-violet-600:   #7C3AED;   /* Hover state for primary */
  --iris-violet-700:   #6D28D9;   /* Active/pressed */
  --iris-violet-900:   #2E1065;   /* Filled backgrounds (badges) */

  /* Secondary — Indigo */
  --iris-indigo-400:   #818CF8;
  --iris-indigo-500:   #6366F1;   /* Secondary accent */
  --iris-indigo-600:   #4F46E5;

  /* Accent — Cyan */
  --iris-cyan-300:     #67E8F9;
  --iris-cyan-400:     #22D3EE;   /* Highlight, flow lines, connections */
  --iris-cyan-500:     #06B6D4;

  /* Borders */
  --iris-border-subtle:  rgba(139, 92, 246, 0.12);  /* Default borders */
  --iris-border-default: rgba(139, 92, 246, 0.25);  /* Focused/active */
  --iris-border-strong:  rgba(139, 92, 246, 0.50);  /* Highlighted elements */

  /* Text */
  --iris-text-primary:   #F0EEFF;   /* Main text */
  --iris-text-secondary: #A89EC9;   /* Dimmed labels */
  --iris-text-muted:     #6B6385;   /* Placeholders, disabled */

  /* Status */
  --iris-success:  #10B981;  /* Green */
  --iris-warning:  #F59E0B;  /* Amber */
  --iris-error:    #EF4444;  /* Red */
  --iris-info:     #06B6D4;  /* Cyan */

  /* Gradients */
  --iris-gradient-primary: linear-gradient(135deg, #8B5CF6 0%, #6366F1 50%, #06B6D4 100%);
  --iris-gradient-subtle:  linear-gradient(135deg, rgba(139,92,246,0.15) 0%, rgba(6,182,212,0.05) 100%);
}
```

### 5.3 Typography

- **Font**: `Inter` (primary) — clean, legible, professional
- **Monospace**: `JetBrains Mono` — code blocks, node IDs, template expressions
- Base size: `16px` (dashboard), `14px` (dense tables)
- Weights: 400 (body), 500 (labels), 600 (headings), 700 (CTAs)

### 5.4 Component Design Language

| Component | Style |
|---|---|
| Buttons (primary) | Violet gradient fill, white text, 8px radius, subtle glow on hover |
| Buttons (secondary) | Transparent, violet border, violet text |
| Inputs | `--iris-bg-surface` fill, `--iris-border-subtle` border, violet focus ring |
| Cards | `--iris-bg-surface`, 1px `--iris-border-subtle` border, 12px radius |
| Sidebar | `--iris-bg-surface`, violet accent for active items |
| DAG nodes (action) | Violet gradient header, dark body, cyan connection handles |
| DAG edges | Animated cyan/indigo gradient stroke |
| Success state | Emerald green glow |
| Failed state | Red border + glow |
| Running state | Animated violet pulse |

---

## 6. Monorepo Structure

```
iris/                                   ← root (renamed from hermes/)
├── go.work                             ← Go workspace linking all modules
├── go.work.sum
├── docker-compose.yml                  ← Postgres + NATS + all services
├── Makefile                            ← Dev, build, migration, infra commands
├── .env.example                        ← Template for required env vars
├── .gitignore
├── ROADMAPIRIS.md                      ← This file
│
├── packages/
│   └── iris-common/                    ← Shared Go library (module: iris-common)
│       ├── go.mod
│       └── pkg/
│           ├── dag/                    ← DAG graph, cycle detection, wave scheduling
│           │   ├── dag.go
│           │   ├── dag_test.go
│           │   ├── scheduler.go
│           │   └── scheduler_test.go
│           ├── templateengine/         ← {{expr}} resolver
│           │   ├── engine.go
│           │   └── engine_test.go
│           ├── cronutil/               ← Cron expression parser
│           │   └── cronutil.go
│           ├── encryptor/              ← AES-GCM encrypt/decrypt
│           │   └── encryptor.go
│           ├── actions/                ← Action type registry + config validation
│           │   ├── actions.go
│           │   └── actions_test.go
│           ├── oauth/                  ← Google + Microsoft OAuth providers
│           │   └── oauth.go
│           └── logger/                 ← Structured slog factory
│               └── logger.go
│
└── services/
    ├── iris-core/                      ← REST API service
    │   ├── go.mod
    │   ├── Dockerfile
    │   ├── cmd/
    │   │   └── api/
    │   │       └── main.go
    │   ├── db/
    │   │   └── migrations/             ← Numbered SQL migration files
    │   └── internal/
    │       ├── config/                 ← Env-based config struct
    │       ├── api/                    ← Handlers, middleware, router
    │       │   ├── router.go
    │       │   ├── handlers.go         ← Relay CRUD, executions
    │       │   ├── auth_handlers.go    ← Register, login
    │       │   ├── oauth_handlers.go   ← OAuth callback, connections
    │       │   ├── ai_handlers.go      ← NEW: LLM relay generation endpoint
    │       │   ├── middleware.go       ← JWT auth middleware
    │       │   └── interfaces.go       ← Store interfaces
    │       ├── models/                 ← Request/response structs
    │       │   └── models.go
    │       ├── store/                  ← DB query layer
    │       │   ├── user_store.go
    │       │   ├── relay_store.go
    │       │   ├── secret_store.go
    │       │   └── connections_store.go
    │       ├── db/                     ← DB connection setup
    │       └── queue/                  ← NATS publisher (for manual trigger)
    │
    ├── iris-hooks/                     ← Webhook ingestion service
    │   ├── go.mod
    │   ├── Dockerfile
    │   ├── cmd/server/main.go
    │   └── internal/
    │       ├── api/                    ← Single handler: POST /hooks/:relayID
    │       ├── queue/                  ← NATS publisher
    │       └── config/
    │
    ├── iris-worker/                    ← Execution engine service
    │   ├── go.mod
    │   ├── Dockerfile
    │   ├── cmd/main.go
    │   └── internal/
    │       ├── config/
    │       ├── engine/
    │       │   ├── worker_pool.go      ← N goroutines draining job channel
    │       │   ├── executor.go         ← DAG wave executor (process())
    │       │   ├── cron_scheduler.go   ← 30s ticker, poll DB for due crons
    │       │   └── registry.go         ← Map[actionType]ActionExecutor
    │       ├── queue/                  ← NATS JetStream consumer
    │       ├── store/                  ← Worker-side DB queries
    │       └── integrations/           ← Action plugin implementations
    │           ├── debug/
    │           ├── discord/
    │           ├── slack/
    │           ├── httpreq/
    │           ├── email/
    │           └── condition/          ← NEW: conditional branching node
    │
    └── iris-telegram/                  ← NEW: Telegram bot + LLM service
        ├── go.mod
        ├── Dockerfile
        ├── .env
        ├── cmd/bot/main.go
        └── internal/
            ├── config/                 ← Env-based config
            ├── bot/
            │   ├── bot.go              ← Telegram bot setup, command routing
            │   ├── handlers.go         ← Message + command handlers
            │   └── session.go          ← Per-user conversation state machine
            ├── ai/
            │   ├── client.go           ← LLMClient interface + OpenAI impl
            │   ├── prompts.go          ← System prompts, few-shot examples
            │   └── parser.go           ← Parse LLM JSON → CreateRelayRequest
            └── iris/
                └── client.go           ← HTTP client for iris-core API

web/                                    ← Next.js frontend
├── src/
│   ├── app/
│   │   ├── layout.tsx                  ← Root layout, Iris font, global CSS
│   │   ├── page.tsx                    ← Landing page (Iris brand)
│   │   ├── globals.css                 ← Iris design tokens, CSS variables
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   └── register/page.tsx
│   │   └── dashboard/
│   │       ├── layout.tsx              ← Sidebar + AI chat panel
│   │       ├── relays/
│   │       │   ├── page.tsx            ← Relay list
│   │       │   ├── new/page.tsx        ← New relay form
    │       │   ├── builder/page.tsx    ← Visual DAG builder
│   │       │   └── [id]/page.tsx       ← Relay detail + execution history
│   │       ├── secrets/page.tsx
│   │       └── connections/page.tsx
│   ├── components/
│   │   ├── ui/                         ← NEW: Iris UI primitives (Button, Input, Card, Badge)
│   │   ├── sidebar.tsx                 ← Iris-branded sidebar
│   │   ├── ai-chat/                    ← NEW: LLM chat panel components
│   │   │   ├── chat-panel.tsx          ← Collapsible chat sidebar
│   │   │   ├── chat-message.tsx        ← Individual message bubble
│   │   │   ├── relay-preview.tsx       ← Structured relay preview card
│   │   │   └── chat-input.tsx          ← Input + send button
│   │   └── workflow/
│   │       ├── workflow-canvas.tsx     ← React Flow canvas
│   │       ├── workflow-provider.tsx   ← React Flow context
│   │       ├── nodes/
│   │       │   ├── trigger-node.tsx
│   │       │   ├── action-node.tsx
│   │       │   └── condition-node.tsx
│   │       ├── edges/
│   │       ├── sidebar/
│   │       └── toolbar/
│   ├── context/
│   │   ├── auth-context.tsx
│   │   └── query-provider.tsx
│   ├── lib/
│   │   ├── api.ts                      ← All HTTP calls to iris-core
│   │   ├── api-dag.ts                  ← DAG-specific API calls
│   │   ├── api-ai.ts                   ← NEW: LLM chat API calls
│   │   ├── dag-utils.ts                ← Client-side DAG utilities
│   │   ├── queries.ts                  ← React Query query/mutation defs
│   │   └── workflow-serializer.ts      ← React Flow ↔ API format conversion
│   └── types/
│       ├── relay.ts
│       ├── workflow.ts
│       ├── auth.ts
│       └── ai.ts                       ← NEW: LLM chat message types
```

---

## 7. Database Schema — Full Evolution

### Migration 000001 — Initial Schema

```sql
-- users, relays (linear), relay_actions (order_index), execution_logs
```

### Migration 000002 — Processed Events (Deduplication)

```sql
CREATE TABLE processed_events (
    relay_id UUID, event_id TEXT,
    UNIQUE(relay_id, event_id)
);
```

### Migration 000003 — Secrets

```sql
CREATE TABLE secrets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    value TEXT NOT NULL,  -- AES-GCM encrypted
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, name)
);
```

### Migration 000004 — OAuth Connections

```sql
CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    access_token TEXT NOT NULL,   -- encrypted
    refresh_token TEXT NOT NULL,  -- encrypted
    account_email TEXT NOT NULL,
    scopes TEXT NOT NULL DEFAULT '',
    token_expiry TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Migration 000005 — Execution Steps

```sql
-- Replaces execution_logs with detailed per-step audit trail
CREATE TABLE executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relay_id UUID NOT NULL REFERENCES relays(id) ON DELETE CASCADE,
    event_id TEXT,
    status TEXT NOT NULL DEFAULT 'running',
    trigger_payload JSONB,
    error_message TEXT,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP
);

CREATE TABLE execution_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    node_id TEXT,
    action_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running',
    input JSONB,
    output JSONB,
    error_message TEXT,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP
);
```

### Migration 000006 — Cron & Manual Triggers

```sql
ALTER TABLE relays
    ADD COLUMN trigger_type TEXT NOT NULL DEFAULT 'webhook',
    ADD COLUMN trigger_config JSONB,
    ADD COLUMN next_run_at TIMESTAMP,
    ADD COLUMN last_run_at TIMESTAMP;
```

### Migration 000007 — DAG Edges

```sql
-- Add stable node_id to relay_actions
ALTER TABLE relay_actions ADD COLUMN IF NOT EXISTS node_id TEXT;
UPDATE relay_actions SET node_id = 'node_' || order_index WHERE node_id IS NULL;
ALTER TABLE relay_actions ALTER COLUMN node_id SET NOT NULL;
ALTER TABLE relay_actions ADD CONSTRAINT uq_relay_actions_node_id UNIQUE (relay_id, node_id);

-- Edge table
CREATE TABLE IF NOT EXISTS relay_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    relay_id UUID NOT NULL REFERENCES relays(id) ON DELETE CASCADE,
    parent_node_id TEXT NOT NULL,
    child_node_id  TEXT NOT NULL,
    condition JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(relay_id, parent_node_id, child_node_id),
    FOREIGN KEY (relay_id, parent_node_id) REFERENCES relay_actions(relay_id, node_id) ON DELETE CASCADE,
    FOREIGN KEY (relay_id, child_node_id)  REFERENCES relay_actions(relay_id, node_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_relay_edges_relay ON relay_edges(relay_id);
CREATE INDEX IF NOT EXISTS idx_relay_edges_child ON relay_edges(relay_id, child_node_id);
```

### Migration 000008 — Telegram User Links (NEW)

```sql
CREATE TABLE IF NOT EXISTS telegram_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    telegram_user_id BIGINT NOT NULL UNIQUE,
    telegram_username TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_telegram_links_user ON telegram_links(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_links_tg   ON telegram_links(telegram_user_id);
```

### Migration 000009 — AI Chat Sessions (NEW)

```sql
-- Persists LLM conversation history per user session (optional, for multi-session recall)
CREATE TABLE IF NOT EXISTS ai_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    channel TEXT NOT NULL DEFAULT 'web',  -- 'web' | 'telegram'
    messages JSONB NOT NULL DEFAULT '[]',
    draft_relay JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_user ON ai_sessions(user_id);
```

---

## 8. Phase 0 — Foundation & Repository Setup

**Goal:** Rename from Hermes to Iris, set up the monorepo skeleton, infrastructure, and developer tooling.

**Duration:** 1–2 days

### 8.1 Repository Rename

- Rename root directory from `hermes/` to `iris/`.
- Update all `go.mod` module names: `hermes-common` → `iris-common`, `hermes-core` → `iris-core`, etc.
- Update all `go.work` `use` directives.
- Update all `import` paths across all Go files.
- Update service names in `docker-compose.yml`.
- Update `Makefile` commands (`dev-core`, `dev-hooks`, `dev-worker`, `dev-telegram`).
- Update all README files.

### 8.2 Environment Variables

```env
# .env.example — root level

# Infrastructure
DATABASE_URL=postgres://user:password@localhost:5432/iris?sslmode=disable
NATS_URL=nats://localhost:4222

# iris-core
JWT_SECRET=change-me-to-a-256-bit-random-string
ENCRYPTION_KEY=change-me-to-a-32-byte-hex-string
FRONTEND_URL=http://localhost:3001
CORE_PORT=3000

# OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=

# iris-hooks
HOOKS_PORT=8080

# iris-telegram (NEW)
TELEGRAM_BOT_TOKEN=
LLM_PROVIDER=openai           # openai | gemini | anthropic
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini
IRIS_CORE_URL=http://localhost:3000

# iris-core AI endpoint (NEW)
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini
LLM_PROVIDER=openai
```

### 8.3 Go Workspace

```go
// go.work
go 1.22

use (
    ./packages/iris-common
    ./services/iris-core
    ./services/iris-hooks
    ./services/iris-worker
    ./services/iris-telegram
)
```

### 8.4 Docker Compose (Full Stack)

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    container_name: iris-postgres
    environment:
      POSTGRES_DB: iris
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    ports: ["5432:5432"]
    volumes: [postgres_data:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d iris"]
      interval: 5s; timeout: 5s; retries: 5

  nats:
    image: nats:latest
    container_name: iris-nats
    command: "-js -m 8222"
    ports: ["4222:4222", "8222:8222"]

  iris-core:
    build: ./services/iris-core
    env_file: .env
    depends_on: [postgres, nats]
    ports: ["3000:3000"]

  iris-hooks:
    build: ./services/iris-hooks
    env_file: .env
    depends_on: [nats]
    ports: ["8080:8080"]

  iris-worker:
    build: ./services/iris-worker
    env_file: .env
    depends_on: [postgres, nats]

  iris-telegram:
    build: ./services/iris-telegram
    env_file: .env
    depends_on: [postgres, nats, iris-core]

volumes:
  postgres_data:
networks:
  default:
    name: iris-network
```

### 8.5 Makefile Targets

```makefile
# Full set of Makefile targets for Iris

infra-up          # docker compose up -d
infra-down        # docker compose down
infra-logs        # docker compose logs -f
infra-clean       # docker compose down -v (WARNING: deletes data)

db-migrate-up     # golang-migrate up
db-migrate-down   # golang-migrate down 1
db-migrate-create # create new migration pair (NAME=...)
db-reset          # drop all + re-migrate
db-shell          # psql into container
db-status         # show table row counts

setup             # infra-up + db-migrate-up (first-time setup)
check             # health check all infrastructure

dev-core          # go run ./services/iris-core/cmd/api
dev-hooks         # go run ./services/iris-hooks/cmd/server
dev-worker        # go run ./services/iris-worker/cmd
dev-telegram      # go run ./services/iris-telegram/cmd/bot
dev-all           # all 4 services concurrently (-j4)
dev-web           # cd web && npm run dev

build             # build all Go services into bin/
test              # go test ./...
lint              # golangci-lint run ./...
```

---

## 9. Phase 1 — Shared Library (`iris-common`)

**Goal:** Build all shared utilities that every service depends on. This must be done first because everything imports from here.

**Duration:** 1 week

**Order of implementation:**

### 9.1 `pkg/logger` — Structured Logging

```go
// logger.go
func New(serviceName string, level slog.Level) *slog.Logger
func WithRequestID(ctx context.Context, id string) context.Context
func WithRelayID(ctx context.Context, id string) context.Context
func WithUserID(ctx context.Context, id string) context.Context
func FromContext(ctx context.Context) *slog.Logger
```

**Build first** because every other package needs logging.

### 9.2 `pkg/encryptor` — AES-GCM Encryption

```go
// encryptor.go
type Encryptor struct { key []byte }
func New(hexKey string) (*Encryptor, error)
func (e *Encryptor) Encrypt(plaintext string) (string, error)  // returns base64
func (e *Encryptor) Decrypt(ciphertext string) (string, error) // from base64
```

### 9.3 `pkg/cronutil` — Cron Parsing

```go
// cronutil.go
func NextRun(expr string, from time.Time) (time.Time, error)
func IsValid(expr string) bool
```

### 9.4 `pkg/dag` — DAG Graph, Cycle Detection, Wave Scheduling

This is the most critical shared library. All four phases of DAG work depend on it.

```go
// dag.go
package dag

type Node struct {
    ID string
}

type Edge struct {
    From      string
    To        string
    Condition map[string]any  // nil = unconditional
}

type Graph struct {
    nodes    map[string]Node
    outEdges map[string][]Edge  // node → downstream edges
    inEdges  map[string][]Edge  // node → upstream edges
}

// New constructs a Graph. Returns error if a cycle is detected (Kahn's algorithm).
func New(nodes []Node, edges []Edge) (*Graph, error)

// TopologicalOrder returns all node IDs in a valid execution order.
func (g *Graph) TopologicalOrder() []string

// Waves returns groups of nodes that can execute in parallel.
// Wave 0 = root nodes (no dependencies).
// Wave N = nodes whose all parents are in waves 0..N-1.
func (g *Graph) Waves() [][]string

// RootNodes returns node IDs with no incoming edges.
func (g *Graph) RootNodes() []string

// Parents returns the IDs of all direct parents of a node.
func (g *Graph) Parents(nodeID string) []string

// Children returns the IDs of all direct children of a node.
func (g *Graph) Children(nodeID string) []string
```

**Kahn's Algorithm (cycle detection):**

```
1. Compute in-degree of every node (count of incoming edges).
2. Enqueue all nodes with in-degree = 0 (roots).
3. While queue is non-empty:
   - Dequeue node N, increment visitedCount.
   - For each child C of N: decrement C's in-degree.
   - If C's in-degree == 0: enqueue C.
4. If visitedCount < len(nodes): CYCLE DETECTED → return error.
```

**Wave Scheduling:**

```
Wave 0 ← all nodes with in-degree = 0
For each wave W:
  For each node in W:
    Decrement in-degree of all children
    Collect newly-zero-in-degree children → Wave W+1
Repeat until no nodes remain.
```

**Tests to write (`dag_test.go`):**

- Single node (trivial graph)
- Linear chain: A → B → C (one wave each)
- Diamond: A → B, A → C, B → D, C → D (waves: [A], [B,C], [D])
- Fan-out: A → B, A → C, A → D (waves: [A], [B,C,D])
- Cycle: A → B → A (must return error)
- Self-loop: A → A (must return error)
- Disconnected subgraph: [A→B], [C→D] (valid, two roots)
- Empty graph (no nodes, no edges — valid, zero waves)

### 9.5 `pkg/templateengine` — Expression Resolver

```go
// engine.go
package templateengine

type StepOutput struct {
    Output map[string]any
    Error  string
}

// Resolve replaces {{expr}} patterns in a config map.
// payload: the raw trigger payload JSON
// steps: map[nodeID] → StepOutput of completed nodes
func Resolve(config map[string]any, payload []byte, steps map[string]StepOutput) (map[string]any, error)
```

**Supported expression patterns:**

| Pattern | Resolves to |
|---|---|
| `{{payload}}` | Full raw trigger payload |
| `{{payload.user.name}}` | Deep field access in payload |
| `{{steps['node_id'].output}}` | Full output of a completed node |
| `{{steps['node_id'].output.field}}` | Specific field from a node's output |
| `{{steps['node_id'].error}}` | Error message of a failed node |

**Implementation:**

1. Walk every string value in `config` (recursively for nested maps/arrays).
2. Use `regexp.FindAllStringSubmatch` to find all `{{...}}` patterns.
3. Parse the expression: split on `.`, check first segment for `payload` or `steps['id']`.
4. Use reflection or JSON unmarshal → `map[string]any` traversal to resolve deep paths.
5. If resolution fails (missing key, nil parent): return the original `{{expr}}` unchanged and log a warning (don't panic).

### 9.6 `pkg/oauth` — OAuth Providers

```go
// oauth.go
type Provider interface {
    AuthURL(state string) string
    ExchangeCode(ctx context.Context, code string) (*Token, error)
    RefreshToken(ctx context.Context, refreshToken string) (*Token, error)
    GetEmail(ctx context.Context, accessToken string) (string, error)
}

type Token struct {
    AccessToken  string
    RefreshToken string
    Expiry       time.Time
    Scopes       []string
}

func NewGoogleProvider(clientID, clientSecret, redirectURL string) Provider
func NewMicrosoftProvider(clientID, clientSecret, redirectURL string) Provider
```

### 9.7 `pkg/actions` — Action Registry & Validation

```go
// actions.go
type ActionConfig struct {
    Type        string
    Description string
    Fields      []FieldSpec  // name, type, required, description
}

type FieldSpec struct {
    Name        string
    Type        string  // "string" | "int" | "bool" | "map" | "secret_ref"
    Required    bool
    Description string
}

// Types returns all registered action type names.
func Types() []string

// Get returns the config spec for an action type, or false if not found.
func Get(actionType string) (ActionConfig, bool)

// ValidateConfig checks that a config map satisfies the ActionConfig spec.
func ValidateConfig(actionType string, config map[string]any) error
```

**Registered action types (build these config specs):**

- `debug_log` — `message` (string, required)
- `discord_send` — `webhook_url_ref` (secret_ref, required), `message` (string, required)
- `slack_send` — `webhook_url_ref` (secret_ref, required), `message` (string, required)
- `http_request` — `url` (string, required), `method` (string, required), `headers` (map, optional), `body` (string, optional)
- `email_send` — `connection_id` (string, required), `to` (string, required), `subject` (string, required), `body` (string, required)
- `condition` — `expr` (string, required) — NEW for conditional branching

---

## 10. Phase 2 — `iris-core` (REST API)

**Goal:** The primary REST API. Auth, relay CRUD, secrets, OAuth connections, execution history, and the new LLM relay generation endpoint.

**Duration:** 1.5 weeks

**Build order within this phase:**

### 10.1 Config (`internal/config/config.go`)

```go
type Config struct {
    Port         string
    DatabaseURL  string
    NATSURL      string
    JWTSecret    string
    EncryptionKey string
    FrontendURL  string
    // OAuth
    GoogleClientID     string
    GoogleClientSecret string
    MicrosoftClientID  string
    MicrosoftClientSecret string
    // LLM (for AI relay generation endpoint)
    LLMProvider string  // "openai" | "gemini"
    LLMAPIKey   string
    LLMModel    string
}

func Load() (*Config, error)  // reads from env, validates required fields
```

### 10.2 Models (`internal/models/models.go`)

All request/response structs. Already defined — review and extend:

```go
// NEW: AI relay generation
type AIRelayRequest struct {
    Message      string    `json:"message"`       // user's natural language description
    Conversation []AIMessage `json:"conversation"` // prior messages for multi-turn
}

type AIMessage struct {
    Role    string `json:"role"`    // "user" | "assistant"
    Content string `json:"content"`
}

type AIRelayResponse struct {
    Ready     bool                 `json:"ready"`
    Questions []string             `json:"questions,omitempty"`
    Relay     *CreateRelayRequest  `json:"relay,omitempty"`
    Message   string               `json:"message,omitempty"` // assistant's text response
}
```

### 10.3 Database Setup (`internal/db/db.go`)

```go
func Connect(ctx context.Context, databaseURL string) (*pgxpool.Pool, error)
```

### 10.4 Store Layer (`internal/store/`)

Build in this order:

1. **`user_store.go`** — `CreateUser`, `GetUserByEmail`, `GetUserByID`
2. **`secret_store.go`** — `CreateSecret`, `GetSecret`, `ListSecrets`, `DeleteSecret`
3. **`connections_store.go`** — `CreateConnection`, `GetConnection`, `ListConnections`, `DeleteConnection`, `UpdateConnectionTokens`
4. **`relay_store.go`** — most complex, includes DAG:
   - `CreateRelay(ctx, req CreateRelayRequest) (*RelayWithActions, error)` — inserts relay + actions + edges in one transaction
   - `GetRelay(ctx, id string) (*RelayWithActions, error)` — JOINs actions + edges
   - `GetRelayGraph(ctx, id string) ([]RelayAction, []RelayEdge, error)` — used by worker
   - `GetAllRelays(ctx, userID string) ([]Relay, error)`
   - `UpdateRelay(ctx, id string, req UpdateRelayRequest) (*Relay, error)`
   - `UpdateRelayActions(ctx, id string, req UpdateRelayActionsRequest) (*RelayWithActions, error)` — delete-and-replace in transaction
   - `DeleteRelay(ctx, id string) error`
   - `GetExecution(ctx, id string) (*Execution, error)`
   - `GetExecutions(ctx, relayID string) ([]Execution, error)`
   - `GetExecutionSteps(ctx, executionID string) ([]ExecutionStep, error)`
   - `DeleteExecution(ctx, id string) error`

### 10.5 NATS Queue Publisher (`internal/queue/publisher.go`)

```go
type Publisher struct { js nats.JetStreamContext }
func NewPublisher(natsURL string) (*Publisher, error)
func (p *Publisher) Publish(ctx context.Context, relayID string, payload []byte) error
```

Used by the manual trigger endpoint.

### 10.6 API Handlers (`internal/api/`)

Build in this order:

**`interfaces.go`** — define all store interfaces used by handlers:

```go
type RelayStore interface {
    CreateRelay(ctx context.Context, req models.CreateRelayRequest) (*models.RelayWithActions, error)
    GetRelay(ctx context.Context, id string) (*models.RelayWithActions, error)
    // ... all relay store methods
}

type SecretStore interface { ... }
type UserStore interface { ... }
type ConnectionStore interface { ... }
```

**`middleware.go`** — JWT auth middleware:

```go
func JWTAuth(secret string) func(http.Handler) http.Handler
// Extracts JWT from Authorization: Bearer <token>
// Validates signature + expiry
// Sets user_id in context via chi.RouteContext
```

**`auth_handlers.go`** — `Register`, `Login`:

```go
// POST /api/v1/auth/register
// POST /api/v1/auth/login
// → returns AuthResponse{Token, User}
```

**`oauth_handlers.go`** — `ConnectProvider`, `OAuthCallback`, `ListConnections`, `DeleteConnection`:

```go
// GET /api/v1/connections/{provider}/connect → redirects to OAuth consent
// GET /api/v1/auth/callback/{provider}       → exchanges code, stores tokens
// GET /api/v1/connections                    → list user's connections
// DELETE /api/v1/connections/{id}            → revoke connection
```

**`handlers.go`** — core relay CRUD + execution history:

```go
// POST   /api/v1/relays                      → CreateRelay
// GET    /api/v1/relays                      → GetAllRelays
// GET    /api/v1/relays/{id}                 → GetRelay
// PUT    /api/v1/relays/{id}                 → UpdateRelay
// PUT    /api/v1/relays/{id}/actions         → UpdateRelayActions
// DELETE /api/v1/relays/{id}                 → DeleteRelay
// POST   /api/v1/relays/{id}/trigger         → TriggerRelay (publish to NATS)
// GET    /api/v1/relays/{id}/executions      → GetExecutions
// GET    /api/v1/executions/{id}/steps       → GetExecutionSteps
// DELETE /api/v1/executions/{id}             → DeleteExecution
// GET    /api/v1/secrets                     → ListSecrets
// POST   /api/v1/secrets                     → CreateSecret
// DELETE /api/v1/secrets/{id}                → DeleteSecret
```

**DAG Validation in `CreateRelay` and `UpdateRelayActions`:**

```go
func validateDAG(actions []models.CreateRelayActionInput, edges []models.RelayEdge) error {
    nodes := make([]dag.Node, len(actions))
    for i, a := range actions { nodes[i] = dag.Node{ID: a.NodeID} }

    dagEdges := make([]dag.Edge, len(edges))
    for i, e := range edges {
        dagEdges[i] = dag.Edge{From: e.ParentNodeID, To: e.ChildNodeID, Condition: e.Condition}
    }

    _, err := dag.New(nodes, dagEdges)  // returns error on cycle
    return err  // translated to 400 CYCLE_DETECTED in the handler
}
```

**`ai_handlers.go`** — NEW: LLM relay generation endpoint:

```go
// POST /api/v1/ai/relay
// Request:  AIRelayRequest{Message, Conversation}
// Response: AIRelayResponse{Ready, Questions, Relay, Message}
//
// Flow:
// 1. Build system prompt (BuildSystemPrompt from iris-common/pkg/actions)
// 2. Append user's message to conversation
// 3. Call LLM client (Chat)
// 4. Parse LLM JSON response
// 5. If ready=true: validate relay (DAG, action types, configs)
// 6. If validation fails: retry once with corrective prompt
// 7. Return AIRelayResponse to client
```

**`router.go`** — wire everything together:

```go
func NewRouter(h *Handler, cfg *config.Config) *chi.Mux {
    r := chi.NewRouter()
    // middleware: Logger, Recoverer, RequestID, RealIP, CORS
    r.Get("/health", h.HealthCheck)
    r.Route("/api/v1", func(r chi.Router) {
        // public
        r.Post("/auth/register", h.Register)
        r.Post("/auth/login", h.Login)
        r.Get("/auth/callback/{provider}", h.OAuthCallback)

        // protected (JWT required)
        r.Group(func(r chi.Router) {
            r.Use(JWTAuth(cfg.JWTSecret))
            // relays, secrets, connections, executions, AI endpoint
        })
    })
}
```

### 10.7 Entry Point (`cmd/api/main.go`)

```go
func main() {
    cfg := config.Load()
    logger := logger.New("iris-core", slog.LevelInfo)
    db := db.Connect(ctx, cfg.DatabaseURL)
    nats := queue.NewPublisher(cfg.NATSURL)
    encryptor := encryptor.New(cfg.EncryptionKey)
    llmClient := ai.NewClient(cfg.LLMProvider, cfg.LLMAPIKey, cfg.LLMModel)

    stores := store.NewStores(db, encryptor)
    handler := api.NewHandler(stores, nats, llmClient, cfg, logger)
    router := api.NewRouter(handler, cfg)

    http.ListenAndServe(":"+cfg.Port, router)
}
```

---

## 11. Phase 3 — `iris-hooks` (Webhook Ingestion)

**Goal:** A thin, high-throughput service: receive HTTP POST → publish to NATS. No DB access, minimal latency.

**Duration:** 2–3 days

### 11.1 Handler (`internal/api/handler.go`)

```go
// POST /hooks/{relayID}
// 1. Read body (max 1MB)
// 2. Extract event_id from header X-Event-ID, query param ?event_id, or generate UUID
// 3. Build ExecutionEvent{RelayID, EventID, Payload, ReceivedAt}
// 4. Marshal to JSON, publish to NATS subject "events.{relayID}"
// 5. Return 200 {"accepted": true, "event_id": "..."}
```

### 11.2 NATS Publisher (`internal/queue/publisher.go`)

Same pattern as iris-core's publisher but for the hooks service.

### 11.3 Config & Entry Point

```go
type Config struct {
    Port    string
    NATSURL string
}
```

```go
// cmd/server/main.go
// wire config → nats → handler → http.ListenAndServe
```

---

## 12. Phase 4 — `iris-worker` (Execution Engine)

**Goal:** Consume NATS events and cron triggers, execute relay DAGs, persist execution audit trail.

**Duration:** 2 weeks (the largest and most complex service)

**Build order:**

### 12.1 Config (`internal/config/config.go`)

```go
type Config struct {
    DatabaseURL  string
    NATSURL      string
    EncryptionKey string
    MaxWorkers   int  // default 10
    CronInterval time.Duration  // default 30s
}
```

### 12.2 Store Layer (`internal/store/`)

```go
// worker_store.go
func (s *Store) GetRelayGraph(ctx, relayID) ([]RelayAction, []RelayEdge, error)
func (s *Store) GetRelayOwner(ctx, relayID) (userID string, error)
func (s *Store) GetSecret(ctx, userID, secretName string) (plaintext string, error) // decrypt here
func (s *Store) GetConnection(ctx, connectionID string) (*ConnectionInternal, error)
func (s *Store) IsDuplicate(ctx, relayID, eventID string) (bool, error)  // processed_events
func (s *Store) MarkProcessed(ctx, relayID, eventID string) error
func (s *Store) CreateExecution(ctx, ...) (executionID string, error)
func (s *Store) CompleteExecution(ctx, executionID, status, errorMsg string) error
func (s *Store) CreateExecutionStep(ctx, ...) (stepID string, error)
func (s *Store) CompleteExecutionStep(ctx, stepID, status string, output json.RawMessage, errorMsg string) error
func (s *Store) GetCronRelays(ctx) ([]Relay, error)  // WHERE trigger_type='cron' AND next_run_at <= NOW()
func (s *Store) UpdateRelayNextRun(ctx, relayID string, nextRun time.Time) error
```

### 12.3 Action Registry (`internal/engine/registry.go`)

```go
type Registry struct { executors map[string]ActionExecutor }
func NewRegistry() *Registry
func (r *Registry) Register(actionType string, exec ActionExecutor)
func (r *Registry) Get(actionType string) (ActionExecutor, bool)

type ActionExecutor interface {
    Execute(ctx context.Context, config map[string]any, payload []byte, prevOutputs map[string]StepOutput) (json.RawMessage, error)
}
```

### 12.4 Integration Plugins (`internal/integrations/`)

Each plugin is a separate package implementing `ActionExecutor`:

**`debug/debug.go`** — logs config + payload, returns `{"logged": true}`.

**`discord/discord.go`** — POST to Discord webhook URL from config, returns Discord API response.

**`slack/slack.go`** — POST to Slack incoming webhook, returns `{"ok": true}`.

**`httpreq/httpreq.go`** — generic HTTP client:
```go
// config: url, method, headers (map), body (string)
// returns: {"status_code": 200, "body": {...}, "headers": {...}}
```

**`email/email.go`** — uses OAuth connection to send email via Gmail or Microsoft Graph API:
```go
// config: connection_id, to, subject, body
// 1. Load connection from DB (encrypted tokens)
// 2. If token expired, refresh via oauth.Provider.RefreshToken()
// 3. POST to Gmail API or Microsoft Graph /sendMail
// returns: {"message_id": "..."}
```

**`condition/condition.go`** — NEW: evaluate a boolean expression:
```go
// config: expr (e.g. "steps['fetch'].output.status == 200")
// Uses expr-lang/expr for safe expression evaluation
// returns: {"result": true/false}
// Outbound edges from this node should have matching conditions
```

### 12.5 DAG Executor (`internal/engine/executor.go`)

This is the core of the execution engine. Implements `process()`:

```go
func (e *Executor) process(ctx context.Context, job Job) error {
    // 1. Deduplication
    if dup := store.IsDuplicate(ctx, job.RelayID, job.EventID); dup { return nil }
    store.MarkProcessed(ctx, job.RelayID, job.EventID)

    // 2. Create execution record
    execID := store.CreateExecution(ctx, job.RelayID, job.EventID, job.Payload)
    defer func() { store.CompleteExecution(ctx, execID, finalStatus, finalError) }()

    // 3. Load relay graph
    actions, edges := store.GetRelayGraph(ctx, job.RelayID)

    // 4. Build DAG
    nodes := toDAGNodes(actions)
    graph, err := dag.New(nodes, toDAGEdges(edges))
    if err != nil { return err }  // cycle (shouldn't happen post-validation)

    // 5. Wave-parallel execution
    completedOutputs := &sync.Map{}  // map[nodeID]StepOutput

    for waveIdx, wave := range graph.Waves() {
        eg, waveCtx := errgroup.WithContext(ctx)

        for _, nodeID := range wave {
            nodeID := nodeID  // capture loop var
            action := findAction(actions, nodeID)

            eg.Go(func() error {
                return e.executeNode(waveCtx, execID, job, action, completedOutputs)
            })
        }

        if err := eg.Wait(); err != nil { return err }
    }
    return nil
}

func (e *Executor) executeNode(ctx, execID, job, action, completedOutputs) error {
    // a. Resolve secrets (_ref suffix → lookup + decrypt)
    resolvedConfig := resolveSecrets(ctx, action.Config, userID)

    // b. Resolve templates ({{payload.x}}, {{steps['n'].output.x}})
    resolvedConfig = templateengine.Resolve(resolvedConfig, job.Payload, snapshotOutputs(completedOutputs))

    // c. Record step as 'running'
    stepID := store.CreateExecutionStep(ctx, execID, action.NodeID, action.ActionType, redactConfig(resolvedConfig))

    // d. Execute
    executor := registry.Get(action.ActionType)
    output, err := executor.Execute(ctx, resolvedConfig, job.Payload, snapshotOutputs(completedOutputs))

    // e. Record outcome
    status := "success"; if err != nil { status = "failed" }
    store.CompleteExecutionStep(ctx, stepID, status, output, errMsg(err))

    // f. Store output for downstream nodes
    completedOutputs.Store(action.NodeID, StepOutput{Output: parseOutput(output), Error: errMsg(err)})

    return err
}
```

**Key design decisions:**

| Concern | Decision |
|---|---|
| Parallelism within a wave | `errgroup.Group` — fail-fast (one failure cancels siblings) |
| Output thread safety | `sync.Map` keyed by `node_id` |
| Secret resolution | `_ref` suffix → `store.GetSecret(userID, name)` → plaintext |
| Conditional edges | After node completes, evaluate outbound edge conditions via `expr-lang/expr` |
| Log safety | `redactConfig()` strips `_ref`, `api_key`, `token`, `password`, `webhook_url` before persisting |

### 12.6 Worker Pool (`internal/engine/worker_pool.go`)

```go
type WorkerPool struct {
    JobQueue   chan Job       // buffered channel (capacity 100)
    workers    int
    executor   *Executor
    wg         sync.WaitGroup
}

func NewWorkerPool(maxWorkers int, executor *Executor) *WorkerPool
func (p *WorkerPool) Start(ctx context.Context)   // spawns N goroutines
func (p *WorkerPool) Shutdown()                   // cancel context, wait for WaitGroup

// Each worker goroutine:
func (p *WorkerPool) worker(ctx context.Context, id int) {
    for {
        select {
        case <-ctx.Done(): return
        case job, ok := <-p.JobQueue:
            if !ok { return }
            err := p.executor.process(ctx, job)
            job.MsgAck(err == nil)
        }
    }
}
```

### 12.7 Cron Scheduler (`internal/engine/cron_scheduler.go`)

```go
type CronScheduler struct {
    db       Store
    jobQueue chan<- Job
    logger   *slog.Logger
    done     chan struct{}
    once     sync.Once
}

func (s *CronScheduler) Start(ctx context.Context) {
    ticker := time.NewTicker(30 * time.Second)
    for {
        select {
        case <-ticker.C:
            relays := store.GetCronRelays(ctx)
            for _, relay := range relays {
                s.jobQueue <- Job{RelayID: relay.ID, EventID: uuid.New(), Payload: []byte("{}"), MsgAck: noop}
                store.UpdateRelayNextRun(ctx, relay.ID, cronutil.NextRun(relay.TriggerConfig["cron_expr"]))
            }
        case <-s.done: return
        }
    }
}
```

### 12.8 NATS Consumer (`internal/queue/consumer.go`)

```go
type Consumer struct { js nats.JetStreamContext; jobQueue chan<- Job }
func NewConsumer(natsURL string, jobQueue chan<- Job) (*Consumer, error)
func (c *Consumer) Start(ctx context.Context)  // subscribe to "events.>" with durable consumer
func (c *Consumer) Stop()
```

On message receive:
```go
var event ExecutionEvent
json.Unmarshal(msg.Data, &event)
jobQueue <- Job{
    RelayID: event.RelayID,
    EventID: event.EventID,
    Payload: event.Payload,
    MsgAck:  func(ok bool) { if ok { msg.Ack() } else { msg.Nak() } },
}
```

### 12.9 Entry Point (`cmd/main.go`)

```go
func main() {
    cfg := config.Load()
    db := store.Connect(cfg.DatabaseURL)
    encryptor := encryptor.New(cfg.EncryptionKey)
    oauthProviders := oauth.LoadProviders(cfg)

    store := store.New(db, encryptor)
    registry := engine.NewRegistry()
    registry.Register("debug_log", debug.New())
    registry.Register("discord_send", discord.New())
    registry.Register("slack_send", slack.New())
    registry.Register("http_request", httpreq.New())
    registry.Register("email_send", email.New(store, oauthProviders))
    registry.Register("condition", condition.New())

    executor := engine.NewExecutor(store, registry, logger)
    pool := engine.NewWorkerPool(cfg.MaxWorkers, executor)
    cron := engine.NewCronScheduler(store, pool.JobQueue, logger)
    consumer := queue.NewConsumer(cfg.NATSURL, pool.JobQueue)

    pool.Start(ctx)
    cron.Start(ctx)
    consumer.Start(ctx)

    <-shutdown signal

    // Graceful shutdown order:
    consumer.Stop()
    cron.Stop()
    pool.Shutdown()
    db.Close()
}
```

---

## 13. Phase 5 — Frontend Revamp

**Goal:** Redesign the entire frontend with the Iris brand, new color scheme, and polish all existing features.

**Duration:** 1.5 weeks

### 13.1 Design Token Setup (`src/app/globals.css`)

Apply the full Iris design token set (see Section 5.2). Remove all orange color references. Apply violet/indigo/cyan palette.

```css
@import "tailwindcss";

:root {
  --background: #080810;
  --foreground: #F0EEFF;
  /* ... full Iris token set from Section 5.2 ... */
}

@theme inline {
  /* Override Tailwind colors with Iris palette */
  --color-violet-500: #8B5CF6;
  --color-violet-600: #7C3AED;
  --color-indigo-500: #6366F1;
  --color-cyan-400:   #22D3EE;
  /* ... */
}
```

### 13.2 Iris UI Primitives (`src/components/ui/`)

Build reusable Iris-branded components:

```
Button.tsx      — primary (violet gradient), secondary (outline), ghost, destructive
Input.tsx       — dark fill, violet focus ring, label + error states
Card.tsx        — surface bg, subtle border, radius-12
Badge.tsx       — status badges (success/warning/error/info)
Modal.tsx       — dark overlay, elevated surface, close button
Spinner.tsx     — violet animated ring
Tabs.tsx        — underline style, violet active tab
Tooltip.tsx     — elevated bg, small text
```

### 13.3 Landing Page (`src/app/page.tsx`)

Full Iris rebrand:

- Hero: "Automate Everything. In Plain English." — violet gradient headline
- Animated gradient orb background (CSS animation)
- Feature cards: DAG workflows, AI-powered, Telegram bot, self-hosted
- CTA: "Get Started Free" → `/register`
- Color scheme: deep dark background, violet/cyan accent elements
- Remove all orange references from existing Hermes landing page

### 13.4 Auth Pages (`src/app/(auth)/`)

```
login/page.tsx     — Iris logo, email/password, "Sign in" violet button, link to register
register/page.tsx  — username, email, password, confirm password, Iris branding
```

Both pages: dark card on deep background, violet focus states, form validation with Zod.

### 13.5 Dashboard Layout (`src/app/dashboard/layout.tsx`)

```tsx
// Two-panel layout:
// [Sidebar 56px] [Main Content] [AI Chat Panel 0-380px, collapsible]

// Sidebar is always visible
// AI Chat Panel slides in from the right when user opens it
// Main content area flexes between them
```

### 13.6 Sidebar (`src/components/sidebar.tsx`)

Iris rebrand:
- Replace Hermes logo/name with Iris logo/name
- Replace orange active state with violet (`bg-violet-500/10 text-violet-400`)
- Add "AI Assistant" nav item with sparkle icon → opens the AI chat panel
- Add "Executions" nav item (shortcut to recent executions across all relays)

```
Nav items:
  ✦ Relays
  🔒 Secrets
  🔗 Connections
  🤖 AI Assistant    ← NEW
```

### 13.7 Relay List Page (`src/app/dashboard/relays/page.tsx`)

- Table/grid of relays with name, trigger type, status badge, last execution time
- "New Relay" button (violet gradient, top-right)
- "Ask Iris" button → opens AI chat panel
- Click row → relay detail page

### 13.8 Relay Detail Page (`src/app/dashboard/relays/[id]/page.tsx`)

- Relay metadata (name, description, webhook URL, trigger config)
- "Edit Actions" button → visual DAG builder
- "Trigger Now" button (manual relays)
- Execution history table with status badges
- Click execution → expand steps inline or modal

### 13.9 Visual DAG Builder (`src/app/dashboard/relays/builder/page.tsx`)

Already partially implemented with `@xyflow/react`. Revamp with Iris styling:

**Node types (update `src/components/workflow/nodes/`):**

- **`trigger-node.tsx`** — Cyan/indigo header (`TRIGGER`), shows trigger type icon
- **`action-node.tsx`** — Violet header with action type icon, config summary in body, cyan connection handles
- **`condition-node.tsx`** — Diamond shape, amber accent, shows `expr` field

**Edge styling (`src/components/workflow/edges/`):**

- Animated gradient stroke (cyan → indigo → violet)
- Arrow head with violet fill
- Conditional edges show a small label badge

**Toolbar (`src/components/workflow/toolbar/`):**

- Add node dropdown (all action types with icons)
- Save button (violet gradient)
- Auto-layout button (uses `dagre` for automatic arrangement)
- Clear canvas button
- "Ask Iris" button → opens AI chat with current relay context

**Sidebar (`src/components/workflow/sidebar/`):**

- Node config panel (slides in when node is selected)
- Shows form fields for the selected action type
- Secret reference picker (dropdown of user's secrets)
- Connection picker (for email_send)

**Serialize/Deserialize (`src/lib/workflow-serializer.ts`):**

```typescript
// React Flow state → API CreateRelayRequest format
export function serializeWorkflow(nodes: Node[], edges: Edge[]): CreateRelayRequest

// API RelayWithActions → React Flow state
export function deserializeWorkflow(relay: RelayWithActions): { nodes: Node[], edges: Edge[] }
```

### 13.10 Secrets Page (`src/app/dashboard/secrets/page.tsx`)

- List of secret names (values never shown)
- Add secret form (name + value, value masked)
- Delete with confirmation modal
- Iris-styled table with violet accents

### 13.11 Connections Page (`src/app/dashboard/connections/page.tsx`)

- List connected OAuth providers with account email
- "Connect Google" / "Connect Microsoft" buttons
- Disconnect button with confirmation

### 13.12 API Client Layer (`src/lib/`)

**`api.ts`** — base API functions:

```typescript
const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T>

// Auth
export const register = (data: RegisterRequest) => apiFetch<AuthResponse>('/api/v1/auth/register', ...)
export const login = (data: LoginRequest) => apiFetch<AuthResponse>('/api/v1/auth/login', ...)

// Relays
export const createRelay = (data: CreateRelayRequest) => apiFetch<RelayWithActions>(...)
export const getRelays = () => apiFetch<Relay[]>(...)
export const getRelay = (id: string) => apiFetch<RelayWithActions>(...)
export const updateRelay = (id: string, data: UpdateRelayRequest) => apiFetch<Relay>(...)
export const updateRelayActions = (id: string, data: UpdateRelayActionsRequest) => apiFetch<RelayWithActions>(...)
export const deleteRelay = (id: string) => apiFetch<void>(...)
export const triggerRelay = (id: string) => apiFetch<void>(...)

// Executions
export const getExecutions = (relayID: string) => apiFetch<Execution[]>(...)
export const getExecutionSteps = (execID: string) => apiFetch<ExecutionStep[]>(...)

// Secrets
export const createSecret = (data: CreateSecretRequest) => apiFetch<Secret>(...)
export const listSecrets = () => apiFetch<Secret[]>(...)
export const deleteSecret = (id: string) => apiFetch<void>(...)

// Connections
export const listConnections = () => apiFetch<Connection[]>(...)
export const connectProvider = (provider: string) => window.location.href = ...
export const deleteConnection = (id: string) => apiFetch<void>(...)
```

**`api-ai.ts`** — NEW: AI chat API:

```typescript
export const sendAIMessage = (data: AIRelayRequest) => apiFetch<AIRelayResponse>('/api/v1/ai/relay', {
    method: 'POST',
    body: JSON.stringify(data),
})
```

---

## 14. Phase 6 — LLM Embedded on Web (Chat-to-Relay)

**Goal:** An AI chat panel embedded in the dashboard where users describe a relay in plain English and Iris builds it for them, with multi-turn conversation support.

**Duration:** 1 week

### 14.1 Backend: AI Relay Endpoint (`iris-core/internal/api/ai_handlers.go`)

```go
// POST /api/v1/ai/relay
// Requires JWT auth

func (h *Handler) GenerateRelay(w http.ResponseWriter, r *http.Request) {
    var req models.AIRelayRequest
    json.NewDecoder(r.Body).Decode(&req)

    userID := getUserIDFromContext(r.Context())

    // Build conversation: system prompt + prior messages + new user message
    messages := []ai.Message{
        {Role: "system", Content: ai.BuildSystemPrompt()},
    }
    messages = append(messages, toAIMessages(req.Conversation)...)
    messages = append(messages, ai.Message{Role: "user", Content: req.Message})

    // Call LLM
    rawResponse, err := h.llmClient.Chat(r.Context(), messages)

    // Parse structured response
    var llmResp ai.LLMResponse
    json.Unmarshal([]byte(rawResponse), &llmResp)

    // If ready=true, validate the relay
    if llmResp.Ready && llmResp.Relay != nil {
        if err := validateRelay(*llmResp.Relay); err != nil {
            // Self-correction: retry once with error context
            correctionMsg := fmt.Sprintf("Your relay had a validation error: %s. Please fix it.", err)
            messages = append(messages, ai.Message{Role: "user", Content: correctionMsg})
            rawResponse, _ = h.llmClient.Chat(r.Context(), messages)
            json.Unmarshal([]byte(rawResponse), &llmResp)
        }
    }

    writeJSON(w, 200, models.AIRelayResponse{
        Ready:     llmResp.Ready,
        Questions: llmResp.Questions,
        Relay:     llmResp.Relay,
        Message:   llmResp.Message,
    })
}
```

### 14.2 LLM Client (`iris-core/internal/ai/`)

```go
// client.go
type LLMClient interface {
    Chat(ctx context.Context, messages []Message) (string, error)
}

type Message struct {
    Role    string `json:"role"`    // "system" | "user" | "assistant"
    Content string `json:"content"`
}

// OpenAI implementation:
type openAIClient struct {
    client *openai.Client
    model  string
}

func (c *openAIClient) Chat(ctx context.Context, messages []Message) (string, error) {
    resp, err := c.client.CreateChatCompletion(ctx, openai.ChatCompletionRequest{
        Model:          c.model,
        Messages:       toOpenAIMessages(messages),
        ResponseFormat: &openai.ChatCompletionResponseFormat{Type: "json_object"},
        Temperature:    0.3,  // low temp for structured output consistency
    })
    return resp.Choices[0].Message.Content, err
}

func NewClient(provider, apiKey, model string) LLMClient {
    switch provider {
    case "openai": return newOpenAIClient(apiKey, model)
    case "gemini": return newGeminiClient(apiKey, model)
    default: panic("unknown LLM provider")
    }
}
```

### 14.3 System Prompt (`iris-core/internal/ai/prompts.go`)

```go
func BuildSystemPrompt() string {
    actionTypes := actions.Types()
    actionDocs := buildActionDocs()  // generates config docs per action type

    return fmt.Sprintf(`You are Iris Assistant, an AI that helps users create automation workflows on the Iris platform.

Iris workflows are called "Relays". Each relay has:
- A trigger (webhook, cron, or manual)
- A set of action nodes forming a DAG (Directed Acyclic Graph)
- Edges connecting nodes (with optional conditions)

Available action types:
%s

Action configs:
%s

When a user describes a workflow, respond with ONLY a valid JSON object:
{
  "ready": true | false,
  "questions": ["question 1", "question 2"],
  "relay": {
    "name": "Human-readable name",
    "description": "What this relay does",
    "trigger_type": "webhook" | "manual" | "cron",
    "trigger_config": {},
    "actions": [
      {
        "node_id": "descriptive_name",
        "action_type": "<type>",
        "config": { ... }
      }
    ],
    "edges": [
      { "parent_node_id": "a", "child_node_id": "b" }
    ]
  },
  "message": "Optional assistant message to show the user"
}

Rules:
1. If the user's request is clear, set "ready": true and provide the full relay.
2. If information is missing (e.g. webhook URL, channel ID), set "ready": false and list clarifying questions.
3. Use descriptive node_ids: "fetch_data", "send_discord", not "node_1".
4. For secrets (API keys, webhook URLs), use the "_ref" suffix in config keys:
   "webhook_url_ref": "my_discord_webhook" — tells the user to save this as a secret named "my_discord_webhook".
5. Build parallel paths where steps are independent (no shared data dependencies).
6. Set "message" to a friendly summary of what you're doing or what you need.

Few-shot examples:
[User]: "Send a Discord message when I get a webhook"
[Response]: {"ready": true, "relay": {"name": "Webhook → Discord", "trigger_type": "webhook", "actions": [{"node_id": "notify_discord", "action_type": "discord_send", "config": {"webhook_url_ref": "discord_webhook", "message": "New webhook received: {{payload}}"}}], "edges": []}, "message": "Here's your relay. You'll need a secret named 'discord_webhook' with your Discord webhook URL."}

[User]: "Every day at 9am, check my GitHub issues and email me a summary"
[Response]: {"ready": false, "questions": ["What email address should the summary go to?", "Which GitHub repo should I check?"], "message": "Almost there — I just need two details to finish this relay."}
`, actionTypes, actionDocs)
}
```

### 14.4 Response Parser (`iris-core/internal/ai/parser.go`)

```go
type LLMResponse struct {
    Ready     bool                        `json:"ready"`
    Questions []string                    `json:"questions,omitempty"`
    Relay     *models.CreateRelayRequest  `json:"relay,omitempty"`
    Message   string                      `json:"message,omitempty"`
}

func Parse(raw string) (*LLMResponse, error) {
    var resp LLMResponse
    if err := json.Unmarshal([]byte(raw), &resp); err != nil {
        return nil, fmt.Errorf("LLM returned invalid JSON: %w", err)
    }
    return &resp, nil
}
```

---

### 14.5 Frontend: AI Chat Panel (`src/components/ai-chat/`)

This is the primary UI for the embedded LLM experience. The chat panel lives as a collapsible right sidebar inside the dashboard layout.

**`chat-panel.tsx`** — the outer container:

```tsx
// Props: isOpen, onClose
// Layout:
// - Fixed-width (380px) panel sliding in from the right
// - Header: "Iris AI" title + sparkle icon + close button
// - Message list (scrollable, flex-col, newest at bottom)
// - Input area (sticky bottom)

// State:
// - messages: AIMessage[]  (conversation history)
// - isLoading: boolean     (LLM call in flight)
// - draftRelay: CreateRelayRequest | null

// On submit:
// 1. Append user message to local state
// 2. POST to /api/v1/ai/relay with full conversation
// 3. Append assistant response
// 4. If ready=true: show RelayPreview card with "Create Relay" button
```

**`chat-message.tsx`** — individual bubble:

```tsx
// role="user"     → right-aligned, violet bg
// role="assistant" → left-aligned, surface bg, Iris avatar icon
// Shows timestamp on hover
// Renders markdown in assistant messages (links, bold, lists)
```

**`relay-preview.tsx`** — structured relay card shown when LLM is ready:

```tsx
// Displays:
// - Relay name + description
// - Trigger type badge (WEBHOOK / CRON / MANUAL)
// - Action list with node IDs and action type icons
// - Edge list (parent → child arrows)
// - Warning: lists any _ref secret names the user needs to create
//
// Buttons:
// - "Create Relay" (primary, violet) → POST /api/v1/relays + redirect to builder
// - "Open in Builder" → deserialize to React Flow, open builder page
// - "Edit" → sends "Please edit: ..." back to LLM
```

**`chat-input.tsx`** — message input:

```tsx
// Textarea (auto-resizing, max 4 rows)
// Send button (violet, disabled while loading)
// Placeholder: "Describe a relay in plain English..."
// Submit on Enter (Shift+Enter for newline)
// Character limit: 2000
```

### 14.6 AI Chat State Management

Use a React context or Zustand store to persist chat state across route navigation:

```typescript
// src/context/ai-chat-context.tsx
interface AIChatState {
    isOpen: boolean
    messages: AIMessage[]
    draftRelay: CreateRelayRequest | null
    isLoading: boolean
    open: () => void
    close: () => void
    sendMessage: (text: string) => Promise<void>
    reset: () => void
    applyDraft: () => void  // creates the relay and opens builder
}
```

### 14.7 Execution Visualization (DAG View)

When viewing an execution, render the relay's DAG with color-coded node status:

```tsx
// src/components/workflow/execution-dag.tsx
// Props: relay: RelayWithActions, execution: Execution, steps: ExecutionStep[]
//
// Renders the same React Flow canvas as the builder, but:
// - Read-only (no drag, no edit)
// - Each node is colored by its execution step status:
//   success  → emerald green border + glow
//   failed   → red border + glow
//   running  → violet pulse animation
//   skipped  → grey, opacity 50%
//   pending  → default node style
// - Click node → side panel shows step input/output/error JSON
// - Shows timing (started_at, finished_at, duration) in node footer
```

---

## 15. Phase 7 — `iris-telegram` (Telegram Bot + LLM)

**Goal:** A standalone Go service providing a full Telegram bot that can create Iris relays through natural language conversation.

**Duration:** 2 weeks

### 15.1 Service Scaffolding

Create `services/iris-telegram/` with the full directory structure from Section 6. Add to `go.work`.

**Dependencies (`go.mod`):**

```
github.com/go-telegram-bot-api/telegram-bot-api/v5
github.com/sashabaranov/go-openai
iris-common (local workspace)
```

### 15.2 Config (`internal/config/config.go`)

```go
type Config struct {
    TelegramBotToken string
    LLMProvider      string   // "openai" | "gemini"
    LLMAPIKey        string
    LLMModel         string
    IrisCoreURL      string   // e.g. "http://localhost:3000"
    DatabaseURL      string   // for telegram_links table
    NATSURL          string   // for execution notifications
    SessionTTL       time.Duration  // default 24h
}
```

### 15.3 Bot Setup (`internal/bot/bot.go`)

```go
type Bot struct {
    api      *tgbotapi.BotAPI
    sessions *SessionManager
    ai       ai.LLMClient
    iris     *iris.Client
    store    *Store
    logger   *slog.Logger
}

func New(cfg *config.Config) (*Bot, error) {
    api, _ := tgbotapi.NewBotAPI(cfg.TelegramBotToken)
    api.Debug = false
    return &Bot{
        api:      api,
        sessions: NewSessionManager(),
        ai:       ai.NewClient(cfg.LLMProvider, cfg.LLMAPIKey, cfg.LLMModel),
        iris:     iris.NewClient(cfg.IrisCoreURL),
        store:    NewStore(cfg.DatabaseURL),
    }, nil
}

func (b *Bot) Start(ctx context.Context) {
    u := tgbotapi.NewUpdate(0)
    u.Timeout = 60
    updates := b.api.GetUpdatesChan(u)

    for {
        select {
        case <-ctx.Done(): return
        case update := <-updates:
            go b.handleUpdate(ctx, update)
        }
    }
}
```

### 15.4 Bot Commands

```
/start        → Welcome message with platform overview and /login instructions
/login        → Begin JWT token linking flow
/new          → Start describing a new relay (enters StateDescribing)
/list         → List user's existing relays with inline buttons
/trigger <id> → Manually trigger a relay by name or ID
/status <name>→ Show last 5 executions for a relay
/toggle <name>→ Enable or disable a relay
/delete <name>→ Delete a relay (with confirmation)
/logs <name>  → Show recent execution step details
/templates    → Show quick-start template gallery
/help         → Show all commands with descriptions
/cancel       → Cancel current operation, return to Idle
```

### 15.5 Session State Machine (`internal/bot/session.go`)

```go
type SessionState int

const (
    StateIdle        SessionState = iota  // waiting for a command
    StateAwaitLogin                       // waiting for JWT token from user
    StateDescribing                       // user is describing a relay in NL
    StateConfirming                       // relay generated, waiting for confirm/edit/cancel
    StateEditing                          // user is refining an existing draft
    StateAwaitDelete                      // waiting for deletion confirmation
)

type Session struct {
    State        SessionState
    HermesToken  string                     // iris JWT
    DraftRelay   *models.CreateRelayRequest // relay being built
    Conversation []ai.Message               // full LLM conversation history
    LastActivity time.Time
}

type SessionManager struct {
    sessions sync.Map  // map[int64]*Session  (key = telegram user ID)
    ttl      time.Duration
}

func (sm *SessionManager) Get(userID int64) *Session
func (sm *SessionManager) Set(userID int64, s *Session)
func (sm *SessionManager) Delete(userID int64)
func (sm *SessionManager) StartCleanup(ctx context.Context)  // evict sessions older than TTL
```

### 15.6 Message Handler Flow (`internal/bot/handlers.go`)

```
handleUpdate(update)
    │
    ├─ Is command? → dispatchCommand()
    │       /start    → sendWelcome()
    │       /login    → setState(StateAwaitLogin), prompt for token
    │       /new      → require auth → setState(StateDescribing), prompt for description
    │       /list     → require auth → fetchRelays() → sendRelayList()
    │       /trigger  → require auth → triggerRelay()
    │       /cancel   → setState(StateIdle), send cancel message
    │       ...
    │
    └─ Is plain message? → dispatchMessage()
            │
            ├─ StateAwaitLogin →
            │       Validate token by calling GET /api/v1/relays
            │       If valid: store (telegramUserID, token) in DB
            │                 setState(StateIdle)
            │                 send "You're linked! Use /new to create a relay."
            │       If invalid: send error, stay in StateAwaitLogin
            │
            ├─ StateDescribing →
            │       Append message to conversation
            │       Call LLM
            │       If ready=false: send questions list, stay StateDescribing
            │       If ready=true:  show relay summary, setState(StateConfirming)
            │
            ├─ StateConfirming →
            │       "yes" / "confirm" / "create" → POST relay to iris-core
            │                                       send success + relay ID
            │                                       setState(StateIdle)
            │       "edit" / "change" → setState(StateEditing)
            │       "cancel" / "no"   → setState(StateIdle), discard draft
            │
            └─ StateEditing →
                    Append edit instruction to conversation
                    Call LLM again
                    → same as StateDescribing flow
```

### 15.7 User-Facing Message Formatting

When a relay draft is ready, send a formatted Telegram message:

```
✦ *New Relay: GitHub Issue Notifier*

Trigger: Webhook

Actions:
  1. 🌐 `fetch_github` — HTTP Request
     GET https://api.github.com/repos/.../issues
  2. 📨 `notify_discord` — Discord Send
     "New issues: {{steps['fetch_github'].output.body}}"

Flow: `fetch_github` → `notify_discord`

⚠️ You'll need these secrets saved in Iris:
  • `github_token` — your GitHub API token
  • `discord_webhook` — your Discord webhook URL

Reply *confirm* to create, *edit* to modify, or *cancel* to discard.
```

### 15.8 LLM Integration (`internal/ai/`)

The Telegram service uses the same `LLMClient` interface and `BuildSystemPrompt()` as `iris-core`, but they are reimplemented locally rather than shared to keep the service self-contained. The system prompt is identical but prefixed with Telegram-specific context:

```go
// prompts.go
func BuildSystemPrompt() string {
    // Same as iris-core prompt but adds:
    // "You are replying in Telegram. Keep responses concise.
    //  Format relay summaries as plain text, not JSON.
    //  Use Markdown-compatible formatting (bold with *, code with `)."
}
```

### 15.9 Iris Core Client (`internal/iris/client.go`)

```go
type Client struct {
    baseURL    string
    httpClient *http.Client
}

func NewClient(baseURL string) *Client

func (c *Client) CreateRelay(ctx context.Context, token string, req models.CreateRelayRequest) (*models.RelayWithActions, error)
func (c *Client) ListRelays(ctx context.Context, token string) ([]models.Relay, error)
func (c *Client) GetRelay(ctx context.Context, token string, id string) (*models.RelayWithActions, error)
func (c *Client) TriggerRelay(ctx context.Context, token string, relayID string) error
func (c *Client) GetExecutions(ctx context.Context, token string, relayID string) ([]models.Execution, error)
func (c *Client) GetExecutionSteps(ctx context.Context, token string, execID string) ([]models.ExecutionStep, error)
func (c *Client) DeleteRelay(ctx context.Context, token string, id string) error
func (c *Client) ValidateToken(ctx context.Context, token string) (bool, error)
```

### 15.10 Quick Templates

Pre-built relay templates a user can activate with one tap:

```
/templates
  📋 Webhook → Discord    (POST to Discord on any webhook)
  📋 Cron → Email         (daily digest via cron)
  📋 Webhook → Slack + Email  (fan-out notification)
  📋 HTTP Fetch → Discord  (poll an API, notify on change)
```

Implementation: Templates are `CreateRelayRequest` structs stored in the service. Tapping one sends a Telegram message pre-filled with the template description, which the LLM can then finalize with user-specific details.

### 15.11 Store Layer (`internal/store/`)

```go
// telegram_store.go
func (s *Store) LinkUser(ctx, userID string, telegramUserID int64, username string) error
func (s *Store) GetLinkByTelegramID(ctx, telegramUserID int64) (userID string, token string, error)
func (s *Store) UnlinkUser(ctx, telegramUserID int64) error
func (s *Store) SaveAISession(ctx, userID string, messages []ai.Message) error
func (s *Store) GetAISession(ctx, userID string) ([]ai.Message, error)
```

### 15.12 Entry Point (`cmd/bot/main.go`)

```go
func main() {
    cfg := config.Load()
    logger := logger.New("iris-telegram", slog.LevelInfo)
    db := store.Connect(cfg.DatabaseURL)
    store := store.New(db)
    bot, _ := bot.New(cfg, store, logger)

    ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
    defer cancel()

    bot.Start(ctx)
    logger.Info("iris-telegram stopped")
}
```

---

## 16. Phase 8 — Notifications & Real-Time Events

**Goal:** Push execution results to Telegram users, and lay the groundwork for real-time updates on the web dashboard.

**Duration:** 1 week

### 16.1 Execution Notifications via NATS

When a relay execution completes (success or failure), `iris-worker` publishes a notification event:

```go
// iris-worker/internal/engine/executor.go
// After CompleteExecution(), publish to NATS:
type ExecutionNotification struct {
    RelayID     string    `json:"relay_id"`
    RelayName   string    `json:"relay_name"`
    UserID      string    `json:"user_id"`
    ExecutionID string    `json:"execution_id"`
    Status      string    `json:"status"`   // "success" | "failed"
    Duration    int64     `json:"duration_ms"`
    ErrorMsg    string    `json:"error_message,omitempty"`
    FinishedAt  time.Time `json:"finished_at"`
}

// Published to subject: "notifications.{userID}"
```

### 16.2 Telegram Notification Subscriber

`iris-telegram` subscribes to `notifications.>` on NATS:

```go
// internal/bot/notifier.go
func (n *Notifier) Start(ctx context.Context) {
    sub, _ := n.js.Subscribe("notifications.>", func(msg *nats.Msg) {
        var notif ExecutionNotification
        json.Unmarshal(msg.Data, &notif)

        // Look up which Telegram user to notify
        link, _ := n.store.GetLinkByUserID(ctx, notif.UserID)
        if link == nil { msg.Ack(); return }

        // Format and send Telegram message
        text := formatNotification(notif)
        n.bot.Send(tgbotapi.NewMessage(link.TelegramUserID, text))
        msg.Ack()
    })
}

func formatNotification(n ExecutionNotification) string {
    icon := "✅"
    if n.Status == "failed" { icon = "❌" }
    return fmt.Sprintf("%s *%s* — %s\nDuration: %dms\nExecution: `%s`",
        icon, n.RelayName, n.Status, n.Duration, n.ExecutionID)
}
```

### 16.3 Notification Format Examples

```
✅ *GitHub Issue Notifier* — success
Duration: 342ms
Execution: `exec_abc123`

❌ *Daily Email Digest* — failed
Error: email_send: OAuth token expired
Duration: 1203ms
Execution: `exec_def456`
```

### 16.4 Web Dashboard Real-Time Updates (Future / Optional)

For now the dashboard polls via React Query's `refetchInterval`. A future iteration can add Server-Sent Events (SSE) or WebSockets:

```
// iris-core: GET /api/v1/events (SSE stream)
// Pushes execution status changes as:
// data: {"type": "execution_completed", "relay_id": "...", "status": "success"}

// Frontend: useEffect with EventSource, invalidates React Query cache on event
```

This is marked as **future work** and is not required for the initial Iris release.

---

## 17. Phase 9 — Testing & Hardening

**Goal:** Build confidence in correctness, safety, and reliability across all layers.

**Duration:** 1 week (runs in parallel with the last week of Phase 8)

### 17.1 Unit Tests — `iris-common`

**`pkg/dag` (highest priority):**

| Test | Description |
|---|---|
| `TestSingleNode` | Graph with one node, zero edges — valid, one wave |
| `TestLinearChain` | A→B→C — three waves of one node each |
| `TestDiamond` | A→B, A→C, B→D, C→D — waves: [A],[B,C],[D] |
| `TestFanOut` | A→B, A→C, A→D — waves: [A],[B,C,D] |
| `TestFanIn` | A→C, B→C — waves: [A,B],[C] |
| `TestCycleDirected` | A→B→A — must return `ErrCycle` |
| `TestSelfLoop` | A→A — must return `ErrCycle` |
| `TestDisconnectedSubgraph` | [A→B],[C→D] — valid, two roots |
| `TestEmptyGraph` | Zero nodes, zero edges — valid, zero waves |
| `TestUnknownEdgeRef` | Edge references node ID not in nodes list — must error |
| `TestWavesMatchTopology` | Each wave's nodes have all parents in prior waves |

**`pkg/templateengine`:**

| Test | Description |
|---|---|
| `TestPayloadTopLevel` | `{{payload}}` resolves to full JSON |
| `TestPayloadDeepField` | `{{payload.user.name}}` resolves correctly |
| `TestStepOutput` | `{{steps['n'].output.field}}` resolves from completed steps |
| `TestMissingStep` | Reference to unknown step ID — returns original `{{expr}}` unchanged |
| `TestNonStringPassthrough` | Integer/bool config values are not modified |
| `TestNestedConfig` | Template in nested map value is resolved |
| `TestArrayConfig` | Template in array string element is resolved |

**`pkg/encryptor`:**

| Test | Description |
|---|---|
| `TestRoundTrip` | Encrypt then decrypt returns original string |
| `TestDifferentCiphertexts` | Same plaintext encrypted twice gives different ciphertexts (nonce randomness) |
| `TestTamperDetection` | Modified ciphertext fails decryption (AES-GCM auth tag) |
| `TestBadKey` | Wrong key length returns error from `New()` |

### 17.2 Unit Tests — `iris-core`

**`internal/api` handlers:**

| Test | Description |
|---|---|
| `TestCreateRelay_Valid` | Valid DAG relay → 201 with actions + edges |
| `TestCreateRelay_Cycle` | Relay with cyclic edges → 400 `CYCLE_DETECTED` |
| `TestCreateRelay_UnknownAction` | Invalid action type → 400 `VALIDATION_ERROR` |
| `TestCreateRelay_Unauthenticated` | Missing JWT → 401 |
| `TestGetRelay_NotOwner` | JWT for user B accessing user A's relay → 404 |
| `TestUpdateRelayActions_DeletesOldEdges` | Update replaces edges, not appends |
| `TestTriggerRelay_PublishesToNATS` | Manual trigger → NATS publish called once |
| `TestLogin_WrongPassword` | → 401 `INVALID_CREDENTIALS` |
| `TestRegister_DuplicateEmail` | → 409 `EMAIL_TAKEN` |

**`internal/api` middleware:**

| Test | Description |
|---|---|
| `TestJWTAuth_Valid` | Valid token → handler called with user_id in context |
| `TestJWTAuth_Expired` | Expired token → 401 |
| `TestJWTAuth_Malformed` | Garbage token → 401 |

### 17.3 Unit Tests — `iris-worker`

| Test | Description |
|---|---|
| `TestProcess_Deduplication` | Duplicate event_id → execution skipped |
| `TestProcess_LinearDAG` | Two-node linear relay executes both steps in order |
| `TestProcess_ParallelWave` | Three independent nodes in same wave all called |
| `TestProcess_ConditionalEdge` | Condition false → child node skipped |
| `TestProcess_FailFast` | First node failure → sibling nodes in same wave cancelled |
| `TestSecretResolution` | `_ref` field replaced with decrypted plaintext |
| `TestTemplateResolution` | `{{steps['a'].output.x}}` filled from prior step |
| `TestRegistryMissingAction` | Unknown action type → execution fails with clear error |

### 17.4 Integration Tests

**End-to-end relay execution (requires running Postgres + NATS):**

```go
// TestWebhookTriggerFlow:
// 1. Create relay with 2 actions via API
// 2. POST to /hooks/{relayID}
// 3. Wait for NATS message to be consumed
// 4. Assert execution record status = "success"
// 5. Assert both execution_steps recorded with correct outputs

// TestCronTriggerFlow:
// 1. Create relay with trigger_type=cron, next_run_at = now - 1s
// 2. Wait for cron scheduler tick (30s or override interval in test)
// 3. Assert execution created and completed

// TestDAGParallelExecution:
// 1. Create relay: A→C, B→C (fan-in) with debug_log nodes
// 2. Trigger relay
// 3. Assert steps A and B have overlapping time ranges (ran in parallel)
// 4. Assert step C started after both A and B finished

// TestBackwardsCompatLinearRelay:
// 1. Create relay with no edges (linear auto-chain)
// 2. Trigger relay
// 3. Assert all steps ran in order_index sequence order
```

### 17.5 Load Testing

```bash
# Use k6 or wrk to load test the webhook ingestion path:
# Target: 1000 concurrent webhook POSTs
# Assert: all events queued to NATS, no drops
# Assert: worker pool processes all within 10s (10 workers x 100 cap channel)

# Large DAG test:
# Create relay with 50 nodes in 5 waves (10 per wave)
# Trigger once
# Assert: all 50 execution_steps recorded
# Assert: goroutine count stays bounded (no leaks)
```

### 17.6 Security Checklist

- [ ] All protected routes reject requests without valid JWT
- [ ] Users can only read/write their own relays, secrets, connections
- [ ] Secret values never appear in API responses or execution step inputs (redacted)
- [ ] Webhook payload capped at 1MB in iris-hooks
- [ ] Duplicate event IDs silently skipped (replay attack protection)
- [ ] LLM response JSON is validated before any relay is created
- [ ] OAuth state parameter validated in callback to prevent CSRF
- [ ] AES-GCM tamper detection tested (wrong key = decrypt error, not wrong plaintext)
- [ ] Telegram token validated against iris-core before being stored

---

## 18. Phase 10 — Infrastructure, Docker & Deployment

**Goal:** Make every service independently buildable, Dockerized, and composable for both local dev and production.

**Duration:** 3–4 days (runs alongside testing)

### 18.1 Dockerfiles

Each service has a multi-stage Dockerfile following the same pattern:

```dockerfile
# Example: services/iris-core/Dockerfile

# Stage 1: Build
FROM golang:1.22-alpine AS builder
WORKDIR /app

# Copy go.work and all module manifests first (layer cache)
COPY go.work go.work.sum ./
COPY packages/iris-common/go.mod packages/iris-common/go.sum ./packages/iris-common/
COPY services/iris-core/go.mod services/iris-core/go.sum ./services/iris-core/

RUN go work sync

# Copy source
COPY packages/iris-common/ ./packages/iris-common/
COPY services/iris-core/ ./services/iris-core/

# Build binary
RUN go build -o /iris-core ./services/iris-core/cmd/api

# Stage 2: Runtime
FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
COPY --from=builder /iris-core /iris-core
EXPOSE 3000
ENTRYPOINT ["/iris-core"]
```

The same pattern applies to `iris-hooks`, `iris-worker`, and `iris-telegram` with their respective binary paths.

### 18.2 Full Docker Compose

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16-alpine
    container_name: iris-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: iris
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d iris"]
      interval: 5s
      timeout: 5s
      retries: 5

  nats:
    image: nats:latest
    container_name: iris-nats
    restart: unless-stopped
    command: "-js -m 8222"
    ports:
      - "4222:4222"
      - "8222:8222"
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:8222/healthz"]
      interval: 5s
      timeout: 3s
      retries: 5

  iris-core:
    build:
      context: .
      dockerfile: services/iris-core/Dockerfile
    container_name: iris-core
    restart: unless-stopped
    env_file: .env
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      nats:
        condition: service_healthy

  iris-hooks:
    build:
      context: .
      dockerfile: services/iris-hooks/Dockerfile
    container_name: iris-hooks
    restart: unless-stopped
    env_file: .env
    ports:
      - "8080:8080"
    depends_on:
      nats:
        condition: service_healthy

  iris-worker:
    build:
      context: .
      dockerfile: services/iris-worker/Dockerfile
    container_name: iris-worker
    restart: unless-stopped
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      nats:
        condition: service_healthy

  iris-telegram:
    build:
      context: .
      dockerfile: services/iris-telegram/Dockerfile
    container_name: iris-telegram
    restart: unless-stopped
    env_file: .env
    depends_on:
      postgres:
        condition: service_healthy
      nats:
        condition: service_healthy
      iris-core:
        condition: service_started

  web:
    build:
      context: ./web
      dockerfile: Dockerfile
    container_name: iris-web
    restart: unless-stopped
    env_file: ./web/.env.local
    ports:
      - "3001:3001"
    depends_on:
      - iris-core

volumes:
  postgres_data:

networks:
  default:
    name: iris-network
```

### 18.3 Web Dockerfile

```dockerfile
# web/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3001
ENV PORT=3001
CMD ["node", "server.js"]
```

### 18.4 Complete Makefile

```makefile
.PHONY: help infra-up infra-down infra-logs infra-clean \
        db-migrate-up db-migrate-down db-migrate-create db-migrate-version \
        db-migrate-force db-reset db-shell db-status \
        setup check dev-core dev-hooks dev-worker dev-telegram dev-all dev-web \
        build build-core build-hooks build-worker build-telegram \
        docker-build docker-up docker-down \
        test lint clean

# Config
DB_USER     := user
DB_PASSWORD := password
DB_NAME     := iris
DB_HOST     := localhost
DB_PORT     := 5432
DB_URL      := postgres://$(DB_USER):$(DB_PASSWORD)@$(DB_HOST):$(DB_PORT)/$(DB_NAME)?sslmode=disable
POSTGRES_CONTAINER := iris-postgres
MIGRATIONS_PATH    := services/iris-core/db/migrations

# Colors
GREEN  := \033[0;32m
YELLOW := \033[0;33m
RED    := \033[0;31m
NC     := \033[0m

help: ## Show this help
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  $(GREEN)%-22s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

## Infrastructure
infra-up:    ## Start Postgres + NATS
	@docker compose up -d && sleep 3 && docker compose ps
infra-down:  ## Stop infrastructure
	@docker compose down
infra-logs:  ## Tail infrastructure logs
	@docker compose logs -f
infra-clean: ## DANGER: stop + delete all volumes
	@docker compose down -v

## Database
db-migrate-up:      ## Run all pending migrations
	@migrate -path $(MIGRATIONS_PATH) -database "$(DB_URL)" up
db-migrate-down:    ## Roll back last migration
	@migrate -path $(MIGRATIONS_PATH) -database "$(DB_URL)" down 1
db-migrate-version: ## Show current migration version
	@migrate -path $(MIGRATIONS_PATH) -database "$(DB_URL)" version
db-migrate-create:  ## Create migration pair (NAME=...)
	@migrate create -ext sql -dir $(MIGRATIONS_PATH) -seq $(NAME)
db-migrate-force:   ## Force version (VERSION=N)
	@migrate -path $(MIGRATIONS_PATH) -database "$(DB_URL)" force $(VERSION)
db-reset:    ## Drop all tables + re-run migrations
	@migrate -path $(MIGRATIONS_PATH) -database "$(DB_URL)" drop -f && $(MAKE) db-migrate-up
db-shell:    ## Open psql shell
	@docker exec -it $(POSTGRES_CONTAINER) psql -U $(DB_USER) -d $(DB_NAME)
db-status:   ## Show table row counts
	@docker exec -i $(POSTGRES_CONTAINER) psql -U $(DB_USER) -d $(DB_NAME) -c \
		"SELECT tablename, n_live_tup FROM pg_stat_user_tables ORDER BY n_live_tup DESC;"

## Development
dev-core:     ## Run iris-core API (port 3000)
	@cd services/iris-core && go run cmd/api/main.go
dev-hooks:    ## Run iris-hooks webhook server (port 8080)
	@cd services/iris-hooks && go run cmd/server/main.go
dev-worker:   ## Run iris-worker execution engine
	@cd services/iris-worker && go run cmd/main.go
dev-telegram: ## Run iris-telegram bot
	@cd services/iris-telegram && go run cmd/bot/main.go
dev-all:      ## Run all 4 backend services concurrently
	@$(MAKE) -j4 dev-core dev-hooks dev-worker dev-telegram
dev-web:      ## Run Next.js frontend (port 3001)
	@cd web && npm run dev

## Build
build: ## Build all Go services into bin/
	@mkdir -p bin
	@go build -o bin/iris-core     ./services/iris-core/cmd/api
	@go build -o bin/iris-hooks    ./services/iris-hooks/cmd/server
	@go build -o bin/iris-worker   ./services/iris-worker/cmd
	@go build -o bin/iris-telegram ./services/iris-telegram/cmd/bot
	@echo "$(GREEN)Built: bin/$(NC)" && ls -lh bin/

## Docker
docker-build: ## Build all Docker images
	@docker compose build
docker-up:    ## Start full stack in Docker
	@docker compose up -d
docker-down:  ## Stop full Docker stack
	@docker compose down

## Setup
setup: infra-up db-migrate-up ## First-time setup
	@echo "$(GREEN)Setup complete!$(NC)"
	@echo "  make dev-core     — API on :3000"
	@echo "  make dev-hooks    — Webhooks on :8080"
	@echo "  make dev-worker   — Worker"
	@echo "  make dev-telegram — Telegram bot"
	@echo "  make dev-web      — Frontend on :3001"

check: ## Verify all infrastructure is healthy
	@docker exec $(POSTGRES_CONTAINER) pg_isready -U $(DB_USER) -d $(DB_NAME) > /dev/null 2>&1 \
		&& echo "$(GREEN)✓ Postgres$(NC)" || echo "$(RED)✗ Postgres$(NC)"
	@curl -sf http://localhost:8222/healthz > /dev/null 2>&1 \
		&& echo "$(GREEN)✓ NATS$(NC)" || echo "$(RED)✗ NATS$(NC)"
	@migrate -version > /dev/null 2>&1 \
		&& echo "$(GREEN)✓ migrate CLI$(NC)" || echo "$(RED)✗ migrate CLI not found$(NC)"

## Quality
test: ## Run all Go tests
	@go test -race -count=1 ./...
lint: ## Run golangci-lint
	@golangci-lint run ./...
clean: ## Remove build artifacts
	@rm -rf bin/

.DEFAULT_GOAL := help
```

---

## 19. Development Order Summary

This is the strict build order. Each item depends on everything before it.

```
WEEK 1 — Foundation
  [ ] Phase 0: Rename Hermes → Iris (module names, imports, docker, makefile)
  [ ] Phase 0: .env.example, go.work with iris-telegram added
  [ ] Phase 1: iris-common/pkg/logger
  [ ] Phase 1: iris-common/pkg/encryptor
  [ ] Phase 1: iris-common/pkg/cronutil
  [ ] Phase 1: iris-common/pkg/dag (dag.go + dag_test.go + scheduler.go + scheduler_test.go)
  [ ] Phase 1: iris-common/pkg/templateengine (engine.go + engine_test.go)
  [ ] Phase 1: iris-common/pkg/oauth
  [ ] Phase 1: iris-common/pkg/actions (all 6 action types with FieldSpec)

WEEK 2 — Core API
  [ ] Phase 2: iris-core config
  [ ] Phase 2: iris-core DB connection (pgxpool)
  [ ] Phase 2: iris-core migrations 000001 through 000009
  [ ] Phase 2: iris-core models (incl. AIRelayRequest/Response)
  [ ] Phase 2: iris-core user_store
  [ ] Phase 2: iris-core secret_store
  [ ] Phase 2: iris-core connections_store
  [ ] Phase 2: iris-core relay_store (with DAG edge support)
  [ ] Phase 2: iris-core NATS publisher
  [ ] Phase 2: iris-core interfaces.go
  [ ] Phase 2: iris-core middleware (JWT)
  [ ] Phase 2: iris-core auth_handlers
  [ ] Phase 2: iris-core oauth_handlers
  [ ] Phase 2: iris-core handlers (relay CRUD + executions + secrets + connections)
  [ ] Phase 2: iris-core LLM client + prompts + parser (ai/ package)
  [ ] Phase 2: iris-core ai_handlers (POST /api/v1/ai/relay)
  [ ] Phase 2: iris-core router
  [ ] Phase 2: iris-core main.go

WEEK 2-3 — Hooks + Worker
  [ ] Phase 3: iris-hooks (config, handler, NATS publisher, main.go)
  [ ] Phase 4: iris-worker config
  [ ] Phase 4: iris-worker store (GetRelayGraph, GetSecret, execution tracking)
  [ ] Phase 4: iris-worker registry
  [ ] Phase 4: iris-worker integration — debug
  [ ] Phase 4: iris-worker integration — discord
  [ ] Phase 4: iris-worker integration — slack
  [ ] Phase 4: iris-worker integration — httpreq
  [ ] Phase 4: iris-worker integration — email
  [ ] Phase 4: iris-worker integration — condition (NEW)
  [ ] Phase 4: iris-worker executor (DAG wave-parallel process())
  [ ] Phase 4: iris-worker worker_pool
  [ ] Phase 4: iris-worker cron_scheduler
  [ ] Phase 4: iris-worker NATS consumer
  [ ] Phase 4: iris-worker main.go

WEEK 3-4 — Frontend Revamp
  [ ] Phase 5: globals.css — Iris design tokens (replace all orange)
  [ ] Phase 5: src/components/ui/ — Button, Input, Card, Badge, Modal, Spinner
  [ ] Phase 5: src/app/layout.tsx — Inter + JetBrains Mono fonts
  [ ] Phase 5: src/app/page.tsx — Iris landing page rebrand
  [ ] Phase 5: (auth)/login + register pages
  [ ] Phase 5: sidebar.tsx — Iris brand, violet active state, AI Assistant nav item
  [ ] Phase 5: dashboard/layout.tsx — three-panel layout (sidebar + main + AI panel)
  [ ] Phase 5: relay list page
  [ ] Phase 5: relay detail page
  [ ] Phase 5: visual DAG builder — Iris-styled nodes, animated edges, toolbar
  [ ] Phase 5: secrets page
  [ ] Phase 5: connections page
  [ ] Phase 5: api.ts, api-dag.ts, queries.ts
  [ ] Phase 5: workflow-serializer.ts

WEEK 4-5 — Web LLM Chat
  [ ] Phase 6: src/lib/api-ai.ts
  [ ] Phase 6: src/types/ai.ts
  [ ] Phase 6: src/context/ai-chat-context.tsx
  [ ] Phase 6: src/components/ai-chat/chat-input.tsx
  [ ] Phase 6: src/components/ai-chat/chat-message.tsx
  [ ] Phase 6: src/components/ai-chat/relay-preview.tsx
  [ ] Phase 6: src/components/ai-chat/chat-panel.tsx
  [ ] Phase 6: execution-dag.tsx (color-coded execution visualization)

WEEK 5-6 — Telegram Bot
  [ ] Phase 7: iris-telegram service scaffold + go.mod + go.work entry
  [ ] Phase 7: config
  [ ] Phase 7: iris-telegram store (telegram_links DB queries)
  [ ] Phase 7: internal/iris/client.go
  [ ] Phase 7: internal/ai/client.go + prompts.go + parser.go
  [ ] Phase 7: internal/bot/session.go (SessionManager + state machine)
  [ ] Phase 7: internal/bot/handlers.go (command + message dispatch)
  [ ] Phase 7: internal/bot/bot.go (setup + Start loop)
  [ ] Phase 7: internal/bot/notifier.go (NATS subscription for push notifications)
  [ ] Phase 7: templates.go (quick-start relay templates)
  [ ] Phase 7: cmd/bot/main.go
  [ ] Phase 7: Dockerfile for iris-telegram

WEEK 6-7 — Notifications + Testing
  [ ] Phase 8: iris-worker publishes ExecutionNotification to NATS
  [ ] Phase 8: iris-telegram Notifier subscribes and sends Telegram messages
  [ ] Phase 9: All dag package unit tests passing
  [ ] Phase 9: All templateengine unit tests passing
  [ ] Phase 9: All encryptor unit tests passing
  [ ] Phase 9: iris-core handler tests (create relay, cycle detection, auth)
  [ ] Phase 9: iris-worker process() unit tests
  [ ] Phase 9: End-to-end webhook trigger integration test
  [ ] Phase 9: End-to-end DAG parallel execution integration test
  [ ] Phase 9: Backwards-compat test (linear relay with no edges)
  [ ] Phase 9: Security checklist review

WEEK 7 — Infrastructure
  [ ] Phase 10: Dockerfiles for all 4 Go services + web
  [ ] Phase 10: docker-compose.yml with health checks + depends_on
  [ ] Phase 10: Full Makefile (all targets)
  [ ] Phase 10: .env.example complete and documented
  [ ] Phase 10: README.md updated for Iris (setup, architecture, env vars)
```

---

## 20. Migration Timeline

| Migration | Description | Status |
|---|---|---|
| `000001_init` | Users, relays (linear), relay_actions, execution_logs | ✅ Exists |
| `000002_processed_events` | Deduplication table | ✅ Exists |
| `000003_secrets` | AES-encrypted secret store | ✅ Exists |
| `000004_connections` | OAuth token storage | ✅ Exists |
| `000005_exec_steps` | Executions + execution_steps tables | ✅ Exists |
| `000006_cron_manual` | trigger_type, trigger_config, next_run_at on relays | ✅ Exists |
| `000007_dag_edges` | node_id on relay_actions, relay_edges table | ✅ Exists |
| `000008_telegram_links` | telegram_links table for bot user linking | 🔲 To build |
| `000009_ai_sessions` | ai_sessions table for persistent LLM history | 🔲 To build |

All migrations live in `services/iris-core/db/migrations/` and are run with:

```bash
make db-migrate-up
```

Rollback any migration with:

```bash
make db-migrate-down   # rolls back the most recent one
```

---

## 21. Files Created / Changed Summary

### Phase 0 — Rename & Setup

| Action | File |
|---|---|
| Rename | All `go.mod` module names: `hermes-*` → `iris-*` |
| Update | `go.work` — add `iris-telegram`, rename all `use` paths |
| Update | `docker-compose.yml` — container names, service names |
| Update | `Makefile` — all targets and binary names |
| Create | `.env.example` — full env var template |

### Phase 1 — `iris-common`

| Action | File |
|---|---|
| Verify / Update | `pkg/logger/logger.go` |
| Verify / Update | `pkg/encryptor/encryptor.go` |
| Verify / Update | `pkg/cronutil/cronutil.go` |
| Verify / Update | `pkg/dag/dag.go` + `dag_test.go` |
| Create | `pkg/dag/scheduler.go` + `scheduler_test.go` |
| Verify / Update | `pkg/templateengine/engine.go` + `engine_test.go` |
| Verify / Update | `pkg/oauth/oauth.go` |
| Update | `pkg/actions/actions.go` — add `condition` action type |

### Phase 2 — `iris-core`

| Action | File |
|---|---|
| Create | `db/migrations/000008_telegram_links.up.sql` + `.down.sql` |
| Create | `db/migrations/000009_ai_sessions.up.sql` + `.down.sql` |
| Update | `internal/models/models.go` — add `AIRelayRequest`, `AIRelayResponse`, `AIMessage` |
| Create | `internal/ai/client.go` |
| Create | `internal/ai/prompts.go` |
| Create | `internal/ai/parser.go` |
| Create | `internal/api/ai_handlers.go` |
| Update | `internal/api/router.go` — add `POST /api/v1/ai/relay` route |
| Update | `internal/api/interfaces.go` — add LLMClient interface |
| Update | `cmd/api/main.go` — wire LLM client |
| Update | `internal/config/config.go` — add LLM config fields |

### Phase 4 — `iris-worker`

| Action | File |
|---|---|
| Create | `internal/integrations/condition/condition.go` |
| Update | `internal/engine/executor.go` — DAG wave-parallel execution |
| Update | `internal/engine/executor.go` — publish ExecutionNotification to NATS |
| Update | `internal/engine/registry.go` — register `condition` action |
| Update | `cmd/main.go` — register condition plugin |

### Phase 5 — Frontend Revamp

| Action | File |
|---|---|
| Rewrite | `src/app/globals.css` — full Iris design tokens, remove orange |
| Rewrite | `src/app/layout.tsx` — Inter + JetBrains Mono, Iris brand |
| Rewrite | `src/app/page.tsx` — Iris landing page |
| Create | `src/components/ui/Button.tsx` |
| Create | `src/components/ui/Input.tsx` |
| Create | `src/components/ui/Card.tsx` |
| Create | `src/components/ui/Badge.tsx` |
| Create | `src/components/ui/Modal.tsx` |
| Create | `src/components/ui/Spinner.tsx` |
| Rewrite | `src/components/sidebar.tsx` — Iris brand, violet, AI nav item |
| Update | `src/app/dashboard/layout.tsx` — three-panel with AI chat slot |
| Update | `src/components/workflow/nodes/action-node.tsx` — violet header, cyan handles |
| Update | `src/components/workflow/nodes/trigger-node.tsx` — cyan/indigo header |
| Update | `src/components/workflow/nodes/condition-node.tsx` — diamond, amber |
| Create | `src/components/workflow/execution-dag.tsx` |
| Update | `src/lib/api.ts` — all endpoints for Iris |
| Update | `src/lib/api-dag.ts` |
| Create | `src/lib/api-ai.ts` |
| Create | `src/types/ai.ts` |

### Phase 6 — Web LLM Chat

| Action | File |
|---|---|
| Create | `src/components/ai-chat/chat-panel.tsx` |
| Create | `src/components/ai-chat/chat-message.tsx` |
| Create | `src/components/ai-chat/relay-preview.tsx` |
| Create | `src/components/ai-chat/chat-input.tsx` |
| Create | `src/context/ai-chat-context.tsx` |

### Phase 7 — `iris-telegram` (All New)

| Action | File |
|---|---|
| Create | `services/iris-telegram/go.mod` |
| Create | `services/iris-telegram/Dockerfile` |
| Create | `services/iris-telegram/.env` |
| Create | `services/iris-telegram/cmd/bot/main.go` |
| Create | `services/iris-telegram/internal/config/config.go` |
| Create | `services/iris-telegram/internal/store/telegram_store.go` |
| Create | `services/iris-telegram/internal/iris/client.go` |
| Create | `services/iris-telegram/internal/ai/client.go` |
| Create | `services/iris-telegram/internal/ai/prompts.go` |
| Create | `services/iris-telegram/internal/ai/parser.go` |
| Create | `services/iris-telegram/internal/bot/session.go` |
| Create | `services/iris-telegram/internal/bot/handlers.go` |
| Create | `services/iris-telegram/internal/bot/bot.go` |
| Create | `services/iris-telegram/internal/bot/notifier.go` |
| Create | `services/iris-telegram/internal/bot/templates.go` |

### Phase 10 — Infrastructure

| Action | File |
|---|---|
| Rewrite | `docker-compose.yml` — all 5 services + web |
| Create | `services/iris-core/Dockerfile` |
| Create | `services/iris-hooks/Dockerfile` |
| Create | `services/iris-worker/Dockerfile` |
| Create | `services/iris-telegram/Dockerfile` |
| Create | `web/Dockerfile` |
| Rewrite | `Makefile` — complete target set |
| Update | `README.md` — Iris branding, full setup guide |

---

## 22. Open Questions & Future Roadmap

### 22.1 Open Questions

| Question | Options | Recommendation |
|---|---|---|
| **Which LLM provider first?** | OpenAI, Gemini, Anthropic, local Ollama | Start with OpenAI `gpt-4o-mini` (cheapest structured output), add others via `LLMClient` interface swap |
| **Session persistence for AI chat?** | In-memory only, Postgres `ai_sessions` table, Redis | Start in-memory (simpler); migrate to Postgres for multi-device / reload support |
| **Telegram token linking UX** | JWT copy-paste, magic link, OAuth | Start with JWT copy-paste (simplest); add magic link in v2 |
| **Condition node evaluation** | `expr-lang/expr`, `govaluate`, custom parser | `expr-lang/expr` — safe, sandboxed, no eval() |
| **fail-fast vs. continue on wave error** | Cancel siblings, continue all | Configurable per relay (`on_error: "stop" | "continue"`); default `"stop"` |
| **Rate limiting the AI endpoint** | Per-user token bucket, per-IP | Per-user rate limit in JWT middleware: max 20 requests/min |
| **Telegram bot session storage in prod** | `sync.Map` (in-memory), Redis | `sync.Map` for v1; Redis for horizontal scaling |

### 22.2 Planned Future Features (Post-Iris v1)

**Additional Integrations:**
- GitHub — create issues, comment, trigger on PR events
- Linear — create/update tickets from webhooks
- PagerDuty — trigger/resolve incidents
- Notion — append to a database, create pages
- Twilio — send SMS notifications
- OpenAI — use LLM calls as relay action nodes

**Platform Features:**
- **Relay versioning** — keep a history of relay config changes, roll back to previous version
- **Execution retry** — manual retry of a failed execution from the UI
- **Relay sharing** — generate a read-only share link for a relay definition
- **Team workspaces** — multiple users sharing a common relay/secret namespace
- **Relay import/export** — JSON export/import of full relay definitions
- **Template marketplace** — browse and clone community relay templates
- **Webhook security** — HMAC signature verification for inbound webhooks
- **Rate limiting** — per-relay webhook rate limiting (prevent thundering herd)

**Observability:**
- Prometheus metrics endpoint (`/metrics`) on each service
- Grafana dashboard template for relay execution rates, latencies, error rates
- OpenTelemetry trace spans across the full webhook-to-execution pipeline

**Frontend:**
- Real-time execution streaming via SSE (replace polling)
- Relay execution timeline visualization (Gantt-style)
- Dark/light theme toggle (Iris dark is default)
- Mobile-responsive dashboard
- Keyboard shortcuts for the DAG builder

**Telegram Bot:**
- OAuth deep-link login (instead of JWT copy-paste)
- Relay execution replay from Telegram (`/retry <execution_id>`)
- Inline keyboard for relay management (buttons, not text commands)
- Natural language relay editing: "change the Discord message to include the user's name"

**Infrastructure:**
- Kubernetes Helm chart for production deployment
- GitHub Actions CI/CD pipeline (build → test → Docker push → deploy)
- Multi-region NATS cluster for high availability
- Automated DB backup and point-in-time recovery

### 22.3 Known Constraints & Non-Goals

| Constraint | Detail |
|---|---|
| **Self-hosted first** | Iris does not offer a managed SaaS tier. All infra (Postgres, NATS) runs on your own machines. |
| **Single-tenant** | One Iris instance = one organization. Multi-tenancy requires team workspaces (future). |
| **LLM API key required** | The AI features require an external LLM API key (OpenAI / Gemini). Local LLM (Ollama) support is planned but not in v1. |
| **No built-in queue persistence across restarts** | The worker job channel is in-memory. NATS JetStream handles persistence for webhook events; cron jobs that fire during downtime are missed (acceptable for v1). |
| **Telegram bot = one user per token** | Each Telegram user must link their own Iris account. Bot accounts or group usage are not supported in v1. |

---

*Iris Roadmap — Last updated: initial draft*
*Built on the Hermes foundation. Evolved with intelligence.*
