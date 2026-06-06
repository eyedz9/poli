-- PoliReports — Database Init
-- Runs once on first container start via Docker entrypoint

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

-- ─── Enum Types ────────────────────────────────────────────────────────────────

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

-- ─── corpus_raw (transient — 24h TTL enforced by BullMQ scheduled job) ────────

CREATE TABLE corpus_raw (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  platform          platform_type NOT NULL,
  external_id       TEXT,
  content_hash      TEXT NOT NULL,
  raw_text          TEXT,
  author_hash       TEXT,        -- SHA-256 of author identifier, never the identifier itself
  geo_state         CHAR(2)[],
  geo_dma           TEXT,
  geo_confidence    TEXT,
  language_code     TEXT DEFAULT 'en',
  eu_flagged        BOOLEAN DEFAULT FALSE,
  eu_excluded       BOOLEAN DEFAULT FALSE,
  collected_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at      TIMESTAMPTZ,
  ttl_delete_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  CONSTRAINT unique_content UNIQUE (content_hash, platform)
);

CREATE INDEX idx_corpus_raw_ttl ON corpus_raw(ttl_delete_at)
  WHERE raw_text IS NOT NULL;
CREATE INDEX idx_corpus_raw_unprocessed ON corpus_raw(collected_at)
  WHERE processed_at IS NULL;

-- ─── corpus_signals (permanent, aggregate-safe — no raw text) ─────────────────

CREATE TABLE corpus_signals (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  corpus_raw_id     UUID,
  platform          platform_type NOT NULL,
  issue_id          UUID,
  content_summary   TEXT,
  content_hash      TEXT NOT NULL,
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
CREATE INDEX ON corpus_signals USING GIN (framing_tags);

-- ─── issues ───────────────────────────────────────────────────────────────────

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
  data_confidence       TEXT DEFAULT 'thin',
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

-- ─── issue_snapshots (momentum history) ──────────────────────────────────────

CREATE TABLE issue_snapshots (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id        UUID REFERENCES issues(id) ON DELETE CASCADE,
  snapshot_at     TIMESTAMPTZ DEFAULT NOW(),
  momentum_score  NUMERIC(5,2),
  source_count_6h INTEGER,
  source_dist     JSONB
);
CREATE INDEX ON issue_snapshots (issue_id, snapshot_at DESC);

-- ─── personas ─────────────────────────────────────────────────────────────────

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

-- ─── channels ─────────────────────────────────────────────────────────────────

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

-- ─── channel_issue_signals ────────────────────────────────────────────────────

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

-- ─── users (local auth — replaces Supabase Auth) ─────────────────────────────
-- Defined before briefs because briefs.created_by references users(id).

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'client',   -- client|admin
  org_id        UUID,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

-- ─── briefs ───────────────────────────────────────────────────────────────────

CREATE TABLE briefs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id              UUID REFERENCES issues(id),
  persona_id            UUID REFERENCES personas(id),
  brief_type            TEXT NOT NULL,
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
  -- Owner of this brief. Briefs encode client-specific strategy
  -- (position/principle/segment) and must never leak across clients.
  created_by            UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON briefs (issue_id, brief_type);
CREATE INDEX ON briefs (created_by, created_at DESC);
CREATE INDEX ON briefs (overall_confidence);
CREATE INDEX ON briefs (generated_at DESC);

-- ─── frames ───────────────────────────────────────────────────────────────────

CREATE TABLE frames (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_id              UUID REFERENCES issues(id) ON DELETE CASCADE,
  persona_id            UUID REFERENCES personas(id),
  segment               TEXT,
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

-- ─── audit_events (3-year retention) ─────────────────────────────────────────

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

-- ─── Momentum scoring function ────────────────────────────────────────────────

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

    SELECT COALESCE(AVG(cnt), 1) INTO v_baseline
    FROM (
      SELECT COUNT(*) as cnt FROM corpus_signals
      WHERE issue_id = issue_rec.id
        AND collected_at > NOW() - INTERVAL '14 days'
        AND collected_at < NOW() - INTERVAL '6 hours'
      GROUP BY FLOOR(EXTRACT(EPOCH FROM collected_at) / 21600)
    ) t;

    WITH r3 AS (
      SELECT COUNT(*) as cnt FROM corpus_signals
      WHERE issue_id = issue_rec.id AND collected_at > NOW() - INTERVAL '3 hours'
    ),
    p3 AS (
      SELECT GREATEST(COUNT(*), 1) as cnt FROM corpus_signals
      WHERE issue_id = issue_rec.id
        AND collected_at BETWEEN NOW() - INTERVAL '6 hours' AND NOW() - INTERVAL '3 hours'
    )
    SELECT 1.0 + GREATEST(((r3.cnt - p3.cnt)::NUMERIC / p3.cnt), 0)
    INTO v_velocity FROM r3, p3;

    SELECT cross_platform_count INTO v_crossplat FROM issues WHERE id = issue_rec.id;

    v_momentum := (v_recent::NUMERIC / GREATEST(v_baseline, 1))
                  * v_velocity
                  * (1.0 + (0.15 * v_crossplat));

    UPDATE issues SET
      momentum_score     = ROUND(v_momentum::NUMERIC, 3),
      velocity_score     = ROUND(v_velocity::NUMERIC, 3),
      total_source_units = (SELECT COUNT(*) FROM corpus_signals WHERE issue_id = issue_rec.id),
      data_confidence    = CASE
        WHEN (SELECT COUNT(*) FROM corpus_signals WHERE issue_id = issue_rec.id) < 50   THEN 'thin'
        WHEN (SELECT COUNT(*) FROM corpus_signals WHERE issue_id = issue_rec.id) < 500  THEN 'normal'
        ELSE 'strong'
      END,
      updated_at = NOW()
    WHERE id = issue_rec.id;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
