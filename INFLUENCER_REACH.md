# Feature Spec — Influencer / Channel Reach Engine

_Add-on to the people intelligence engine. Research date: 2026-06-06._
_Companion to MARKET_RESEARCH.md and COMPETITOR_TEARDOWN.md._

## The feature in one line

For each detected issue cluster, surface **which channels/creators drive that conversation** and rank them by **comment-section vitality** — not raw follower count — so a campaign knows *where the real, engageable conversation lives* and can enter it (organically or via creator activation).

This is the natural extension of the narrative engine: _issue → who's talking → where the comments are alive → go there._

---

## Why "robust comment section" is the right metric (and nobody uses it)

Every influencer tool ranks by **follower count + engagement rate (likes/views)**. That measures *broadcast*, not *conversation*. For getting into the conversation, the signal you actually want is:

- **Comment volume per post** (absolute discussion mass)
- **Comment-to-view & comment-to-like ratio** (do people *reply*, not just tap?)
- **Reply depth / threading** (back-and-forth = real debate, not drive-by)
- **Author-responsiveness** (creator replies → community feels heard → entries land)
- **Topical concentration** (are comments *about the issue*, or off-topic noise?)
- **Sentiment + civility mix** (engageable vs. toxic/locked)
- **Velocity** (comments still arriving = live window, not dead thread)

Bundle these into a **Comment Vitality Score (CVS)**. That's the proprietary metric. Reach tools don't compute it; comment tools don't do discovery. The intersection is empty.

---

## Market landscape

### A. Influencer discovery (reach-first, NOT comment-first)
- **HypeAuditor, CreatorIQ, Modash** — 10–20M creator profiles, audience overlap, brand-safety, bot detection. ~$200–600/mo; serve $50K–$500K brand budgets.
- **ChannelCrawler** — 22M+ YouTube channels, 400+ AI subcategories, filter by engagement rate/growth/language. Good discovery rail.
- **Apify YouTube Niche Finder / Market Intelligence** — keyword→channels w/ comment counts + topic categories via API. Cheap, scriptable.
- **Phyllo / TikTok Creator Search Insights API** — creator-level follower/engagement/category/audience via API.
- **Gap:** these **filter OUT political creators** as brand-safety risk, and rank by reach. None scope to *issue* + *comment vitality*.

### B. Comment-section analysis (creator-first, NOT discovery)
- **BeyondComments** — YouTube-only, sentiment + reply-priority queue. But for *your own* channel.
- **Senti-meter, PainOnSocial** — Reddit comment quality scoring (upvote patterns, discussion quality, problem-intensity).
- **Awario, Brand24** — multi-platform mention/sentiment incl. Reddit/YouTube/TikTok.
- **Gap:** all are **inward-facing** (analyze a channel you own/track) — none do *discovery* ("find me the alive comment sections on issue X").

### C. Political/advocacy creator activation
- **People First (peoplefirst.cc)** — largest opt-in creator DB in social impact; end-to-end political creator campaigns since 2019. The activation incumbent here.
- **Good Influence** — creator-for-good marketplace.
- **Gap:** these are **managed agencies with rosters**, not real-time issue→creator discovery engines. You'd compete on *automated discovery + comment intelligence*, then optionally hand off to (or undercut) their activation.

---

## Where this slots into the product

```
Narrative engine detects issue cluster
        │
        ▼
Channel/Creator discovery  ──► pull creators talking about the issue
  (ChannelCrawler / Apify / TikTok+YouTube API / X / Reddit)
        │
        ▼
Comment Vitality scoring   ──► scrape comment sections, compute CVS
  (your proprietary metric)
        │
        ▼
Rank + classify            ──► allies / persuadable / opposition / neutral
        │                        + "engageable window open?" (velocity)
        ▼
Action layer
  • Organic: where + how to enter the conversation (your creative briefs)
  • Paid: creator-activation shortlist (hand to People First-style, or build marketplace)
  • Targeting: channel/topic → contextual ad placements (ties to audience engine)
```

CVS feeds three existing pillars: **organic entry** (the "get in the conversation" product), **creator activation**, and **contextual ad placement** (advertise *around* the alive conversation — compliance-safe since it's contextual, not microtargeting).

---

## Compliance (creator/political-specific — design in early)

- **FEC**: paid political creator content can require disclaimers / disclosure; coordinated spend may count as a contribution. Track paid vs. organic from day one.
- **FTC**: #ad / material-connection disclosure mandatory for sponsored creators.
- **Platform political-creator rules** vary (TikTok bans paid political branded content; Meta/Google have political-advertiser verification). Organic engagement ≠ paid promo — keep the line clean in-product.
- **Scraping comments**: public, no-login = legal (per Bright Data ruling), but comments are user PII → aggregate/score, minimize stored identifiable text, US-scope, honor platform API ToS where used.

---

## MVP cut

1. Pick **2 platforms first: YouTube + Reddit** — richest, most scrapable comment structures, clearest threading. (TikTok comments harder/ToS-restricted; X via API.)
2. Issue cluster (from narrative engine) → keyword/topic → **ChannelCrawler + Apify** pull candidate channels/threads.
3. Scrape recent comment sections → compute **CVS v1** (volume, reply-ratio, depth, velocity, on-topic %, sentiment).
4. Rank channels per issue; tag stance (ally/opposition/neutral) via LLM.
5. Output: **"Top 20 live conversations on Issue X, ranked by engageability,"** each with entry-angle brief + contextual-placement spec.
6. Later: TikTok/X, creator-activation marketplace, audience-overlap dedupe (avoid the ~35% wasted-overlap problem the industry has).

---

## Competitive takeaway

Three categories exist — reach discovery, comment analysis, political creator agencies — and **none connect issue detection → creator discovery → comment-section vitality → activation.** "Comment Vitality Score" tied to live issues is a genuinely novel, defensible metric. Pair it with the creative auto-gen edge and the contextual-targeting engine, and the influencer feature isn't a bolt-on — it's a third leg of the same loop (audience / creative / **conversation entry-points**).
