// Narrative engine.
// Real mode (TODO): LLM clustering of corpus_signals into issues, geo-tagging,
// emerging/saturated classification, momentum via update_all_momentum_scores()
// (which assumes corpus_signals holds the full unit history).
//
// Dummy mode: we only store a SAMPLE of signals, so we must NOT recompute
// total_source_units from scratch (that would shrink the curated demo numbers
// and wrongly flip rich issues to thin/activation-blocked). Instead we refresh
// momentum from recent signal velocity, let total_source_units only grow
// (GREATEST), and snapshot. No keys needed.
import { db } from '../lib/db.js'
import { isDummy } from '../lib/mode.js'

interface NarrativeJob {
  issueId?: string
}

export async function process(_data: NarrativeJob) {
  if (!isDummy()) {
    throw new Error('narrative engine: real mode not implemented — set USE_DUMMY_DATA=true')
  }

  const issues = await db`
    SELECT id, momentum_score, total_source_units, platform_breakdown FROM issues WHERE status != 'archived'`

  for (const iss of issues) {
    const [{ recent }] = await db`
      SELECT count(*)::int AS recent FROM corpus_signals
      WHERE issue_id = ${iss.id} AND collected_at > NOW() - INTERVAL '6 hours'`
    const [{ total }] = await db`
      SELECT count(*)::int AS total FROM corpus_signals WHERE issue_id = ${iss.id}`

    // Velocity nudge: recent activity lifts momentum, quiet decays it.
    const base = Number(iss.momentumScore ?? 0)
    const nudged = Math.max(0, base * (recent > 5 ? 1.05 : 0.97) + recent * 0.01)

    await db`
      UPDATE issues SET
        momentum_score     = ${Number(nudged.toFixed(2))},
        -- never shrink the curated count; ingest can only grow it
        total_source_units = GREATEST(total_source_units, ${total}),
        last_signal_at     = NOW(),
        updated_at         = NOW()
      WHERE id = ${iss.id}`

    await db`
      INSERT INTO issue_snapshots (issue_id, momentum_score, source_count_6h, source_dist)
      VALUES (${iss.id}, ${Number(nudged.toFixed(2))}, ${recent}, ${db.json(iss.platformBreakdown ?? {})})`
  }

  console.log(`[narrative] dummy: refreshed momentum for ${issues.length} issues (source units preserved)`)
  return { recomputed: issues.length }
}
