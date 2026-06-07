// Scorers — grade engine output against the golden set. Pure functions, unit
// testable. Each returns a 0..1 score; the runner aggregates + gates on a
// baseline threshold.
import type { ClusterCase, PersonaCase, ReframeCase } from './golden-set.js'

const lc = (s: string) => s.toLowerCase()

// Cluster label: did the generated label capture an expected theme?
export function scoreClusterLabel(c: ClusterCase, generatedLabel: string): number {
  const label = lc(generatedLabel)
  return c.expectedThemeKeywords.some((k) => label.includes(lc(k))) ? 1 : 0
}

// Persona: do the Census-checkable demographic bands match?
export function scorePersona(
  c: PersonaCase,
  generated: { ageSkew?: string; urbanRuralSkew?: string }
): number {
  const age = c.expectedAgeBand.includes(generated.ageSkew ?? '') ? 1 : 0
  const geo = c.expectedUrbanRural.includes(generated.urbanRuralSkew ?? '') ? 1 : 0
  return (age + geo) / 2
}

// Reframe fidelity: preserves position, keeps principle, no partisan drift.
export function scoreReframe(
  c: ReframeCase,
  generated: { reframeText: string; checklist?: { preserves_position?: boolean; no_principle_abandoned?: boolean } }
): number {
  const text = lc(generated.reframeText)
  const partisan = c.forbiddenPartisanCues.some((w) => text.includes(lc(w)))
  if (partisan) return 0 // hard fail on partisan drift
  const preserves = generated.checklist?.preserves_position !== false
  const keepsPrinciple = generated.checklist?.no_principle_abandoned !== false
  return (Number(preserves) + Number(keepsPrinciple)) / 2
}

export interface EvalResult {
  suite: string
  scores: number[]
  mean: number
}

export function summarize(suite: string, scores: number[]): EvalResult {
  const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
  return { suite, scores, mean: Number(mean.toFixed(3)) }
}
