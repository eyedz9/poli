import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../lib/db.js'
import { queues } from '../lib/queues.js'
import { requireAuth, requireInternalToken } from '../lib/auth.js'
import type { AppEnv } from '../lib/types.js'

export const issuesRouter = new Hono<AppEnv>()

const IngestTriggerSchema = z.object({
  source: z.enum(['google_trends', 'gdelt', 'youtube', 'reddit', 'bluesky']).optional(),
  keywords: z.array(z.string().max(100)).max(20).optional(),
  geo: z.string().length(2).optional(),
})

issuesRouter.get('/', requireAuth, async (c) => {
  const rows = await db`
    SELECT id, slug, label, status, momentum_score, momentum_delta_24h,
           geo_scope, activation_blocked, last_signal_at
    FROM issues
    ORDER BY momentum_score DESC
    LIMIT 50
  `
  return c.json(rows)
})

issuesRouter.get('/:id', requireAuth, async (c) => {
  const [row] = await db`SELECT * FROM issues WHERE id = ${c.req.param('id')!}`
  if (!row) return c.json({ error: 'not found' }, 404)
  return c.json(row)
})

// Combined detail — issue + personas + top channels + owner's briefs + frames.
issuesRouter.get('/:id/detail', requireAuth, async (c) => {
  const id = c.req.param('id')!
  const [issue] = await db`SELECT * FROM issues WHERE id = ${id}`
  if (!issue) return c.json({ error: 'not found' }, 404)

  const [personas, channels, briefs, frames] = await Promise.all([
    db`SELECT * FROM personas WHERE issue_id = ${id} ORDER BY confidence_score DESC`,
    db`SELECT cis.*, row_to_json(ch) AS channel
       FROM channel_issue_signals cis JOIN channels ch ON ch.id = cis.channel_id
       WHERE cis.issue_id = ${id} ORDER BY cis.cvs_for_issue DESC LIMIT 20`,
    db`SELECT * FROM briefs WHERE issue_id = ${id} AND created_by = ${c.get('userId')}
       ORDER BY created_at DESC`,
    db`SELECT * FROM frames WHERE issue_id = ${id} ORDER BY generated_at DESC`,
  ])
  return c.json({ issue, personas, channels, briefs, frames })
})

// Internal only — n8n triggers ingest via this endpoint.
issuesRouter.post('/trigger-ingest', requireInternalToken, async (c) => {
  const body = await c.req.json()
  const parsed = IngestTriggerSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
  const job = await queues.ingest.add('ingest', parsed.data)
  return c.json({ jobId: job.id })
})
