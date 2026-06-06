import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../lib/db.js'
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
  // Briefs are owner-scoped — only return the caller's own briefs.
  const rows = await db`
    SELECT * FROM briefs
    WHERE issue_id = ${c.req.param('issueId')}
      AND created_by = ${c.get('userId')}
    ORDER BY created_at DESC
  `
  return c.json(rows)
})

briefsRouter.post('/generate', requireAuth, async (c) => {
  const body = await c.req.json()
  const parsed = GenerateBriefSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)
  // Stamp the owner so the worker can persist created_by.
  const job = await queues.language.add('generate-brief', {
    ...parsed.data,
    createdBy: c.get('userId'),
  })
  return c.json({ jobId: job.id }, 202)
})
