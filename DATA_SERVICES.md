# Data Services Map — Available Providers for the People Intelligence Engine

_Research date: 2026-06-06. Honest assessment: what works, what's expensive, what to avoid at MVP._
_Creative auto-gen is OUT of scope. Focus: data gathering for actionable insight._

---

## Guiding principle

**Actionable insight, not data for data's sake.** Every service below is rated against: does it get us closer to telling a campaign *what conversation is happening, who's in it, and how to speak to them*? If it doesn't serve that, skip it — even if it's cheap.

**Honest disclaimer upfront:** Some signal inference (especially media habits and exact demographics from comments) is probabilistic, not certain. We will state confidence levels in the product. A wrong confident answer destroys credibility faster than an honest "we're 70% sure."

---

## Platform APIs (direct)

### YouTube Data API v3
- **What:** video metadata, comments, search by keyword/topic, channel stats.
- **Cost:** FREE. Quota-based (10,000 units/day default; search.list = 100 units, comments.list = 1 unit). Can apply for higher quota.
- **What we get:** comment threads per video, video engagement stats, channel subscriber counts, search by keyword → relevant channels.
- **Limitations:** no comment *sentiment* or *threading depth* natively — that's our processing layer.
- **Verdict:** ✅ Core source. Use for discovery + comment extraction. Start here.

### Reddit API (official)
- **What:** posts, comments, subreddit data, search.
- **Cost:** Free tier (100 req/min OAuth) = non-commercial only. **Commercial = $12,000/mo for 50M calls + Reddit approval required.** Applications for commercial use frequently rejected for "competitive intelligence"-looking use cases.
- **Limitations:** The commercial gate is real. Reddit aggressively kills anything that looks like scraping.
- **Workaround:** Apify Reddit scraper actors ($3–3.40/1K results) = scraping public data (legally defensible post-Bright Data ruling). Slower but no commercial API approval needed.
- **Verdict:** ✅ Critical source (Reddit = raw political opinion, no filters). ⚠️ Use Apify scraper at MVP, not official commercial API.

### X (Twitter) API
- **What:** posts, search, user timelines, trending.
- **Cost:** Pay-per-use since Feb 2026. Reading a post ≈ $0.005/request. **Enterprise (full firehose) = $42,000/mo minimum.** Academic research = free for approved institutions (non-commercial only).
- **Limitations:** Prohibitively expensive for a startup. The firehose you'd need to do real political trend detection = $500K+/yr.
- **Honest take:** X is where political discourse lives, but the API cost makes it unviable at MVP. Scraping (Bright Data, Apify) costs much less and is legally defensible for public data — **but X's ToS prohibits scraping** specifically, creating a ToS risk even if not a legal one. Can lead to IP bans.
- **Verdict:** ⚠️ Expensive + risky. **Deprioritize at MVP.** Monitor via a scraping provider if critical. Revisit when revenue justifies the firehose.

### TikTok Research API
- **What:** public video data, comments, trending topics.
- **Cost:** Free — **but academic/non-commercial affiliation required.** Commercial use denied.
- **Limitations:** No commercial path. Comments API is restricted. TikTok bans paid political branded content outright.
- **Verdict:** ❌ Not available for a commercial political platform. Skip at MVP.

### Bluesky / AT Protocol Firehose
- **What:** real-time full public activity stream. Open by design.
- **Cost:** FREE. No auth required for public data. Excellent developer access.
- **Limitations:** smaller user base than X (but growing fast for political discourse post-X). Less politically mainstream.
- **Verdict:** ✅ Hidden gem. Free, legally clean, real-time. Add early. Growing relevance.

---

## Scraping infrastructure providers

These are the "rails" — they handle anti-bot, proxy rotation, compliance, and reliability so you don't.

### Bright Data (luminati-io)
- **What:** 400M+ residential IPs, 437+ pre-built scrapers (YouTube, Reddit, TikTok, Facebook, X). Pay-per-success model.
- **Cost:** **$0.75/1K requests** base, pay only for successful results. 98.44% success rate (independently benchmarked).
- **Legal posture:** Named defendant in the landmark Meta/X v. Bright Data case — **won.** Public data scraping ruled legal. Best legal standing in the industry.
- **Political ToS risk:** ToS breach ≠ illegal, but platforms can ban IPs. Bright Data manages this via rotating residential proxies.
- **Verdict:** ✅ **Primary scraping infrastructure.** Most reliable, best legal backing, covers all our target platforms.

### Apify
- **What:** marketplace of scraper "actors" for specific sites. YouTube, Reddit, TikTok, news, etc. Pay-per-compute-unit.
- **Cost:** YouTube scraper ≈ $2.40/1K videos. Reddit scraper ≈ $3.00–3.40/1K results. Monthly plans + PAYG.
- **Good for:** Reddit comments (best option given commercial API cost), YouTube channel/comment discovery, one-off scrape jobs.
- **Verdict:** ✅ **Best Reddit comments solution at MVP.** Good for modular, targeted scrapes.

### ScraperAPI / ScrapeOps
- **What:** rotating proxy + scraping API, simpler stack than Bright Data.
- **Cost:** cheaper entry point than Bright Data, lower scale ceiling.
- **Verdict:** ⚠️ Fine for early prototyping, outgrown quickly. Start with Apify for platform-specific actors.

---

## Trend / issue-pulse providers

### Google Trends (official API — alpha)
- **What:** scaled search interest data, back 1800 days (5 years). Daily/weekly/monthly/yearly. Geo filter (region + sub-region). Compare up to 5 terms.
- **Cost:** FREE. Launched officially in alpha 2025. Requires Google Cloud auth.
- **What we get:** leading indicator of issue salience. Searches precede social discussion by 24–72h. Regional breakdown shows where an issue is heating up before it appears in comments.
- **Limitations:** alpha = quota limits, limited endpoints. Not real-time (hourly at best). No demographic breakdown.
- **Verdict:** ✅ **Must-have.** Free, Google-blessed, geo-specific, leading indicator. Integrate day one.

### Glimpse (Google Trends data layer)
- **What:** unofficial Google Trends enrichment — adds volume estimates, related trends, breakout alerts.
- **Cost:** ~$79–499/mo plans.
- **Verdict:** ⚠️ Nice-to-have for richer Trends data. Evaluate post-MVP.

### NewsWhip
- **What:** real-time prediction of which news stories will go viral. Journalist engagement, share velocity.
- **Cost:** enterprise (~$1,000+/mo estimated, no public pricing).
- **What we get:** early signal on news-driven issue spikes before social catches up. Political/news-centric.
- **Verdict:** ✅ Strong complement to Google Trends for news-driven issues. Evaluate for journalism/political news angle.

### GDELT Project
- **What:** free, open database of global news events, themes, sentiment, geography — updated every 15 minutes.
- **Cost:** FREE. Runs on Google BigQuery (query costs only).
- **What we get:** near-real-time news narrative tracking at scale. 100+ countries, 65+ languages. Full political event/tone/geography tagging.
- **Limitations:** noise-heavy, requires filtering. Not social-native.
- **Verdict:** ✅ **Underused gem. Free, huge, real-time.** Add as a news/narrative signal layer alongside social.

---

## Audience / voter data (contextual enrichment only — no individual profiles)

### TargetSmart or L2 (segment-level data purchase)
- **What:** licensed voter file aggregate data — issue polling, issue salience by geography.
- **Cost:** variable per pull; manageable for segment-level queries.
- **Use:** ground-truth check on demographic distribution in a geography. NOT individual profiling — just: "what does the voting-age population in zip X look like?"
- **Verdict:** ✅ Narrow use. Geo-calibration of persona inferences. Keep it statistical, not individual.

---

## What we're NOT doing (and why)

| Service | Why skip |
|---|---|
| Brandwatch / Pulsar licensed firehose | $20K–$100K/yr. At MVP, build on Bright Data + Apify for a fraction. Revisit if narrative engine needs to scale. |
| X Enterprise firehose | $42K/mo minimum. Unavoidable eventually for real X coverage, but not at MVP. |
| Reddit commercial API | $12K/mo + approval likely rejected. Use Apify scraper instead. |
| TikTok Research API | Non-commercial only. No path for a commercial political platform. |
| Facebook Graph API | Only works for business/creator accounts you own. Zero value for public political comment scraping. |

---

## Recommended MVP data stack

```
TREND / PULSE (leading indicators)
├── Google Trends API (alpha)  → free, geo, 5yr history
├── GDELT Project              → free, real-time news narrative
└── NewsWhip (optional)        → news virality prediction

SOCIAL CONVERSATION (lagging but rich)
├── YouTube Data API v3        → free, comments + channel discovery
├── Apify Reddit scrapers      → $3/1K, best Reddit comment access
└── Bluesky AT Protocol        → free, real-time, growing

SCRAPING INFRASTRUCTURE
└── Bright Data                → $0.75/1K, best legal standing, covers all platforms

CALIBRATION / GEO
└── Google Trends (geo) + GDELT geo tags → validate where issues are hot
```

**Monthly cost estimate at MVP scale (100K comments/mo, 10K trend queries):**
- Bright Data: ~$75–150
- Apify: ~$30–50
- Google Trends / GDELT / Bluesky: $0
- YouTube API: $0
- **Total: ~$100–200/mo data cost at MVP.** Scales sub-linearly with volume.

---

## Actionable insight guardrails

Data is only the input. These rules keep the output honest:

1. **State confidence.** Every persona attribute carries a confidence score (high/medium/low). Not every inference is equal — age range is more reliable than income estimate.
2. **Show the evidence.** Every insight links to the comment clusters that generated it. User can drill down. Not a black box.
3. **Flag thin data.** If an issue has fewer than 50 comments in the corpus, flag it as "insufficient signal — do not activate." Don't manufacture false precision.
4. **Distinguish signal from noise.** Single-platform spike ≠ real trend. Cross-platform corroboration required before "emerging issue" alert fires.
5. **No fabrication.** If we can't reliably infer a demographic, we say so. The platform's credibility lives or dies on this.
