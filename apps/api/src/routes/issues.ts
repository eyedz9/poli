import { Hono } from 'hono'
import { supabase } from '../lib/supabase.js'
import { queues } from '../lib/queues.js'

export const issuesRouter = new Hono()

issuesRouter.get('/', async (c) => {
  const { data, error } = await supabase
    .from('issues')
    .select('id, slug, label, status, momentum_score, momentum_delta_24h, geo_scope, activation_blocked, last_signal_at')
    .order('momentum_score', { ascending: false })
    .limit(50)
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

issuesRouter.get('/:id', async (c) => {
  const { data, error } = await supabase
    .from('issues')
    .select('*')
    .eq('id', c.req.param('id'))
    .single()
  if (error) return c.json({ error: error.message }, 404)
  return c.json(data)
})

// n8n trigger: enqueue ingest job for a topic
issuesRouter.post('/trigger-ingest', async (c) => {
  const body = await c.req.json()
  const job = await queues.ingest.add('ingest', body)
  return c.json({ jobId: job.id })
})
