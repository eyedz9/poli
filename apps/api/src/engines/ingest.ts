// Ingestion engine.
// Real mode (TODO): pull from Google Trends, GDELT, YouTube, Apify Reddit,
// Bluesky firehose → normalize → write corpus_raw (24h TTL) + corpus_signals.
// Dummy mode: synthesize aggregate-safe corpus_signals for known issues so
// momentum/narrative have fresh input — no external calls, no keys.
import { db } from '../lib/db.js'
import { genSignals } from '../lib/dummy.js'
import { isDummy } from '../lib/mode.js'

interface IngestJob {
  source?: string
  keywords?: string[]
  issueId?: string
  count?: number
}

export async function process(data: IngestJob) {
  if (!isDummy()) {
    throw new Error('ingest engine: real mode not implemented — set USE_DUMMY_DATA=true')
  }

  // Target a specific issue, or fan out across all active issues.
  const issues = data.issueId
    ? await db`SELECT id FROM issues WHERE id = ${data.issueId}`
    : await db`SELECT id FROM issues WHERE status != 'archived' ORDER BY momentum_score DESC LIMIT 5`

  let inserted = 0
  const per = data.count ?? 15
  for (const iss of issues) {
    for (const s of genSignals(`${iss.id}-${Date.now()}`, per)) {
      const r = await db`
        INSERT INTO corpus_signals (
          platform, issue_id, content_summary, content_hash, geo_state, geo_confidence,
          sentiment_score, moral_foundations, framing_tags, stance, engagement_score,
          reply_depth, on_topic_score, confidence_score, confidence_flags, collected_at
        ) VALUES (
          ${s.platform}, ${iss.id}, ${s.contentSummary}, ${s.contentHash}, ${s.geoState},
          ${s.geoConfidence}, ${s.sentimentScore}, ${db.json(s.moralFoundations)}, ${s.framingTags},
          ${s.stance}, ${s.engagementScore}, ${s.replyDepth}, ${s.onTopicScore},
          ${s.confidenceScore}, ${s.confidenceFlags}, ${s.collectedAt}
        ) ON CONFLICT DO NOTHING RETURNING id`
      inserted += r.length
    }
  }
  console.log(`[ingest] dummy: inserted ${inserted} signals across ${issues.length} issues`)
  return { inserted, issues: issues.length }
}
