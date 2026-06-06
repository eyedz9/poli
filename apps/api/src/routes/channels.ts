import { Hono } from 'hono'
import { db } from '../lib/db.js'
import { requireAuth } from '../lib/auth.js'

export const channelsRouter = new Hono()

channelsRouter.get('/issue/:issueId', requireAuth, async (c) => {
  const rows = await db`
    SELECT cis.*, row_to_json(ch) AS channel
    FROM channel_issue_signals cis
    JOIN channels ch ON ch.id = cis.channel_id
    WHERE cis.issue_id = ${c.req.param('issueId')}
    ORDER BY cis.cvs_for_issue DESC
    LIMIT 20
  `
  return c.json(rows)
})
