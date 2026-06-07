// 24h TTL / PII purge — the load-bearing compliance commitment.
//
//   corpus_raw holds author-associated, raw text (PII). Every row carries
//   ttl_delete_at = collected_at + 24h. This job deletes expired rows and
//   records a success marker. A dead-man's-switch checks that the purge has
//   actually run recently — a SILENTLY stopped purge is a compliance breach,
//   so absence of success must raise an alarm, not pass quietly.
//
//   ┌── hourly ──────────────────────────────────────────────┐
//   │ purgeExpired() ─▶ DELETE corpus_raw WHERE ttl<now       │
//   │               └▶ audit_events('ttl_purge', {count})     │
//   └─────────────────────────────────────────────────────────┘
//   ┌── hourly (offset) ─────────────────────────────────────┐
//   │ assertPurgeHealthy() ─▶ last 'ttl_purge' < MAX_AGE?     │
//   │   no  ─▶ audit_events('ttl_purge_stale') + console.error│
//   └─────────────────────────────────────────────────────────┘
import { db } from '../lib/db.js'

// If no successful purge in this long, the system is out of compliance.
// Purge runs hourly, so 3h of silence is a real failure, not jitter.
export const PURGE_STALE_AFTER_MS = 3 * 60 * 60 * 1000

export async function purgeExpired(): Promise<number> {
  const rows = await db`
    DELETE FROM corpus_raw
    WHERE ttl_delete_at < NOW()
    RETURNING id`
  const count = rows.length
  await db`
    INSERT INTO audit_events (event_type, actor_type, action, metadata)
    VALUES ('ttl_purge', 'system', 'delete_expired', ${db.json({ count })})`
  console.log(`[ttl-purge] deleted ${count} expired corpus_raw rows`)
  return count
}

// Dead-man's-switch. Returns true if healthy, false (and alarms) if the purge
// has not succeeded within PURGE_STALE_AFTER_MS.
export async function assertPurgeHealthy(): Promise<boolean> {
  const [last] = await db`
    SELECT created_at FROM audit_events
    WHERE event_type = 'ttl_purge'
    ORDER BY created_at DESC LIMIT 1`

  const ageMs = last ? Date.now() - new Date(last.createdAt).getTime() : Infinity
  if (ageMs > PURGE_STALE_AFTER_MS) {
    const detail = last ? `last purge ${Math.round(ageMs / 60000)}m ago` : 'no purge ever recorded'
    console.error(`[ttl-purge] COMPLIANCE ALERT: ${detail} — author PII may be accumulating past 24h`)
    await db`
      INSERT INTO audit_events (event_type, actor_type, action, metadata)
      VALUES ('ttl_purge_stale', 'system', 'alert', ${db.json({ ageMs: ageMs === Infinity ? null : ageMs })})`
    return false
  }
  return true
}
