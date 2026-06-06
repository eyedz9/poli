// Shared Hono environment — typed context variables set by auth middleware.
export type AppEnv = {
  Variables: {
    userId: string
    userRole: string
  }
}
