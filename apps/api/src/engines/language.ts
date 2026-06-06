// Language / Framing engine.
// Real mode (TODO): vocab extraction + MFT scoring + LLM reframe generation
// with a fidelity guardrail. Dummy mode: deterministic brief + frame from the
// dummy generators so the full trigger→queue→worker→DB→dashboard loop works
// with no API keys.
import { db } from '../lib/db.js'
import { genBrief, genFrame } from '../lib/dummy.js'
import { isDummy } from '../lib/mode.js'

interface BriefJob {
  issueId: string
  position?: string
  principle?: string
  targetSegment?: string
  createdBy?: string
}

export async function process(data: BriefJob) {
  if (!isDummy()) {
    // TODO real: extract distinctive vocab, score MFT, generate reframes via
    // Claude, run the fidelity check, persist. Requires ANTHROPIC_API_KEY.
    throw new Error('language engine: real mode not implemented — set USE_DUMMY_DATA=true')
  }

  const { issueId, position, principle, targetSegment = 'persuadable independents', createdBy = null } = data
  const [issue] = await db`SELECT id, total_source_units FROM issues WHERE id = ${issueId}`
  if (!issue) throw new Error(`language engine: issue ${issueId} not found`)

  const [persona] = await db`
    SELECT id FROM personas WHERE issue_id = ${issueId} ORDER BY confidence_score DESC LIMIT 1`
  const chRows = await db`
    SELECT channel_id FROM channel_issue_signals WHERE issue_id = ${issueId}
    ORDER BY cvs_for_issue DESC LIMIT 3`
  const topChannelIds = chRows.map((r: any) => r.channelId)
  const personaId = persona?.id ?? null
  const sourceCount = issue.totalSourceUnits as number

  const f = genFrame(issueId, personaId, targetSegment, 0)
  await db`
    INSERT INTO frames (
      issue_id, persona_id, segment, dominant_frame, vocab_distinctive, mft_scores,
      reframe_text, foundation_targeted, fidelity_score, fidelity_verified, fidelity_checklist
    ) VALUES (
      ${f.issueId}, ${f.personaId}, ${f.segment}, ${f.dominantFrame}, ${f.vocabDistinctive},
      ${db.json(f.mftScores)}, ${f.reframeText}, ${f.foundationTargeted}, ${f.fidelityScore},
      ${f.fidelityVerified}, ${db.json(f.fidelityChecklist)}
    )`

  const b = genBrief(issueId, personaId, targetSegment, createdBy, topChannelIds, sourceCount)
  // Fold the operator's stated position/principle into the brief.
  if (position) b.executiveSummary = `Your position: "${position}". ${b.executiveSummary}`
  if (principle) b.confidenceStatement = `Principle preserved: "${principle}". ${b.confidenceStatement}`

  const [row] = await db`
    INSERT INTO briefs (
      issue_id, persona_id, brief_type, version, status, headline, executive_summary,
      confidence_statement, language_bridges, distinctive_vocab, targeting_spec, key_findings,
      framing_recs, top_channel_ids, source_corpus_count, data_gaps, thin_data_warnings,
      overall_confidence, confidence_score, confidence_breakdown, generated_by_model,
      valid_until, created_by
    ) VALUES (
      ${b.issueId}, ${b.personaId}, ${b.briefType}, ${b.version}, ${b.status}, ${b.headline},
      ${b.executiveSummary}, ${b.confidenceStatement}, ${db.json(b.languageBridges)},
      ${db.json(b.distinctiveVocab)}, ${db.json(b.targetingSpec)}, ${db.json(b.keyFindings)},
      ${db.json(b.framingRecs)}, ${b.topChannelIds}, ${b.sourceCorpusCount}, ${b.dataGaps},
      ${b.thinDataWarnings}, ${b.overallConfidence}, ${b.confidenceScore},
      ${db.json(b.confidenceBreakdown)}, ${b.generatedByModel}, ${b.validUntil}, ${b.createdBy}
    ) RETURNING id`

  console.log(`[language] generated brief ${row.id} for issue ${issueId} (${b.overallConfidence})`)
  return { briefId: row.id, confidence: b.overallConfidence }
}
