import type { Context, Next } from 'hono'
import { SignJWT, jwtVerify } from 'jose'
import type { AppEnv } from './types.js'

const getJwtSecret = () => {
  const s = process.env.JWT_SECRET
  if (!s) throw new Error('JWT_SECRET must be set')
  return new TextEncoder().encode(s)
}

export async function signToken(payload: { sub: string; role: string }) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getJwtSecret())
}

export async function verifyToken(token: string) {
  const { payload } = await jwtVerify(token, getJwtSecret(), { algorithms: ['HS256'] })
  return payload as { sub: string; role: string }
}

// ─── Middleware ────────────────────────────────────────────────────────────────

// Dashboard users: validate JWT, set userId + role on context.
export async function requireAuth(c: Context<AppEnv>, next: Next) {
  const header = c.req.header('authorization') ?? ''
  const token = header.replace(/^Bearer\s+/i, '')
  if (!token) return c.json({ error: 'unauthorized' }, 401)
  try {
    const payload = await verifyToken(token)
    c.set('userId', payload.sub)
    c.set('userRole', payload.role)
    await next()
  } catch {
    return c.json({ error: 'unauthorized' }, 401)
  }
}

// n8n / internal services: static shared secret.
export async function requireInternalToken(c: Context, next: Next) {
  const token = process.env.INTERNAL_TRIGGER_TOKEN
  if (!token) {
    console.error('INTERNAL_TRIGGER_TOKEN not set')
    return c.json({ error: 'server misconfigured' }, 500)
  }
  const header = c.req.header('authorization') ?? ''
  if (header !== `Bearer ${token}`) {
    return c.json({ error: 'unauthorized' }, 401)
  }
  await next()
}
