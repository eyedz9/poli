# Competitor Teardown — Resonate · DSPolitical · Pulsar

_Deep dive on the three closest reference points. Research date: 2026-06-06._
_Companion to MARKET_RESEARCH.md._

Each represents one layer you must beat or bridge:
- **Resonate** = audience intelligence (insight→activation) — closest full-stack rival.
- **DSPolitical** = political activation (the DSP you'd plug into or displace).
- **Pulsar** = narrative/social intelligence (best-in-class signal engine you must match).

---

## 1. Resonate — the closest competitor

**What it is:** AI-powered consumer/voter intelligence + activation. "Ignite" platform. Politics is a named vertical.

**Data & method**
- 250M US consumer profiles, **15,000+ attributes** each (values, voter intent, hot-topic sentiment, media habits, candidate support).
- `rAI` = proprietary AI infra modeling/predicting attributes.
- **Core method = survey panels.** Non-probability convenience samples from online panels → modeled out to 250M profiles. This is the crack in the armor (below).
- 2025: auto-aggregation AI feature (cuts manual analysis).

**Activation / integrations**
- Pushes audiences to **Meta, The Trade Desk**, CRMs, DMPs. Targets across CTV/OTT/display/social.
- Insight→activation in one platform — the loop they already close.

**Pricing**
- Enterprise only. No tiers, no trial, no free. Custom quote. (Reads as $50K+/yr territory.)

**Ratings**
- G2 4.3/5 (22 reviews). Praised for depth of values/behavior insight.

**Weaknesses = your openings**
- **Panel-grounded, not live-conversation-grounded.** Reviewers note convenience samples "may not reflect your target audience." Predictive/modeled — **structurally lagged on emerging issues.** ← your real-time wedge.
- **US-only, no B2B.** (Fine for you — US-first anyway.)
- **Overwhelming / steep learning curve.** "So much info"; needs power users + Resonate-side hand-holding. Attributes measured inconsistently across channels.
- **No client-facing survey instruments / data dictionaries** — black box.
- **Enterprise-priced = down-ballot/SMB locked out.** ← your beachhead.

**Verdict:** Closest to your vision but slow, expensive, panel-bound, enterprise-gated. Beat on **speed (live signal), price (SMB), and transparency.**

---

## 2. DSPolitical — the activation incumbent

**What it is:** #1 Democratic/progressive programmatic ad platform. **"Deploy"** = self-serve meta-DSP (one UI, many ad-tech vendors + SSPs underneath).

**Data & method**
- First to onboard voter file for digital ads (2011). **Deterministic, not probabilistic.**
- Direct API integrations: **Catalist, TargetSmart, PDI**.
- **90%+ match rate** offline voter→online ID via multiple onboarders. Upload any list → matched & enriched against national voter file.
- 16 Catalist presets + layered data points (registration, propensity, age, race, gender, digital consumption).

**Activation**
- Mobile, desktop, **CTV, digital audio**. Multi-DSP via meta-DSP layer.

**Pricing / access**
- **Starts at $500** — lowest barrier of the three. Self-serve (Deploy) for agencies/consultants + managed service.
- Glassdoor 3.6/5 (employee, not client).

**Weaknesses = your openings**
- **Partisan-locked: Democrats/progressives only.** Cuts the R + corporate-advocacy + nonpartisan TAM entirely. ← nonpartisan positioning is wide open.
- **Voter-file/identity-centric** = inherits dead microtargeting (Meta/Google bans hit deterministic audience uploads). **Zero issue/conversation intelligence** — it activates audiences someone else defines.
- **Built for experienced agencies/consultants** — Deploy is self-serve *for pros*, not a turnkey product for a local campaign with no media buyer.
- No creative generation. No listening. No "what issue / what angle."

**Verdict:** Not a rival — a **potential rail.** Deploy ingests custom audiences via API (Inbound Audience API). You generate the contextual/issue audience + creative; push to Deploy (or Meta/Trade Desk) for delivery. **Integrate, don't rebuild the DSP.** Their gap (no signal, no creative, partisan) is exactly your product.

---

## 3. Pulsar — the narrative-intelligence benchmark

**What it is:** AI audience + social intelligence. The bar your **signal engine** must clear. Brand/comms/gov-tuned, not political-native.

**Products**
- **TRAC** — social listening + audience segmentation; ingests **45+ source types, 200+ languages**; community-level analysis, narrative tracking.
- **CORE** — owned-channel performance.
- **Narratives AI** — public-opinion trend tracking.
- **CLEAR** — ad compliance vs regulatory codes (real-time).
- **Crisis Oracle** — reputational risk (P.U.L.S.E. score: Volume/Visibility/Velocity).
- **TeamMates** — agentic AI layer; autonomous 24/7 "digital teammates." **Threat Sentinel** detects adversarial campaigns + deepfakes.
- **Signals** — auto-discovers statistically significant trends/emerging narratives.
- 2026: 3D Influencer Network Graph (bridge accounts, amplification mapping).

**Scale**
- 40B+ docs/yr. NLP sentiment/emotion/topics/entities across 68+ languages.

**Pricing**
- Enterprise/custom, no public price. Class-typical **$20K–$100K+/yr** annual contracts.

**Strengths to respect**
- Best-in-class **narrative + community + audience** depth ("why," not just volume). Agentic AI is the 2026 differentiator. Crisis/deepfake detection is genuinely political-adjacent.

**Weaknesses = your openings**
- **Brand/comms-built, not political.** No voter framing, persuadability, coalition language, or "how to enter this conversation." Output = insight dashboards, **dead-ends before ad activation.** ← the handoff gap again.
- **Keyword-reliant** (shared w/ Brandwatch) — misses conversations without the exact terms. LLM-native clustering can beat this.
- Weak on **paid campaign tracking** (G2 4.8 vs Brandwatch 6.7) — not built to close the loop to ads.
- Enterprise-priced, enterprise-complex.

**Verdict:** Defines the signal-quality bar. You won't out-scale 40B docs/yr at MVP — so **either license a firehose** (Brandwatch/Pulsar-tier) to launch fast, **or** go LLM-native + politics-tuned on a narrower, deeper US-political corpus and win on *relevance + activation*, not raw volume.

---

## Cross-cut: the three-way gap map

| Capability | Resonate | DSPolitical | Pulsar | **YOUR ENGINE** |
|---|---|---|---|---|
| Live conversation/issue detection | ⚠️ panel-lagged | ❌ | ✅ (brand-tuned) | ✅ political-native, real-time |
| Political/voter framing | ✅ | ✅ | ❌ | ✅ |
| Audience generation | ✅ modeled | ✅ voter-file | ⚠️ segments only | ✅ contextual+issue |
| Ad activation (push to DSP/Meta) | ✅ | ✅ | ❌ | ✅ via API |
| Creative generation | ❌ | ❌ | ❌ | ✅ **your moat** |
| Nonpartisan / all-side | ✅ | ❌ D-only | ✅ | ✅ |
| SMB / down-ballot affordable | ❌ | ✅ ($500) | ❌ | ✅ target |
| Closed listen→activate→measure loop | ⚠️ partial | ❌ | ❌ | ✅ **the product** |

**The whitespace, in one line:** _politics-native, real-time conversation intelligence → contextual audience → auto-generated creative → push to activation → measure → relisten — at SMB/down-ballot price, nonpartisan._ No one occupies that cell.

---

## Strategic takeaways

1. **Don't rebuild a DSP.** DSPolitical/Deploy ($500 entry, 90% match, multi-channel) is a rail — integrate via their Inbound Audience API or go straight to Meta/Trade Desk. Saves years.
2. **Don't out-scale Pulsar on volume.** Win on **political relevance + activation + creative**, the three things it lacks. License signal early if needed.
3. **Attack Resonate on speed, price, transparency.** Live > panel; SMB > enterprise; open methodology > black box.
4. **Nonpartisan is structurally open** — DSPolitical (D) and i360 (R) are locked; the neutral lane has corporate-advocacy + issue + cause money and no dominant tool.
5. **Creative auto-gen is unclaimed by all three** — your HTML5/GSAP/video background is the defensible edge none of them will build.

## Next teardown candidates
i360 (R-side mirror of DSPolitical), Civis (data-science credibility play), Zignal/NewsWhip (real-time political-adjacent listening), Quorum/FiscalNote (legislative/advocacy intel).
