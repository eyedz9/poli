# Feature Spec — Comment-Derived Audience Persona Engine

_Add-on to the people intelligence engine. Research date: 2026-06-06._
_Companion to MARKET_RESEARCH.md, COMPETITOR_TEARDOWN.md, INFLUENCER_REACH.md, LANGUAGE_INTELLIGENCE.md._

## The idea

Scrape public comments across platforms → cross-reference signals → infer demographics, psychographics, media habits → build targeting personas. No survey panel, no voter file, no PII — the audience builds itself from what they publicly write.

---

## Critical design fork: individual-down vs. aggregate-up

Two architectures. Only one is legal, and the legal one is also better.

### ❌ Individual-down (DO NOT BUILD)
Track each commenter → build a profile per person → link across platforms → resolve to an identity.
- This IS cross-platform identity resolution.
- Under GDPR: requires legal basis (consent, contract, or legitimate interest) for each EU-resident profile. "Publicly available" is NOT a lawful basis for profiling.
- Under CCPA/CPRA 2026: aggregating cross-site behavioral data + selling/activating it triggers **data broker classification** — mandatory registration, assessments, deletion rights.
- Class-action target. Meta/Bright Data ruling protects *scraping*; it doesn't protect *profiling individuals from scraped data*.
- Cambridge Analytica did this. Don't.

### ✅ Aggregate-up (BUILD THIS)
Scrape comments as a corpus → infer patterns *of the group* → build personas as statistical descriptions, not individual records.
- No stored individual profiles. No cross-platform identity links.
- Output: "Commenters on this issue on this channel skew 35–54, working-class economic frame, fear-dominant emotion, Fox/talk-radio media habit" — a *cohort description*, not a person.
- Legally: processing *aggregated, anonymized patterns* = analytics, not profiling. Design so no individual is recoverable from the output.
- This is also *more useful* for targeting: you can't buy an individual; you buy an audience segment. The segment description IS the deliverable.

---

## What you can actually infer from public comments (research-backed)

LLMs analyzing batches of comments (tested at 30+ comments per inference) extract four dimensions reliably:

| Dimension | Signals in text | What it gives you |
|---|---|---|
| **Demographics** | vocabulary complexity, cultural references, generational slang, topic mix | age range, education proxy, US region |
| **Psychographics** | values language, moral framing, risk/fear vs. hope register, OCEAN markers | personality orientation, Moral Foundation scores, values priorities |
| **Political / ideological** | LLMs can detect political stance + framing with high accuracy | left/right/center, issue salience, coalition identity |
| **Media habits** | source citations, talking-point language, platform-specific idioms, narrative sources ("I saw on...") | inferred media diet (Fox / MSNBC / podcasts / TikTok / Reddit) |
| **Engagement style** | argumentation pattern, reply behavior, emotional register | persuadable vs. entrenched, lurker vs. active, debate-receptive |

**What you CANNOT reliably infer from text alone:** precise income, household composition, specific geography below state/metro level. Don't overstate the product.

---

## The cross-platform enrichment layer

The real power: same issue, comments from **YouTube + Reddit + X + TikTok** each attract subtly different audience slices. Cross-referencing reveals:

- **Platform-persona mapping:** Reddit thread on immigration → different age/education/value profile than YouTube comments on same story → TikTok comments → completely different emotional register and vocabulary. Map this. Campaigns learn *which platform holds their persuadable slice.*
- **Convergence signals:** what appears across ALL platforms = core, stable public opinion. What's platform-specific = echo-chamber artifact. Distinguish these.
- **Community graph:** same accounts (where public handles match) commenting across platforms → map cross-platform communities without storing individual profiles. (Store community fingerprints, not identities.)

---

## The persona output format

Per (issue × channel/community):

```
PERSONA: "Security-Mom Suburban, 40-55"
─────────────────────────────────────────────────
Demographics (inferred):  35–54, female-skewing, suburban/exurban
Education proxy:          Mid (vocabulary complexity score: 2.3/5)
Region markers:           Midwest + Sun Belt idioms dominant
─────────────────────────────────────────────────
Psychographics:
  Moral foundations:      Loyalty 78% · Care 71% · Authority 65% · Fairness 48%
  OCEAN proxy:            High Conscientiousness, moderate Neuroticism
  Core values language:   "protect," "safe," "my kids," "community"
  Emotional register:     Fear 62% · Anger 24% · Hope 14%
─────────────────────────────────────────────────
Political:
  Stance (this issue):    Soft-oppose (persuadable)
  Frame in use:           Security/threat frame dominant
  Talking points sourced: Local news + Facebook shares + Fox prime-time
─────────────────────────────────────────────────
Media habits (inferred):  Local TV news, Facebook groups, conservative talk radio,
                          YouTube (long-form commentary), not TikTok
─────────────────────────────────────────────────
Engagement profile:       Replies to personal stories, disengages from stats,
                          responds to authority sources
─────────────────────────────────────────────────
Targeting spec:
  Platforms:              Facebook, YouTube pre-roll, local CTV
  Contextual keywords:    [auto-pulled from distinctive vocab analysis]
  Creative angle:         Security → community protection frame
  Language bridge:        [from Language Intelligence engine]
```

---

## Integration with other engines

- **Narrative engine** → feeds the comment corpora per issue.
- **Language Intelligence** → persona's moral-foundation profile directly feeds the reframe generator. The two engines share the same corpus analysis.
- **Influencer/CVS** → persona tells you *which channel's comment section has your target persona*. Crossref the Comment Vitality Score with the persona type → "this persona is most active and persuadable on these 5 channels."
- **Creative auto-gen** → persona brief feeds directly into ad copy generation. The output row IS the creative brief header.

---

## What this replaces / improves on

| Current approach | Problem | This |
|---|---|---|
| Resonate survey panels | Lagged, non-probability samples | Real-time, actual conversation |
| Voter file + consumer overlays | Identity-based, microtargeting-banned | Contextual, compliance-safe |
| Generic buyer personas (marketing) | Not grounded in actual political language | Extracted from real political speech |
| Platform ad targeting (Facebook interest) | Meta removed political interest targeting | Bypasses the ban — targets context, not declared identity |

---

## Compliance design (baked in, not bolted on)

1. **No individual storage.** Comments ingested → analyzed → persona scores extracted → raw comments discarded within session. Only the aggregated persona vector is stored.
2. **No cross-platform identity linking.** Personas built per-platform-per-issue. Convergence signals computed from population statistics, not identity graphs.
3. **No PII fields in output.** Persona output has no names, handles, emails, or linkable identifiers.
4. **Data broker audit.** If the output personas are sold or activated for third-party targeting, legal review needed for CCPA broker classification. Internal use / SaaS campaign use = cleaner. Build the audit trail now.
5. **EU-scoped out at MVP.** US-only comment corpus; EU-resident comments flagged and excluded at ingestion.

---

## MVP cut

1. Per issue cluster, pull top-100 highest-CVS comment threads (YouTube + Reddit first).
2. Batch-feed to LLM: infer per-batch demographics proxy, moral-foundation scores, emotional register, media-habit markers, engagement style.
3. Aggregate across batches → weighted persona profile.
4. Generate structured persona card (above format).
5. Tag: *persuadable / entrenched / already-aligned* — campaign only needs the first.
6. Export as creative brief header into the creative auto-gen pipeline.

Later: TikTok/X, persona-tracking over time (watch persuadable slice shift as issue evolves), persona→platform crossref (tell campaign "your persuadable lives on YouTube, not Reddit").

---

## The honest capability statement

Comments + LLM → **statistically reliable cohort descriptions**, not precision individual profiles. Accuracy on age range and political stance: high. Accuracy on income and exact geography: low. The value isn't precision individual profiling (banned anyway) — it's **understanding who is actually in the conversation you want to enter**, in real-time, from public data, without a survey panel or a voter file. That's the product.
