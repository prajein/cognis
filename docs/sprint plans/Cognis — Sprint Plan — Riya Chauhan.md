**COGNIS + ARC - INDIVIDUAL SPRINT PLAN**

**Riya Chauhan**

_Visualiser & Skill-Progress Lead (and ML on the AI Co-pilot)_

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

You own Surface B - the brain-map visualiser, the session loop, the automaticity and skill-progress logic, and the insight engine - and you are its integration lead. In the weeks where Surface A needs machine-learning-flavoured work (reading the AI's answer), you lead that too.

This is your track because of your ML/MLOps background and your experience building inference that runs under tight latency and resource limits - which is exactly what the answer-analysis and the progress models need. Where a task below is rendering or UI, lean on a component library and pair with Naren; your core value is the models and the logic behind the screens.

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

**What you build:** The data file that says, for each of the 47 tasks, which brain regions light up - the "research baseline" the whole Visualiser reads.

**How to build it:**

- Build the versioned activation-profile config (JSON): 47 task/subclass rows, each with the ten region scores (0-4) taken straight from the spec tables, loaded at runtime - never hardcoded.
- Seed the task list from the full taxonomy.
- Treat this as your ground-truth data set: it is what every later model and chart is checked against.

**Alongside you:** Naren stands up the extension shell, event bus and mock harness; Suchit builds the data store; Riya builds the brain-activation config; Yogesh drafts the gap-detection rules and picks the on-device approach.

**Deliverable:** architecture and schema documents committed; the mock harness runs; the activation-profile config validates against the schema.

## Week 2 . 22-28 June - Perception + Brain-Map Renderer

**Goal of the week:** The extension can watch how the user works in the mock harness, and can draw the brain map for any task from the config.

**You lead this week (Surface B).**

**What you build:** The brain-map picture that lights up regions for the chosen task, with an honest "this is a prediction" label.

**How to build it:**

- Render the ten-region brain map as an SVG whose colour intensity reads directly from the config (0 = outline only ... 4 = peak fill). Use a component library and vibe-code the rendering first, then clean it.
- Build the task picker, and the always-visible disclosure label ("Research baseline - no hardware connected").

**Alongside you:** Suchit leads the typing capture + state guess; Naren captures the streaming response and detects which site you're on; Riya leads the brain-map renderer; Yogesh wires the gap rules into a testable pipeline.

**Deliverable:** a live mock-harness demo of words-per-minute tracking, pause detection and state inference; the brain map renders for any task with the correct disclosure label.

## Week 3 . 29 June - 5 July - Core Engines, Part One

**Goal of the week:** Surface A produces a complete enriched prompt; Surface B runs a full session from start to finish.

**You lead this week (Surface B).**

**What you build:** The session "loop" for Surface B - start, run, end, insight, progress.

**How to build it:**

- Build the session lifecycle as a clear state machine: IDLE -> TASK_SELECTED -> SESSION_ACTIVE -> SESSION_ENDED -> INSIGHT_GENERATED -> PROGRESS_UPDATED.
- Build the start/end logging (task, duration, session number) and the task profile card. The thinking here is the phase logic, not heavy UI.

**Alongside you:** Naren leads the Enrichment Engine + injection; Suchit builds onboarding + the Gap Profile; Riya leads the Surface-B session loop; Yogesh finishes stem generation within budget + ghost-text.

**Checkpoint 1:** in the mock harness a ghost-text stem appears during a pause and the enriched prompt is inspectable; on Surface B, selecting any task renders the map with its disclosure label and a session logs correctly from start to end.

## Week 4 . 6-12 July - Live Adapters + Insight Engine v1

**Goal of the week:** Move from the practice page onto live Claude and ChatGPT, and start generating real insights after sessions.

**You lead this week (Surface B).**

**What you build:** The first real insights after a session.

**How to build it:**

- Build the universal insight engine: compare this session's state-quality to the last same-task session, name the dominant predicted region, say whether the automaticity phase advanced, and check milestones.
- Each insight is a template filled with the user's real numbers and only shows when the data supports it (the disclosure rule).

**Alongside you:** Naren builds the live-site adapters; Suchit builds the session-end profile update; Riya leads the universal insight engine; Yogesh builds streaming distillation + duration-threshold notes.

**Deliverable:** the extension runs on live Claude and ChatGPT in a test account with ghost-text working; universal insights appear after any Surface-B session.

## Week 5 . 13-19 July - Integration Week - Both Surfaces

**Goal of the week:** Wire every part together so both surfaces run end to end. No new features this week.

**Integration week - you are the Surface-B integration lead.**

**What you build:** Wiring Surface B together end to end.

**How to build it:**

- As Surface-B integration lead, connect task selection -> session loop -> logging -> universal insight -> the progress-tab shell, and resolve mismatches.

**Alongside you:** Naren is integration lead for Surface A; Riya is integration lead for Surface B; Suchit confirms the profile reaches the Enrichment Engine; Yogesh confirms the ghost-text and duration-note handoffs.

**Outcome:** both surfaces run end to end without manual help; an informal walkthrough at week's end (no formal checkpoint).

## Week 6 . 20-26 July - Response Intelligence + Automaticity

**Goal of the week:** Surface A reads the live answer; Surface B computes the automaticity phase - both on real data.

**You lead this week (Surface A - the ML work).**

**What you build:** The machine-learning read of the AI's answer - the key assumption it rests on and what it skipped. (Your ML week.)

**How to build it:**

- Build assumption extraction: as the answer streams, find the load-bearing assumptions paragraph by paragraph and rank them - a natural-language-inference / entailment approach works well here.
- Build gap-completion analysis: did the answer resolve the gap you targeted? Reuse the gap signal. Keep it inside the runtime/latency limits.

**Alongside you:** Riya leads Surface A's answer analysis this week; Yogesh leads the Surface-B automaticity engine; Suchit builds the reading-engagement tracker; Naren builds the unified panel.

**Checkpoint 2:** after a live answer, the panel shows the one-sentence distillation, the load-bearing assumption and the unaddressed gap; on Surface B, after 3+ sessions of a task, the automaticity phase shows with a progress note.

## Week 7 . 27 July - 2 August - Platform Parity + Progress Charts

**Goal of the week:** Make ChatGPT behave like Claude, and give Surface B its first progress charts and weekly digest.

**You lead this week (Surface B).**

**What you build:** The "are you getting better?" charts.

**How to build it:**

- Build the models behind two progress charts: for a cognitive task, prefrontal cost (should fall) vs session quality (should hold); for a motor task, M1 (falls) vs Cerebellum (rises), with the crossing point labelled as the automaticity transition.
- You produce the chart-ready numbers; a chart library draws them.

**Alongside you:** Naren fixes the ChatGPT adapter; Suchit hardens storage; Riya leads the progress-curve charts; Yogesh builds the weekly digest + the AI-dependency check.

**Deliverable:** stable on both sites for a 20-minute session; at least one progress chart renders from 3+ real sessions; the weekly digest assembles.

## Week 8 . 3-9 August - Hardware-Readiness Pass + Docs

**Goal of the week:** Prove the Arc hooks really exist in the build, prove the skill-progress maths, and write the handoff.

**What you build:** Proving the skill-progress maths works.

**How to build it:**

- Build and validate the balance score (the coefficient of variation of hours across a skill's subclasses: 0 = balanced, above 0.5 = concentrated) against 2-3 multi-subclass domains.
- Surface the cross-subclass transfer notes (for example, serve practice predicting match-play improvement) as non-guaranteed predictions.

**Alongside you:** Suchit finalises event logging + null hardware fields; Riya leads the skill-progress balance-score validation; Yogesh documents the swappable config; Naren polishes the UI; the whole team walks the Hardware Integration Map row by row.

**Deliverable:** the Hardware Integration Map is validated against the live build; the balance score is correct on the test domains; the architecture + hardware handoff document is drafted.

## Week 9 . 10-15 August - Final Integration, Testing + Demo

**Goal of the week:** A reliable build on both surfaces, and a clear plan for what comes next.

**What you build:** Carry Surface B and your answer-analysis work through final testing and the demo.

**How to build it:**

- Regression-test the session loop, insights and charts; support the rehearsals.

**Alongside you:** Mon-Wed everyone fixes bugs and regression-tests; Thursday is code freeze and 5+ demo rehearsals; Friday 15 August is the live demo.

**Final demo (Fri 15 Aug):** Surface A's full Co-pilot loop on Claude; Surface B's session -> brain map -> insight -> progress loop; and a walkthrough of the hardware-readiness seams.

# 7\. Risks you help manage

- **Heuristics/models seen as rough without real data -** this is an explicit v0.1 boundary - keep everything in swappable config so the better model drops in later without engine changes.
- **Skill-progress maths not statistically strong in nine weeks -** Week 8 is about the calculation being correct, not statistically significant - label everything as an estimate per the disclosure rules.
- **Rendering work is not your strength -** lean on a component/chart library and pair with Naren; your deliverable is the model and logic, not pixel-perfect UI.

# 8\. What you deliver by 15 August

- The activation-profile config and the Surface-B session loop.
- The universal insight engine and the automaticity/skill-progress logic.
- The progress-curve models and the validated balance score.
- Surface A's answer-analysis ML (assumption extraction + gap-completion), and your share of the handoff document.

# 9\. After this sprint (for context)

Not part of this sprint - shown so you see where your work leads next:

- The fine-tuned, personalised models once v0.1 produces usage data.
- The full thirteen-domain skill-progress system and per-task insight rules.