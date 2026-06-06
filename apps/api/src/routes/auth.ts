import { Hono } from 'hono'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
const { hash, compare, hashSync } = bcrypt
import { db } from '../lib/db.js'
import { signToken, requireInternalToken } from '../lib/auth.js'

export const authRouter = new Hono()

const CredSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
})

// Valid bcrypt hash (cost 12) of an unknown string, computed once at
// startup. Compared against on login when no user is found, so a full
// bcrypt round runs and response time is constant regardless of whether
// the email exists — defeats the user-enumeration timing oracle.
// Computed (not a literal) to guarantee structural validity; a malformed
// hash would make compare() bail early and reintroduce the timing gap.
const DUMMY_HASH = hashSync(`dummy-${process.env.JWT_SECRET ?? 'x'}`, 12)

// Registration is admin-provisioning only — gated behind the internal
// token, not public. Prevents anyone from self-registering into the
// tenant and reading shared issue/persona data.
authRouter.post('/register', requireInternalToken, async (c) => {
  const body = await c.req.json()
  const parsed = CredSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)

  const passwordHash = await hash(parsed.data.password, 12)
  const [user] = await db`
    INSERT INTO users (email, password_hash)
    VALUES (${parsed.data.email}, ${passwordHash})
    RETURNING id, email, role
  `.catch(() => { throw new Error('email_taken') })

  const token = await signToken({ sub: user.id, role: user.role })
  return c.json({ token, user: { id: user.id, email: user.email, role: user.role } }, 201)
})

authRouter.post('/login', async (c) => {
  const body = await c.req.json()
  const parsed = CredSchema.safeParse(body)
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)

  const [user] = await db`
    SELECT id, email, role, password_hash FROM users WHERE email = ${parsed.data.email}
  `
  // Always run a compare — constant time whether or not the email exists.
  const ok = user
    ? await compare(parsed.data.password, user.passwordHash)
    : await compare(parsed.data.password, DUMMY_HASH)
  if (!user || !ok) return c.json({ error: 'invalid credentials' }, 401)

  await db`UPDATE users SET last_login_at = NOW() WHERE id = ${user.id}`
  const token = await signToken({ sub: user.id, role: user.role })
  return c.json({ token, user: { id: user.id, email: user.email, role: user.role } })
})
