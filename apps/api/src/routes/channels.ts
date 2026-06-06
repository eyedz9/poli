import { Hono } from 'hono'
import { supabase } from '../lib/supabase.js'

export const channelsRouter = new Hono()

channelsRouter.get('/issue/:issueId', async (c) => {
  const { data, error } = await supabase
    .from('channel_issue_signals')
    .select('*, channels(*)')
    .eq('issue_id', c.req.param('issueId'))
    .order('cvs_score', { ascending: false })
    .limit(20)
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})
