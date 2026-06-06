// Persona engine.
// Real mode (TODO): aggregate cohort profiling via batch LLM inference + MFT
// aggregation, confidence gating (min 50 source units). Dummy mode: generate a
// fresh aggregate persona for an issue from the dummy generators. No keys.
import { db } from '../lib/db.js'
import { genPersona } from '../lib/dummy.js'
import { isDummy } from '../lib/mode.js'

interface PersonaJob {
  issueId: string
}

export async function process(data: PersonaJob) {
  if (!isDummy()) {
    throw new Error('persona engine: real mode not implemented — set USE_DUMMY_DATA=true')
  }
  const { issueId } = data
  const [issue] = await db`SELECT id, slug, total_source_units FROM issues WHERE id = ${issueId}`
  if (!issue) throw new Error(`persona engine: issue ${issueId} not found`)

  // Confidence gate: aggregate personas require >= 50 source units.
  if ((issue.totalSourceUnits ?? 0) < 50) {
    console.log(`[persona] issue ${issueId} below 50-unit threshold — skipping (thin data)`)
    return { skipped: true, reason: 'insufficient_source_units' }
  }

  const existing = await db`SELECT count(*)::int AS n FROM personas WHERE issue_id = ${issueId}`
  const variant = existing[0].n
  const p = genPersona(issue.slug, issueId, variant)
  const [row] = await db`
    INSERT INTO personas (
      issue_id, label, version, source_unit_count, platform_sources, date_range_start,
      date_range_end, age_skew, urban_rural_skew, geo_concentration, income_proxy_skew,
      dominant_values, primary_concerns, trusted_sources, rhetoric_style,
      mft_care, mft_fairness, mft_loyalty, mft_authority, mft_sanctity, mft_liberty, mft_primary,
      stance_on_issue, stance_intensity, persuadability_score, persuadability_evidence,
      receptive_frames, resistant_frames, resonant_vocabulary,
      confidence, confidence_score, confidence_flags, expires_at
    ) VALUES (
      ${p.issueId}, ${p.label}, ${p.version}, ${p.sourceUnitCount}, ${p.platformSources},
      ${p.dateRangeStart}, ${p.dateRangeEnd}, ${p.ageSkew}, ${p.urbanRuralSkew}, ${p.geoConcentration},
      ${p.incomeProxySkew}, ${p.dominantValues}, ${p.primaryConcerns}, ${p.trustedSources}, ${p.rhetoricStyle},
      ${p.mftCare}, ${p.mftFairness}, ${p.mftLoyalty}, ${p.mftAuthority}, ${p.mftSanctity}, ${p.mftLiberty}, ${p.mftPrimary},
      ${p.stanceOnIssue}, ${p.stanceIntensity}, ${p.persuadabilityScore}, ${p.persuadabilityEvidence},
      ${p.receptiveFrames}, ${p.resistantFrames}, ${p.resonantVocabulary},
      ${p.confidence}, ${p.confidenceScore}, ${p.confidenceFlags}, ${p.expiresAt}
    ) RETURNING id`
  console.log(`[persona] dummy: generated persona ${row.id} for issue ${issueId}`)
  return { personaId: row.id, confidence: p.confidence }
}
