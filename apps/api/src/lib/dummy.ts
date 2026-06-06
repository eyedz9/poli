// Dummy data generators — let the whole platform run end-to-end with NO
// external API keys. Used by both the seed script and the engines' dummy
// mode. Deterministic given a seed so test runs are reproducible.

// ─── Seeded RNG (mulberry32) ────────────────────────────────────────────────
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T>(r: () => number, arr: T[]): T => arr[Math.floor(r() * arr.length)]
const between = (r: () => number, lo: number, hi: number) => lo + r() * (hi - lo)
const round = (n: number, d = 2) => Math.round(n * 10 ** d) / 10 ** d
const sample = <T>(r: () => number, arr: T[], n: number): T[] => {
  const copy = [...arr]
  const out: T[] = []
  for (let i = 0; i < n && copy.length; i++) out.push(copy.splice(Math.floor(r() * copy.length), 1)[0])
  return out
}

// ─── Vocab pools (nonpartisan, issue-tagged) ────────────────────────────────
const PLATFORMS = ['youtube', 'reddit', 'bluesky', 'gdelt_news', 'google_trends'] as const
const STANCES = ['pro', 'con', 'neutral', 'mixed'] as const
const STATES = ['CA', 'TX', 'FL', 'PA', 'OH', 'MI', 'WI', 'AZ', 'GA', 'NC', 'NV', 'CO']
const MFT_KEYS = ['care', 'fairness', 'loyalty', 'authority', 'sanctity', 'liberty']

// ─── The demo issue catalog ─────────────────────────────────────────────────
// Realistic down-ballot / advocacy issues. Nonpartisan framing.
export interface IssueSeed {
  slug: string
  label: string
  description: string
  themes: string[]
  status: 'emerging' | 'active' | 'saturated' | 'declining'
  primaryState: string
  seedKeywords: string[]
  trendsTerms: string[]
  thin?: boolean // if true, under-50 source units → activation_blocked
}

export const ISSUE_CATALOG: IssueSeed[] = [
  {
    slug: 'local-water-fluoridation',
    label: 'Municipal Water Fluoridation Debate',
    description: 'Renewed local debate over removing fluoride from municipal water supplies, driven by new state guidance and viral health claims.',
    themes: ['public health', 'local government', 'science trust'],
    status: 'emerging',
    primaryState: 'OH',
    seedKeywords: ['fluoride water', 'remove fluoride', 'water safety'],
    trendsTerms: ['is fluoride safe', 'fluoride ban'],
  },
  {
    slug: 'short-term-rental-caps',
    label: 'Short-Term Rental Caps in Resort Towns',
    description: 'Ballot measures capping short-term rentals to address housing affordability in tourism-dependent municipalities.',
    themes: ['housing', 'local economy', 'tourism'],
    status: 'active',
    primaryState: 'CO',
    seedKeywords: ['airbnb cap', 'short term rental ban', 'housing affordability'],
    trendsTerms: ['str ordinance', 'vacation rental rules'],
  },
  {
    slug: 'school-cellphone-bans',
    label: 'Cellphone Bans in Public Schools',
    description: 'Statewide movement toward bell-to-bell phone-free school policies, with strong parent and teacher engagement.',
    themes: ['education', 'youth mental health', 'school policy'],
    status: 'saturated',
    primaryState: 'FL',
    seedKeywords: ['phone ban school', 'phone free schools', 'student screen time'],
    trendsTerms: ['cellphone ban schools', 'phone free policy'],
  },
  {
    slug: 'rural-broadband-funding',
    label: 'Rural Broadband Funding Rollout',
    description: 'Local frustration over delayed rural broadband buildout despite allocated federal funds.',
    themes: ['infrastructure', 'rural', 'digital divide'],
    status: 'active',
    primaryState: 'WI',
    seedKeywords: ['rural internet', 'broadband funding', 'no internet rural'],
    trendsTerms: ['bead program', 'rural broadband map'],
  },
  {
    slug: 'utility-rate-hikes',
    label: 'Electric Utility Rate Hikes',
    description: 'Surging residential electric bills triggering organized ratepayer pushback at public utility commissions.',
    themes: ['energy', 'cost of living', 'utilities'],
    status: 'emerging',
    primaryState: 'AZ',
    seedKeywords: ['electric bill high', 'utility rate increase', 'puc rate case'],
    trendsTerms: ['why is my electric bill so high', 'rate hike protest'],
  },
  {
    slug: 'youth-vaping-enforcement',
    label: 'Youth Vaping Enforcement',
    description: 'Advocacy push for stricter retailer enforcement on flavored vape sales to minors.',
    themes: ['public health', 'youth', 'regulation'],
    status: 'declining',
    primaryState: 'MI',
    seedKeywords: ['flavored vape ban', 'youth vaping', 'vape retailer'],
    trendsTerms: ['flavored vape ban', 'vape age check'],
    thin: true,
  },
  {
    slug: 'farmland-solar-siting',
    label: 'Solar Farm Siting on Farmland',
    description: 'County-level zoning fights over large solar installations replacing active farmland.',
    themes: ['energy', 'agriculture', 'land use'],
    status: 'emerging',
    primaryState: 'NC',
    seedKeywords: ['solar farm zoning', 'farmland solar', 'solar setback'],
    trendsTerms: ['solar farm near me', 'farmland solar ban'],
    thin: true,
  },
  {
    slug: 'library-funding-levy',
    label: 'Public Library Funding Levy',
    description: 'Local levy campaigns to sustain public library hours and programming amid budget shortfalls.',
    themes: ['education', 'local budget', 'community services'],
    status: 'active',
    primaryState: 'PA',
    seedKeywords: ['library levy', 'save the library', 'library funding'],
    trendsTerms: ['library levy vote', 'library hours cut'],
  },
]

// ─── Generators ──────────────────────────────────────────────────────────────

export function genIssue(seed: IssueSeed, idx: number) {
  const r = rng(1000 + idx)
  const units = seed.thin ? Math.floor(between(r, 12, 45)) : Math.floor(between(r, 80, 1400))
  const crossPlat = seed.thin ? Math.floor(between(r, 1, 2)) : Math.floor(between(r, 2, 5))
  const momentum = seed.status === 'emerging' ? between(r, 1.8, 4.2)
    : seed.status === 'active' ? between(r, 1.2, 2.2)
    : seed.status === 'saturated' ? between(r, 0.8, 1.3)
    : between(r, 0.3, 0.9)
  const conf = units < 50 ? 'insufficient' : units < 200 ? 'low' : units < 600 ? 'medium' : 'high'
  const breakdown: Record<string, number> = {}
  sample(r, [...PLATFORMS], crossPlat + 1).forEach((p) => { breakdown[p] = Math.floor(between(r, 5, units / 2)) })
  return {
    slug: seed.slug,
    label: seed.label,
    description: seed.description,
    themes: seed.themes,
    status: seed.status,
    confidence: conf,
    geoScope: 'state',
    geoCodes: [seed.primaryState, ...sample(r, STATES.filter((s) => s !== seed.primaryState), 2)],
    primaryState: seed.primaryState,
    momentumScore: round(momentum, 2),
    momentumDelta24h: round(between(r, -0.6, 0.9), 2),
    momentumDelta7d: round(between(r, -1.1, 1.6), 2),
    velocityScore: round(between(r, 0.8, 2.4), 2),
    saturationIndex: round(seed.status === 'saturated' ? between(r, 0.7, 0.95) : between(r, 0.1, 0.6), 2),
    totalSourceUnits: units,
    platformBreakdown: breakdown,
    crossPlatformCount: crossPlat,
    dataConfidence: units < 50 ? 'thin' : units < 500 ? 'normal' : 'strong',
    googleTrendsTerms: seed.trendsTerms,
    seedKeywords: seed.seedKeywords,
    operatorVerified: r() > 0.6,
  }
}

export function genPersona(issueSlug: string, issueId: string, variant: number) {
  const r = rng(hash(issueSlug) + variant * 7)
  const stance = pick(r, [...STANCES])
  const mft: Record<string, number> = {}
  MFT_KEYS.forEach((k) => { mft[k] = round(between(r, 0.1, 0.9), 3) })
  const primaryMft = MFT_KEYS.reduce((a, b) => (mft[a] > mft[b] ? a : b))
  const units = Math.floor(between(r, 55, 900))
  const labels = ['Concerned Local Parents', 'Cost-Conscious Homeowners', 'Civic-Minded Retirees', 'Skeptical Independents', 'Engaged Small-Business Owners', 'Rural Pragmatists']
  const conf = units < 120 ? 'low' : units < 400 ? 'medium' : 'high'
  return {
    issueId,
    label: `${pick(r, labels)} (v${variant + 1})`,
    version: 1,
    sourceUnitCount: units,
    platformSources: sample(r, [...PLATFORMS], Math.floor(between(r, 2, 4))),
    dateRangeStart: daysAgo(30),
    dateRangeEnd: daysAgo(0),
    ageSkew: pick(r, ['skews 25-34', 'skews 35-49', 'skews 50-64', 'broad 30-60']),
    urbanRuralSkew: pick(r, ['urban-leaning', 'suburban', 'rural-leaning', 'mixed']),
    geoConcentration: sample(r, STATES, 3),
    incomeProxySkew: pick(r, ['middle-income', 'lower-middle', 'mixed', 'upper-middle']),
    dominantValues: sample(r, ['fairness', 'security', 'community', 'self-reliance', 'tradition', 'opportunity'], 3),
    primaryConcerns: sample(r, ['affordability', 'safety', 'trust in institutions', 'local control', 'fairness', 'future generations'], 3),
    trustedSources: sample(r, ['local news', 'community Facebook groups', 'word of mouth', 'church/civic orgs', 'YouTube explainers'], 2),
    rhetoricStyle: pick(r, ['plainspoken', 'data-driven', 'values-first', 'story-driven']),
    mftCare: mft.care, mftFairness: mft.fairness, mftLoyalty: mft.loyalty,
    mftAuthority: mft.authority, mftSanctity: mft.sanctity, mftLiberty: mft.liberty,
    mftPrimary: primaryMft,
    stanceOnIssue: stance,
    stanceIntensity: round(between(r, 0.3, 0.95), 2),
    persuadabilityScore: round(between(r, 0.2, 0.8), 2),
    persuadabilityEvidence: 'Mixed-sentiment comment clusters with high reply engagement; values-framed appeals outperform partisan cues.',
    receptiveFrames: sample(r, ['fairness-to-families', 'protecting-local-control', 'common-sense-safety', 'fiscal-responsibility'], 2),
    resistantFrames: sample(r, ['top-down-mandates', 'partisan-labeling', 'outside-interests'], 2),
    resonantVocabulary: sample(r, ['common sense', 'our community', 'fair share', 'accountability', 'kitchen-table', 'looking out for'], 4),
    confidence: conf,
    confidenceScore: round(between(r, 0.45, 0.9), 2),
    confidenceFlags: units < 120 ? ['small_cohort'] : [],
    expiresAt: daysAhead(14),
  }
}

export function genChannel(idx: number) {
  const r = rng(5000 + idx)
  const platform = pick(r, ['youtube', 'reddit', 'bluesky'] as const)
  const names = ['Heartland Voices', 'The Local Ledger', 'Civic Pulse', 'Main Street Report', 'Statehouse Watch', 'Community Forum', 'The Ratepayer', 'Open Town Hall', 'Grassroots Daily', 'The Commons']
  const cvs = round(between(r, 35, 92), 2)
  return {
    platform,
    platformChannelId: `${platform}_${1000 + idx}`,
    displayName: `${pick(r, names)} ${idx + 1}`,
    channelUrl: `https://example.test/${platform}/ch${idx + 1}`,
    channelType: pick(r, ['independent creator', 'local outlet', 'advocacy org', 'commentator']),
    subscriberProxy: Math.floor(between(r, 2000, 480000)),
    cvsOverall: cvs,
    cvsVolume: round(between(r, 30, 95), 2),
    cvsReplyDepth: round(between(r, 20, 90), 2),
    cvsVelocity: round(between(r, 25, 95), 2),
    cvsOnTopicPct: round(between(r, 0.4, 0.95), 3),
    cvsSentimentSpread: round(between(r, 0.2, 0.8), 3),
    cvsComputedAt: daysAgo(1),
    topicTags: sample(r, ['housing', 'energy', 'education', 'health', 'local-gov', 'infrastructure'], 3),
    primaryGeo: sample(r, STATES, 2),
    geoConfidence: round(between(r, 0.4, 0.9), 2),
    sampleSize: Math.floor(between(r, 200, 5000)),
    confidence: cvs > 70 ? 'high' : cvs > 50 ? 'medium' : 'low',
    lastScrapedAt: daysAgo(1),
  }
}

export function genChannelIssueSignal(channelId: string, issueId: string, seedN: number) {
  const r = rng(hash(channelId + issueId) + seedN)
  return {
    channelId, issueId,
    stance: pick(r, [...STANCES]),
    stanceConfidence: round(between(r, 0.4, 0.9), 3),
    cvsForIssue: round(between(r, 30, 90), 2),
    postCount: Math.floor(between(r, 2, 40)),
    commentCount: Math.floor(between(r, 50, 4000)),
    firstPostedAt: daysAgo(45),
    lastPostedAt: daysAgo(2),
  }
}

export function genFrame(issueId: string, personaId: string | null, segment: string, variant: number) {
  const r = rng(hash(issueId + segment) + variant)
  const foundation = pick(r, MFT_KEYS)
  const mft: Record<string, number> = {}
  MFT_KEYS.forEach((k) => { mft[k] = round(between(r, 0.1, 0.9), 3) })
  return {
    issueId, personaId, segment,
    dominantFrame: pick(r, ['economic-fairness', 'local-control', 'public-safety', 'future-generations', 'personal-liberty']),
    vocabDistinctive: sample(r, ['common sense', 'our town', 'fair shot', 'accountability', 'red tape', 'kitchen-table'], 4),
    mftScores: mft,
    reframeText: reframeFor(segment, foundation),
    foundationTargeted: foundation,
    fidelityScore: round(between(r, 0.7, 0.98), 2),
    fidelityVerified: r() > 0.3,
    fidelityChecklist: { preserves_position: true, no_principle_abandoned: true, audience_appropriate: r() > 0.2 },
  }
}

export function genBrief(issueId: string, personaId: string | null, segment: string, createdBy: string | null, topChannelIds: string[], sourceCount: number) {
  const r = rng(hash(issueId + segment))
  const conf = sourceCount < 50 ? 'insufficient' : sourceCount < 200 ? 'low' : sourceCount < 600 ? 'medium' : 'high'
  const thin = sourceCount < 50
  return {
    issueId, personaId,
    briefType: 'bridge',
    version: 1,
    status: 'draft',
    headline: `Reaching ${segment} on this issue without losing your base`,
    executiveSummary: `Aggregate conversation analysis shows a ${segment} cohort that is reachable through ${pick(r, ['fairness', 'local-control', 'safety'])}-framed messaging. Sentiment is mixed but reply engagement is high, indicating active deliberation rather than entrenched opinion.`,
    confidenceStatement: thin
      ? 'INSUFFICIENT DATA: fewer than 50 source units. Do not activate on this brief — treat as directional only.'
      : `Confidence ${conf}. Based on ${sourceCount} aggregate source units across multiple platforms with cross-platform corroboration.`,
    languageBridges: { use: ['common sense', 'our community', 'fair share'], avoid: ['partisan labels', 'national talking points'] },
    distinctiveVocab: { high_signal: ['kitchen-table', 'accountability'], low_signal: ['paradigm', 'stakeholder'] },
    targetingSpec: { type: 'contextual', keywords: ['local issue', segment], placements: ['local news', 'community forums'], geo: 'state', note: 'Contextual-only — no banned demographic microtargeting.' },
    keyFindings: [
      { finding: 'High reply-depth on cost-of-living angle', confidence: 'medium' },
      { finding: 'Resistance to top-down framing', confidence: 'high' },
    ],
    framingRecs: { lead_with: pick(r, ['fairness', 'safety', 'local-control']), avoid: 'partisan cues' },
    topChannelIds,
    sourceCorpusCount: sourceCount,
    dataGaps: thin ? ['insufficient corpus', 'no cross-platform corroboration'] : ['limited rural sampling'],
    thinDataWarnings: thin ? ['Brief generated on thin data — directional only'] : [],
    overallConfidence: conf,
    confidenceScore: round(thin ? between(r, 0.1, 0.3) : between(r, 0.5, 0.9), 2),
    confidenceBreakdown: { volume: conf, corroboration: thin ? 'low' : 'medium', recency: 'high' },
    generatedByModel: 'dummy-generator-v1',
    validUntil: daysAhead(30),
    createdBy,
  }
}

// Generate aggregate-safe corpus_signals rows for an issue (no raw text).
export function genSignals(issueId: string, n: number) {
  const out = []
  for (let i = 0; i < n; i++) {
    const r = rng(hash(issueId) + i)
    const mft: Record<string, number> = {}
    MFT_KEYS.forEach((k) => { mft[k] = round(between(r, 0, 1), 3) })
    out.push({
      platform: pick(r, [...PLATFORMS]),
      issueId,
      contentSummary: 'aggregate signal (dummy)',
      contentHash: `${issueId.slice(0, 8)}-${i}-${Math.floor(r() * 1e9)}`,
      geoState: pick(r, STATES),
      geoConfidence: round(between(r, 0.3, 0.9), 2),
      sentimentScore: round(between(r, -0.8, 0.8), 3),
      moralFoundations: mft,
      framingTags: sample(r, ['fairness', 'safety', 'liberty', 'community', 'cost'], 2),
      stance: pick(r, [...STANCES]),
      engagementScore: round(between(r, 1, 5000), 2),
      replyDepth: Math.floor(between(r, 0, 12)),
      onTopicScore: round(between(r, 0.4, 1), 2),
      confidenceScore: round(between(r, 0.3, 0.9), 2),
      confidenceFlags: [],
      collectedAt: hoursAgo(Math.floor(between(r, 0, 200))),
    })
  }
  return out
}

// ─── helpers ──────────────────────────────────────────────────────────────
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  return Math.abs(h)
}
function daysAgo(d: number) { return new Date(Date.now() - d * 864e5).toISOString() }
function daysAhead(d: number) { return new Date(Date.now() + d * 864e5).toISOString() }
function hoursAgo(h: number) { return new Date(Date.now() - h * 36e5).toISOString() }

function reframeFor(segment: string, foundation: string): string {
  const map: Record<string, string> = {
    care: `For ${segment}: lead with who gets protected — "this keeps our families and neighbors from getting hurt."`,
    fairness: `For ${segment}: lead with fairness — "everyone should play by the same rules and pay their fair share."`,
    loyalty: `For ${segment}: lead with community — "this is about looking out for our own town, not outside interests."`,
    authority: `For ${segment}: lead with order and responsibility — "responsible stewardship and clear rules everyone can count on."`,
    sanctity: `For ${segment}: lead with what we don't want to degrade — "protecting what makes this place worth living in."`,
    liberty: `For ${segment}: lead with freedom from overreach — "keeping decisions local instead of dictated from far away."`,
  }
  return map[foundation] ?? map.fairness
}
