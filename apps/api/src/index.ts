import { Hono } from 'hono'
import { serve } from '@hono/node-server'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { authRouter } from './routes/auth.js'
import { issuesRouter } from './routes/issues.js'
import { personasRouter } from './routes/personas.js'
import { channelsRouter } from './routes/channels.js'
import { briefsRouter } from './routes/briefs.js'

const DASHBOARD_ORIGINS = (process.env.DASHBOARD_ORIGINS ?? 'http://localhost:5173').split(',')

const app = new Hono()

app.use('*', cors({
  origin: DASHBOARD_ORIGINS,
  allowMethods: ['GET', 'POST'],
  credentials: false,
}))
app.use('*', logger())
app.use('*', prettyJSON())

app.get('/health', (c) => c.json({ status: 'ok', ts: new Date().toISOString() }))

app.route('/api/auth', authRouter)
app.route('/api/issues', issuesRouter)
app.route('/api/personas', personasRouter)
app.route('/api/channels', channelsRouter)
app.route('/api/briefs', briefsRouter)

const port = parseInt(process.env.API_PORT ?? '3000')
serve({ fetch: app.fetch, port, hostname: '0.0.0.0' }, (info) => {
  console.log(`API running on :${info.port}`)
})

export default app
