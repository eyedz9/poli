import { Hono } from 'hono'
import { z } from 'zod'
import { supabase } from '../lib/supabase.js'
import { queues } from '../lib/queues.js'
import { requireAuth } from '../lib/auth.js'

export const briefsRouter = new Hono()

const GenerateBriefSchema = z.object({
  issueId: z.string().uuid(),
  position: z.string().min(10).max(500),
  principle: z.string().min(10).max(500),
  targetSegment: z.enum(['progressive', 'conservative', 'moderate', 'persuadable']),
})

briefsRouter.get('/issue/:issueId', requireAuth, async (c) => {
  const { data, error } = await supabase
    .from('briefs')
    .select('*')
    .eq('issue_id', c.req.param('issueId'))
    .order('created_at', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

// Authenticated: dashboard users trigger brief generation.
briefsRouter.post('/generate', requireAuth, async (c) => {
  const body = await c.req.json()
  const parsed = GenerateBriefSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
  const job = await queues.language.add('generate-brief', parsed.data)
  return c.json({ jobId: job.id }, 202)
})
