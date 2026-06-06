# PoliReports MVP — Implementation Plan

**Engineering Bible v1.0 | June 2026**

---

## Executive Summary

PoliReports is a People Intelligence Engine for political and advocacy marketing. It ingests public discourse from five data sources, detects emerging narratives, builds aggregate audience cohort profiles, ranks influencer channels by comment engagement quality, and generates morally-reframed messaging briefs — all without storing personally identifiable information.

**The product in one sentence:** Give a campaign strategist a live map of what issues are heating up, who is talking about them, and how to phrase their message so it lands with the persuadable middle.

**Four engines power the product:**

| Engine | Function | Output |
|---|---|---|
| Narrative Engine | Issue detection, momentum scoring, geo-tagging | Ranked issue list with lifecycle state |
| Persona Engine | Aggregate cohort profiling via MFT | Audience profiles with moral foundation scores |
| Influencer Engine | Channel scoring via Comment Vitality Score | Ranked reach channels with stance tags |
| Language Engine | Vocab extraction, frame detection, reframing | Bridge Briefs with fidelity-checked reframes |

**Data stack:**
- Supabase (PostgreSQL + pgvector) for all operational data
- Redis (BullMQ) for job queuing
- n8n (self-hosted) for orchestration and scheduling
- Node.js (Hono) for API layer
- React/Vite for dashboard

**Build timeline:** 14 weeks, ~357 hours, solo development.

**Infrastructure cost at MVP:** $120-160/month. One paying client at $299/month covers all infrastructure.

**Three decisions that determine success before a line is written:**
1. Use LLM-based clustering (not BERTopic) for Sprint 2 — ships in days, not weeks
2. Use Hono, not Express — TypeScript-first, edge-ready, no debt
3. Delete raw comment-author associations within 24 hours — this is architectural, not optional

---

## 1. System Architecture

### Component Diagram

```
INGESTION LAYER
┌─────────────────────────────────────────────────────────────────────┐
│  Google Trends    GDELT BigQuery    YouTube API    Apify Reddit     │
│  (free/geo)       (free/news)       (free/quota)   ($3/1K rows)     │
│                                                                       │
│  Bluesky AT Protocol Firehose (free, always-on WebSocket service)   │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
              n8n Orchestration (cron + webhook triggers)
                                  │
PROCESSING LAYER (Node.js workers)
┌─────────────────────────────────┴───────────────────────────────────┐
│                                                                       │
│  Narrative Engine          Persona Engine                            │
│  - LLM cluster detection   - Batch LLM inference (Sonnet)           │
│  - Momentum scoring        - MFT aggregation                        │
│  - Geo-tagging             - Confidence gating (50 comment floor)   │
│  - Lifecycle transitions                                             │
│                                                                       │
│  Influencer Engine         Language Engine                           │
│  - CVS computation         - TF-IDF vocab extraction                │
│  - Channel ranking         - MFD2.0 + LLM MFT scoring               │
│  - Stance tagging          - Reframe generation + fidelity check    │
│                                                                       │
│  Embedding Service (Voyage AI voyage-3-lite, $0.02/1M tokens)       │
│  Claude API (Haiku for bulk, Sonnet for synthesis)                  │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
DATA LAYER
┌─────────────────────────────────┴───────────────────────────────────┐
│  Supabase (PostgreSQL + pgvector)                                    │
│  - corpus_raw (24h TTL, PII stripped on purge)                      │
│  - corpus_signals (permanent, aggregate only)                        │
│  - issues, personas, channels, frames, briefs                       │
│  - audit_events (3-year retention)                                  │
│                                                                       │
│  Redis (BullMQ job queues)                                          │
│  Supabase Storage (raw corpus audit trail, brief exports)           │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
API LAYER
┌─────────────────────────────────┴───────────────────────────────────┐
│  Hono (Node.js) — REST API                                          │
│  Auth: Supabase JWT (dashboard) + API key header (programmatic)     │
│  Rate limiting per org/tier                                         │
└─────────────────────────────────┬───────────────────────────────────┘
                                  │
FRONTEND (React/Vite — localhost → Vercel)
┌─────────────────────────────────┴───────────────────────────────────┐
│  Issues Dashboard  │  Persona Explorer  │  Framing Lab             │
│  Influencer Map    │  Bridge Brief View │  Activation Export       │
└─────────────────────────────────────────────────────────────────────┘
```

### Stack Decisions

**Node.js, not Python.** The workload is I/O-bound (API calls, scraping, DB writes). The only compute-heavy task (ML clustering) is offloaded entirely to Claude API and Voyage embeddings. No pandas, no transformers, no Python microservice ops overhead. n8n is Node-native. This stack is consistent end to end.

**Hono, not Express.** TypeScript-first, 10x faster on benchmarks, runs on Node/Deno/Bun/Workers with zero lock-in. Two-hour learning curve is worth it on day one versus compounding Express middleware debt.

**Supabase, not self-hosted Postgres.** pgvector, pg_cron, RLS, Row Level Security, and Realtime push come free. The managed DB saves two weeks of ops setup that would otherwise eat Sprint 0 and Sprint 1.

**n8n as orchestrator only.** n8n handles scheduling, webhooks, and alerting. All business logic runs in Node.js workers triggered via HTTP from n8n. Never put data transformation in n8n function nodes.

**LLM-based clustering, not BERTopic.** BERTopic requires Python, UMAP/HDBSCAN tuning, and a separate Docker service before you have seen a single real cluster. LLM clustering is 10 lines of code and ships in days. Migrate to BERTopic post-MVP as a cost optimization.

**Docker on Hetzner VPS (CX21, $6/mo).** One VPS, Docker Compose, external Supabase. Not Kubernetes. Over-engineering the infra for a solo MVP kills the timeline. Extract to dedicated compute instance when processing load requires it.

---

## 2. Database Schema

### Extensions and Types

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

CREATE TYPE platform_type AS ENUM (
  'youtube', 'reddit', 'bluesky', 'gdelt_news', 'google_trends'
);

CREATE TYPE issue_status AS ENUM (
  'emerging', 'active', 'saturated', 'declining', 'archived'
);

CREATE TYPE confidence_tier AS ENUM (
  'insufficient', 'low', 'medium', 'high', 'verified'
);

CREATE TYPE stance_polarity AS ENUM (
  'pro', 'con', 'neutral', 'mixed'
);
```

### Table: `corpus_raw` (Transient, 24h TTL)

```sql
CREATE TABLE corpus_raw (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform          platform_type NOT NULL,
  external_id       TEXT,
  content_hash      TEXT NOT NULL,
  raw_text          TEXT,                        -- deleted after processing, 24h hard cap
  author_hash       TEXT,                        -- SHA-256 of identifier, NOT the identifier
  geo_state         CHAR(2)[],
  geo_dma           TEXT,
  geo_confidence    TEXT,
  language_code     TEXT DEFAULT 'en',
  eu_flagged        BOOLEAN DEFAULT FALSE,
  eu_excluded       BOOLEAN DEFAULT FALSE,
  collected_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at      TIMESTAMPTZ,
  ttl_delete_at     TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
  CONSTRAINT unique_content UNIQUE (content_hash, platform)
);

CREATE INDEX idx_corpus_raw_ttl ON corpus_raw(ttl_delete_at)
  WHERE raw_text IS NOT NULL;
CREATE INDEX idx_corpus_raw_unprocessed ON corpus_raw(collected_at)
  WHERE processed_at IS NULL;

-- Automated PII purge (pg_cron)
SELECT cron.schedule(
  'purge-raw-corpus',
  '0 * * * *',
  $$DELETE FROM corpus_raw WHERE ttl_delete_at < NOW()$$
);
```

### Table: `corpus_signals` (Permanent, Aggregate-Safe)

```sql
CREATE TABLE corpus_signals (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  corpus_raw_id     UUID,                         -- reference only, raw may be deleted
  platform          platform_type NOT NULL,
  issue_id          UUID,
  content_summary   TEXT,                         -- LLM-extracted, 280 chars max
  content_hash      TEXT NOT NULL,                -- for dedup only, cannot rehydrate
  geo_state         CHAR(2),
  geo_dma           TEXT,
  geo_confidence    NUMERIC(3,2),
  sentiment_score   NUMERIC(4,3),
  moral_foundations JSONB,
  framing_tags      TEXT[],
  stance            stance_polarity,
  engagement_score  NUMERIC(7,2),
  reply_depth       SMALLINT DEFAULT 0,
  on_topic_score    NUMERIC(3,2),
  embedding         VECTOR(1024),
  confidence_score  NUMERIC(3,2) DEFAULT 0,
  confidence_flags  TEXT[],
  collected_at      TIMESTAMPTZ NOT NULL,
  processed_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_signal UNIQUE (content_hash, platform)
);

CREATE INDEX ON corpus_signals (issue_id, collected_at DESC);
CREATE INDEX ON corpus_signals (platform, collected_at DESC);
CREATE INDEX ON corpus_signals USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 200);
CREATE INDEX ON corpus_signals USING GIN (framing_tags);
```

### Table: `issues`

```sql
CREATE TABLE issues (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug                  TEXT UNIQUE NOT NULL,
  label                 TEXT NOT NULL,
  description           TEXT,
  themes                TEXT[],
  status                issue_status NOT NULL DEFAULT 'emerging',
  confidence            confidence_tier NOT NULL DEFAULT 'insufficient',

  geo_scope             TEXT NOT NULL DEFAULT 'national',
  geo_codes             TEXT[],
  primary_state         CHAR(2),

  momentum_score        NUMERIC(5,2) NOT NULL DEFAULT 0,
  momentum_delta_24h    NUMERIC(5,2),
  momentum_delta_7d     NUMERIC(5,2),
  velocity_score        NUMERIC(5,2),
  saturation_index      NUMERIC(5,2),

  total_source_units    INTEGER NOT NULL DEFAULT 0,
  platform_breakdown    JSONB,
  cross_platform_count  SMALLINT NOT NULL DEFAULT 0,
  data_confidence       TEXT DEFAULT 'thin',      -- thin|normal|strong
  activation_blocked    BOOLEAN GENERATED ALWAYS AS (total_source_units < 50) STORED,

  first_detected_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_signal_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  peak_at               TIMESTAMPTZ,
  state_changed_at      TIMESTAMPTZ,

  cluster_centroid      VECTOR(1024),
  related_issue_ids     UUID[],
  google_trends_terms   TEXT[],
  seed_keywords         TEXT[],

  audience_persona_ids  UUID[],
  influencer_ids        UUID[],
  framing_analysis_id   UUID,

  operator_verified     BOOLEAN DEFAULT FALSE,
  operator_notes        TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON issues (status, momentum_score DESC);
CREATE INDEX ON issues (primary_state);
CREATE INDEX ON issues (last_signal_at DESC);
CREATE INDEX ON issues USING GIN (geo_codes);
CREATE INDEX ON issues USING GIN (themes);
CREATE INDEX ON issues USING ivfflat (cluster_centroid vector_cosine_ops)
  WITH (lists = 100);
```

### Table: `issue_snapshots` (Momentum History)

```sql
CREATE TABLE issue_snapshots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id        UUID REFERENCES issues(id) ON DELETE CASCADE,
  snapshot_at     TIMESTAMPTZ DEFAULT NOW(),
  momentum_score  NUMERIC(5,2),
  source_count_6h INTEGER,
  source_dist     JSONB
);
CREATE INDEX ON issue_snapshots (issue_id, snapshot_at DESC);
```

### Table: `personas`

```sql
CREATE TABLE personas (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id              UUID REFERENCES issues(id) ON DELETE CASCADE,
  label                 TEXT NOT NULL,
  version               INTEGER NOT NULL DEFAULT 1,

  source_unit_count     INTEGER NOT NULL,
  platform_sources      TEXT[],
  date_range_start      TIMESTAMPTZ NOT NULL,
  date_range_end        TIMESTAMPTZ NOT NULL,

  age_skew              TEXT,
  urban_rural_skew      TEXT,
  geo_concentration     TEXT[],
  income_proxy_skew     TEXT,

  dominant_values       TEXT[],
  primary_concerns      TEXT[],
  trusted_sources       TEXT[],
  rhetoric_style        TEXT,

  mft_care              NUMERIC(4,3),
  mft_fairness          NUMERIC(4,3),
  mft_loyalty           NUMERIC(4,3),
  mft_authority         NUMERIC(4,3),
  mft_sanctity          NUMERIC(4,3),
  mft_liberty           NUMERIC(4,3),
  mft_primary           TEXT,

  stance_on_issue       stance_polarity,
  stance_intensity      NUMERIC(3,2),
  persuadability_score  NUMERIC(3,2),
  persuadability_evidence TEXT,

  receptive_frames      TEXT[],
  resistant_frames      TEXT[],
  resonant_vocabulary   TEXT[],

  confidence            confidence_tier NOT NULL,
  confidence_score      NUMERIC(3,2) NOT NULL,
  confidence_flags      TEXT[],

  computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT min_cohort_size CHECK (source_unit_count >= 50)
);

CREATE INDEX ON personas (issue_id, confidence);
CREATE INDEX ON personas (mft_primary);
CREATE INDEX ON personas USING GIN (geo_concentration);
```

### Table: `channels`

```sql
CREATE TABLE channels (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform              platform_type NOT NULL,
  platform_channel_id   TEXT NOT NULL,
  display_name          TEXT NOT NULL,
  channel_url           TEXT,
  channel_type          TEXT,

  subscriber_proxy      BIGINT,

  cvs_overall           NUMERIC(5,2),
  cvs_volume            NUMERIC(5,2),
  cvs_reply_depth       NUMERIC(5,2),
  cvs_velocity          NUMERIC(5,2),
  cvs_on_topic_pct      NUMERIC(4,3),
  cvs_sentiment_spread  NUMERIC(4,3),
  cvs_computed_at       TIMESTAMPTZ,

  primary_issue_ids     UUID[],
  topic_tags            TEXT[],
  primary_geo           TEXT[],
  geo_confidence        NUMERIC(3,2),

  sample_size           INTEGER,
  confidence            confidence_tier NOT NULL DEFAULT 'insufficient',
  last_scraped_at       TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_channel UNIQUE (platform, platform_channel_id)
);

CREATE INDEX ON channels (cvs_overall DESC);
CREATE INDEX ON channels USING GIN (primary_issue_ids);
CREATE INDEX ON channels USING GIN (topic_tags);
```

### Table: `channel_issue_signals`

```sql
CREATE TABLE channel_issue_signals (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id        UUID REFERENCES channels(id) ON DELETE CASCADE,
  issue_id          UUID REFERENCES issues(id) ON DELETE CASCADE,
  stance            stance_polarity,
  stance_confidence NUMERIC(4,3),
  cvs_for_issue     NUMERIC(5,2),
  post_count        INTEGER,
  comment_count     INTEGER,
  first_posted_at   TIMESTAMPTZ,
  last_posted_at    TIMESTAMPTZ,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_channel_issue UNIQUE (channel_id, issue_id)
);
```

### Table: `briefs`

```sql
CREATE TABLE briefs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id              UUID REFERENCES issues(id),
  persona_id            UUID REFERENCES personas(id),
  brief_type            TEXT NOT NULL,    -- narrative|persona|influencer|framing|full
  version               INTEGER NOT NULL DEFAULT 1,
  status                TEXT NOT NULL DEFAULT 'draft',

  headline              TEXT NOT NULL,
  executive_summary     TEXT NOT NULL,
  confidence_statement  TEXT NOT NULL,

  language_bridges      JSONB,
  distinctive_vocab     JSONB,
  targeting_spec        JSONB,
  key_findings          JSONB,
  framing_recs          JSONB,

  top_channel_ids       UUID[],
  source_corpus_count   INTEGER,
  data_gaps             TEXT[],
  thin_data_warnings    TEXT[],

  overall_confidence    confidence_tier NOT NULL,
  confidence_score      NUMERIC(3,2) NOT NULL,
  confidence_breakdown  JSONB,

  generated_by_model    TEXT,
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until           TIMESTAMPTZ,
  superseded_by         UUID REFERENCES briefs(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE briefs ENABLE ROW LEVEL SECURITY;

CREATE INDEX ON briefs (issue_id, brief_type);
CREATE INDEX ON briefs (overall_confidence);
CREATE INDEX ON briefs (generated_at DESC);
```

### Table: `frames` (Language Engine Output)

```sql
CREATE TABLE frames (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id              UUID REFERENCES issues(id) ON DELETE CASCADE,
  persona_id            UUID REFERENCES personas(id),
  segment               TEXT,           -- support|oppose|persuadable
  dominant_frame        TEXT,
  vocab_distinctive     TEXT[],
  mft_scores            JSONB,
  reframe_text          TEXT,
  foundation_targeted   TEXT,
  fidelity_score        NUMERIC(3,2),
  fidelity_verified     BOOLEAN DEFAULT FALSE,
  fidelity_checklist    JSONB,
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Table: `audit_events`

```sql
CREATE TABLE audit_events (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type    TEXT NOT NULL,
  actor_type    TEXT,
  actor_id      UUID,
  resource_type TEXT,
  resource_id   UUID,
  action        TEXT,
  metadata      JSONB,
  ip_address    TEXT,
  session_id    UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON audit_events (event_type, created_at DESC);
CREATE INDEX ON audit_events (actor_id, created_at DESC);

-- Clients read only their own audit records
CREATE POLICY "clients_own_audit"
ON audit_events FOR SELECT
USING (actor_id = auth.uid() OR actor_type = 'system');
```

### Momentum Scoring Function

```sql
CREATE OR REPLACE FUNCTION update_all_momentum_scores()
RETURNS void AS $$
DECLARE
  issue_rec     RECORD;
  v_recent      INTEGER;
  v_24h         INTEGER;
  v_baseline    NUMERIC;
  v_velocity    NUMERIC;
  v_crossplat   INTEGER;
  v_momentum    NUMERIC;
BEGIN
  FOR issue_rec IN
    SELECT id FROM issues WHERE status != 'archived'
  LOOP
    SELECT COUNT(*) INTO v_recent FROM corpus_signals
    WHERE issue_id = issue_rec.id
      AND collected_at > NOW() - INTERVAL '6 hours';

    SELECT COUNT(*) INTO v_24h FROM corpus_signals
    WHERE issue_id = issue_rec.id
      AND collected_at > NOW() - INTERVAL '24 hours';

    SELECT COALESCE(AVG(cnt), 1) INTO v_baseline
    FROM (
      SELECT COUNT(*) as cnt FROM corpus_signals
      WHERE issue_id = issue_rec.id
        AND collected_at > NOW() - INTERVAL '14 days'
        AND collected_at < NOW() - INTERVAL '6 hours'
      GROUP BY FLOOR(EXTRACT(EPOCH FROM collected_at) / 21600)
    ) t;

    WITH r3 AS (SELECT COUNT(*) as cnt FROM corpus_signals
      WHERE issue_id = issue_rec.id AND collected_at > NOW() - INTERVAL '3 hours'),
    p3 AS (SELECT GREATEST(COUNT(*), 1) as cnt FROM corpus_signals
      WHERE issue_id = issue_rec.id
        AND collected_at BETWEEN NOW() - INTERVAL '6 hours' AND NOW() - INTERVAL '3 hours')
    SELECT 1.0 + GREATEST(((r3.cnt - p3.cnt)::NUMERIC / p3.cnt), 0)
    INTO v_velocity FROM r3, p3;

    SELECT cross_platform_count INTO v_crossplat FROM issues WHERE id = issue_rec.id;

    v_momentum := (v_recent::NUMERIC / GREATEST(v_baseline, 1))
                  * v_velocity
                  * (1.0 + (0.15 * v_crossplat));

    UPDATE issues SET
      momentum_score      = ROUND(v_momentum::NUMERIC, 3),
      velocity_score      = ROUND(v_velocity::NUMERIC, 3),
      total_source_units  = (SELECT COUNT(*) FROM corpus_signals WHERE issue_id = issue_rec.id),
      data_confidence     = CASE
        WHEN (SELECT COUNT(*) FROM corpus_signals WHERE issue_id = issue_rec.id) < 50 THEN 'thin'
        WHEN (SELECT COUNT(*) FROM corpus_signals WHERE issue_id = issue_rec.id) < 500 THEN 'normal'
        ELSE 'strong'
      END,
      updated_at          = NOW()
    WHERE id = issue_rec.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

---

## 3. Four Engine Specs

### 3.1 Narrative Engine

**Purpose:** Detect emerging political narratives, cluster them into named issues, score momentum, tag geography, manage lifecycle.

**Data sources and cadence:**

| Source | Frequency | Method |
|---|---|---|
| Google Trends | Hourly (national), 6h (geo) | `google-trends-api` npm package |
| GDELT BigQuery | Every 4 hours | `@google-cloud/bigquery` client |
| YouTube API v3 | Every 4 hours | `googleapis` npm, comment threads |
| Reddit via Apify | Every 3 hours (Tier 1), on-demand (Tier 2/3) | Apify `trudax/reddit-scraper` |
| Bluesky firehose | Continuous | `wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos` |

**Clustering pipeline:**

```
Raw corpus_signals (unassigned) → batches of 200
    ↓
Claude Haiku: "Identify 5-15 distinct political issues in these texts.
  Return JSON: [{issue_label, description, document_ids[]}]"
    ↓
pgvector cosine similarity check against existing issue centroids
  cosine > 0.82 → assign to existing issue
  cosine < 0.70 → candidate new issue (batch 20+ orphans → Sonnet label → new row)
    ↓
Cross-platform gate: new issue needs signals from >= 2 platforms before status='emerging'
```

**Momentum formula:**

```
momentum_score = (V_recent / V_baseline) × velocity_multiplier × cross_platform_bonus

V_recent   = signal count last 6h
V_baseline = avg signal count per 6h window over 14 days
velocity_multiplier = 1 + d/dt(V_recent)
cross_platform_bonus = 1.0 + (0.15 × platforms_active)
```

**Issue lifecycle states:**

| State | Trigger | Action |
|---|---|---|
| `emerging` | momentum > 2.5, cross_platform >= 2, < 72h | Trigger downstream engines |
| `active` | Confirmed multi-platform, momentum sustained | Full pipeline runs |
| `saturated` | momentum > 5.0 but velocity_multiplier < 1.1 | Mark in dashboard |
| `declining` | momentum < 1.0 for two consecutive 30-min windows | Suppress activations |
| `archived` | No signals for 7 days | Remove from active view |

**Lifecycle transition function** runs every 30 minutes as a Supabase scheduled function called from n8n.

**Geo-tagging priority (highest confidence first):**
1. Subreddit name (r/Virginia → VA) — high
2. Platform profile location field — medium-high
3. Text NER (state/city mention regex + map) — medium
4. GDELT `ActionGeo_ADM1Code` — high
5. Google Trends geo breakdown — high (search intent, not post origin)

**n8n Master Orchestration Workflow (every 30 min):**
```
[Schedule: 30min]
  → [HTTP: /api/embed-pending]
  → [Wait: 90s]
  → [HTTP: /api/cluster-new] + [Postgres: update_all_momentum_scores()]
  → [Postgres: update_issue_lifecycles()]
  → [Write issue_snapshots]
  → [SELECT newly emerging issues since last run]
  → [IF new emerging: HTTP POST /api/downstream-trigger {issue_ids:[...]}]
```

### 3.2 Persona Engine

**Purpose:** Build aggregate cohort profiles from comment corpora. Never individual-level. Enforced at architecture level, not just policy.

**Minimum corpus gate:** 200 usable comments across >= 2 platforms before inference runs. Hard block below 50. `activation_ready` field is `FALSE` below 200.

**Pre-processing (Node.js, before any LLM call):**
- Strip usernames, @mentions, account IDs
- Replace URLs with [LINK]
- Truncate individual comments to 280 chars
- Deduplicate: cosine similarity > 0.95 → keep one
- Language filter: EN only
- Max 75 comments per batch; 50 is target sweet spot

**Core LLM prompt (Claude Sonnet, 50 comments/batch):**

```
SYSTEM:
You are a political communications analyst performing AGGREGATE analysis of public comments.
You extract cohort-level signals from comment batches. You never profile individuals.
All output describes the BATCH AS A WHOLE.

USER:
Analyze the following batch of {N} public comments about: "{ISSUE_LABEL}"
Platform: {PLATFORM_SOURCE} | Window: {DATE_RANGE}

---COMMENTS START---
[1] {COMMENT_TEXT}
...
[N] {COMMENT_TEXT}
---COMMENTS END---

Return JSON:
{
  "batch_size": <integer>,
  "usable_comments": <integer>,
  "demographic_proxies": {
    "age_skew": "<under_30|30_to_50|over_50|mixed>",
    "age_confidence": <0.0-1.0>,
    "urban_rural_skew": "<urban|suburban|rural|mixed>",
    "urban_rural_confidence": <0.0-1.0>
  },
  "moral_foundations": {
    "care_harm": <0.0-1.0>,
    "fairness_cheating": <0.0-1.0>,
    "loyalty_betrayal": <0.0-1.0>,
    "authority_subversion": <0.0-1.0>,
    "sanctity_degradation": <0.0-1.0>,
    "liberty_oppression": <0.0-1.0>,
    "dominant_foundation": "<name>",
    "mft_confidence": <0.0-1.0>
  },
  "emotional_register": {
    "fear": <0.0-1.0>, "anger": <0.0-1.0>, "hope": <0.0-1.0>,
    "dominant_emotion": "<name>",
    "emotion_confidence": <0.0-1.0>
  },
  "political_stance": {
    "lean": "<strong_left|lean_left|center|lean_right|strong_right|mixed|indeterminate>",
    "lean_confidence": <0.0-1.0>,
    "persuadability_score": <0.0-1.0>,
    "persuadability_evidence": "<what signals suggest openness>"
  },
  "language_signals": {
    "dominant_vocabulary": ["<term>"],
    "framing_metaphors": ["<metaphor>"],
    "tribal_markers": ["<in_group_phrase>"],
    "softening_language": ["<hedging_phrase>"]
  },
  "batch_quality": {
    "on_topic_pct": <0-100>,
    "signal_density": "<high|medium|low>"
  }
}
Rules: Never infer individual identities. No fabricated quotes. Return valid JSON only.
```

**Signal aggregation across batches:**
- Numeric scores: weighted average by `usable_comments` per batch
- Categorical fields: plurality vote weighted by `usable_comments`; top < 40% → "mixed"
- High inter-batch variance (σ > 0.25) → reduce field confidence

**Confidence formula:**
```
final_confidence = raw_confidence
  × (1.0 if usable_comments >= 200 else usable_comments / 200)
  × (1.0 if platform_count >= 2 else 0.7)
  × (1.0 if inter_batch_σ <= 0.15 else max(0.4, 1.0 - (inter_batch_σ × 2)))
```

**Persuadable slice activation gate:**
`activation_ready = true` only when: persuadable_pct >= 15, confidence >= 0.5, usable_comments >= 200, no thin_data_flags.

**Retention:** Persona cards expire 30 days from `computed_at`. Refresh triggered if issue momentum changes > 0.3 or corpus age > 14 days. Raw comments never written to persistent storage.

### 3.3 Influencer / CVS Engine

**Purpose:** Rank channels by comment engagement quality (not audience size) for each issue. Identify ally, persuadable, and opposition channels. Detect the "engageable window" when a conversation is still live.

**Comment Vitality Score (CVS):**

```
CVS = 0.25·V̂ + 0.15·D̂ + 0.10·R̂ + 0.20·Vel̂ + 0.15·T + 0.10·S + 0.05·A

V   = comment volume (log-normalized)
D   = mean reply chain depth
R   = comment-to-view ratio (YouTube only; redistribute 0.10 to V on Reddit/Bluesky)
Vel = comments/hour in trailing 7d window
T   = fraction of comments classified on-topic (cosine similarity >= 0.60)
S   = civility score (1 - toxicity via Perspective API)
A   = creator/OP responsiveness (% top-level comments receiving reply)

Normalization: always intra-platform. YouTube vs YouTube. Never cross-platform raw.
```

**Velocity calculation:**
```
VelocityScore = 0.5·Vel_24h + 0.3·Vel_48h + 0.2·Vel_7d
```

**Engageable Window Score (EWS):**
```
EWS = (Vel_24h / Vel_7d_mean) × exp(-0.03 × hours_since_last_comment) × PlatformDecay

PlatformDecay: YouTube=0.85, Reddit=0.70, Bluesky=0.60

Window states:
  LIVE    : EWS >= 0.70 → act within 24h
  COOLING : 0.40-0.69  → act within 48h
  TAIL    : 0.20-0.39  → organic only
  DEAD    : < 0.20     → archive
```

**Stance classification (per channel, per issue):**
- Sample 20 on-topic comments from channel on issue
- Haiku: "What stance does this community take on [issue]? Return: SUPPORTIVE / OPPOSED / MIXED / UNCLEAR"
- `ally` (>60% support), `persuadable` (30-60% mixed), `opposition` (>60% oppose), `neutral` (<20% on-topic)

**Top 20 channels output** is the `ChannelReachReport` JSON stored in `top_channel_rankings` table, regenerated after each CVS batch cycle.

**Update cadence:**

| State | CVS Recalc | Comment Pull |
|---|---|---|
| LIVE | Every 4h | Every 2h |
| COOLING | Every 12h | Every 6h |
| TAIL/DEAD | Once at 7d | None |

**Top 20 ranking query (simplified):**

```sql
WITH latest_cvs AS (
  SELECT DISTINCT ON (channel_id)
    channel_id, cvs_composite, ews_score, window_state, comments_sampled
  FROM cvs_snapshots
  WHERE issue_id = :issue_id
    AND snapshot_at > NOW() - INTERVAL '8 hours'
  ORDER BY channel_id, snapshot_at DESC
)
SELECT ROW_NUMBER() OVER (ORDER BY cvs_composite DESC) AS rank, *
FROM latest_cvs
JOIN channels c USING (channel_id)
LEFT JOIN channel_issue_signals cis USING (channel_id, issue_id)
WHERE comments_sampled >= 50
  AND window_state != 'DEAD'
ORDER BY cvs_composite DESC
LIMIT 20;
```

### 3.4 Language & Framing Engine

**Scientific basis:** Feinberg & Willer (2013, 2015, 2019) — reframing messages to match the audience's dominant moral foundation increases persuasion 25-50% without changing the policy position. This engine operationalizes that finding.

**Pipeline:**

```
Issue corpus → Stance segmentation (SUPPORT/OPPOSE/PERSUADABLE)
    ↓
Per-segment: Vocab extraction (TF-IDF + log-odds-ratio)
    ↓
Per-segment: MFT scoring (MFD2.0 dictionary + Sonnet refinement)
    ↓
Frame detection (Sonnet, 3 dominant frames per segment)
    ↓
Reframe generation (Sonnet) → Fidelity check (Haiku) → Bridge Brief
```

**Distinctive vocabulary extraction (log-odds-ratio):**

```javascript
function extractDistinctiveTerms(segmentTokens, baselineTokens, topN = 30) {
  const alpha0 = 0.01;
  const scores = {};
  for (const word of union(keys(segCount), keys(baseCount))) {
    const yw_s = segCount[word] || 0;
    const yw_b = baseCount[word] || 0;
    const alpha_w = Math.max(1, alpha0 * (yw_b / baseTotal) * segTotal);
    const delta = Math.log((yw_s + alpha_w) / (segTotal + alpha0 - yw_s - alpha_w))
                - Math.log((yw_b + alpha_w) / (baseTotal + alpha0 - yw_b - alpha_w));
    const variance = 1/(yw_s + alpha_w) + 1/(yw_b + alpha_w);
    scores[word] = delta / Math.sqrt(variance);
  }
  return sortByZ(scores).slice(0, topN);
}
```

**MFT scoring:** MFD2.0 word list for speed (stem matching), Sonnet refinement for context (catches negation, sarcasm). Combined: LLM weight = 0.7 for corpora < 200 items, 0.4 for larger corpora.

**Reframe generation prompt (Sonnet):**

```
SYSTEM:
You are a political communication strategist trained in Moral Foundations Theory and
Feinberg/Willer reframing research. Translate a political message to appeal to a specific
set of moral foundations WITHOUT changing the underlying policy position.
This is translation, not spin. Position fidelity is non-negotiable.

USER:
ISSUE: {issue_title}
ORIGINAL POSITION: "{original_position}"
ORIGINAL DOMINANT FOUNDATION: {support_segment_dominant_foundation}
TARGET FOUNDATION: {target_mft_foundation}
RESONANT VOCAB FOR TARGET: {top_10_distinctive_terms}
DO-NOT-USE: {top_10_alienating_terms}

Generate 3 reframings. Each must:
1. Advocate for the IDENTICAL policy position
2. Appeal to {target_foundation} moral reasoning
3. Use 2-3 resonant vocab terms naturally
4. Avoid all do-not-use terms
5. Be 2-5 sentences

Return JSON: {"reframings": [{"version": 1, "foundation_target": "...", "text": "...", "key_moves": "..."}]}
```

**Fidelity check prompt (Haiku, separate call):**

```
SYSTEM:
You check whether a reframed political message preserves its original factual position.
PASS = position preserved. FLAG = minor drift, fixable. FAIL = position changed.

USER:
ORIGINAL: "{original_message}"
REFRAME: "{reframing_text}"

Return JSON: {
  "fidelity_result": "PASS|FLAG|FAIL",
  "checklist": {
    "same_policy": true|false,
    "no_weakening": true|false,
    "no_strengthening": true|false,
    "no_omission": true|false,
    "no_false_implication": true|false
  },
  "failure_reason": null | "...",
  "suggested_fix": null | "..."
}
```

**Fidelity enforcement:** `FLAG` → apply suggested_fix → recheck once. `FAIL` → discard, retry. If 0/5 candidates pass → flag for human review, block auto-generation. All fidelity checks logged in `lfe_fidelity_log` for legal audit trail.

**Bridge Brief output** is the assembled deliverable: segment breakdown, dominant frames per segment, MFT radar chart data, distinctive vocabulary per segment, reframe options (all PASS-verified), word guidance (do/don't use lists), confidence metadata.

**LFE cost per brief:** ~$0.12 at Sonnet pricing. Gross margin on LFE compute at $49-299/mo SaaS: >98%.

---

## 4. Compliance Architecture

Compliance is structural, not a feature layer. The architecture's core doctrine: **minimize-by-default, aggregate-up, never-personalize.**

### What Is Never Stored

These are absolute prohibitions enforced at the ingestion pipeline in Node.js code, not in application policy:

- Raw comment text paired with username or user ID
- Cross-platform identity joins (Reddit username = YouTube commenter)
- Individual voting history, party registration, or ideological label tied to a person
- Geographic data below DMA/county level linked to any identifier
- Email addresses, phone numbers, real names scraped from profiles
- IP addresses from scraped sessions

### 24-Hour TTL Enforcement

The `corpus_raw` table is the only place raw text exists. Two enforcement layers:

1. `ttl_delete_at` column set to `NOW() + 24 hours` at insert
2. pg_cron job: `DELETE FROM corpus_raw WHERE ttl_delete_at < NOW()` — runs every hour
3. Audit event logged for every deletion batch

This is not application-layer TTL that can be forgotten in a deploy. It is database-level, running independently.

### EU Exclusion

EU content detection runs at ingestion, before any processing:

```javascript
function classifyEUResidency(record) {
  if (EU_COUNTRY_CODES.includes(record.geo_code)) {
    return { exclude: true, reason: 'explicit_geo_code', confidence: 1.0 };
  }
  let euConfidence = 0;
  if (EU_TIMEZONES.includes(record.timezone)) euConfidence += 0.6;
  if (EU_LANGUAGES_UNAMBIGUOUS.includes(record.language_code)) euConfidence += 0.5;
  if (euConfidence >= 0.6) return { exclude: true, reason: 'signals', confidence: euConfidence };
  return { exclude: false, confidence: euConfidence };
}
```

When EU confidence >= 0.6, record is excluded. False exclusion cost (losing some US data) is far lower than GDPR violation cost. Conservative default.

### CCPA / CPRA 2026

**Data broker registration:** Register with CPPA annually. PoliReports likely qualifies under the expansive CPPA definition. Register and operate as a data broker while maintaining the architectural argument that stored data is aggregate (non-personal).

**Consumer deletion requests:** Because no individual records exist, the response is: "We do not maintain individual consumer records. Data was processed transiently and deleted within 24 hours pursuant to our data minimization policy." This response is both accurate and architecturally enforced.

**Global Privacy Control:** Honor GPC signals in the ingestion pipeline (`gpc_signal_honored: true` in config).

### FEC Compliance

**Platform role:** PoliReports is a commercial data intelligence vendor. No direct FEC filing obligations. The subscription fee is reported by client campaign committees as a vendor expenditure.

**Coordination safeguard:** The platform sells a standardized commercial product. There is no mechanism for cross-client information sharing. If Campaign A and Super PAC B both subscribe, they receive identical commercial product outputs — the platform cannot transmit Campaign A's strategic context to Super PAC B.

**What the ToS states:** Clients bear all campaign finance disclosure obligations. PoliReports does not provide political consulting services.

### Confidence Scoring as Legal Defense

Confidence tiers are both epistemic and legal metadata:

| Tier | Threshold | UI Treatment | Activation |
|---|---|---|---|
| `verified` | >= 0.90 | Normal display | Fully enabled |
| `high` | >= 0.70 | Normal display | Enabled |
| `medium` | >= 0.50 | Normal display | Enabled with caveats |
| `low` | >= 0.30 | Yellow badge | Restricted |
| `insufficient` | < 50 comments | Red banner, blocked | Blocked by `activation_blocked` computed column |

The `activation_blocked` field is a Postgres generated column — it cannot be toggled by application code. This makes it impossible for a UI bug to accidentally surface thin-data personas to clients.

Documented design decisions serve three legal purposes: regulatory investigation defense, client dispute defense, and FEC coordination defense.

### Audit Trail

`audit_events` table logs every decision: ingestion jobs, EU exclusions, PII purges, cluster creations, persona activations, brief generations, client API calls. Retention: 3 years (California privacy statute of limitations). GDPR incident logs: 5 years.

---

## 5. Sprint-by-Sprint Build Order

### Sprint 0 — Foundation (Weeks 1-2, ~28 hours)

**Goal:** Every service starts clean. Schema is locked. Secrets are managed. No sprint touches an undocumented dependency.

**Deliverables:**

```
polireports/
├── apps/
│   ├── api/              # Hono API (scaffold only)
│   └── dashboard/        # React/Vite (stub only)
├── workers/
│   ├── ingest/           # Data ingestion workers
│   ├── cluster/          # Narrative engine
│   └── export/           # Activation export
├── n8n/workflows/        # Exported n8n JSON workflows
├── supabase/migrations/  # All DDL migrations
├── docker/compose.yml
└── .env.example
```

Docker Compose services: `api` (Hono), `n8n` (port 5678), `redis` (BullMQ), `worker`. Supabase is external cloud — do not self-host Postgres.

All Supabase migrations from Section 2 applied and verified. Core tables created with correct indexes, RLS policies, and pg_cron jobs registered.

Hono API scaffold:
```
GET  /health
POST /ingest/trigger
GET  /issues          (stub 200)
GET  /issues/:id      (stub 200)
POST /export/:id      (stub 200)
```

**Go/No-Go Gate:**
- `docker compose up` starts all services clean
- All migrations apply without error
- `/health` returns 200
- n8n accessible at localhost:5678
- All `.env.example` keys documented with source URLs

**Biggest risk:** Schema lock-in. Under-specified `jsonb` blobs feel flexible but become query nightmares. Spend the extra 3 hours on schema design upfront.

---

### Sprint 1 — Data Ingestion (Weeks 3-4, ~55 hours)

**Goal:** Five sources pulling live data into `corpus_raw`. TTL purge running. No PII in processed tables.

**Deliverables:**

**Google Trends worker:**
```javascript
const googleTrends = require('google-trends-api');
async function fetchRisingTerms(seedTerm) {
  const result = await googleTrends.relatedQueries({
    keyword: seedTerm, geo: 'US',
    startTime: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  });
  return JSON.parse(result).default.rankedList[1].rankedKeyword;
}
```
Hourly national + 6h geo breakdown. 1100ms delay between calls (unofficial rate limit).

**GDELT BigQuery worker:**
```javascript
const { BigQuery } = require('@google-cloud/bigquery');
```
Every 4 hours. US political stories only (CAMEO event codes 14x, 17x, 18x + political themes). Budget alert at $20/month.

**YouTube worker:**
```javascript
const { google } = require('googleapis');
const youtube = google.youtube({ version: 'v3', auth: process.env.YOUTUBE_API_KEY });
```
Every 4 hours. Quota: 10,000 units/day. Build quota tracker (stop at 8,000, alert at 9,000). Comment threads (1 unit/page) burn quota fast on deep threads.

**Apify Reddit worker:**
```json
{ "actor": "trudax/reddit-scraper", "input": { "maxItems": 500, "maxComments": 200 } }
```
Every 3 hours (Tier 1 subs). Tier 2/3 on-demand when issue clusters trigger.

**Bluesky firehose worker (always-on Docker service, not n8n):**
```javascript
const ws = new WebSocket('wss://bsky.network/xrpc/com.atproto.sync.subscribeRepos');
const POLITICAL_REGEX = /\b(congress|senate|election|immigration|abortion|gun|healthcare)\b/i;
// buffer 10-minute windows → batch insert → queue for embedding
```
WebSocket streaming does not fit n8n's trigger model. Run as persistent Docker service.

**Normalization layer:** BullMQ queue consumes all source worker output. Normalizer writes to `corpus_raw` with `author_hash = SHA256(platform + user_id)` — never the raw identifier.

**n8n orchestration:** Cron triggers call `/ingest/trigger` with source + config payload. n8n is a scheduler here, not a data processor.

**Go/No-Go Gate:**
- All five sources pulling live data
- `corpus_raw` receiving normalized records
- TTL deletion job running and verifiable (check `audit_events` for purge records)
- 72h of data: minimum 500 records across platforms
- No usernames or author identifiers in `corpus_signals`

**Biggest risk:** YouTube quota exhaustion. Implement quota tracking in Sprint 1, not as a bug fix in Sprint 2.

---

### Sprint 2 — Narrative Engine (Weeks 5-6, ~56 hours)

**Goal:** Issues detected, labeled, scored. Dashboard showing top 10 heating issues with real data.

**Deliverables:**

**LLM clustering pipeline:**
- Pull unclassified `corpus_signals` in batches of 200
- Claude Haiku: identify 5-15 distinct political issues, return `[{issue_label, description, document_ids[]}]`
- pgvector cosine dedup: cosine > 0.82 → assign to existing issue, cosine < 0.70 → candidate new issue
- Enable pgvector on Supabase: `CREATE EXTENSION IF NOT EXISTS vector;`

**Momentum scoring:** `update_all_momentum_scores()` function (see Section 2) runs every 30 minutes via n8n.

**Issue lifecycle transitions:** `update_issue_lifecycles()` function runs after each momentum update.

**Geo-tagging worker:**
```javascript
const STATE_MAP = {
  'virginia': 'VA', 'florida': 'FL', 'texas': 'TX', // ... all 50 states + DC
  'austin': 'TX', 'miami': 'FL', 'phoenix': 'AZ',    // major cities → state
};
function extractGeoStates(text) {
  const lower = text.toLowerCase();
  return [...Object.entries(STATE_MAP)
    .filter(([name]) => lower.includes(name))
    .map(([, code]) => code)];
}
```

**Dashboard (React/Vite):**
- Single page: top 10 issues by `momentum_delta` (week-over-week)
- Per card: label, momentum sparkline (data from `issue_snapshots`), platform breakdown, geo heatmap, signal count, confidence badge
- Hono endpoint: `GET /issues?status=emerging&limit=10&sort=momentum_delta`

**Go/No-Go Gate:**
- Clustering producing coherent labeled issues (manual QA: 20 issues, >80% make sense)
- Momentum scoring differentiating states (at least 3 issues per lifecycle state)
- Dashboard rendering top 10 with real data
- No issues surfaced below 50-comment threshold (`activation_blocked = true` filter applied)
- Geo-tagging present on >60% of issues

**Biggest risk:** Issue proliferation. Without dedup tuning, the clustering worker creates 400 issues in a week. Plan 4 hours of cosine similarity threshold tuning (start at 0.85). Do this before the dashboard has real clients looking at it.

---

### Sprint 3 — Persona Engine (Weeks 7-8, ~48 hours)

**Goal:** Aggregate cohort profiles running on all qualifying issues. PII deletion verified. Confidence scores working.

**Deliverables:**

**Batch inference pipeline:**
- Pull `corpus_signals` for issue (text/summary only, no author data)
- Pre-process: strip handles, replace URLs, truncate to 280 chars, deduplicate
- Batch 50 comments → Sonnet inference (prompt in Section 3.2)
- Aggregate outputs across batches using weighted-average merging
- Write `personas` row (blocked by CHECK constraint if `source_unit_count < 50`)

**Confidence scoring:**
```
persona_confidence = (
  min(source_unit_count / 500, 1.0) * 0.5 +
  platform_diversity_score * 0.3 +
  llm_consistency_score * 0.2
)
```
Tiers: HIGH (>0.75), MEDIUM (0.5-0.75), LOW (<0.5), INSUFFICIENT (< 50 comments, not generated).

**PII deletion audit:** Verify TTL jobs running. Add hard delete: `corpus_raw` records older than 48h regardless of `processed_at` flag. Log every deletion batch to `audit_events`.

**Persona card API + dashboard tab:** `GET /issues/:id/personas` → render cohort cards with MFT scores.

**Go/No-Go Gate:**
- Persona generation running on all issues with >= 50 comments
- Persona cards passing manual review (10 issues, 80% produce interpretable distinct cohorts)
- PII deletion audit logs showing clean purge cadence
- No author-level data in `personas` table
- Confidence scores correlating with data volume

**Biggest risk:** LLM hallucinating confident cohorts from thin data. The `LOW` confidence badge must be visually alarming in the UI (red, blurred, explicit warning text). A confidently wrong persona is worse than no persona.

---

### Sprint 4 — Language & Framing Engine (Weeks 9-10, ~62 hours)

**This is the moat. Ship it right.**

**Deliverables:**

**Stance segmentation:** Haiku batch (20 comments/call): classify each as SUPPORT / OPPOSE / PERSUADABLE / OFF_TOPIC. Gate: < 50 comments per segment → block LFE activation for that segment.

**Distinctive vocabulary extraction:**
- TF-IDF unigrams in Node.js (no LLM needed)
- Log-odds-ratio z-scoring against cross-segment baseline (Monroe, Colaresi & Quinn method — see formula in Section 3.4)
- PMI bigram/trigram extraction: PMI > 3.0 AND frequency >= 5 → include
- Output: top 15 unigrams + 10 bigrams + 5 trigrams per segment

**MFT scoring pipeline:**
- MFD2.0 word list (Frimer et al. 2019) for dictionary baseline
- Sonnet refinement for contextual corrections (catches negation, sarcasm, irony)
- Combined scoring: LLM weight = 0.7 for < 200 items, 0.4 for larger corpora
- Output: 6 foundation scores (0-100) + dominant + secondary + confidence tier

**Frame detection (Sonnet, per segment):** Identify 3 dominant frames from the taxonomy (ECONOMIC, MORAL_DUTY, SECURITY, FREEDOM, FAIRNESS, IDENTITY, COMMUNITY, SCIENCE_FACT, LEGAL_PROCESS, URGENCY) with evidence phrases and deployment summary.

**Reframe generation + fidelity pipeline (prompts in Section 3.4):**
- Generate 5 candidates (Sonnet)
- Check each with fidelity prompt (Haiku)
- `PASS` → add to verified list
- `FLAG` → apply suggested fix → recheck once
- `FAIL` → discard
- Need 3 passing → if fewer, surface with warning
- All checks logged in `lfe_fidelity_log`

**Bridge Brief assembly + dashboard tab.**

**Go/No-Go Gate:**
- Vocab extraction producing non-obvious, issue-specific terminology
- MFT showing differentiation across cohorts (cohorts should have different dominant foundations)
- Reframe generation achieving > 85% fidelity on first attempt in > 70% of cases
- Full Bridge Brief rendering for >= 3 real issues
- QA: have a non-political person read 5 reframes and confirm position is preserved

**Biggest risk:** Fidelity check missing subtle position drift. The Haiku fidelity prompt must be adversarially phrased: "Look for any way the reframe could be interpreted as a weaker or different commitment than the original." Without adversarial framing, it will wave through subtle drift. This is a liability risk.

---

### Sprint 5 — Influencer / CVS Engine (Weeks 11-12, ~42 hours)

**Goal:** Channels ranked by CVS per issue. Stance tagged. EWS calculated. Top 20 list populated.

**Deliverables:**

**Channel discovery:** Mine existing `corpus_signals` for `channel_id` / `subreddit` / `handle` values per issue — no new data sources needed. Pull channel metadata from platform APIs.

**CVS calculation:**
- Per channel, per issue, per window (24h / 48h / 7d)
- Normalize sub-scores intra-platform (YouTube vs YouTube only)
- Store as `cvs_snapshots` rows
- Recompute on schedule (LIVE every 4h, COOLING every 12h)

**EWS computation:** Calculated on-the-fly from latest velocity + `last_comment_at`. Not stored — derived at query time from snapshot data.

**Stance classification:** Haiku batch on 20 sampled on-topic comments per channel per issue.

**Top 20 ranking query** (see Section 3.3) + API endpoint + dashboard tab.

**Integration into Bridge Brief:** Populate "Reach Channels" section from CVS rankings.

**Go/No-Go Gate:**
- CVS calculated for all channels with > 10 comments in corpus
- Top 20 list rendering per issue
- Stance tagging on > 70% of listed channels
- CVS differentiation: top channel vs median channel has > 2x CVS difference
- Bridge Brief "Reach Channels" section populated with live CVS data

**Biggest risk:** CVS collapse on thin corpus. Gate: only show channels with CVS calculated on > 10 issue-specific comments. Show 7 honest results rather than 20 padded stubs.

---

### Sprint 6 — Integration + Beta (Weeks 13-14, ~66 hours)

**Goal:** Full pipeline working end-to-end in one UI session. Three beta clients onboarded. Exports opening correctly in ad platforms.

**Deliverables:**

**Full four-tab dashboard:**
- **Issues:** Trending narrative cards, momentum sparklines, geo heatmap (US states choropleth)
- **Personas:** Cohort cards with MFT radar charts (Chart.js or D3)
- **Language:** Vocab clouds, MFT bars, Bridge Brief view with reframes
- **Channels:** CVS-ranked list, platform badges, stance tags, EWS indicator

Apply GSAP for tab transitions and card entrances. This is where you outclass every competitor on visual quality — Resonate's UI is a 2019 enterprise data warehouse.

**Activation export (four formats):**
```
POST /export/:issue_id
Body: {cohort_id, format: "meta_audience_brief|google_affinity|dspolitical_inbound|csv"}
```
All exports: no individual identifiers, no political affiliation targeting, no demographic targeting fields. Contextual only. Build as versioned configurable schema (JSON config per format field mapping) so platform format changes don't require redeployment.

**Compliance layer UI:**
- Confidence badges mandatory on every insight (not hideable)
- Thin data banner when `activation_blocked = true`
- Admin audit dashboard at `GET /admin/audit` (basic auth)
- All export timestamps and confidence levels written to `audit_events`

**Beta client onboarding:**
- Onboarding form: campaign name, candidate, race type, issues of interest, email
- Supabase RLS scopes client to subscribed issues only
- Manual API key generation for first 5 clients (automate post-MVP)

**Go/No-Go Gate:**
- Full flow working: data → issue → persona → language → channel → export in single UI session
- Export files opening correctly in Meta Ads Manager or Google Ads (test with one real export)
- 3 beta clients onboarded with scoped views working
- Deletion jobs verified on schedule (check audit_events)
- No PII in any export file (manual inspect 3 exports)

**Biggest risk:** Export format mismatch with ad platforms. Call DSPolitical BD team before building their inbound API format. Don't assume from docs.

---

### Sprint Summary

| Sprint | Focus | Hours | Calendar |
|---|---|---|---|
| 0 | Foundation + Schema | 28h | Weeks 1-2 |
| 1 | Data Ingestion (5 sources) | 55h | Weeks 3-4 |
| 2 | Narrative Engine + Dashboard | 56h | Weeks 5-6 |
| 3 | Persona Engine | 48h | Weeks 7-8 |
| 4 | Language & Framing Engine | 62h | Weeks 9-10 |
| 5 | Influencer / CVS Engine | 42h | Weeks 11-12 |
| 6 | Integration + Beta | 66h | Weeks 13-14 |
| **Total** | | **357h** | **14 weeks** |

At 25-30 hours/week solo, this is a true 14-week calendar. Do not compress by skipping go/no-go gates.

---

## 6. Three Kill-Switch Decisions

These decisions determine whether the project completes in 14 weeks or gets stuck in a 3-week hole.

### Decision 1: Clustering Strategy

**Question:** BERTopic (self-hosted Python) or LLM-based?

**Answer: LLM-based (Haiku) for MVP. BERTopic post-MVP as cost optimization.**

BERTopic requires Python, a separate Docker service, `sentence-transformers`, UMAP/HDBSCAN parameter tuning, and 3 weeks of ops before you see a single cluster. LLM clustering is 10 lines of Node.js and ships in days. At MVP data volumes (~100K items/month), LLM clustering costs $2-3/day. That is not worth the ops overhead trade-off. When you're processing millions of documents and $2/day becomes $60/day, migrate to BERTopic. The processing services are already decoupled so the migration is clean.

### Decision 2: API Framework

**Question:** Express, Fastify, or Hono?

**Answer: Hono.**

Hono is TypeScript-first, runs on Node/Deno/Bun/Workers with no lock-in, benchmarks 2-3x faster than Fastify and 10x faster than Express on the I/O-bound endpoints that matter here. Learning curve is 2 hours. The alternative is building on Express and accumulating middleware debt from day one. Fastify is a reasonable second choice but Hono's edge-readiness matters when you later want to deploy hot API paths to Cloudflare Workers without a rewrite.

### Decision 3: Individual Data Boundary

**Question:** Where exactly does individual data stop being stored?

**Answer: Raw comment-author associations are deleted within 24 hours. Only aggregate signals persist.**

This is not optional. It is the architectural decision that makes the product legally viable.

The `corpus_raw` table is the only table that ever touches raw text. It has:
- `author_hash = SHA256(platform + user_id)` — the identifier is hashed before storage, never stored raw
- `ttl_delete_at = NOW() + 24h` — enforced by pg_cron at the database level, not application code
- Hard delete after 48 hours regardless of `processed_at` flag

By the time a brief reaches a client, the individual-level content has either expired or never existed. Only aggregate scores, cluster patterns, and cohort profiles remain.

If you store `comment_text + username + subreddit + timestamp` indefinitely, you have a PII database regardless of what you call it. CCPA deletion requests become impossible to fulfill. Meta/Google refuse activation exports. A data breach ends the company. Build the deletion job in Sprint 0.

---

## 7. Appendix: Data Services Map

### Service Selection Matrix

| Use Case | Service | Cost | Notes |
|---|---|---|---|
| Social discourse (Reddit) | Apify `trudax/reddit-scraper` | $3/1K items | Legal, reliable, handles rate limiting |
| Video comments | YouTube Data API v3 | Free (10K units/day) | Budget quota carefully, track per-run |
| News narrative detection | GDELT BigQuery | Free (1TB/month query) | Use `LIMIT`, monitor spend. Set budget alert at $20/mo |
| Keyword trend signals | Google Trends API | Free | Unofficial API, 1100ms delay required |
| Real-time social pulse | Bluesky AT Protocol | Free | WebSocket, always-on service, filter aggressively |
| Fallback web scraping | Bright Data | $0.75/1K rows | Legal buffer vs direct scraping |
| Text embeddings | Voyage AI voyage-3-lite | $0.02/1M tokens | 1024-dim, politics-domain tested |
| Bulk classification | Claude Haiku (claude-haiku-4-5) | $0.80/1M input | Stance tagging, CVS scoring, fidelity checks |
| Quality synthesis | Claude Sonnet (claude-sonnet-4-6) | $3/1M input | MFT scoring, persona inference, reframe generation |
| Vector search | Supabase pgvector | Included in Supabase Pro | IVFFlat index, cosine similarity |
| Job queuing | BullMQ (Redis) | Self-hosted, ~$0 | Reliable, TypeScript-native |
| Orchestration | n8n (self-hosted Docker) | $0 | Scheduling + webhooks only, not data processing |

### What to Use When

**Use Haiku for:** On-topic scoring, sentiment classification, stance tagging, cluster labeling, CVS component scoring, fidelity checks, trend alert decisions, anything with volume > 100 items/run.

**Use Sonnet for:** MFT scoring (nuanced multi-label reasoning), persona cohort synthesis (holds 50+ signals), reframe generation (creative constraint satisfaction), framing analysis, executive summaries. Sonnet is called O(cluster) or O(brief), not O(comment).

**Use Voyage embeddings for:** Issue cluster deduplication (cosine similarity), comment → cluster assignment, cross-platform narrative correlation. Do NOT use for MFT scoring (context-dependent, not semantic similarity).

**Use TF-IDF / LOR (no LLM) for:** Distinctive vocabulary extraction, preliminary keyword detection, off-topic filtering before LLM calls (saves tokens).

**Use BigQuery for:** Raw GDELT event streams (millions of rows/day), historical trend analysis (30-180 day windows), batch NLP jobs at scale. Never move GDELT rows to Supabase — link via `issue_cluster_id` foreign key in BigQuery.

**Use Supabase for:** All operational data (issues, personas, channels, briefs), real-time dashboard pushes, transactional writes from n8n pipeline, client brief storage and retrieval.

### Cost Model at MVP Scale

| Item | Monthly Estimate |
|---|---|
| Hetzner VPS CX21 (2 vCPU / 4GB) | $6 |
| Supabase Pro (pgvector + pg_cron) | $25 |
| Voyage AI embeddings (~500K items/mo) | $10 |
| Claude API (Haiku bulk + Sonnet synthesis) | $40-80 |
| Apify Reddit (~5K pulls/mo) | $15 |
| Bright Data (fallback scraping) | $20 |
| YouTube / Google Trends / GDELT / Bluesky | $0 |
| **Total** | **$116-156/mo** |

First client at $299/month covers all infrastructure. At five clients the margin structure is clear.

### Anthropic Batch API

Use `POST /v1/messages/batches` for all non-real-time work (stance tagging, MFT scoring, persona inference). 50% cost discount applies. Poll every 60 seconds for status. Never use `claude-haiku-latest` or `claude-sonnet-latest` in production — pin specific model IDs to prevent silent JSON schema breakage on model updates.

```javascript
// n8n HTTP Request node: Batch API call
{
  "requests": [
    {
      "custom_id": "cluster_42_mft",
      "params": {
        "model": "claude-haiku-4-5",
        "max_tokens": 500,
        "messages": [{"role": "user", "content": "..."}]
      }
    }
  ]
}
// Poll /v1/messages/batches/{id} until processing_status = "ended"
```

### n8n Workflow Design Rules

1. n8n orchestrates, Node.js processes — no data transformation in n8n Code nodes
2. All LLM calls go through Node.js workers triggered by n8n HTTP Request nodes
3. Error handling pattern: 429 → exponential backoff (30s/60s/120s, max 3 retries); 5xx → retry once after 60s; 4xx → log to `failed_jobs` table, skip item, continue batch
4. Dead letter queue: `failed_jobs` table with `retry_count` and `resolved_at`. n8n cron retries where `retry_count < 3 AND resolved_at IS NULL`. Alert (Slack/email) at `retry_count = 3`.
5. Bluesky firehose is NOT managed by n8n — WebSocket streaming requires always-on Docker service. n8n monitors its health via `GET /health` every 5 minutes.

---

*This document is the engineering bible for the PoliReports MVP build. Every sprint builds to the contracts defined here. Schema changes require updating this document first.*

*Version 1.0 — June 2026*
