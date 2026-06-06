import { Hono } from 'hono'
import { z } from 'zod'
import { db } from '../lib/db.js'
import { queues } from '../lib/queues.js'
import { requireAuth } from '../lib/auth.js'
import type { AppEnv } from '../lib/types.js'

export const briefsRouter = new Hono<AppEnv>()

// Segments must match the dashboard select + seed SEGMENTS so the whole
// listen→advise flow uses one vocabulary.
const GenerateBriefSchema = z.object({
  issueId: z.string().uuid(),
  position: z.string().min(10).max(500),
  principle: z.string().min(10).max(500),
  targetSegment: z.enum([
    'persuadable independents',
    'cost-conscious moderates',
    'civic-minded conservatives',
    'pragmatic progressives',
  ]),
})

briefsRouter.get('/issue/:issueId', requireAuth, async (c) => {
  // Briefs are owner-scoped — only return the caller's own briefs.
  const rows = await db`
    SELECT * FROM briefs
    WHERE issue_id = ${c.req.param('issueId')!}
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
