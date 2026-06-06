# PoliReports

A **People Intelligence Engine** for political and advocacy marketing. It listens to public discourse, detects emerging issues, profiles aggregate audiences, ranks engaged channels by Comment Vitality Score, generates cross-partisan message reframes (Moral Foundations Theory), and produces ready-to-run creative briefs — all without storing PII.

> **This repo currently runs in dummy-data mode.** Every engine produces realistic synthetic output so the entire platform works end-to-end with **no external API keys**. Wire real data sources later (see [Going live](#going-live)).

See `PARTNER_BRIEF.md` for the business case and `IMPLEMENTATION_PLAN.md` for the full engineering spec.

---

## Architecture

```
Ingest sources ──► n8n (schedule) ──► API ──► BullMQ queues ──► Worker (5 engines) ──► Postgres
                                       │                                                   │
                              React/Vite dashboard ◄──────────────────────────────────────┘
```

| Service | Port (localhost) | Purpose |
|---|---|---|
| API (Hono) | 3000 | REST API + auth + queue triggers |
| Dashboard (React/Vite) | 5173 | Intelligence dashboard UI |
| n8n | 5678 | Ingestion orchestration / scheduling |
| pgAdmin | 5050 | Database admin UI |
| Postgres (pgvector) | internal (55432 in dev) | All operational data |
| Redis | internal (56379 in dev) | BullMQ job queues |
| Worker | — | Processes the 5 engine queues |

The five engines: **Narrative** (issue detection/momentum), **Persona** (aggregate cohort profiling), **Influencer/CVS** (channel comment-vitality ranking), **Language/Framing** (MFT reframes), **Ingest** (source normalization).

---

## Quick start

Requires Docker + Docker Compose.

```bash
# 1. Create env with auto-generated secrets (or copy .env.example → .env and edit)
bash scripts/setup.sh

# 2. Build and start the whole stack
docker compose up -d --build

# 3. Seed realistic dummy data (run from apps/api, against the dev DB port)
cd apps/api && npm install
DATABASE_URL="postgresql://polireports:<POSTGRES_PASSWORD>@localhost:55432/polireports" \
  SEED_ADMIN_EMAIL="admin@polireports.local" \
  SEED_ADMIN_PASSWORD="DevAdminPass123!" \
  npm run seed
```

Then open **http://localhost:5173** and sign in:

```
admin@polireports.local  /  DevAdminPass123!
```

> The dev `docker-compose.override.yml` publishes Postgres on `127.0.0.1:55432` and Redis on
> `127.0.0.1:56379` so host-side tooling (seed, tests) can reach them. App containers talk to
> them in-network. Don't use the override in production (`docker compose -f docker-compose.yml ...`).

---

## What you can do in the dashboard

- Browse **emerging issues** ranked by momentum; thin-data issues are visibly **activation-blocked** (<50 source units).
- Drill into an issue: **aggregate personas** (with MFT primary foundation, persuadability), **top channels** by Comment Vitality Score, and **framing reframes**.
- **Generate a Bridge Brief**: state your position + the principle you won't compromise + a target segment; the language engine produces a confidence-scored, owner-scoped brief (processed asynchronously via the worker).

---

## Development

```bash
cd apps/api
npm install
npm run dev          # API with hot reload (needs DATABASE_URL + REDIS_URL)
npm run worker:dev   # worker with hot reload
npm test             # vitest unit tests (generators, auth)

cd apps/dashboard
npm install
npm run dev          # Vite dev server
```

### Tests

```bash
cd apps/api && npm test
```

Covers the deterministic dummy generators (activation gating, cohort-size constraints, thin-data flagging) and JWT sign/verify (including alg-confusion rejection).

---

## Going live

Dummy mode is controlled by `USE_DUMMY_DATA` in `.env`. Set it to `false` (and provide
`ANTHROPIC_API_KEY`) to switch engines to real mode. Each engine's real-mode path is stubbed
with a clear `TODO` — implement source pulls (Google Trends, GDELT, YouTube, Apify Reddit,
Bluesky) and LLM calls there. The DB schema, queues, API, worker, and dashboard are all
production-shaped already.

### Security notes

- `/api/auth/register` is **admin-gated** behind `INTERNAL_TRIGGER_TOKEN` (no public signup).
  Bootstrap the first admin via the seed script.
- Briefs are **owner-scoped** (`created_by`); `issues`/`personas`/`channels` are the shared
  public-intelligence corpus by design.
- JWT verification is pinned to HS256. Login uses a constant-time compare.
- All host ports bind to `127.0.0.1` only. Postgres/Redis are internal-only in production.
