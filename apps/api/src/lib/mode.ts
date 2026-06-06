// Dummy-mode switch. The platform runs fully on synthetic data when
// USE_DUMMY_DATA=true OR when no Anthropic key is configured — so it works
// end-to-end with zero external API keys.
export function isDummy(): boolean {
  if (process.env.USE_DUMMY_DATA === 'true') return true
  if (process.env.USE_DUMMY_DATA === 'false') return false
  return !process.env.ANTHROPIC_API_KEY
}
