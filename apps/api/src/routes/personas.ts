import { Hono } from 'hono'
import { db } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'

export const personasRouter = new Hono()

personasRouter.get('/issue/:issueId', requireAuth, async (c) => {
  const rows = await db`
    SELECT * FROM personas
    WHERE issue_id = ${c.req.param('issueId')}
    ORDER BY confidence_score DESC
  `
  return c.json(rows)
})
