// Influencer / CVS engine.
// Real mode (TODO): scrape channel comment sections, compute Comment Vitality
// Score (volume, reply depth, velocity, on-topic %, sentiment spread), tag
// stance per issue. Dummy mode: create a channel + channel_issue_signal linked
// to the issue. No keys.
import { db } from '../lib/db.js'
import { genChannel, genChannelIssueSignal } from '../lib/dummy.js'
import { isDummy } from '../lib/mode.js'

interface InfluencerJob {
  issueId: string
}

export async function process(data: InfluencerJob) {
  if (!isDummy()) {
    throw new Error('influencer engine: real mode not implemented — set USE_DUMMY_DATA=true')
  }
  const { issueId } = data
  const [issue] = await db`SELECT id FROM issues WHERE id = ${issueId}`
  if (!issue) throw new Error(`influencer engine: issue ${issueId} not found`)

  const total = await db`SELECT count(*)::int AS n FROM channels`
  const idx = total[0].n
  const c = genChannel(idx)
  const [chRow] = await db`
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
    ) ON CONFLICT (platform, platform_channel_id) DO UPDATE SET cvs_overall = EXCLUDED.cvs_overall
    RETURNING id`

  const cis = genChannelIssueSignal(chRow.id, issueId, idx)
  await db`
    INSERT INTO channel_issue_signals (
      channel_id, issue_id, stance, stance_confidence, cvs_for_issue,
      post_count, comment_count, first_posted_at, last_posted_at
    ) VALUES (
      ${cis.channelId}, ${cis.issueId}, ${cis.stance}, ${cis.stanceConfidence}, ${cis.cvsForIssue},
      ${cis.postCount}, ${cis.commentCount}, ${cis.firstPostedAt}, ${cis.lastPostedAt}
    ) ON CONFLICT (channel_id, issue_id) DO UPDATE SET cvs_for_issue = EXCLUDED.cvs_for_issue`

  console.log(`[influencer] dummy: channel ${chRow.id} linked to issue ${issueId} (CVS ${cis.cvsForIssue})`)
  return { channelId: chRow.id, cvsForIssue: cis.cvsForIssue }
}
