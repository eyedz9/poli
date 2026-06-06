import { Hono } from 'hono'
import { z } from 'zod'
import { hash, compare } from 'bcryptjs'
import { db } from '../lib/db.js'
import { signToken } from '../lib/auth.js'

export const authRouter = new Hono()

const CredSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
})

authRouter.post('/register', async (c) => {
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
  if (!user) return c.json({ error: 'invalid credentials' }, 401)

  const ok = await compare(parsed.data.password, user.passwordHash)
  if (!ok) return c.json({ error: 'invalid credentials' }, 401)

  await db`UPDATE users SET last_login_at = NOW() WHERE id = ${user.id}`
  const token = await signToken({ sub: user.id, role: user.role })
  return c.json({ token, user: { id: user.id, email: user.email, role: user.role } })
})
