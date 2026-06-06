import { Queue, type ConnectionOptions } from 'bullmq'
import Redis from 'ioredis'

// BullMQ bundles its own ioredis copy; the instance is valid at runtime, the
// cast just reconciles the duplicate type identities from nested node_modules.
const connection = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  maxRetriesPerRequest: null,
}) as unknown as ConnectionOptions

export const queues = {
  ingest: new Queue('ingest', { connection }),
  narrative: new Queue('narrative', { connection }),
  persona: new Queue('persona', { connection }),
  influencer: new Queue('influencer', { connection }),
  language: new Queue('language', { connection }),
}
