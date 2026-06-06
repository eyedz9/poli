import { Hono } from 'hono'
import { supabase } from '../lib/supabase.js'
import { queues } from '../lib/queues.js'

export const briefsRouter = new Hono()

briefsRouter.get('/issue/:issueId', async (c) => {
  const { data, error } = await supabase
    .from('briefs')
    .select('*')
    .eq('issue_id', c.req.param('issueId'))
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

// Generate a new language bridge brief
briefsRouter.post('/generate', async (c) => {
  const body = await c.req.json()
  const job = await queues.language.add('generate-brief', body)
  return c.json({ jobId: job.id }, 202)
})
