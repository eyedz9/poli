// Thin API client. Token persisted in localStorage. All calls go through the
// Vite dev proxy (/api → API container) so there are no CORS issues in dev.

const TOKEN_KEY = 'polireports_token'

export const getToken = () => localStorage.getItem(TOKEN_KEY)
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t)
export const clearToken = () => localStorage.removeItem(TOKEN_KEY)

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = getToken()
  const res = await fetch(`/api${path}`, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  })
  if (res.status === 401) {
    clearToken()
    throw new Error('unauthorized')
  }
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${res.status}: ${body}`)
  }
  return res.json() as Promise<T>
}

export interface Issue {
  id: string
  slug: string
  label: string
  description?: string
  status: string
  confidence: string
  momentumScore: number
  momentumDelta24h?: number
  totalSourceUnits: number
  crossPlatformCount?: number
  dataConfidence?: string
  geoScope?: string
  primaryState?: string
  activationBlocked: boolean
  lastSignalAt?: string
  themes?: string[]
}

export interface Persona {
  id: string
  label: string
  sourceUnitCount: number
  ageSkew?: string
  urbanRuralSkew?: string
  incomeProxySkew?: string
  dominantValues?: string[]
  primaryConcerns?: string[]
  mftPrimary?: string
  stanceOnIssue?: string
  persuadabilityScore?: number
  receptiveFrames?: string[]
  resistantFrames?: string[]
  resonantVocabulary?: string[]
  confidence: string
  confidenceScore: number
}

export interface ChannelSignal {
  id: string
  cvsForIssue: number
  stance?: string
  commentCount?: number
  postCount?: number
  channel: { displayName: string; platform: string; subscriberProxy: number; channelUrl?: string; cvsOverall: number }
}

export interface Brief {
  id: string
  headline: string
  executiveSummary: string
  confidenceStatement: string
  overallConfidence: string
  confidenceScore: number
  thinDataWarnings?: string[]
  dataGaps?: string[]
  createdAt?: string
}

export interface Frame {
  id: string
  segment?: string
  dominantFrame?: string
  foundationTargeted?: string
  reframeText?: string
  fidelityScore?: number
  fidelityVerified?: boolean
  vocabDistinctive?: string[]
}

export interface IssueDetail {
  issue: Issue
  personas: Persona[]
  channels: ChannelSignal[]
  briefs: Brief[]
  frames: Frame[]
}

export const api = {
  login: (email: string, password: string) =>
    req<{ token: string; user: any }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  issues: () => req<Issue[]>('/issues'),
  detail: (id: string) => req<IssueDetail>(`/issues/${id}/detail`),
  generateBrief: (body: { issueId: string; position: string; principle: string; targetSegment: string }) =>
    req<{ jobId: string }>('/briefs/generate', { method: 'POST', body: JSON.stringify(body) }),
  briefs: (issueId: string) => req<Brief[]>(`/briefs/issue/${issueId}`),
}
