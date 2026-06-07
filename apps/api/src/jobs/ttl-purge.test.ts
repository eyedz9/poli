import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { db } from '../lib/db.js'
import { purgeExpired, assertPurgeHealthy } from './ttl-purge.js'

// Integration test — needs a live DB (DATABASE_URL). Skips cleanly without one.
const hasDb = !!process.env.DATABASE_URL
const d = hasDb ? describe : describe.skip

d('ttl purge (compliance)', () => {
  const expiredHash = `test-expired-${Math.random()}`
  const freshHash = `test-fresh-${Math.random()}`

  beforeAll(async () => {
    // Expired row — ttl in the past. MUST be purged.
    await db`
      INSERT INTO corpus_raw (platform, content_hash, raw_text, author_hash, ttl_delete_at)
      VALUES ('bluesky', ${expiredHash}, 'pii text', 'author-pii', NOW() - INTERVAL '1 hour')`
    // Fresh row — ttl in the future. MUST survive.
    await db`
      INSERT INTO corpus_raw (platform, content_hash, raw_text, author_hash, ttl_delete_at)
      VALUES ('bluesky', ${freshHash}, 'pii text', 'author-pii', NOW() + INTERVAL '12 hours')`
  })

  afterAll(async () => {
    await db`DELETE FROM corpus_raw WHERE content_hash IN (${expiredHash}, ${freshHash})`
    await db.end()
  })

  it('deletes expired rows and keeps fresh ones', async () => {
    await purgeExpired()
    const [expired] = await db`SELECT id FROM corpus_raw WHERE content_hash = ${expiredHash}`
    const [fresh] = await db`SELECT id FROM corpus_raw WHERE content_hash = ${freshHash}`
    expect(expired).toBeUndefined() // purged
    expect(fresh).toBeDefined() // survived
  })

  it('never leaves a row past its TTL (the compliance invariant)', async () => {
    await purgeExpired()
    const [{ overdue }] = await db`
      SELECT count(*)::int AS overdue FROM corpus_raw WHERE ttl_delete_at < NOW()`
    expect(overdue).toBe(0)
  })

  it('reports healthy right after a successful purge', async () => {
    await purgeExpired()
    expect(await assertPurgeHealthy()).toBe(true)
  })
})
