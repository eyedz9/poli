// Golden set — operator-labeled ground truth for grading the AI engines.
//
// This is the moat. Each engine's non-deterministic LLM output is scored
// against these expectations every run; the regression gate (run.ts) fails CI
// if a tracked metric drops below baseline.
//
// HOW TO GROW IT: an operator curates real examples from production corpus —
// pick an issue, write what a correct cluster label / persona band / reframe
// looks like. Aim for N≈30-50 per engine. This file holds the seed scaffold.

export interface ClusterCase {
  id: string
  // The signal summaries that should cluster together.
  signals: string[]
  // The generated label should contain at least one of these (case-insensitive).
  expectedThemeKeywords: string[]
}

export interface PersonaCase {
  id: string
  issue: string
  // Census-checkable demographic expectations (calibration target).
  expectedAgeBand: string[] // generated age_skew should match one
  expectedUrbanRural: string[]
}

export interface ReframeCase {
  id: string
  position: string
  principle: string
  segment: string
  // Fidelity checklist the reframe MUST satisfy.
  mustPreservePosition: true
  mustNotAbandonPrinciple: true
  // Words that, if present, signal the reframe drifted partisan (fail).
  forbiddenPartisanCues: string[]
}

export const CLUSTER_CASES: ClusterCase[] = [
  {
    id: 'water-fluoride',
    signals: [
      'city council voting to remove fluoride from tap water',
      'is fluoride in drinking water actually safe for kids',
      'petition to stop fluoridation of municipal supply',
    ],
    expectedThemeKeywords: ['fluoride', 'water', 'public health'],
  },
  {
    id: 'str-caps',
    signals: [
      'airbnb is making it impossible to find a long term rental here',
      'ballot measure to cap short term rentals in resort towns',
      'vacation rentals are eating our housing stock',
    ],
    expectedThemeKeywords: ['rental', 'housing', 'airbnb', 'short-term'],
  },
]

export const PERSONA_CASES: PersonaCase[] = [
  {
    id: 'broadband-rural',
    issue: 'rural-broadband-funding',
    expectedAgeBand: ['broad 30-60', 'skews 35-49', 'skews 50-64'],
    expectedUrbanRural: ['rural-leaning', 'mixed'],
  },
]

export const REFRAME_CASES: ReframeCase[] = [
  {
    id: 'solar-conservative',
    position: 'We support a balanced solar siting ordinance',
    principle: 'Protect productive farmland while enabling clean energy',
    segment: 'civic-minded conservatives',
    mustPreservePosition: true,
    mustNotAbandonPrinciple: true,
    forbiddenPartisanCues: ['MAGA', 'libs', 'socialist', 'fascist'],
  },
]
