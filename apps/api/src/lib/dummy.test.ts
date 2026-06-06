import { describe, it, expect } from 'vitest'
import {
  rng, ISSUE_CATALOG, genIssue, genPersona, genChannel, genBrief, genSignals, genFrame,
} from './dummy.js'

describe('rng', () => {
  it('is deterministic for a given seed', () => {
    const a = rng(42), b = rng(42)
    expect([a(), a(), a()]).toEqual([b(), b(), b()])
  })
  it('differs across seeds', () => {
    expect(rng(1)()).not.toEqual(rng(2)())
  })
  it('stays in [0,1)', () => {
    const r = rng(7)
    for (let i = 0; i < 1000; i++) { const v = r(); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1) }
  })
})

describe('genIssue', () => {
  it('thin issues fall under the 50-unit activation threshold', () => {
    ISSUE_CATALOG.forEach((seed, i) => {
      const iss = genIssue(seed, i)
      if (seed.thin) expect(iss.totalSourceUnits).toBeLessThan(50)
      else expect(iss.totalSourceUnits).toBeGreaterThanOrEqual(50)
    })
  })
  it('thin issues are marked insufficient/thin confidence', () => {
    const thin = ISSUE_CATALOG.findIndex((s) => s.thin)
    const iss = genIssue(ISSUE_CATALOG[thin], thin)
    expect(iss.confidence).toBe('insufficient')
    expect(iss.dataConfidence).toBe('thin')
  })
  it('is deterministic', () => {
    expect(genIssue(ISSUE_CATALOG[0], 0)).toEqual(genIssue(ISSUE_CATALOG[0], 0))
  })
})

describe('genPersona', () => {
  it('always meets the min cohort size constraint (>= 50)', () => {
    for (let v = 0; v < 20; v++) {
      const p = genPersona('test-issue', 'issue-id', v)
      expect(p.sourceUnitCount).toBeGreaterThanOrEqual(50)
    }
  })
  it('picks a valid primary moral foundation', () => {
    const p = genPersona('x', 'y', 0)
    expect(['care', 'fairness', 'loyalty', 'authority', 'sanctity', 'liberty']).toContain(p.mftPrimary)
  })
})

describe('genChannel', () => {
  it('CVS bands map to confidence tiers consistently', () => {
    for (let i = 0; i < 30; i++) {
      const c = genChannel(i)
      const expected = c.cvsOverall > 70 ? 'high' : c.cvsOverall > 50 ? 'medium' : 'low'
      expect(c.confidence).toBe(expected)
    }
  })
})

describe('genBrief', () => {
  it('flags thin data and zeroes confidence when source count < 50', () => {
    const b = genBrief('i', null, 'persuadable independents', null, [], 23)
    expect(b.overallConfidence).toBe('insufficient')
    expect(b.thinDataWarnings.length).toBeGreaterThan(0)
    expect(b.confidenceScore).toBeLessThan(0.4)
  })
  it('does not flag thin data with a healthy corpus', () => {
    const b = genBrief('i', null, 'persuadable independents', null, [], 800)
    expect(b.overallConfidence).toBe('high')
    expect(b.thinDataWarnings.length).toBe(0)
  })
})

describe('genSignals', () => {
  it('produces the requested count with unique content hashes', () => {
    const sigs = genSignals('issue-1', 40)
    expect(sigs).toHaveLength(40)
    expect(new Set(sigs.map((s) => s.contentHash)).size).toBe(40)
  })
  it('sentiment stays within [-1, 1]', () => {
    genSignals('issue-2', 50).forEach((s) => {
      expect(s.sentimentScore).toBeGreaterThanOrEqual(-1)
      expect(s.sentimentScore).toBeLessThanOrEqual(1)
    })
  })
})

describe('genFrame', () => {
  it('targets a valid foundation and produces reframe text', () => {
    const f = genFrame('i', null, 'cost-conscious moderates', 0)
    expect(f.reframeText.length).toBeGreaterThan(20)
    expect(['care', 'fairness', 'loyalty', 'authority', 'sanctity', 'liberty']).toContain(f.foundationTargeted)
  })
})
