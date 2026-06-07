# PoliReports — Claude Code Context

People Intelligence Engine for political/advocacy marketing. Listens to public discourse → detects issues → aggregate personas → Comment Vitality Score channel ranking → Moral Foundations reframes. Nonpartisan, down-ballot/advocacy SMB focus. Self-contained Docker stack. Business case in `PARTNER_BRIEF.md`; build plan/decisions in `~/.gstack/projects/eyedz9-poli/ceo-plans/`.

## Current state
Dummy-data MVP complete and runs with **no external API keys** (`USE_DUMMY_DATA=true`). Real engines (LLM/scraper integrations) are stubbed with `TODO` real-mode paths. Trust/compliance foundation built: HNSW indexes, 24h TTL purge + dead-man's-switch, eval-harness scaffold.

## Commands
```bash
# Bring up the full stack (builds api/worker/dashboard images)
docker compose up -d --build

# Seed dummy data (run from apps/api; uses the DEV DB port — see Gotchas)
cd apps/api && npm install
DATABASE_URL="postgresql://polireports:devpassword_local_only_change_me@localhost:55432/polireports" \
  SEED_ADMIN_EMAIL="admin@polireports.local" SEED_ADMIN_PASSWORD="DevAdminPass123!" npm run seed

# Tests (DB-backed tests need DATABASE_URL on 55432; others run without it)
cd apps/api && DATABASE_URL="postgresql://polireports:devpassword_local_only_change_me@localhost:55432/polireports" npm test

npm run eval        # run the golden-set eval harness + regression gate (EVAL_GATE=true to enforce)
npx tsc --noEmit    # typecheck (run in apps/api AND apps/dashboard)
```
Dashboard: http://localhost:5173 (login `admin@polireports.local` / `DevAdminPass123!`). API :3000, n8n :5678, pgAdmin :5050.

## Architecture
- `apps/api` — Hono API (`src/routes/`), BullMQ worker (`src/worker.ts`), 5 engines (`src/engines/{ingest,narrative,persona,influencer,language}.ts`), `src/lib/` (db, auth, queues, dummy generators, mode switch), `src/eval/` (golden-set harness), `src/jobs/ttl-purge.ts`.
- `apps/dashboard` — React/Vite SPA.
- `infra/postgres/init.sql` — full schema (runs once on first container start).
- Pipeline: n8n/route → BullMQ queue → worker → engine → Postgres → dashboard.
- Dummy mode: `src/lib/mode.ts` `isDummy()` gates each engine. Real-mode paths throw with a TODO until keys are set.

## Gotchas
- **Dev DB/Redis ports:** host already runs Postgres on `5432`. Compose Postgres/Redis are internal-only; `docker-compose.override.yml` publishes them to host on `127.0.0.1:55432` (PG) and `56379` (Redis) for host-side tooling. App containers use in-network hostnames (`postgres:5432`).
- **git push:** active gh account reverts to `AdForge-Studios` (no push access). Run `gh auth switch --user eyedz9` before pushing. Commit email: `1859434+eyedz9@users.noreply.github.com`.
- **bcryptjs v2 is CommonJS:** `import bcrypt from 'bcryptjs'; const {hash}=bcrypt` — named imports crash at runtime.
- **Hono on Node:** needs `@hono/node-server` `serve()`. `export default {port,fetch}` only binds on Bun.
- **postgres.js camel transform** camelCases nested `row_to_json` keys too — read nested fields as `channel.displayName`, not `display_name`.
- **Redis** must be `--maxmemory-policy noeviction` (BullMQ; lru drops jobs).
- **init.sql table order:** `users` before `briefs` (FK). Under ON_ERROR_STOP a forward ref aborts the whole init.
- **pgAdmin** rejects reserved TLDs (`.local`) — use a real domain.
- **No `jq`** in the local Git Bash — use `node` for JSON serialization.

## Real-engine architecture (decided, not yet built)
Narrative clustering = embed (Voyage `voyage-3`, 1024-dim, matches schema `VECTOR(1024)`) → HDBSCAN per-geo/window → one LLM call per cluster to label. NOT LLM-in-the-loop. Two-tier tests: deterministic math unit-tested, LLM output golden-set eval-gated. Needs `ANTHROPIC_API_KEY` + `VOYAGE_API_KEY` + source keys.

## Skill routing (gstack)
When a request matches an available skill, invoke it via the Skill tool. Key routes: product ideas → /office-hours; strategy/scope → /plan-ceo-review; architecture → /plan-eng-review; bugs → /investigate; QA → /qa; code review → /review; ship → /ship.
