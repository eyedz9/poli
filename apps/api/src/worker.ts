import { Worker, type ConnectionOptions } from 'bullmq'
import Redis from 'ioredis'

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

console.log('Worker running — listening on queues:', QUEUES.join(', '))
