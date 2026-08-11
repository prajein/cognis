**HYLE GLOBAL PRIVATE LIMITED**

**Cognis**

Product & Technical Specification

_The software layer of the Arc platform_

**Prepared for:** Freelance software engineer (browser-extension build)

**Purpose:** A complete brief and technical specification so an external developer can build Cognis without prior context.

**Source:** Compiled verbatim from the originating product-design conversation (Claude x HYLE, April 2026). Spec version 0.1.

**Status:** CONFIDENTIAL - internal and contracted parties only.

**Contents**

# 1\. About this document

This document is a self-contained brief for building Cognis, the browser-extension software product of the Arc platform. It assumes no prior knowledge of the project. It covers the vision, the product concepts, what is measured, what success looks like, and the full technical specification, followed by a suggested build order, a parameters table, a glossary, and open questions to confirm before work begins.

It was compiled from a product-design conversation and preserves the specifics (mechanisms, parameters, schemas) exactly. Where a note is the compiler's own framing rather than from the source, it is marked _\[note\]_.

Two companion realities to keep in mind: **Arc** is the hardware (an in-ear and over-ear neuro-wearable that reads brain state and can apply gentle neurostimulation). **Cognis** is the software that lives in the browser and acts on what the brain is looking at. They are one product with two surfaces.

# 2\. Executive summary

Cognis is a browser extension that sits invisibly on top of any AI interface (Claude, ChatGPT, Gemini, Perplexity) and does two things at once, with **zero added friction**: it makes the AI's output faster and higher quality, and it protects and develops the user's own thinking.

It pursues both goals through the same mechanisms rather than treating them as separate features. The user never does anything that feels like an exercise and never waits on a popup. Everything happens inside the natural act of typing, reading, and deciding.

Cognis is Arc-native from day one. When the wearable is connected, the extension reads the user's live cognitive state (Coasting, Stretch, Overload) over Bluetooth and adapts how and when it acts. The device measures the brain; the extension acts on what the brain is doing on screen. That closed loop, measured from two directions, is the moat: no other AI tool company has the hardware side.

**North-star metric:** the rate at which a user's _unassisted_ prompt quality converges toward their _enriched_ prompt quality. That convergence is cognitive development made measurable, and (with Arc running) it can be correlated to a neurological capacity measure, producing a defensible scientific claim no competitor can make.

# 3\. The opportunity and the problem

The problem this product attacks is **cognitive debt**: when a person delegates reasoning to AI without their own brain doing any work to generate, evaluate, or interrogate the output, the underused circuits weaken over time. The cause is not AI use itself, it is **unearned acceptance** - accepting an output your brain did nothing to earn. Do that repeatedly and the circuit atrophies.

### The multi-prompt discovery problem

People do not need multiple prompts because they are bad at prompting. They need them because context is discovered, not known upfront. You do not know what the AI needs until you see what it produces without it. The first response reveals a gap; the second prompt fills one; by prompt four or five you finally get what you wanted, but you have burned time and cognitive load, and most people stop at prompt two with a mediocre output. Collapsing that discovery cycle is the core technical challenge.

### Where context lives

The context needed for a great output lives in three places: what you know and stated; what you know but did not think to say; and what you do not know you know - implicit assumptions and domain expertise that only surface when something violates them. The third category is the hardest and most valuable, and it is exactly what the multi-prompt cycle slowly excavates. Cognis's job is to excavate it before the first prompt, not after the third.

# 4\. Product philosophy and design principles

- **No added steps.** The work is reshaped into the existing interaction, never bolted on. The user never stops to interact with the extension.
- **Nothing happens during waiting.** Interventions occur within an action the user is already performing (typing, reading, deciding) - never as a loading-screen prompt or a blocking modal.
- **Invisible infrastructure, not a layer on top.** No modals, no loading states, no panels that pop up while the user waits. The side panel exists but is closed by default.
- **Generative, not interrogative.** Where the system primes thinking it uses sentence stems the brain involuntarily completes, not questions (which only trigger shallow retrieval).
- **Earn every acceptance.** Ensure the brain does some real work on every AI interaction without that work feeling like effort.
- **Make itself less necessary.** The honest definition of cognitive enhancement is the tool's contribution shrinking over time as the user internalises the skill. The product is designed to measure and pursue that.
- **Arc-native from the start.** Built as the software expression of the same closed loop, not a standalone tool that later integrates with hardware.

# 5\. How it works - the core concepts

## 5.1 The closed loop, extended into software

Cognis is the software precursor to the Arc's Phase 4 Vision layer: context-aware perception inside real work. It sits in the browser, sees what the user is doing in any AI interface, and acts as a domain-expert layer that makes the interaction faster and higher quality without the user prompting differently. When Arc is connected, the brain state decides how the software intervenes - the device tells the software what the brain is doing; the software adjusts how it acts.

## 5.2 What the extension perceives

On any AI interface it can read: the prompt as it is typed, the AI response as it streams, the thread history, the interface and page context, time-on-page, typing speed and pattern, edit behaviour (how much is deleted and rewritten before sending), and the Arc state over Bluetooth. From Arc specifically: current state and confidence, the day's Depth Score, time in current state, HRV trend, and whether tACS is firing (if it is, the brain is being pushed toward Stretch, so the extension should expect higher-quality input and give it more room).

## 5.3 Prompt enrichment

The extension never changes what the user wrote. It wraps it - prepending context the user did not write and appending structural constraints for the model. The user sees their original prompt; the model sees the enriched version. Five layers:

1. **Identity and domain context.** Who the user is, what they are working on, expertise level. Example injection: "The user is a medical student and early-stage founder building a cognitive wearable; technical depth in neuroscience and product strategy; match this level without over-explaining fundamentals."
2. **Task classification.** Classify the prompt into a task type (strategic reasoning, creative generation, technical problem-solving, research synthesis, decision-making, communication drafting, learning); each type has its own enrichment template. Done locally with a small on-device model - no latency.
3. **Cognitive-state calibration (the Arc layer).** In Stretch, minimal injection. In Coasting, more scaffolding and "flag any assumptions". In Overload, simplify and suppress the analysis panel.
4. **The clarifying-question layer.** At most one question, only when a missing piece of context would materially change the output. It identifies the single highest-leverage gap and asks only that, as a one-line non-blocking overlay above send. Skippable; if skipped, the most probable answer is inferred from history and flagged as an inference.
5. **Output-format specification.** Appends a structure the user would rarely write, e.g. "direct answer first, then reasoning, then what you'd need to know to be more confident". These structural injections reliably improve quality by forcing the model to organise before concluding.

## 5.4 Progressive Context Crystallization (three live sources)

Rather than getting all context upfront (impossible, creates friction) or waiting for multiple prompts (the broken status quo), the extension builds a live context model from three sources running simultaneously:

- **Persistent user model -** everything learned across all sessions: domain expertise, style, decision patterns, recurring values and constraints. Always injected, always refined, never asked for again after onboarding.
- **Session context -** what has happened in this conversation, including behavioural signals (what was deleted before sending, pauses, what was accepted vs corrected, what was scrolled back to). These reveal implicit judgement without the user articulating it.
- **Pre-flight context extraction -** the new mechanism (next section).

## 5.5 The pre-flight mechanism

When the user finishes typing and pauses before send, the extension runs a silent meta-call to the model: "Given this task, what are the three pieces of context that would most change your response if you had them? Rank by impact. Return only the questions." The model returns three questions. The extension filters them: any already answered by the persistent user model or the session history is injected silently. What remains - typically one question, sometimes zero - is the only thing shown to the user. They answer in one line or skip. The first response becomes what would have been the fourth. The key move: the AI is used to identify its own context gaps, and the extension resolves most of those gaps from existing knowledge before asking the human anything.

## 5.6 Generative priming (in-flow, never during waiting)

Per the client's hard constraint, the primer must operate **within the act of typing**, before the user hits enter - never as a loading screen. The mechanism is a single incomplete thought (a sentence stem) rendered as ghost text in the input field during a cognitive pause. A question triggers shallow retrieval; a sentence stem triggers generative completion - the exact circuit that atrophies under AI dependence. The brain completes it involuntarily. Any keystroke dismisses it. If the user types a completion, even three words, it is captured as a high-confidence context signal and injected (attributed to the user). If not, the system infers from the user model.

## 5.7 The gap taxonomy and dynamic, longitudinal targeting

Every person has a stable signature of recurring cognitive gaps. The system maps that signature from behavioural signals, tracks its evolution, and generates the single most valuable stem for this person, task, and state. The eight gap types, their tell-tale signatures, and the stem each one activates:

| **Gap type**   | **What it is / signature**                                                                                                                                 | **Generative stem**                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Intentionality | Output is specified, purpose is not. Signature: detailed deliverable, no stated success criterion.                                                         | "Beyond producing this, what I actually need to happen is \___"                   |
| Audience       | Who it is for, what they know, what would make them reject it. Signature: "write this for my investor" with no model of the investor.                      | "The person reading this will hesitate when they reach \___"                      |
| Constraint     | Unstated real-world limits (budget, timeline, politics, prior decisions). Signature: follow-ups starting "but it needs to be" / "the problem is we can't". | "The version of this that actually gets implemented looks different because \___" |
| Stakes         | What happens if it is wrong. Signature: accepting a hedged output then stripping the qualifications.                                                       | "If this lands wrong, the specific thing that breaks is \___"                     |
| Assumption     | Unexamined beliefs the model cannot challenge if it does not know they exist. Signature: outputs that confirm the framing entirely.                        | "The thing I'm taking for granted here that I haven't tested is \___"             |
| Mechanism      | Goal stated without the causal logic. Signature: generic lists with no diagnostic layer underneath.                                                        | "This works because \___"                                                         |
| Temporal       | Missing time context (stage, what's been tried, deadline). Signature: recommends things already done / ignores urgency.                                    | "What's different about this situation right now compared to before is \___"      |
| Second-order   | Thinks one level deep; misses systemic effects. Signature: locally correct strategy that ignores knock-on effects.                                         | "Six months after this succeeds, the new problem is \___"                         |

The system infers gaps from five behavioural signals: (1) correction prompts ("actually", "but", restating with more specificity); (2) edit behaviour in the response (what the user removes/adds/restructures after copying it out); (3) acceptance under depleted state; (4) the arc of a multi-prompt session (what had to be added in prompts 2-4); (5) outcome correlation (which outputs were used vs abandoned). It learns the conditional patterns (e.g. constraint gaps appear more on strategic tasks; assumption gaps appear most when the user works in an area of expertise) which predict gap presence far better than base rates.

## 5.8 Active reading architecture

The second place decline happens is during reading - people skim and take the first answer. Instead of a "did you read carefully" check (friction and condescension), the response panel prepares three things during streaming, available (not forced) the moment reading ends:

- **The actual answer -** a one-sentence distillation of the response's core claim. Forces a comparison against the user's own reading.
- **The load-bearing assumption -** the single assumption the whole response depends on. "This assumes X." Confirm or flag. The most important five seconds of cognitive work.
- **The gap -** the one thing the response did not address that this user's model suggests they care about. "This doesn't address Y. Is that intentional?"

## 5.9 State-gated depth (Arc states)

Arc state gates depth, not effort - it never reduces the cognitive work, it matches it to what the brain can currently do:

| **Arc state** | **How Cognis behaves**                                                                                                                                                                                                                                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stretch       | Lightest mode. Stem asks for the user's own conclusion; the response panel shows the full three-element analysis; the assumption flagged is the subtlest one. The brain can handle depth, so the system gets out of the way.                                                                                                |
| Coasting      | More active. Simpler, more concrete stem; distillation more prominent; more aggressive domain-context injection; "flag any assumptions" added. Still requires a real evaluation, not passive receipt.                                                                                                                       |
| Overload      | Stem disappears. Panel collapses to one thing only: the load-bearing assumption (is the thing this depends on true?). Below that minimum, Arc fires tACS and Cognis holds the output, flagged "reviewed under high load, worth revisiting". When the user returns to Stretch, those held decisions are surfaced for review. |

## 5.10 Operating modes (the scaffolding control)

To avoid removing too much thinking, the system runs in three modes and can progressively reduce scaffolding as the user develops, the way a trainer removes the spotter:

| **Mode** | **Behaviour**                                                                                                                                                                                                                                                                                                                                                       |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full     | Resolves everything it can silently. Default.                                                                                                                                                                                                                                                                                                                       |
| Guided   | Resolves domain context silently but asks the user to supply task-specific context themselves.                                                                                                                                                                                                                                                                      |
| Shadow   | Watches and measures but injects nothing. Run automatically once a week (silently, during the user's historically highest-Stretch window) to get a clean baseline of unassisted thinking. The delta between Shadow output quality and Full output quality is the exact size of the system's contribution; watching that delta shrink is the deepest proof of value. |

# 6\. What gets measured

This is where the product is genuinely novel: it measures things nobody currently measures. Grouped conceptually:

### Prompt-quality metrics

- **Specificity score** - ratio of concrete to abstract terms in the prompt.
- **Constraint density** - how many constraints the user provides unprompted (low density predicts low quality and high edit rate).
- **Intent clarity** - whether the prompt contains a stated success criterion.
- **Self-sufficiency** - ratio of thinking prompts (analyse, evaluate) to execution prompts (write, generate). A direct measure of cognitive offloading.

### Cognitive-behaviour metrics

- **Edit depth before sending** - high edit depth correlates with Stretch and predicts higher quality.
- **Response read time** - from scroll behaviour; a follow-up within ~5s of a response means it was not read (shallow processing).
- **Acceptance rate** - proportion of output used unmodified. High is NOT success; it is an offloading signal.
- **Follow-up question type** - deepening (good) vs correcting (neutral) vs more-of-the-same (offloading).
- **Independent generation rate** - how often the user writes something substantive themselves, across all pages, not just AI interfaces.

### Output-quality metrics

- **Response relevance** - cosine similarity of response embedding to prompt embedding (did the model answer what was asked?).
- **Assumption density in the response** - "assuming/typically/in most cases" mark places where injected context would have produced a more specific answer.
- **Contradiction rate** - internal contradictions within a single response.
- **Enrichment delta** - pre- vs post-enrichment output quality, A/B tested on alternate prompts.

### Cognitive-domain health metrics (the Arc layer)

- **Depth per AI interaction** - is AI use happening during Coasting or Stretch?
- **Cognitive state at acceptance** - Overload-state acceptance is the highest-risk signal: decisions on unvetted output while depleted.
- **Generative ratio** - independent generative work vs AI-assisted work, correlated with Arc state. The direct measure of exercise vs offloading.
- **Recovery curve** - after Overload, how long to return to Stretch, and whether AI use extends or shortens it. Nobody has measured this before.

# 7\. What "improvement" looks like

**Prompt-quality improvement** is visible when specificity rises without the system's prompts triggering, constraint density rises in unassisted prompts, and the user starts stating success criteria unprompted - the skill has transferred, not merely been compensated for.

**Cognitive protection** is visible when acceptance rate stops correlating with Overload (the user flags output for review regardless of state), read time rises, follow-up depth rises, and independent generation holds or rises even as AI capability grows around them.

**Cognitive enhancement** (the hardest claim, made measurable by Arc) is visible when Stretch-window duration during AI-assisted work rises over 90 days, the Ceiling Migration Rate is positive during heavy AI use (capacity developing, not atrophying), and the gap between unassisted and enriched prompt quality narrows - the closing of the skill-transfer loop.

# 8\. Technical specification

_Version 0.1 - April 2026 - HYLE Global Private Limited - Confidential._ The foundational constraint below drives every decision.

## 8.1 Architectural philosophy

The extension has no UI in the traditional sense: no modals, no loading states, no panels that appear while the user waits. Every intervention happens either during an action the user is already performing or invisibly in the background. The generative prompt fires during typing; response analysis runs during reading; context extraction happens during the natural pause between finishing a thought and sending; Arc integration shapes behaviour continuously. It is a layer of intelligence woven into the interaction, not a checkpoint before or after it.

## 8.2 System architecture overview

Six interconnected systems share a unified event bus and a local-first data store, with selective cloud sync for the longitudinal-model components:

| **System**                  | **Role**                                                                                                              |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Perception Layer            | Observes everything happening in the browser (input field, response container, page context).                         |
| Arc Integration Layer       | Maintains a continuous real-time Bluetooth connection to the wearable and ingests the weekly personalisation payload. |
| User Intelligence Model     | The persistent, longitudinal knowledge base about this specific person (7 components).                                |
| Generative Prompt Engine    | Produces the dynamic incomplete-thought (ghost-text) interventions during typing.                                     |
| Enrichment Engine           | Constructs the enriched prompt sent to the AI (5-layer prefix + state-varying suffix).                                |
| Response Intelligence Layer | Processes the AI output during the user's reading of it (4 simultaneous analyses).                                    |

## 8.3 Perception layer

A content script injected into every active page, with observers at three levels - the prompt input, the response container, and the page context.

- **Input field:** a continuous keystroke listener captures the full text on every keystroke (not just change events). Derives current text, words-per-minute at any moment, pause duration, deletion rate (deleted/typed over a rolling 30s window), and revision depth (how far back deletions reach - deep deletions are conceptual revisions and a high-value signal).
- **Cognitive-pause detection:** a pause of 1200 ms or more during typing is a cognitive pause (thinking, not word-finding). These are the primary trigger window for the generative engine - the brain is already generative; the system meets it there rather than interrupting.
- **Response container:** a MutationObserver fires on every DOM insertion during streaming, giving the response token-by-token so analysis completes before the user finishes reading.
- **Page context:** reads URL and structure to identify the interface (Claude / ChatGPT / Gemini / Perplexity / other) and the current thread; interface identity selects DOM selectors, thread structure feeds enrichment and gap classification.
- **Clipboard instrumentation:** copy events on the response and paste events into known productivity-tool domains feed output-utilisation tracking (used as-is vs starting point vs abandoned).

## 8.4 Arc integration layer

Maintains a persistent WebBluetooth connection (correct choice: runs in the browser, no native app, supports the needed polling without excess battery drain). It subscribes to the Arc's state-notification characteristic, which fires every 30 seconds with this packet:

| **State packet field** | **Meaning**                                                             |
| ---------------------- | ----------------------------------------------------------------------- |
| State label            | Coasting, Stretch, or Overload.                                         |
| Confidence             | 0 to 1.                                                                 |
| Depth Score            | Current score for the session.                                          |
| Time in state          | Seconds in the current state.                                           |
| HRV (RMSSD)            | Deviation from the user's personal morning baseline (positive = above). |
| tACS active + protocol | Whether stimulation is firing, and which (theta or alpha).              |
| Artifact flag          | Whether the current classification is considered reliable.              |
| Session elapsed        | Total session time.                                                     |

- **Rolling buffer:** last 20 packets (10 minutes). A state consistent for 6 packets (3 minutes) is treated as stable and acted on with full confidence; a fluctuating state is treated as transitional and acted on conservatively. Using the user's historical transition probabilities, the layer pre-empts changes (e.g. if in Stretch but trending toward Overload, increase enrichment depth pre-emptively).
- **Software-only fallback:** when Arc is not connected, infer state from behavioural proxies - typing 20%+ above baseline = Coasting; 30%+ below baseline with high deletion = Overload; near baseline with low deletion and long pauses = Stretch. Accuracy ~65% vs Arc's 80%+ ; degrades gracefully rather than switching off.
- **Weekly personalisation payload:** receives the updated Ceiling Migration Rate and its trend, the week's cognitive-state distribution, and intervention-sensitivity settings, used to calibrate thresholds (positive/accelerating Ceiling Migration Rate = reduce scaffolding and raise stem difficulty; flattening = probe new gap types).

## 8.5 User Intelligence Model

The persistent longitudinal knowledge base. Local storage with selective cloud sync, encrypted at rest, never transmitted in raw form. When an API call needs context it sends only derived representations (domain summary, gap distributions, task templates), never raw logs. Seven components:

| **Component**        | **Contents**                                                                                                                                                                                                                                                                                                     |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity             | Weighted domain-expertise graph (inferred from prompt complexity and corrections, not self-report), role and org context, working hours, communication register. Seeded by a 5-minute onboarding that asks the user to complete three sentences about their work (generative priming) rather than answer a form. |
| Task taxonomy        | Every task type the user performs, frequency, typical prompt/output length and format, audience and success-signal distribution per type. Types are learned from the user's own corpus, in the user's own language.                                                                                              |
| Gap profile          | The eight-dimensional gap frequency distribution, with conditional breakdowns (by task type, Arc state, time of day, prompt length, recency-weighted trend), plus a transfer registry and a regression monitor. The core of the longitudinal intelligence.                                                       |
| Session behaviour    | Correction-prompt frequency/classification, edit depth, acceptance rate by state, follow-up type distribution, independent generation rate. Session-scoped; rolls up to the gap profile at session end.                                                                                                          |
| Enrichment templates | Per-task parameterised structures that have produced the highest output quality for this user (personalised at the structural level, not fixed text).                                                                                                                                                            |
| Relationship         | Models of people the user communicates with/about: inferred expertise, risk tolerance, register, relationship dynamic, communication history. The most privacy-sensitive layer: stronger local encryption, never synced, quarterly user review.                                                                  |
| Output utilisation   | Downstream fate of outputs (used as-is / modified / inspiration only / abandoned). Combined with the gap profile, reveals which unaddressed gaps produce abandoned outputs - the strongest training signal.                                                                                                      |

## 8.6 Generative Prompt Engine

Produces the dynamic incomplete-thought during typing. Hard constraint: nothing during waiting, nothing interrupting a completed action, everything within composition.

- **Activation conditions (all must hold):** a cognitive pause (1200 ms); mid-prompt (not the start, not the end); prompt length ≥ 40 words (minimum for reliable classification); Arc state not Overload; and not the first pause in the prompt (the first is usually memory retrieval, not generation - the second and later pauses are where the generative circuit is most receptive).
- **Gap classification:** a quantised small language model in a service worker, < 50 ms, no network. Fine-tuned on the gap taxonomy plus the user's history (pushed weekly). Outputs ranked absent-gap types weighted by the user's profile for this task type and state.
- **Generation:** the structural stem form is learned (not from a template library); dynamic content is pulled from the identity and task layers; the combination is unique to this prompt, user, and moment. Whole generation budget: under 200 ms, before the finger reaches send.
- **Rendering:** injected into the input field as ghost text (lower-opacity, clearly a suggestion, like autocomplete). It disappears on any keystroke. Typing through it logs "fired, not engaged" (a training signal). A secondary pause after it appears = engagement (the brain completed it in working memory). A typed completion is captured and routed to the enrichment engine as high-confidence, user-attributed context.
- **Diversity constraint:** the same gap type cannot be targeted in consecutive sessions unless it is both the highest-frequency gap and the most correlated with output abandonment.
- **Learning update (per session):** for every fired prompt - engaged? completion typed? completion used by enrichment? output useful or abandoned? Arc state? - trains the generator toward stems that produce engaged completions that improve output for this user.

## 8.7 Enrichment Engine

Constructs the full enriched prompt at the moment of send (so it includes any text typed in response to the generative prompt). Under 100 ms on device using cached components, with a single lightweight task-classification API call only if local-model confidence < 0.8. Prefix in five layers, then a state-varying suffix; the user's text sits unchanged between them.

1. **Identity injection** - 2-4 sentences: who the user is, relevant expertise, register.
2. **Task-frame injection** - the goal below the surface task (not "write a cold email" but "move a risk-averse technical reader from skepticism to curiosity in under 90 seconds of reading").
3. **Gap-resolution injection** - context addressing the highest-impact absent gaps. Gaps resolved by a user completion use the user's own words verbatim and are attributed ("The user has specified…"); gaps resolved from the model are marked inferred ("Based on this user's context…"). The model weights attributed (ground-truth) context above inferred.
4. **Constraint injection** - the three most relevant standing constraints for this task type (the real-world limits the user never states because they feel obvious).
5. **Output-structure instruction** - the format the utilisation layer has learned the user actually uses (e.g. lead with recommendation; prohibit hedging if they always strip it).

**State-varying suffix:** Stretch - "Flag any assumption that, if wrong, would materially change your response." Coasting - "Lead with the single most important output. Be specific, not comprehensive." Overload - "Give one clear answer. No options, no alternatives, no caveats unless a caveat is the answer." Injection method varies by platform (API proxy preferred, DOM manipulation fallback). The enriched prompt is always viewable in the panel but never shown by default.

## 8.8 Response Intelligence Layer

Runs during reading, not after, via the streaming MutationObserver. Four simultaneous analyses:

- **Distillation** - a rolling one-sentence core claim, updated every ~200 tokens, finalised on completion. Compared against the user's stem completion (prediction accuracy) and used as the anchor for assumption analysis.
- **Assumption extraction** - the load-bearing assumptions (where, if wrong, the conclusion changes), classified per paragraph as it arrives; output ranked by impact.
- **Gap-completion analysis** - did enrichment resolve the targeted gaps? Which remain? Pre-generates the optimal follow-up so the user need not think about what to ask next.
- **Cognitive-engagement tracker** - scroll velocity, direction changes (scrolling back = re-reading), time before first action, whether they reached the end - builds the reading-depth model.

The layer never interrupts reading; its outputs surface only when the user opens the panel. Its real value is the longitudinal data it generates (e.g. which unresolved gaps produce assumptions in the response, which then re-prioritises the gap profile).

## 8.9 Gap-profile update pipeline

A background process on session end (10 minutes without prompt activity on a tracked interface, or browser close). Ingests five sources - correction-prompt log, generative-prompt engagement log (with completion text), response-layer assumption/gap analysis, clipboard/edit log, Arc session data - and writes five updates:

1. **Gap frequency distribution** - recomputed with an exponential moving average, decay factor 0.15 (recent sessions weigh more; older ones never vanish).
2. **Transfer registry** - a high-frequency gap not detected as absent in any prompt this session for 3 consecutive sessions is flagged potentially transferred; for 7, marked transferred (the engine reduces targeting weight).
3. **Regression monitor** - a transferred gap detected as absent in > 40% of this session's prompts reactivates targeting.
4. **Enrichment-template quality** - each fired template scored against the utilisation signal; low-scoring templates get a variant generated next session.
5. **Relationship layer** - new signals about named individuals from communication-task prompts.

Full run < 2 seconds on device, written to local storage immediately. A subset (gap distribution and template weights, anonymised) syncs to cloud for the central model that produces the weekly payload.

## 8.10 Cognitive-health measurement pipeline

Twelve metrics at three timescales connect everything to the Arc's longitudinal model and make the product defensible as a cognitive-health tool, not just a productivity tool.

| **Timescale**                          | **Metrics**                                                                                                                                                                                                                                                                            |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Session-level                          | Generative-prompt engagement rate; completion rate; gap-resolution rate; acceptance rate by Arc state (Coasting/Stretch/Overload separately); response read-depth score; independent generation rate.                                                                                  |
| Weekly (Sun eve, with the Arc insight) | Gap-transfer count; regression count; enrichment-dependency ratio (context supplied by extension vs user); prompt-specificity trend vs prior week; output-utilisation rate.                                                                                                            |
| Longitudinal (90-day)                  | Prompt-quality convergence rate (NORTH STAR - unassisted converging to enriched); cognitive-gap reduction rate (gaps transferred/reduced); Arc correlation index (correlation between behavioural engagement metrics and the Arc Ceiling Migration Rate - the dual-validation signal). |

**Shadow-mode protocol:** runs automatically once a week, during the user's historically highest-Stretch window, with no notification. The enrichment engine stands down; the generative engine fires but shows no ghost text; the response layer runs fully. The session is stored as the weekly unassisted baseline. The delta between Shadow and the rolling Full-mode average is the system's measured contribution - watching it narrow is the deepest proof of value.

## 8.11 Data architecture

- **Local store:** IndexedDB, event-sourced - every observable event stored as an immutable record (timestamp, session ID, Arc-state snapshot, payload). The gap profile and other models are derived views recomputed from the log, so the full history is always available and models can be rebuilt if the architecture changes.
- **Retention:** 90 days of full event logs, rolling to weekly summaries after 90 days and monthly after 12 months (the Arc correlation index needs only summaries, so the longitudinal measure persists indefinitely at low cost).
- **Cloud sync:** end-to-end encrypted, keys only on the user's devices. Syncs: anonymised gap distribution (central training), template weights (payload generation), measurement outputs (Arc insight), and derived user-model representations (multi-device continuity). Never leaves the device: raw behavioural logs, relationship-layer data, clipboard content, prompt text.
- **Shared backend:** the same backend as the Arc mobile app. The extension registers as a secondary device in the Arc device graph and reads the Ceiling Migration Rate and health metrics from the shared platform model rather than recomputing them.

## 8.12 Browser integration and platform targets

- **Initial targets:** Chrome and Arc browser (Arc browser because its user base overlaps the beachhead persona and it allows deeper content-script integration).
- **Standard:** Manifest V3 - a service worker for local-model inference and the session-end pipeline, content scripts for perception and DOM integration, and a side panel that is never open by default.
- **Interface adapters:** a common interface with per-platform implementations for Claude, ChatGPT, Gemini, Perplexity - each handles its DOM selectors, send-trigger detection, and injection method. API-proxy interception is preferred (zero visual change, handles attachments/multimodal); DOM manipulation is the fallback.
- **Roadmap:** Safari in the second release, Firefox after. Mobile deferred - the Arc BLE integration needs WebBluetooth, which has limited mobile-browser support, and the mobile use case is rarer for the beachhead persona.

## 8.13 Arc platform integration

Beyond real-time BLE polling, the extension is a first-class client in the Arc platform: same data model, personalisation pipeline, and insight system as the hardware and mobile app. The weekly payload carries updated gap weights (from anonymised cross-user training), the Ceiling Migration Rate and its 4-week trend, the week's state distribution, intervention-sensitivity settings, and the inputs for the Sunday insight. The Sunday insight reads across both surfaces at once, e.g.: "your Ceiling Migration Rate rose 8% this week; generative-prompt engagement was 71%; three gap types showed transfer; acceptance under Overload dropped 34% to 21%." Hardware and software telling the same story from two vantage points is the most powerful proof point, and it is only possible because both are built on the same platform from the start.

# 9\. Suggested build order

The client's stated sequence (foundation first, intelligence later):

1. **Arc Bluetooth connection and state-polling layer** - the foundation everything reads from. Include the software-only behavioural-proxy fallback so the product works without a device.
2. **Perception layer** - the DOM observation foundation (input keystrokes, response MutationObserver, page-context/interface detection, clipboard).
3. **Prompt-enrichment engine with a static domain model** - deliver value immediately; personalised model comes later with data.
4. **Response-analysis layer/panel** - distillation, load-bearing assumption, gap, engagement tracking.
5. **Generative Prompt Engine** - ghost-text stems with the local gap classifier; static gap taxonomy first, personalised targeting once data accrues.
6. **Longitudinal User Intelligence Model + gap-profile pipeline** - the system that improves enrichment and priming over time.
7. **Measurement pipeline + Shadow mode + full Arc platform integration** - the cognitive-health metrics and the dual-validation story.

# 10\. Key parameters and thresholds (quick reference)

| **Parameter**                            | **Value**                                                                                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Arc state polling                        | every 30 seconds                                                                                                  |
| Cognitive-pause threshold                | 1200 ms                                                                                                           |
| Min prompt length for gap classification | 40 words                                                                                                          |
| Gap classification (local model)         | < 50 ms, no network, in a service worker                                                                          |
| Generative-prompt total budget           | < 200 ms (before finger reaches send)                                                                             |
| Enrichment construction                  | < 100 ms; task-classification API call only if local confidence < 0.8                                             |
| Arc state buffer                         | last 20 packets (10 min); "stable" = 6 consecutive packets (3 min)                                                |
| Gap-profile update                       | exponential moving average, decay 0.15                                                                            |
| Transfer detection                       | flag after 3 consecutive sessions; confirm "transferred" after 7                                                  |
| Regression trigger                       | transferred gap absent in > 40% of a session's prompts                                                            |
| Session end                              | 10 min without prompt activity, or browser close                                                                  |
| Session-end pipeline runtime             | < 2 s on device                                                                                                   |
| Classification accuracy                  | Arc ≈ 80%+; behavioural proxy ≈ 65%                                                                               |
| Behavioural proxy                        | +20% WPM vs baseline = Coasting; -30% + high deletion = Overload; baseline + low deletion + long pauses = Stretch |
| Local retention                          | 90 days full logs → weekly summaries; → monthly after 12 months                                                   |
| Standard                                 | Manifest V3 (service worker + content scripts + side panel)                                                       |

# 11\. Glossary

| **Term**                        | **Meaning**                                                                                                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Arc                             | The HYLE neuro-wearable (in-ear + over-ear) that reads brain state and can apply gentle neurostimulation (tACS / tDCS).            |
| Cognis                          | This product - the browser-extension software layer of the Arc platform.                                                           |
| Coasting / Stretch / Overload   | The three cognitive states Arc classifies. Stretch = engaged depth; Coasting = under-engaged; Overload = depleted.                 |
| Depth Score                     | Arc's per-session measure of cognitive depth.                                                                                      |
| Ceiling Migration Rate          | Arc's longitudinal measure of whether the brain's capacity for deep work is developing (positive) or flattening.                   |
| tACS / tDCS                     | Non-invasive neurostimulation Arc can apply (tACS = alternating current, used here to push toward Stretch; theta/alpha protocols). |
| FlowState                       | An earlier/related HYLE product line (learning engine); the hardware glasses reference comes from its Phase 3.                     |
| Generative priming              | Showing a sentence stem the brain involuntarily completes, to activate generation rather than retrieval.                           |
| Gap profile                     | The user's signature distribution across the eight cognitive-gap types.                                                            |
| Prompt-quality convergence rate | North-star metric: how fast unassisted prompt quality approaches enriched prompt quality.                                          |
| Shadow / Guided / Full          | The three scaffolding modes (measure-only / partial / full assistance).                                                            |
| WebBluetooth / BLE              | Browser Bluetooth API used for the real-time Arc connection.                                                                       |
| Manifest V3                     | The current Chrome extension platform standard.                                                                                    |
| EMA                             | Exponential moving average (used for the gap-profile update).                                                                      |

# 12\. Open questions and decisions to confirm

Decisions already made in the source conversation (do not re-litigate):

- **Arc-native from day one** - not a standalone tool that later integrates. Build the BLE/state layer as the foundation.
- **No "exercise" framing** - the user never does anything that feels like an exercise; nothing happens during waiting; everything is in-flow.

To confirm with the client before/early in the build:

- **Legal / ToS:** intercepting and modifying third-party AI interfaces (proxy or DOM injection) may conflict with those products' terms of service - get a review.
- **On-device model:** choose the quantised small model for gap classification and stem generation that fits the < 50 ms / service-worker budget; define the weekly fine-tune push.
- **Pre-flight latency:** confirm the extra meta-call ("ask the AI what context it needs") fits the no-waiting constraint, or run it speculatively during typing.
- **Privacy posture:** confirm the relationship-layer rules (never synced, quarterly review) and the encryption/keys model for cloud sync.
- **Arc backend contract:** the device-graph registration, the BLE service/characteristic UUIDs, and the weekly-payload schema must come from the Arc hardware/app team.
- **Onboarding copy:** the three sentence-completion prompts that seed the identity layer.

_End of specification. Compiled from the originating conversation (HYLE x Claude, April 2026). Confidential._