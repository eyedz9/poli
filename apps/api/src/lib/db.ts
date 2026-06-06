import postgres from 'postgres'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL must be set')
}

// Single connection pool shared across the process.
// postgres() is lazy — connects on first query.
export const db = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 30,
  connect_timeout: 10,
  transform: postgres.camel,  // snake_case DB cols → camelCase JS
})
