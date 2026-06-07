import { describe, it, expect } from 'vitest'
import { scoreClusterLabel, scorePersona, scoreReframe, summarize } from './scorer.js'

describe('scoreClusterLabel', () => {
  const c = { id: 'x', signals: [], expectedThemeKeywords: ['fluoride', 'water'] }
  it('1 when label contains an expected theme', () => {
    expect(scoreClusterLabel(c, 'Municipal Water Fluoridation Debate')).toBe(1)
  })
  it('0 when label misses all themes', () => {
    expect(scoreClusterLabel(c, 'School Cellphone Policy')).toBe(0)
  })
})

describe('scorePersona', () => {
  const c = { id: 'x', issue: 'i', expectedAgeBand: ['broad 30-60'], expectedUrbanRural: ['rural-leaning'] }
  it('1 when both bands match', () => {
    expect(scorePersona(c, { ageSkew: 'broad 30-60', urbanRuralSkew: 'rural-leaning' })).toBe(1)
  })
  it('0.5 when one matches', () => {
    expect(scorePersona(c, { ageSkew: 'broad 30-60', urbanRuralSkew: 'urban-leaning' })).toBe(0.5)
  })
  it('0 when neither matches', () => {
    expect(scorePersona(c, { ageSkew: 'skews 25-34', urbanRuralSkew: 'urban-leaning' })).toBe(0)
  })
})

describe('scoreReframe', () => {
  const c = {
    id: 'x', position: 'p', principle: 'pr', segment: 's',
    mustPreservePosition: true as const, mustNotAbandonPrinciple: true as const,
    forbiddenPartisanCues: ['libs', 'MAGA'],
  }
  it('hard-fails (0) on partisan drift regardless of checklist', () => {
    expect(scoreReframe(c, { reframeText: 'own the libs on this', checklist: { preserves_position: true, no_principle_abandoned: true } })).toBe(0)
  })
  it('1 when clean and checklist passes', () => {
    expect(scoreReframe(c, { reframeText: 'common-sense local control', checklist: { preserves_position: true, no_principle_abandoned: true } })).toBe(1)
  })
  it('0.5 when one fidelity item fails', () => {
    expect(scoreReframe(c, { reframeText: 'fair shot for families', checklist: { preserves_position: true, no_principle_abandoned: false } })).toBe(0.5)
  })
})

describe('summarize', () => {
  it('computes the mean', () => {
    expect(summarize('s', [1, 0, 0.5]).mean).toBe(0.5)
  })
  it('handles empty', () => {
    expect(summarize('s', []).mean).toBe(0)
  })
})
