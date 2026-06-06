import { Hono } from 'hono'
import { supabase } from '../lib/supabase.js'

export const personasRouter = new Hono()

personasRouter.get('/issue/:issueId', async (c) => {
  const { data, error } = await supabase
    .from('personas')
    .select('*')
    .eq('issue_id', c.req.param('issueId'))
    .order('confidence_score', { ascending: false })
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})
