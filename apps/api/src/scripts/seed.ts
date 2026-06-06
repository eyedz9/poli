// Seed the database with realistic dummy data so the whole platform is
// demonstrable end-to-end with NO external API keys.
//
//   npm run seed          (from apps/api, with DATABASE_URL set)
//
// Idempotent-ish: clears the demo tables first, then repopulates.

import bcrypt from 'bcryptjs'
const { hash } = bcrypt
import { db } from '../lib/db.js'
import {
  ISSUE_CATALOG, genIssue, genPersona, genChannel,
  genChannelIssueSignal, genFrame, genBrief, genSignals,
} from '../lib/dummy.js'

const SEGMENTS = ['persuadable independents', 'cost-conscious moderates', 'civic-minded conservatives', 'pragmatic progressives']

async function main() {
  console.log('[seed] starting…')

  await db.begin(async (sql) => {
    // ─── wipe demo data (respect FK order) ───────────────────────────────
    await sql`TRUNCATE frames, briefs, channel_issue_signals, channels, personas, corpus_signals, issue_snapshots, issues, audit_events RESTART IDENTITY CASCADE`
    await sql`DELETE FROM users WHERE email LIKE '%@polireports.local'`

    // ─── demo users ──────────────────────────────────────────────────────
    const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@polireports.local'
    const adminPass = process.env.SEED_ADMIN_PASSWORD ?? 'DevAdminPass123!'
    const adminHash = await hash(adminPass, 12)
    const clientHash = await hash('DevClientPass123!', 12)
    const [admin] = await sql`
      INSERT INTO users (email, password_hash, role)
      VALUES (${adminEmail}, ${adminHash}, 'admin')
      RETURNING id`
    await sql`
      INSERT INTO users (email, password_hash, role)
      VALUES ('client@polireports.local', ${clientHash}, 'client')`
    console.log(`[seed] users: ${adminEmail} (admin), client@polireports.local (client)`)

    // ─── channels (global pool) ──────────────────────────────────────────
    const channelIds: string[] = []
    for (let i = 0; i < 12; i++) {
      const c = genChannel(i)
      const [row] = await sql`
        INSERT INTO channels (
          platform, platform_channel_id, display_name, channel_url, channel_type,
          subscriber_proxy, cvs_overall, cvs_volume, cvs_reply_depth, cvs_velocity,
          cvs_on_topic_pct, cvs_sentiment_spread, cvs_computed_at, topic_tags,
          primary_geo, geo_confidence, sample_size, confidence, last_scraped_at
        ) VALUES (
          ${c.platform}, ${c.platformChannelId}, ${c.displayName}, ${c.channelUrl}, ${c.channelType},
          ${c.subscriberProxy}, ${c.cvsOverall}, ${c.cvsVolume}, ${c.cvsReplyDepth}, ${c.cvsVelocity},
          ${c.cvsOnTopicPct}, ${c.cvsSentimentSpread}, ${c.cvsComputedAt}, ${c.topicTags},
          ${c.primaryGeo}, ${c.geoConfidence}, ${c.sampleSize}, ${c.confidence}, ${c.lastScrapedAt}
        ) RETURNING id`
      channelIds.push(row.id)
    }
    console.log(`[seed] channels: ${channelIds.length}`)

    // ─── issues + dependents ─────────────────────────────────────────────
    let nPersonas = 0, nSignals = 0, nFrames = 0, nBriefs = 0, nCis = 0
    for (let idx = 0; idx < ISSUE_CATALOG.length; idx++) {
      const seed = ISSUE_CATALOG[idx]
      const iss = genIssue(seed, idx)
      const [issueRow] = await sql`
        INSERT INTO issues (
          slug, label, description, themes, status, confidence, geo_scope, geo_codes,
          primary_state, momentum_score, momentum_delta_24h, momentum_delta_7d,
          velocity_score, saturation_index, total_source_units, platform_breakdown,
          cross_platform_count, data_confidence, google_trends_terms, seed_keywords,
          operator_verified
        ) VALUES (
          ${iss.slug}, ${iss.label}, ${iss.description}, ${iss.themes}, ${iss.status},
          ${iss.confidence}, ${iss.geoScope}, ${iss.geoCodes}, ${iss.primaryState},
          ${iss.momentumScore}, ${iss.momentumDelta24h}, ${iss.momentumDelta7d},
          ${iss.velocityScore}, ${iss.saturationIndex}, ${iss.totalSourceUnits},
          ${db.json(iss.platformBreakdown)}, ${iss.crossPlatformCount}, ${iss.dataConfidence},
          ${iss.googleTrendsTerms}, ${iss.seedKeywords}, ${iss.operatorVerified}
        ) RETURNING id`
      const issueId = issueRow.id

      // corpus_signals (capped sample so seeding stays fast)
      const sigCount = Math.min(iss.totalSourceUnits, 40)
      for (const s of genSignals(issueId, sigCount)) {
        await sql`
          INSERT INTO corpus_signals (
            platform, issue_id, content_summary, content_hash, geo_state, geo_confidence,
            sentiment_score, moral_foundations, framing_tags, stance, engagement_score,
            reply_depth, on_topic_score, confidence_score, confidence_flags, collected_at
          ) VALUES (
            ${s.platform}, ${s.issueId}, ${s.contentSummary}, ${s.contentHash}, ${s.geoState},
            ${s.geoConfidence}, ${s.sentimentScore}, ${db.json(s.moralFoundations)}, ${s.framingTags},
            ${s.stance}, ${s.engagementScore}, ${s.replyDepth}, ${s.onTopicScore},
            ${s.confidenceScore}, ${s.confidenceFlags}, ${s.collectedAt}
          ) ON CONFLICT DO NOTHING`
        nSignals++
      }

      // issue snapshots (momentum history, last 7 points)
      for (let d = 6; d >= 0; d--) {
        await sql`
          INSERT INTO issue_snapshots (issue_id, snapshot_at, momentum_score, source_count_6h, source_dist)
          VALUES (${issueId}, ${new Date(Date.now() - d * 864e5).toISOString()},
                  ${Number((iss.momentumScore * (0.7 + 0.05 * (7 - d))).toFixed(2))},
                  ${Math.floor(iss.totalSourceUnits / 12)}, ${db.json(iss.platformBreakdown)})`
      }

      // personas (thin issues get 1 low-confidence; others 2-3)
      const personaIds: string[] = []
      const nP = seed.thin ? 1 : 2 + (idx % 2)
      for (let v = 0; v < nP; v++) {
        const p = genPersona(seed.slug, issueId, v)
        const [pr] = await sql`
          INSERT INTO personas (
            issue_id, label, version, source_unit_count, platform_sources,
            date_range_start, date_range_end, age_skew, urban_rural_skew, geo_concentration,
            income_proxy_skew, dominant_values, primary_concerns, trusted_sources, rhetoric_style,
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
        personaIds.push(pr.id)
        nPersonas++
      }

      // channel_issue_signals: link top 3-5 channels to this issue
      const linked = channelIds.slice(idx % 4, (idx % 4) + 4)
      for (let k = 0; k < linked.length; k++) {
        const cis = genChannelIssueSignal(linked[k], issueId, k)
        await sql`
          INSERT INTO channel_issue_signals (
            channel_id, issue_id, stance, stance_confidence, cvs_for_issue,
            post_count, comment_count, first_posted_at, last_posted_at
          ) VALUES (
            ${cis.channelId}, ${cis.issueId}, ${cis.stance}, ${cis.stanceConfidence}, ${cis.cvsForIssue},
            ${cis.postCount}, ${cis.commentCount}, ${cis.firstPostedAt}, ${cis.lastPostedAt}
          ) ON CONFLICT DO NOTHING`
        nCis++
      }

      // frames + briefs (one per segment for non-thin; thin issue gets a thin brief)
      const segs = seed.thin ? [SEGMENTS[0]] : SEGMENTS.slice(0, 2)
      for (const seg of segs) {
        const persona = personaIds[0] ?? null
        const f = genFrame(issueId, persona, seg, 0)
        await sql`
          INSERT INTO frames (
            issue_id, persona_id, segment, dominant_frame, vocab_distinctive,
            mft_scores, reframe_text, foundation_targeted, fidelity_score,
            fidelity_verified, fidelity_checklist
          ) VALUES (
            ${f.issueId}, ${f.personaId}, ${f.segment}, ${f.dominantFrame}, ${f.vocabDistinctive},
            ${db.json(f.mftScores)}, ${f.reframeText}, ${f.foundationTargeted}, ${f.fidelityScore},
            ${f.fidelityVerified}, ${db.json(f.fidelityChecklist)}
          )`
        nFrames++

        const b = genBrief(issueId, persona, seg, admin.id, linked.slice(0, 3), iss.totalSourceUnits)
        await sql`
          INSERT INTO briefs (
            issue_id, persona_id, brief_type, version, status, headline, executive_summary,
            confidence_statement, language_bridges, distinctive_vocab, targeting_spec,
            key_findings, framing_recs, top_channel_ids, source_corpus_count, data_gaps,
            thin_data_warnings, overall_confidence, confidence_score, confidence_breakdown,
            generated_by_model, valid_until, created_by
          ) VALUES (
            ${b.issueId}, ${b.personaId}, ${b.briefType}, ${b.version}, ${b.status}, ${b.headline},
            ${b.executiveSummary}, ${b.confidenceStatement}, ${db.json(b.languageBridges)},
            ${db.json(b.distinctiveVocab)}, ${db.json(b.targetingSpec)}, ${db.json(b.keyFindings)},
            ${db.json(b.framingRecs)}, ${b.topChannelIds}, ${b.sourceCorpusCount}, ${b.dataGaps},
            ${b.thinDataWarnings}, ${b.overallConfidence}, ${b.confidenceScore},
            ${db.json(b.confidenceBreakdown)}, ${b.generatedByModel}, ${b.validUntil}, ${b.createdBy}
          )`
        nBriefs++
      }

      // backfill issue array references
      await sql`UPDATE issues SET audience_persona_ids = ${personaIds}, influencer_ids = ${linked} WHERE id = ${issueId}`
    }

    console.log(`[seed] issues: ${ISSUE_CATALOG.length}, personas: ${nPersonas}, signals: ${nSignals}, channel_issue_signals: ${nCis}, frames: ${nFrames}, briefs: ${nBriefs}`)
  })

  console.log('[seed] done ✓')
  await db.end()
}

main().catch((err) => {
  console.error('[seed] FAILED:', err)
  process.exit(1)
})
