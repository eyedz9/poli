# People Intelligence Engine — Market Research & Gap Analysis

_Political programmatic + social marketing intelligence platform. Research date: 2026-06-06._

## Thesis (what you want to build)

A **people intelligence engine**: continuously scrape web + social to detect what issues real people are actively talking about, identify openings to enter the conversation on social, and convert those signals into hyper-targeted display + social audiences for activation. The differentiator is the **closed loop**: _listen → interpret → activate → measure → relisten_, in near-real-time, purpose-built for political/advocacy.

---

## The market today

The space splits into **five silos that do not talk to each other**. Nobody owns the full loop for politics.

### 1. Political data / voter files (identity layer)
- **L2, TargetSmart, Catalist** (D-aligned), **i360 / DataTrust** (R-aligned), **PDI**. Voter file + consumer overlays, propensity & persuasion models.
- Built around the **voter file as the unit of truth** — registration, vote history, modeled attributes. Strong identity, weak on *what people are saying right now*.

### 2. Programmatic activation / DSPs (delivery layer)
- **DSPolitical "Deploy"** (meta-DSP, ~90% match rate, voter-file native), **El Toro** (IP-targeting), **Basis** (formerly Centro), **AudienceX**.
- These *activate* audiences across display/CTV/OLV. They consume audiences; they don't generate issue insight.
- 2026 political ad spend projected **~$10.8B** (AdImpact); **~$2.5B to CTV/streaming** — the only digital channel growing.

### 3. Social listening / consumer intelligence (signal layer)
- **Brandwatch, Talkwalker (Hootsuite), Sprinklr, Meltwater, Pulsar, Infegy, Brand24, NewsWhip, Zignal**.
- Pulsar: 40B+ docs/yr, 200+ languages, "Signals" generative-AI trend discovery. Brandwatch: 1.7T historical conversations.
- **2026 shift: agentic AI** — task the platform like a researcher, not just query summaries. Narrative summarization via LLMs on top of classic classifiers.
- Almost all are **brand/PR-oriented**, not political. Output is dashboards & reports — **dead-ends at insight**. No native path to ad activation.

### 4. Audience / psychographic intelligence (the closest competitor)
- **Resonate** — the one to study hardest. 15K+ attributes (values, voter intent, hot-topic sentiment), `rAI` infra, survey-based + AI-modeled, **activates across CTV/OTT/display/social**. Enterprise pricing, no published tiers.
- Resonate is the closest to "people intelligence + activation" but is **survey/panel-grounded and slow-moving** — predictive models, not live-conversation-driven.

### 5. Data science / message testing (persuasion layer)
- **Civis Analytics** (Schmidt-backed), **BlueLabs**, **Swayable** (RCT-style ad/message lift testing), **Murmuration** (advocacy organizing data).
- Bespoke, consultative, expensive. Answer "does this message move opinion" — not "what conversation is happening now."

---

## The gaps (where you win)

1. **The listening→activation handoff is manual everywhere.** Listening tools output dashboards; activation tools ingest audiences. The translation — _conversation theme → audience hypothesis → message angle → targetable segment_ — is done by hand by strategists. **Automate that bridge and you own the loop.** This is the single biggest opening.

2. **Real-time vs. stale.** Voter files and panel data are structurally lagged. Conversations move daily; segments are rebuilt quarterly. A live "issue → audience" pipeline beats static models on *emerging* issues — exactly where campaigns are blind.

3. **No politics-native narrative intelligence.** Listening suites are brand-tuned. A tool that understands political issue framing, persuadability, coalition language, and "how to enter this conversation credibly" is unserved by Brandwatch/Talkwalker.

4. **SMB / down-ballot is abandoned.** Resonate, Civis, DSPolitical are enterprise/statewide-and-up. State leg, local, ballot-initiative, and advocacy orgs have **budget but no tooling**. Land here; the incumbents won't fight for it.

5. **"How do I get in the conversation" is a product nobody sells.** Everyone sells audiences or insight. Nobody sells the **creative+timing recommendation**: which conversation, which angle, which moment, which platform, which microcommunity. That's your wedge given your creative/animation background — pair signal with ready-to-ship creative.

---

## Hard constraints (design around these from day one)

- **Platform microtargeting is dead.** Meta & Google **banned** political targeting by affiliation, race, religion, ideology, age/gender (Google). Custom political audiences from donor/email uploads **prohibited** on Meta. → Precision must come from **contextual + geo + behavioral + 1st-party**, not platform demographic slicing. Reframes the product: you sell *contextual conversation targeting + creative*, not forbidden microtargeting.
- **EU political ad ban.** Meta & Google pulled political ads in the EU (TTPA regulation). → **US-first**, treat EU as non-market.
- **Scraping legality (2026).** Public, no-login scraping ruled legal (Meta/X v. Bright Data). BUT: GDPR makes you a data controller over any EU-resident PII even if public; CCPA triggers on CA residents' public PII used commercially. TikTok Research API = academic/non-commercial only; IG Graph API = business accounts only. → Use **aggregate/narrative signal, not individual profiling**; minimize stored PII; US-scoped; lean on licensed APIs + compliant scraping vendors (Apify/Bright Data) over DIY.
- **Ad blackout windows.** 7-day pre-election freeze on *new* political ads (Meta). Build scheduling around it.

---

## Recommended positioning

> **"Real-time political narrative intelligence that turns live conversations into contextual ad audiences + ready-to-run creative — for campaigns the enterprise tools ignore."**

- **Signal-to-creative loop**, not another dashboard.
- **Contextual-first** (compliance-proof), 1st-party enrichment second.
- **Down-ballot / advocacy SMB** as beachhead, expand up.
- Wedge moat = your **creative production** edge (HTML5/GSAP/video): competitors stop at the audience; you ship the ad.

---

## Build order (MVP → moat)

1. **Ingestion**: licensed/compliant scrape of X, Reddit, news, YouTube, TikTok (where legal) → normalized conversation store.
2. **Narrative engine** (LLM): cluster posts into *issues → frames → sentiment → momentum*, geo-tagged, with "emerging vs. saturated" scoring.
3. **Translation layer** (the differentiator): issue cluster → audience hypothesis → contextual targeting spec (keywords, placements, geo) → message angle brief.
4. **Activation**: push contextual segments + creative to Meta/Google/a DSP. Start with API exports; deepen integration later.
5. **Creative auto-gen**: brief → HTML5/social ad drafts (your strength).
6. **Measurement**: lift/engagement back into the loop → reweight signal.

---

## Open questions to resolve before building

- D-aligned, R-aligned, or **nonpartisan/advocacy** (biggest TAM, fewest enemies)? Most data vendors pick a side — staying neutral opens corporate-advocacy + issue-campaign money.
- Sell **SaaS self-serve**, **managed service**, or **data-feed/API** to existing agencies?
- Buy signal (license Pulsar/Brandwatch firehose) or build ingestion? Build is the moat but slow; license to launch fast.
- Identity resolution: stay **contextual-only** (clean, compliant, defensible) or add PII matching (powerful, legally heavy)?

---

## Key competitors to teardown next
**Resonate** (closest), **DSPolitical/Deploy** (activation incumbent), **Pulsar** (best narrative AI), **Zignal/NewsWhip** (real-time political-adjacent), **Civis** (data-science credibility).
