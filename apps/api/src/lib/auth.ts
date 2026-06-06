import type { Context, Next } from 'hono'

// Internal trigger token — used by n8n to enqueue jobs.
// Treat n8n as an untrusted external caller; it must present this token.
export async function requireInternalToken(c: Context, next: Next) {
  const token = process.env.INTERNAL_TRIGGER_TOKEN
  if (!token) {
    console.error('INTERNAL_TRIGGER_TOKEN not set — blocking all internal trigger requests')
    return c.json({ error: 'server misconfigured' }, 500)
  }
  const header = c.req.header('authorization') ?? ''
  if (header !== `Bearer ${token}`) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  await next()
}

// Dashboard/public API auth — Supabase JWT.
// Returns 401 if token missing/invalid; sets c.var.userId on success.
export async function requireAuth(c: Context, next: Next) {
  const header = c.req.header('authorization') ?? ''
  const jwt = header.replace(/^Bearer\s+/i, '')
  if (!jwt) return c.json({ error: 'unauthorized' }, 401)

  // Validate via Supabase getUser (network call — cache if needed post-MVP)
  const { createClient } = await import('@supabase/supabase-js')
  const sb = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
  )
  const { data, error } = await sb.auth.getUser(jwt)
  if (error || !data.user) return c.json({ error: 'unauthorized' }, 401)

  c.set('userId', data.user.id)
  await next()
}
