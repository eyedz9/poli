# PoliReports — Partner Brief

_An honest assessment for a business partner. Written to inform a go/no-go decision, not to sell. Where something is shaky, it's flagged as shaky._

_Date: 2026-06-06_

---

## 1. What it is

PoliReports is a **People Intelligence Engine** for political and advocacy marketing.

In one sentence: it watches what real people are saying online about political/social issues, figures out which issues are heating up and where, identifies who has the most engaged audiences talking about them, builds aggregate profiles of those audiences, and tells a campaign how to phrase its message so it lands with people who don't already agree.

It is **nonpartisan by design** — it sells to anyone (campaigns, advocacy orgs, issue groups, corporate public affairs). The target customer is **down-ballot and advocacy SMBs**: state legislative races, local races, ballot initiatives, advocacy nonprofits. People with real budgets that the enterprise tools (Resonate, Civis, DSPolitical) don't bother serving.

It is built around four engines:

| Engine | What it does | Output |
|---|---|---|
| **Narrative** | Detects emerging issues, scores momentum, tags geography | Ranked list of issues with "emerging vs. saturated" state |
| **Audience Persona** | Builds *aggregate* cohort profiles from public comment corpora | Audience profiles (no individual profiling) |
| **Influencer / CVS** | Ranks channels by a proprietary Comment Vitality Score | Which creators have genuinely engaged comment sections on an issue |
| **Language / Framing** | Applies Moral Foundations Theory to generate cross-partisan reframes | Message briefs that speak to the other side without abandoning your principles |

**Explicitly out of scope for now:** auto-generating the actual ad creative. We stop at the brief.

---

## 2. How it works

```
LISTEN                    INTERPRET                  ADVISE
─────────────────         ──────────────────         ──────────────────
Google Trends      ┐      Narrative engine     ┐     Ranked issues
GDELT (news)       │      (LLM clustering)     │     Audience personas
YouTube comments   ├──►   Persona engine       ├──► Top channels (CVS)
Apify (Reddit)     │      Influencer scoring   │     Reframed message briefs
Bluesky firehose   ┘      Language engine      ┘     Confidence on everything
```

1. **Ingest** — Pull from five public sources on a schedule (n8n orchestrates).
2. **Process** — LLM clusters raw posts into issues; scores momentum; builds aggregate personas; computes Comment Vitality Score per channel; extracts vocabulary and generates moral reframes.
3. **Output** — A dashboard (and eventually API) that hands a strategist a live map: *what's heating up, who's talking, how to talk back.*

The whole stack runs in Docker — Postgres (with pgvector), Redis, the API, the workers, and n8n. Self-contained, runnable on one box.

**Four design commitments that matter:**

- **Aggregate-up, never individual-down.** We profile cohorts, not people. This is the opposite of the Cambridge Analytica approach and it's what keeps us on the right side of CCPA/GDPR.
- **Raw data has a 24-hour TTL.** Author-associated comment data is deleted within a day. This is architectural, not a setting.
- **Confidence on every output.** Every inference carries a confidence score. Thin data (under ~50 comments on an issue) is flagged "do not activate" rather than dressed up as insight.
- **Calibrated against ground truth (US Census API).** Our aggregate persona inferences (geographic, age, income-proxy skews) are validated against actual Census/ACS data for the same geography. When the model says "this cohort skews younger and urban," we can check that against the real population of that area. This turns a probabilistic guess into a guess *with a reality check* — and it's free.

That third point is the entire product philosophy: **a wrong confident answer destroys credibility faster than an honest "we're 70% sure."** The Census calibration (fourth point) is how we earn the right to make confident claims at all.

---

## 3. The gap it fills

The market splits into five silos that don't talk to each other:

1. **Voter file / identity** (L2, TargetSmart, i360) — knows who people are, not what they're saying now.
2. **Programmatic activation / DSPs** (DSPolitical, El Toro) — delivers ads, doesn't generate insight.
3. **Social listening** (Brandwatch, Pulsar, Talkwalker) — brand-tuned, outputs dashboards, dead-ends at insight, no political framing, no path to activation.
4. **Audience/psychographic** (Resonate) — closest competitor, but survey/panel-grounded and slow-moving.
5. **Data science / message testing** (Civis, Swayable) — bespoke, expensive, answers "does this message move opinion," not "what's happening right now."

**The single biggest opening: the listen → activate handoff is manual everywhere.** Listening tools spit out dashboards. Activation tools ingest audiences. The translation between them — *conversation theme → audience hypothesis → message angle → targetable spec* — is done by hand by human strategists, everywhere, today. Nobody has automated that bridge for politics.

Secondary gaps we sit in:
- **Real-time vs. stale** — voter files and panels are structurally lagged; conversations move daily.
- **Politics-native framing** — listening suites are tuned for brands, not issue framing and persuadability.
- **SMB / down-ballot is abandoned** — the incumbents are all enterprise/statewide-and-up.
- **"How do I get into the conversation" is a product nobody sells** — everyone sells audiences or insight, nobody sells the timing+angle+channel recommendation.

---

## 4. How it compares to competitors

| | PoliReports | Resonate | Pulsar / Brandwatch | DSPolitical | Civis |
|---|---|---|---|---|---|
| **Real-time conversation** | ✅ Yes | ❌ Survey/panel-lagged | ✅ Yes | ❌ Voter-file | ❌ Project-based |
| **Politics-native framing** | ✅ Core (MFT) | ⚠️ Partial | ❌ Brand-tuned | ⚠️ | ✅ |
| **Listen → activate loop** | ✅ The wedge | ⚠️ Has activation | ❌ Dead-ends at dashboard | ✅ Activation only | ❌ |
| **Serves down-ballot SMB** | ✅ Beachhead | ❌ Enterprise | ❌ Enterprise | ❌ Statewide+ | ❌ Enterprise |
| **Published price** | Will publish | ❌ Enterprise opaque | ❌ $20K–100K/yr | ❌ Enterprise | ❌ Consulting |
| **X/Twitter coverage** | ❌ Priced out | ✅ | ✅ | n/a | ✅ |
| **Data depth / track record** | ❌ Unproven, thin | ✅ 15K+ attributes | ✅ Trillions of docs | ✅ ~90% match | ✅ Credible |

**Honest read:** We win on speed, price, political-framing, and SMB focus. We lose on data depth, track record, X coverage, and trust. The incumbents have years of data and credibility we don't. **Our advantages are go-to-market advantages (niche, price, speed), not deep technical moats.** Resonate could build the listen→activate bridge if they decided the SMB segment was worth it. Our bet is that they won't bother — and that's a real bet, not a certainty.

---

## 5. Pricing strategy

**The uncomfortable truth first: this is not pure self-serve SaaS at launch. It's a high-touch service with a software layer.** The "trustworthy insight" promise *requires* a human validating outputs, at least early on. Plan pricing around that reality, not around a SaaS fantasy.

Three models, in the order I'd actually roll them out:

1. **Managed / done-for-you (launch here).** $2,500–10,000/mo retainer or per-campaign project fee. Down-ballot and advocacy buyers buy *services*, not software. This is where the early money is, and it lets us validate the engine's output against real human judgment before we expose it raw.

2. **Hybrid SaaS + service (12–18 months in).** $500–2,000/mo tiers with a dashboard, plus optional strategist hours. Customers self-serve the easy stuff, pay for help on the hard stuff.

3. **Self-serve SaaS (the goal, not the start).** $199–499/mo entry tier once the engine is trustworthy enough to stand alone and the dashboard is polished. This is the venture-scalable version — but we get there by earning it, not by launching it.

**Recommendation:** Launch as a managed service. Resist the urge to call it SaaS on day one. The margins are lower and it doesn't scale like software, but it's honest about what the product actually is at MVP, and it generates revenue and validation immediately. Build toward self-serve as the engine proves itself.

---

## 6. Costs — straight numbers

### Data
At MVP scale (~100K comments/mo, ~10K trend queries):

| Source | Cost | Note |
|---|---|---|
| Decodo scraping API (ex-Smartproxy) | ~$30–80/mo | Web Scraping API from **$0.09/1K req**, residential from $2/GB. Cheapest credible option. |
| Bright Data (scraping infra) | ~$75–150/mo | $0.75/1K. Pricier, but **best legal standing** (won Meta/X v. Bright Data) + 98.44% benchmarked success. |
| Apify (Reddit) | ~$30–50/mo | $3/1K. Best for Reddit-specific actors. |
| Google Trends, GDELT, Bluesky, YouTube | $0 | Free public/official sources. |
| **US Census API** | **$0** | Free. Calibration ground-truth, not a raw-data source — see below. |
| **Subtotal (raw data)** | **~$60–200/mo** | Lower end now achievable by routing volume through Decodo. |

Scales sub-linearly with volume. This part is genuinely cheap — and **Decodo pushes the floor lower.**

**On scraping vendors — honest tradeoff, not "cheapest wins."** Decodo's $0.09/1K headline is a real cost lever and we should route bulk, low-sensitivity scraping through it. **But cheaper isn't strictly better in political scraping**, where legal posture matters: Bright Data's value was never the price, it was the courtroom win and the legal cover that comes with it. The right play is **Decodo as primary for cost, Bright Data kept available for legally-sensitive or hard-to-reach targets** — and never single-vendor (a ban event on one provider shouldn't take the product down). Also note Decodo's "from $0.09/1K" is a floor; real cost rises with success rate and harder targets.

**US Census API — the credibility multiplier, and it's free.** Not a raw-data source — a *validation layer*. Every aggregate persona we infer (geo, age, income-proxy skew) gets checked against actual Census/ACS figures for that geography. This is the single cheapest thing we can do to attack our biggest risk (untrustworthy inference, Section 8 risk #1). It costs nothing and it directly underwrites the confidence claims the whole product rests on.

**The cost the data table hides: LLM inference.** The narrative, persona, and language engines all call Claude. Running 100K comments/mo through clustering, persona generation, and reframing is real money — realistically **$200–1,000+/mo** depending on how much we route through the LLM vs. cheap embeddings. This is the single most uncertain cost line and it can dwarf the data cost. Flag it, measure it early, optimize aggressively (embeddings for the cheap work, LLM only where it earns its keep).

### Hosting
- **MVP:** One decent VPS (Hetzner/DigitalOcean), all services in Docker — **~$40–100/mo.** pgvector is RAM-hungry; size for it.
- **Scaling:** Managed Postgres + separate worker boxes when one machine isn't enough — climbs to **$300–800/mo** as customer count grows. Not a near-term problem.

### Management — the real cost
This is where the honest assessment matters most. **The ongoing cost is not infrastructure, it's labor:**

- **Scrapers break constantly.** Sites change layout, deploy anti-bot. This is a permanent maintenance treadmill, not a one-time build.
- **n8n workflows need babysitting.**
- **Outputs need human QA.** The entire pitch is trustworthy insight. That means a human validates personas and reframes before they go to a client — especially early. This is the hidden labor cost that makes it a service, not software.

Realistically, at MVP this is **most of one person's time** (the maintenance + QA), plus development. Infrastructure is rounding error next to that.

**Summary cost picture at MVP:** ~$60–200/mo data (Decodo lowers this), ~$200–1,000/mo LLM, ~$40–100/mo hosting, Census $0 → call it **$300–1,300/mo in hard costs**, dominated by LLM inference. The dominant *real* cost is human time, not the bill.

---

## 7. TAM and revenue projection

**Numbers first, honesty caveat immediately after:** these are bottom-up estimates and scenarios, not forecasts. Political tooling has no clean published market-size figure, so this is built from counting addressable buyers. Treat the magnitude as directional.

### Market size (TAM / SAM / SOM)

The often-quoted "$10.8B US political ad spend (2026)" is **ad spend, not tooling spend** — that's the money that flows to media, not to intelligence products. Using it as our TAM would be dishonest. Built from the bottom up instead:

| Layer | Definition | Estimate | How it's derived |
|---|---|---|---|
| **TAM** | All US political + advocacy intelligence/targeting tooling + services we could plausibly touch | **~$200–400M/yr** | ~10K addressable orgs (funded campaigns, advocacy/501c4s, PACs, public-affairs shops, small political agencies) × blended ~$20–40K annual spend on this category |
| **SAM** | Our actual target: down-ballot + advocacy SMB, US, contextual-first | **~$50–80M/yr** | The slice of the above that is SMB-budget, tool-buying, and underserved by enterprise incumbents |
| **SOM** | Realistically obtainable in 3–5 yrs at single-digit market share | **~$2–6M/yr** | 3–8% of SAM, accounting for churn, cyclicality, and a two-person team |

**The honest headline: this is a "low hundreds of millions" TAM, not a billions TAM.** That's a good, profitable, defensible business. It is not a venture unicorn story, and any pitch that implies otherwise is inflating it.

### Revenue projection (managed-service-first, cyclical)

Built on the Section 5 pricing roadmap. **The defining feature of this projection is the cycle:** 2026 is a midterm year (good launch timing), 2027 is an odd-year trough (the survival test), 2028 is a presidential peak.

| | Year 1 (2026, partial) | Year 2 (2027, trough) | Year 3 (2028, peak) |
|---|---|---|---|
| **Market condition** | Midterm — strong, but launching mid-cycle/late | Odd year — political demand collapses | Presidential — biggest spend year |
| **Model** | Managed service only | Managed (advocacy-heavy) | Hybrid SaaS + service |
| **Paying accounts (blended)** | 3–8 | 8–15 (churn after midterms) | 25–50 |
| **Blended avg revenue/account/yr** | ~$25–35K | ~$25–30K | ~$25–35K (SaaS tiers lower, volume higher) |
| **Revenue (conservative)** | ~$100K | ~$250K | ~$800K |
| **Revenue (base case)** | **~$150K** | **~$350K** | **~$1.1M** |
| **Revenue (optimistic)** | ~$250K | ~$450K | ~$1.5M |

**Read the shape, not just the numbers.** Year 2 is nearly flat — that's not pessimism, it's the structural reality of an odd-year political market. The business survives 2027 on **advocacy and corporate public-affairs retainers**, which are year-round and cycle-independent. If we can't win that non-campaign revenue, Year 2 is a cash crisis, not a plateau. **Winning advocacy/corporate accounts isn't upside — it's the thing that keeps the lights on between elections.**

### Margins

- **Managed service:** ~40–60% gross margin. Labor-heavy (the QA and scraper-maintenance reality from Section 6).
- **SaaS tier:** ~70–80% gross margin, but a small revenue share until Year 3.
- **Blended margin improves over time** as the software does more of the work and self-serve grows — but only if the engine becomes trustworthy enough to reduce the human QA load. That's the central operational bet.

### What would change these numbers

- **Up:** landing one or two anchor advocacy/corporate accounts on annual retainers; the creative-production upsell (ship the ad, not just the brief) materially raising ACV.
- **Down:** scraper maintenance and QA consuming more labor than projected (caps how many accounts two people can serve); LLM inference cost running hot; a platform ban event; failing to win odd-year non-campaign revenue.

---

## 8. My honest opinion — risks and verdict

You asked me not to hold back. Here it is.

**The real risks, no sugarcoating:**

1. **The trustworthiness promise is both the product and the hardest thing to deliver.** Inferring demographics and psychographics from public comments is genuinely probabilistic and often shaky. If we confidently get it wrong in front of a client, the credibility — which is the whole product — is gone. The confidence-scoring discipline is good, but it's a constant fight against the temptation to manufacture precision. **Partially mitigated now** by Census/ACS calibration (Section 2 + 6): we can validate geographic/demographic skews against real population data, which catches the worst confident-but-wrong errors. It does *not* fully solve psychographic inference (values, persuadability) — Census has no data on those — so the risk is reduced, not eliminated.

2. **It's not really SaaS at MVP — it's a service with software.** Lower margins, doesn't scale like software, harder VC story. That's fine for a profitable bootstrapped business; it's a weaker pitch if the plan is to raise and rocket.

3. **The political market is brutally cyclical.** Huge in even years (2026, 2028), dead in odd years. Revenue will be lumpy. Advocacy and corporate-issue money smooths it but is harder to win and slower to close.

4. **We're missing X, where political discourse actually lives.** The API is ~$42K/mo for the firehose — unviable. Scraping X violates their ToS (legal grey zone + ban risk). Bluesky/Reddit/YouTube are real signal, but pretending they fully substitute for X would be dishonest.

5. **The moat is go-to-market, not technology.** Niche focus + price + your creative-production edge. A well-resourced incumbent *could* copy the loop. Our bet is that they won't aim at the SMB segment.

6. **The activation side is still hand-wavy.** Microtargeting bans (Meta/Google) mean we're limited to contextual targeting, which is less precise. And the actual integration to push audiences to ad platforms isn't built yet — it's roadmap, not product.

7. **TAM is "good business," not "unicorn."** 2026 political ad spend is ~$10.8B, but the slice that's down-ballot/advocacy *and* buys tools like this is realistically tens of millions, not billions.

**What's genuinely strong:**

- The gap is real and well-identified. The manual listen→activate handoff is a true unserved need.
- The compliance architecture (aggregate-up, 24h TTL, US-scoped) is a real, defensible differentiator in a space full of legal landmines.
- The Moral Foundations framing engine is differentiated and intellectually honest — it's the most novel piece.
- **Your creative-production background (HTML5/GSAP/video) is the most defensible edge.** Competitors stop at the audience; you can ship the ad. Lean into this hard — it's the thing nobody else in this stack can easily replicate.

**Verdict:** This is a **real product solving a real, validated gap in a defensible niche** — but it is a **high-touch services business with a software moat still under construction**, in a **cyclical market**, with a **maintenance-heavy data layer** and a **trustworthiness promise that's hard to keep at scale.**

It is a good bootstrapped, profitable agency-plus-software business. It is a *harder* venture story. If we go in calling it what it is — a managed intelligence service that's productizing toward SaaS — and lean on the creative-production edge as the wedge, I think it works. If we go in pitching it as a self-serve SaaS rocket, we'll over-promise on margins and scale and get burned on the maintenance and QA reality.

**My recommendation: build it, launch it as a managed service, price it like one, and let the software earn its way to self-serve.**
