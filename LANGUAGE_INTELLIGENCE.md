# Feature Spec — Language & Framing Intelligence

_Add-on to the people intelligence engine. Research date: 2026-06-06._
_Companion to MARKET_RESEARCH.md, COMPETITOR_TEARDOWN.md, INFLUENCER_REACH.md._

## The feature in one line

For each issue, surface **how people actually talk about it** — the distinctive vocabulary, metaphors, and moral frames each side uses — then **auto-generate cross-audience reframings** that carry your position into the *other side's* moral language, without abandoning the position.

This is the hardest leg to build and the hardest to copy. It's also the user's core thesis: _preaching to believers is easy; connecting with non-believers without losing your principles is the unsolved problem._ There is real science here, and **the science says the product should exist.**

---

## The science (this isn't vibes — it's replicated research)

### Moral reframing (Feinberg & Willer, Stanford/Toronto)
- The most persuasive argument is built on **the values of the person you're persuading**, not your own.
- Liberals weight **care / fairness / equality**; conservatives weight **loyalty / authority / sanctity** (Moral Foundations Theory, Haidt).
- Same policy position, reframed onto the target's foundation, **moves opinion on entrenched issues** — and even shifts candidate support.
- **The killer stat / the entire business case:** when shown reframed vs. native arguments, **64% of liberals and 85% of conservatives correctly identify the reframed one as more persuasive to the other side** — but when asked to *write* a persuasive message, **fewer than 10% spontaneously do it.** People *recognize* good reframing but *can't produce it.* That production gap is the product.

### Framing theory (Lakoff)
- Frames = mental structures; word choice activates them. "Tax relief," "playing by the rules," "partial-birth abortion" are engineered frames.
- Conservatives historically out-disciplined on message vocabulary. Whoever names the frame wins the reasoning.
- → A tool that **detects the active frames** in a conversation and **suggests counter-frames** is directly actionable.

### Message testing (Swayable — the validation layer that already exists)
- RCT-based persuasion lift in ~24h. Finding: top messages for progressives often also test best for moderates; "Children & Families" moved R + independents *and* mobilized D in 2026 tests.
- Swayable proves *whether* a message works. **Nobody generates the candidate messages grounded in the other side's real language.** You feed the front of that pipeline.

---

## What the feature actually computes

For a given issue + audience segment:

1. **Distinctive vocabulary extraction** — not just frequent words, words *distinctive to this group vs. others*. (TF-IDF / log-odds-ratio / BERTopic embeddings on the scraped corpus.) → "Here's how *this* segment names the issue."
2. **Metaphor & frame detection** — LLM classifies the dominant frames (economic, moral, security, freedom, fairness...) per side.
3. **Moral-foundation profiling** — score each segment's language against the 6 foundations (care, fairness, loyalty, authority, sanctity, liberty). → "This audience reasons through *sanctity + loyalty*."
4. **Emotional/sentiment register** — fear, anger, hope, pride, disgust — what affect carries the conversation.
5. **Reframe generation** — LLM takes *your principle + position* and rewrites it into the target segment's vocabulary + moral foundation, with guardrails so the *substance* is preserved (see below).
6. **Vocabulary do/don't list** — terms that resonate vs. terms that trigger reactance in that segment (e.g. avoid "tax," use "what you've earned").

Output: a **bridge brief** per (issue × audience): _their words, their frame, their moral foundation, and 3 reframings of your message that land — plus the words to avoid._

---

## "Without losing your principles" — the design guardrail

This is the ethical and product crux. Moral reframing is **not** flip-flopping:
- **Position stays fixed. Moral justification changes.** You still support X; you argue for X using *their* values instead of yours.
- Example (Feinberg/Willer canon): to persuade conservatives on environmental protection, frame it as **purity/sanctity** ("keep our land pure, clean, God-given") not **care/harm** ("save the planet from suffering"). Identical ask. Different moral entry point.
- Product enforces this with a **fidelity check**: the reframe must preserve the original *policy claim* (LLM verifies the ask is unchanged) — only the *moral framing and vocabulary* flex. Flag any reframe that alters the actual position.
- This keeps it **persuasion, not manipulation/disinfo** — a line that matters for compliance, brand, and the platform/legal posture (ties to the deepfake/adversarial-content concerns flagged in the market research).

---

## Where it slots in the loop

```
Narrative engine → issue cluster + per-segment corpora
        │
        ▼
Language & Framing engine
  • distinctive vocab per segment
  • frame + moral-foundation profile
  • reframe generation (fidelity-checked)
        │
        ├─► Creative auto-gen  → ad/social copy in the resonant language (your moat)
        ├─► Influencer/comment → entry scripts that speak the channel's dialect
        ├─► Contextual targeting → keyword/placement specs use the real vocabulary
        └─► (optional) Swayable-style A/B → validate lift, feed winners back
```

It's the connective tissue: **audience tells you *who*, influencer tells you *where*, language tells you *what to say* — and creative ships it.**

---

## Market gap

- **Listening tools** (Brandwatch/Pulsar) surface volume/sentiment/topics — they tell you *what's discussed*, not *how to speak to the opposition*.
- **Resonate** profiles values but doesn't generate reframed language.
- **Swayable** tests messages but doesn't generate them from the other side's vocabulary.
- **Academia** proved moral reframing works but shipped no product; the <10% production gap is wide open.
- **Nobody** offers: *detect the other side's actual language + moral frame → auto-generate principle-preserving reframings → ship as creative.* That's a category of one.

---

## MVP cut

1. Per issue cluster, split corpus by stance (LLM tag: support / oppose / persuadable).
2. **Distinctive-vocab v1**: log-odds-ratio of terms per stance vs. baseline → ranked word lists + a do/don't list.
3. **Moral-foundation scorer**: classify segment language across 6 foundations (start with an LLM prompt + the MFT dictionary; refine later).
4. **Reframe generator**: prompt = `{your position, your principle, target segment's top vocab + dominant moral foundation}` → 3 reframings + 1 "avoid these words" note. Add the **fidelity check** (position unchanged) as a second LLM pass.
5. Output the **bridge brief**; pipe into creative gen.
6. Later: validated A/B loop, frame-shift tracking over time, multilingual (Spanish first — US political relevance).

---

## Why this is the moat

The other features (audience, influencer) can be assembled from licensable data + APIs. **This one is grounded in persuasion science nobody has productized, hits the user's exact thesis (reach non-believers without selling out), and compounds with the creative edge.** It's the reason the platform is *people intelligence*, not just *people data* — it doesn't only tell you what people think, it tells you **how to talk to them.**
