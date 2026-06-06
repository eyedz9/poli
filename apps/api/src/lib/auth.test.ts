import { describe, it, expect, beforeAll } from 'vitest'
import { signToken, verifyToken } from './auth.js'

beforeAll(() => {
  process.env.JWT_SECRET = 'test_secret_for_unit_tests_only_32_bytes_long!!'
})

describe('JWT sign/verify', () => {
  it('round-trips a payload', async () => {
    const token = await signToken({ sub: 'user-123', role: 'admin' })
    const payload = await verifyToken(token)
    expect(payload.sub).toBe('user-123')
    expect(payload.role).toBe('admin')
  })

  it('rejects a tampered token', async () => {
    const token = await signToken({ sub: 'u', role: 'client' })
    const tampered = token.slice(0, -3) + 'xxx'
    await expect(verifyToken(tampered)).rejects.toThrow()
  })

  it('rejects an alg-confusion token (none/RS256 not accepted)', async () => {
    // Hand-craft an unsigned "alg: none" token — verifier pins HS256.
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
    const body = Buffer.from(JSON.stringify({ sub: 'attacker', role: 'admin' })).toString('base64url')
    const forged = `${header}.${body}.`
    await expect(verifyToken(forged)).rejects.toThrow()
  })
})
