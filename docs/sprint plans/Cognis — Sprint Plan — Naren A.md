**COGNIS + ARC - INDIVIDUAL SPRINT PLAN**

**Naren A**

_Architecture Lead & AI Co-pilot Enrichment_

Software-first build sprint . 15 June - 15 August 2026 . Confidential - internal use

**A quick note: vibe-coding is welcome.** Lean on AI assistants (Claude, Cursor, Copilot) freely to move fast - get it working first. The coding standards in Section 5 are simply the "now make it clean" checklist you run before a task is done.

# 1\. What you are building

Cognis lives in a browser side panel and has two surfaces that share one backend:

- **Surface A - the AI Co-pilot:** works inside Claude and ChatGPT. It quietly enriches the user's prompt, offers gentle ghost-text "stems" during thinking pauses, and analyses the AI's answer as it appears.
- **Surface B - the Visualiser & Skill Progress:** lets the user log any kind of task, shows a brain-map of which regions that task uses, and tracks whether they are getting better over time.

Both surfaces read and write the same backend, so they behave like one product:

- **Event bus -** the one channel every part talks through - modules announce events and listen for them, instead of calling each other directly.
- **Event-sourced store (IndexedDB) -** an on-device log where every event is saved once and never edited; all the models are just views computed from that log.
- **User Intelligence Model -** the persistent profile of the user (in v0.1: Identity + Gap Profile).
- **Versioned JSON config -** all the numbers and templates (brain-activation profiles, gap rules, insight text) live here and load at runtime - no code change to update them.
- **Insight engine -** turns session data into plain, evidence-referenced notes.
- **State-inference layer -** guesses Stretch / Coasting / Overload from behaviour now, and will accept Arc's hardware signal later through the same interface.

## The architecture, at a glance

+--------------------------- COGNIS (browser side panel) ---------------------------+

| SURFACE A - AI Co-pilot SURFACE B - Visualiser & Skill Progress |

| works INSIDE Claude / ChatGPT logs any task, shows brain-map + insight |

+-----------------------------------+------------------------------+-----------------+

| ONE SHARED BACKEND |

Event bus . Event-sourced store (IndexedDB) . User Intelligence Model

Versioned JSON config . Insight engine . State-inference layer

|

( Arc hardware later plugs into the SAME hooks - no rebuild )

**Build everything "hardware-ready":** each part is built behind the same interface Arc's hardware will later fill, so adding hardware means switching on hooks that already exist - not rebuilding.

# 2\. The nine-week roadmap

This is the whole arc so you can see where your week fits. Your detailed weeks are in Section 6.

- **Week 1 (15-21 Jun) - Unified Foundation -** the shared architecture, data store and mock harness exist and are documented.
- **Week 2 (22-28 Jun) - Perception + Brain Map -** the extension reads typing and renders the brain map from config.
- **Week 3 (29 Jun-5 Jul) - Core Engines, Part One -** Checkpoint 1: ghost-text + enriched prompt visible; a session logs end to end.
- **Week 4 (6-12 Jul) - Live Adapters + Insights v1 -** runs on live Claude/ChatGPT (test account); first real insights appear.
- **Week 5 (13-19 Jul) - Integration Week (both surfaces) -** everything is wired together end to end; no new features.
- **Week 6 (20-26 Jul) - Response Intelligence + Automaticity -** Checkpoint 2: answer analysis on Surface A; automaticity phase on Surface B.
- **Week 7 (27 Jul-2 Aug) - Parity + Progress Charts (integration) -** ChatGPT matches Claude; first progress charts and the weekly digest.
- **Week 8 (3-9 Aug) - Hardware-Readiness + Docs -** confirm the Arc hooks are real; validate skill-progress maths; draft handoff.
- **Week 9 (10-15 Aug) - Final Integration + Demo -** reliable build; live demo on Friday 15 August.

# 3\. Your role on this sprint

You own the foundation the whole extension stands on: the shared architecture, the event bus, and the Enrichment Engine (the part that quietly wraps the user's prompt with helpful context). You are also the integration lead for Surface A.

This is your track because you have shipped a real production system before and made the hard call between fidelity and scale - which is exactly the judgement the architecture and Enrichment Engine need.

# 4\. How we work

- **Friday review (every week) -** the whole team meets on Friday to demo what shipped that week and plan the next. This is the main meeting - keep a working build ready to show.
- **Checkpoints -** end of Week 3 and Week 6, plus the final demo in Week 9 - each must be a runnable extension, not slides.
- **Integration weeks -** Weeks 5 and 7 - stop new features and focus on wiring the pieces together and stabilising.
- **Platform testing -** build against the local mock harness through Week 4; from Week 5, test on internal test accounts only (this keeps us inside the platforms' terms of service).
- **If you're blocked -** say so in the team chat the moment it happens - don't wait for Friday.

# 5\. Coding standards everyone follows

These keep four people's work fitting together cleanly. They are simple on purpose.

- **One repo, small pull requests -** branch per task, open a PR, keep it small enough to read in ten minutes; PRs are reviewed at or before the Friday review.
- **TypeScript for the extension, Python for ML/offline work -** type everything; avoid "any" unless you leave a note saying why.
- **Auto-format and lint -** Prettier + ESLint run on save. Don't debate style - the formatter decides, so reviews stay about logic.
- **Never hardcode numbers or text -** activation profiles, gap weights, thresholds and insight templates all live in the versioned JSON config and load at runtime. If you typed a number into code, it probably belongs in config.
- **Talk through the event bus, not directly -** a module announces an event and others listen; one module never reaches inside another. Add any new event name and shape to the architecture doc.
- **The golden rule: nothing happens while the user waits -** no blocking popups, no spinners. Anything the system does happens DURING typing, pausing or reading - never as a loading screen.
- **Respect the latency budgets -** ghost-text under 200 ms, enrichment under 100 ms. Put a timer on it; if you're over budget, simplify - don't ship it slow.
- **Local-first and private by default -** behavioural data stays on the device. Never store raw prompt text - store a hash. Follow the disclosure rule: in software mode every output is labelled a prediction or estimate, never a measurement.
- **Build hardware-ready, then leave it empty -** create the Arc fields and hooks now and leave them null; never take a shortcut that would force a rebuild when Arc arrives.
- **Every module ships a tiny self-test and a one-line "what & why" comment at the top -** and a checkpoint must run as a real extension, not a description of one.
- **Commit messages say what changed, in plain present tense -** e.g. "add gap-classification heuristics", not "updates".

## What is in and out of scope for v0.1

- **Arc hardware:** schema, hooks and interfaces are built and reviewed, but there is no live hardware connection in v0.1.
- **Platforms:** Claude and ChatGPT only (Gemini, Perplexity, Safari, Firefox come later).
- **Gap model:** rule-based heuristics + a small pretrained stem model now; the fine-tuned, personalised model is post-August.
- **User profile:** Identity and Gap Profile only (two of seven components).
- **Skill Progress:** the calculation engine, validated on 2-3 skill domains as proof; full coverage is post-August.
- **Insights:** universal insights only; per-task insight rules are post-August.
- **Measurement / Shadow mode:** session-level logging only; the full metric pipeline is post-August.

# 6\. Your nine-week plan

## Week 1 . 15-21 June - Unified Foundation

**Goal of the week:** Build the shared, hardware-ready foundation - the architecture, the data store and a safe practice environment - before any surface-specific features begin.

**What you build:** The skeleton of the extension, the event bus everything communicates through, and a safe "practice" copy of Claude/ChatGPT.

**How to build it:**

- Create one Manifest V3 project: a service worker, content-script injection, and a side-panel shell with empty placeholder views for BOTH surfaces.
- Design the event bus as simple publish/subscribe. Pick clear event names (for example prompt.typed, state.changed, response.chunk) and write their shapes in the architecture doc so nobody wires modules together directly.
- Build the mock harness: a local page that imitates Claude's and ChatGPT's input box and answer area, so the team develops without touching the live sites.

**Alongside you:** Naren stands up the extension shell, event bus and mock harness; Suchit builds the data store; Riya builds the brain-activation config; Yogesh drafts the gap-detection rules and picks the on-device approach.

**Deliverable:** architecture and schema documents committed; the mock harness runs; the activation-profile config validates against the schema.

## Week 2 . 22-28 June - Perception + Brain-Map Renderer

**Goal of the week:** The extension can watch how the user works in the mock harness, and can draw the brain map for any task from the config.

**What you build:** The piece that watches the AI's answer as it streams in, and tells Claude apart from ChatGPT.

**How to build it:**

- Put a MutationObserver on the answer container and publish each new chunk on the event bus as it arrives.
- Add interface detection from the page URL/structure so the right site selectors load.
- Keep all of this behind the event bus - the response logic should know nothing about the rest of the system.

**Alongside you:** Suchit leads the typing capture + state guess; Naren captures the streaming response and detects which site you're on; Riya leads the brain-map renderer; Yogesh wires the gap rules into a testable pipeline.

**Deliverable:** a live mock-harness demo of words-per-minute tracking, pause detection and state inference; the brain map renders for any task with the correct disclosure label.

## Week 3 . 29 June - 5 July - Core Engines, Part One

**Goal of the week:** Surface A produces a complete enriched prompt; Surface B runs a full session from start to finish.

**You lead this week.**

**What you build:** The Enrichment Engine - it wraps the user's prompt with five layers of context plus one state-based line - and getting it into the real input box.

**How to build it:**

- Build the five-layer prefix in order: Identity, Task-frame, Gap-resolution, Constraints, Output-structure, then one suffix line chosen by the user's state. It must wrap the user's text, never change it.
- Pull each layer from its source (Identity from the profile, gaps from the Gap Profile) and assemble from cached pieces so it finishes under 100 ms.
- Inject the enriched text into the site's input box via the page method for now (the cleaner API method is post-August).

**Alongside you:** Naren leads the Enrichment Engine + injection; Suchit builds onboarding + the Gap Profile; Riya leads the Surface-B session loop; Yogesh finishes stem generation within budget + ghost-text.

**Checkpoint 1:** in the mock harness a ghost-text stem appears during a pause and the enriched prompt is inspectable; on Surface B, selecting any task renders the map with its disclosure label and a session logs correctly from start to end.

## Week 4 . 6-12 July - Live Adapters + Insight Engine v1

**Goal of the week:** Move from the practice page onto live Claude and ChatGPT, and start generating real insights after sessions.

**What you build:** Making it work on the real Claude.ai and ChatGPT pages.

**How to build it:**

- Write one small adapter per site that knows that site's input box, send button and answer area.
- Keep each adapter in its own file, so when a site changes layout you fix one file (Week 7 is reserved for this).
- Switch the Enrichment Engine to inject through the live adapter.

**Alongside you:** Naren builds the live-site adapters; Suchit builds the session-end profile update; Riya leads the universal insight engine; Yogesh builds streaming distillation + duration-threshold notes.

**Deliverable:** the extension runs on live Claude and ChatGPT in a test account with ghost-text working; universal insights appear after any Surface-B session.

## Week 5 . 13-19 July - Integration Week - Both Surfaces

**Goal of the week:** Wire every part together so both surfaces run end to end. No new features this week.

**Integration week - you are the Surface-A integration lead.**

**What you build:** Wiring the whole Surface-A chain together on a live Claude tab.

**How to build it:**

- As integration lead, own the event-bus "contract": confirm every module sends and receives the agreed events.
- Walk the full chain - typing -> state -> enrichment -> injection -> ghost-text -> response capture - on a live tab and fix mismatches. No new features.

**Alongside you:** Naren is integration lead for Surface A; Riya is integration lead for Surface B; Suchit confirms the profile reaches the Enrichment Engine; Yogesh confirms the ghost-text and duration-note handoffs.

**Outcome:** both surfaces run end to end without manual help; an informal walkthrough at week's end (no formal checkpoint).

## Week 6 . 20-26 July - Response Intelligence + Automaticity

**Goal of the week:** Surface A reads the live answer; Surface B computes the automaticity phase - both on real data.

**What you build:** One side panel that holds both surfaces, and enforcing the "nothing while waiting" rule.

**How to build it:**

- Build side-panel v1 combining Surface A's answer-analysis view and Surface B's Now/Progress tabs, closed by default.
- Make sure no content appears while the user waits for the AI - it shows only after the answer finishes and only when the user opens the panel.

**Alongside you:** Riya leads Surface A's answer analysis this week; Yogesh leads the Surface-B automaticity engine; Suchit builds the reading-engagement tracker; Naren builds the unified panel.

**Checkpoint 2:** after a live answer, the panel shows the one-sentence distillation, the load-bearing assumption and the unaddressed gap; on Surface B, after 3+ sessions of a task, the automaticity phase shows with a progress note.

## Week 7 . 27 July - 2 August - Platform Parity + Progress Charts

**Goal of the week:** Make ChatGPT behave like Claude, and give Surface B its first progress charts and weekly digest.

**What you build:** Bringing ChatGPT up to the same level as Claude.

**How to build it:**

- Fix the ChatGPT adapter for its layout quirks, its different send trigger and its different streaming behaviour.
- Cross-test with the team on both sites.

**Alongside you:** Naren fixes the ChatGPT adapter; Suchit hardens storage; Riya leads the progress-curve charts; Yogesh builds the weekly digest + the AI-dependency check.

**Deliverable:** stable on both sites for a 20-minute session; at least one progress chart renders from 3+ real sessions; the weekly digest assembles.

## Week 8 . 3-9 August - Hardware-Readiness Pass + Docs

**Goal of the week:** Prove the Arc hooks really exist in the build, prove the skill-progress maths, and write the handoff.

**What you build:** Tidy the interface, add the settings/mode placeholder, and help confirm the Arc hooks are real.

**How to build it:**

- Polish both surfaces; add a settings area with a Full/Guided/Shadow mode toggle (only Full works for now).
- Join the row-by-row walkthrough of the Hardware Integration Map and confirm each hook exists in the build.

**Alongside you:** Suchit finalises event logging + null hardware fields; Riya leads the skill-progress balance-score validation; Yogesh documents the swappable config; Naren polishes the UI; the whole team walks the Hardware Integration Map row by row.

**Deliverable:** the Hardware Integration Map is validated against the live build; the balance score is correct on the test domains; the architecture + hardware handoff document is drafted.

## Week 9 . 10-15 August - Final Integration, Testing + Demo

**Goal of the week:** A reliable build on both surfaces, and a clear plan for what comes next.

**What you build:** Carry the architecture, adapters and panel through final testing and the live demo.

**How to build it:**

- Lead Surface-A regression across both sites and session lengths; freeze on Thursday; rehearse the demo at least five times.

**Alongside you:** Mon-Wed everyone fixes bugs and regression-tests; Thursday is code freeze and 5+ demo rehearsals; Friday 15 August is the live demo.

**Final demo (Fri 15 Aug):** Surface A's full Co-pilot loop on Claude; Surface B's session -> brain map -> insight -> progress loop; and a walkthrough of the hardware-readiness seams.

# 7\. Risks you help manage

- **Terms-of-service exposure from injecting into Claude/ChatGPT -** you develop on the mock harness through Week 4 and use internal test accounts only from Week 5. This risk sits closest to your adapters.
- **Site layout drift -** adapters are isolated by design and Week 7 is reserved for fixing them - you own this.
- **Integration surprises -** your Week-1 architecture doc is the main defence; Week 5 is the buffer.

# 8\. What you deliver by 15 August

- The extension architecture: the event bus and Manifest V3 skeleton.
- The Enrichment Engine (five layers + state suffix).
- The live Claude/ChatGPT adapters and the unified side panel.
- Your share of the architecture handoff document.

# 9\. After this sprint (for context)

Not part of this sprint - shown so you see where your work leads next:

- API-based injection to replace page manipulation where the platforms allow it.
- Gemini and Perplexity adapters, then Safari and Firefox.