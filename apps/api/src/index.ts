import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { prettyJSON } from 'hono/pretty-json'
import { issuesRouter } from './routes/issues.js'
import { personasRouter } from './routes/personas.js'
import { channelsRouter } from './routes/channels.js'
import { briefsRouter } from './routes/briefs.js'

const app = new Hono()

app.use('*', cors())
app.use('*', logger())
app.use('*', prettyJSON())

app.get('/health', (c) => c.json({ status: 'ok', ts: new Date().toISOString() }))

app.route('/api/issues', issuesRouter)
app.route('/api/personas', personasRouter)
app.route('/api/channels', channelsRouter)
app.route('/api/briefs', briefsRouter)

const port = parseInt(process.env.API_PORT ?? '3000')
console.log(`API running on :${port}`)

export default {
  port,
  fetch: app.fetch,
}
