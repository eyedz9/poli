import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../lib/db.js'
import { queues } from '../lib/queues.js'
import { requireAuth, requireInternalToken } from '../lib/auth.js'

export const issuesRouter = new Hono()

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
  const [row] = await db`SELECT * FROM issues WHERE id = ${c.req.param('id')}`
  if (!row) return c.json({ error: 'not found' }, 404)
  return c.json(row)
})

// Internal only — n8n triggers ingest via this endpoint.
issuesRouter.post('/trigger-ingest', requireInternalToken, async (c) => {
  const body = await c.req.json()
  const parsed = IngestTriggerSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
  const job = await queues.ingest.add('ingest', parsed.data)
  return c.json({ jobId: job.id })
})
