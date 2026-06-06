import { Hono } from 'hono'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { queues } from '../lib/queues.js'
import { requireAuth, requireInternalToken } from '../lib/auth.js'

export const issuesRouter = new Hono()

const IngestTriggerSchema = z.object({
  source: z.enum(['google_trends', 'gdelt', 'youtube', 'reddit', 'bluesky']).optional(),
  keywords: z.array(z.string().max(100)).max(20).optional(),
  geo: z.string().length(2).optional(),
})

issuesRouter.get('/', requireAuth, async (c) => {
  const { data, error } = await supabase
    .from('issues')
    .select('id, slug, label, status, momentum_score, momentum_delta_24h, geo_scope, activation_blocked, last_signal_at')
    .order('momentum_score', { ascending: false })
    .limit(50)
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

issuesRouter.get('/:id', requireAuth, async (c) => {
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .eq('id', c.req.param('id'))
    .single()
  if (error) return c.json({ error: error.message }, 404)
  return c.json(data)
})

// Internal-only: n8n triggers ingest jobs via this endpoint.
// Requires INTERNAL_TRIGGER_TOKEN — not accessible to dashboard users.
issuesRouter.post('/trigger-ingest', requireInternalToken, async (c) => {
  const body = await c.req.json()
  const parsed = IngestTriggerSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
  const job = await queues.ingest.add('ingest', parsed.data)
  return c.json({ jobId: job.id })
})
