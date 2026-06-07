import { Worker, Queue, type ConnectionOptions } from 'bullmq'
import Redis from 'ioredis'
import { purgeExpired, assertPurgeHealthy } from './jobs/ttl-purge.js'

// BullMQ bundles its own ioredis copy; cast reconciles duplicate type identities.
const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
}) as unknown as ConnectionOptions

// Queue names — match what n8n posts to via HTTP trigger
const QUEUES = ['ingest', 'narrative', 'persona', 'influencer', 'language'] as const

for (const queueName of QUEUES) {
  const worker = new Worker(
    queueName,
    async (job) => {
      console.log(`[${queueName}] processing job ${job.id}`, job.data)
      // Engine-specific processor dynamically imported to keep worker boot fast
      const { process } = await import(`./engines/${queueName}.js`)
      return process(job.data)
    },
    {
      connection,
      concurrency: 2,
    }
  )

  worker.on('completed', (job) => console.log(`[${queueName}] job ${job.id} done`))
  worker.on('failed', (job, err) => console.error(`[${queueName}] job ${job?.id} failed`, err))
}

// ─── Maintenance: 24h TTL purge + dead-man's-switch ──────────────────────────
const maintenance = new Queue('maintenance', { connection })

const maintenanceWorker = new Worker(
  'maintenance',
  async (job) => {
    if (job.name === 'ttl-purge') return purgeExpired()
    if (job.name === 'ttl-health') return assertPurgeHealthy()
    throw new Error(`unknown maintenance job: ${job.name}`)
  },
  { connection, concurrency: 1 }
)
maintenanceWorker.on('failed', (job, err) => console.error(`[maintenance] ${job?.name} failed`, err))

// Schedule repeatable jobs (idempotent — BullMQ dedupes by repeat key).
async function scheduleMaintenance() {
  await maintenance.add('ttl-purge', {}, { repeat: { pattern: '0 * * * *' }, jobId: 'ttl-purge' }) // hourly
  await maintenance.add('ttl-health', {}, { repeat: { pattern: '30 * * * *' }, jobId: 'ttl-health' }) // hourly, offset
  // Run once at boot so a fresh deploy purges immediately rather than waiting an hour.
  await maintenance.add('ttl-purge', {})
}
scheduleMaintenance().catch((err) => console.error('[maintenance] scheduling failed', err))

console.log('Worker running — listening on queues:', QUEUES.join(', '), '+ maintenance')
