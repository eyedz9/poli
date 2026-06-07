// Eval runner + regression gate.
//
//   npm run eval            -> score the engines, print a report
//   EVAL_GATE=true npm run eval  -> additionally exit 1 if any suite is below
//                                   its baseline (use in CI)
//
// Engine adapters: in DUMMY mode these grade the dummy generators so the
// harness + gate run end-to-end with no keys. Replace each adapter's body with
// a real engine call once ANTHROPIC_API_KEY / Voyage are wired (marked TODO).

import { CLUSTER_CASES, PERSONA_CASES, REFRAME_CASES } from './golden-set.js'
import { scoreClusterLabel, scorePersona, scoreReframe, summarize, type EvalResult } from './scorer.js'
import { genPersona, genFrame } from '../lib/dummy.js'

// Baseline thresholds — a suite mean below this fails the gate.
const BASELINE: Record<string, number> = { cluster: 0.8, persona: 0.5, reframe: 0.9 }

// ─── adapters (dummy now; real engine calls are the TODO seam) ───────────────
function clusterLabelAdapter(c: (typeof CLUSTER_CASES)[number]): string {
  // TODO real: embed c.signals -> HDBSCAN -> LLM label. Dummy: synthesize a
  // label from the case theme so the harness wiring is exercised.
  return `${c.expectedThemeKeywords[0]} debate`
}
function personaAdapter(c: (typeof PERSONA_CASES)[number]) {
  // TODO real: persona engine on the issue's corpus. Dummy generator stands in.
  const p = genPersona(c.issue, 'eval', 0)
  return { ageSkew: p.ageSkew, urbanRuralSkew: p.urbanRuralSkew }
}
function reframeAdapter(c: (typeof REFRAME_CASES)[number]) {
  // TODO real: language engine reframe + fidelity check. Dummy frame stands in.
  const f = genFrame('eval-issue', null, c.segment, 0)
  return { reframeText: f.reframeText, checklist: f.fidelityChecklist as any }
}

export function runEval(): EvalResult[] {
  const cluster = summarize('cluster', CLUSTER_CASES.map((c) => scoreClusterLabel(c, clusterLabelAdapter(c))))
  const persona = summarize('persona', PERSONA_CASES.map((c) => scorePersona(c, personaAdapter(c))))
  const reframe = summarize('reframe', REFRAME_CASES.map((c) => scoreReframe(c, reframeAdapter(c))))
  return [cluster, persona, reframe]
}

function main() {
  const results = runEval()
  console.log('\n  EVAL REPORT (dummy adapters — real engines TODO)')
  console.log('  ─────────────────────────────────────────────')
  let failed = false
  for (const r of results) {
    const base = BASELINE[r.suite] ?? 0
    const pass = r.mean >= base
    if (!pass) failed = true
    console.log(`  ${r.suite.padEnd(10)} mean ${r.mean.toFixed(2)}  baseline ${base.toFixed(2)}  ${pass ? 'PASS' : 'FAIL'}  (n=${r.scores.length})`)
  }
  console.log('')
  if (failed && process.env.EVAL_GATE === 'true') {
    console.error('  EVAL GATE: a suite dropped below baseline — failing.')
    process.exit(1)
  }
}

// Run only when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('run.ts') || process.argv[1]?.endsWith('run.js')) {
  main()
}
