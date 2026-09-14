# Cognis

A browser extension that helps you keep thinking while you use AI.

## The problem

AI assistants are very good at giving you an answer. That is exactly why they are easy to lean on: you type a vague prompt, get something plausible back, accept it, and move on. Do that often enough and the work of framing a problem — noticing what you actually want, which constraints matter, what you are assuming — quietly shifts from you to the model.

The cost is invisible in the moment. The task still ships. But the skill of formulating the problem stops developing, and over time you get worse at the part the model cannot do for you.

Cognis is built on a simple bet: the fix is not to use AI less. It is to make the moment *before* you hit send a little more deliberate.

## What it does

Cognis runs alongside ChatGPT, Claude, and Gemini and does two things.

**While you write**, it notices when a prompt is under-specified — no stated goal, no constraints, no context about what you have already tried. When you pause to think, it offers a short ghost-text opener you can continue in your own words, drawn from a local template set. There is no model call and no spinner; suggestions appear during a natural pause or not at all.

**When you submit**, it prepends locally-generated context to your prompt — your stated preferences, the current task frame, and guidance derived from the gaps it detected — then sends the expanded version. This changes what the model receives, so it is worth understanding before you install: see [Prompt enrichment](#prompt-enrichment).

**Over time**, it tracks how your prompting changes: which gaps you keep leaving, whether you start closing them without being asked, how much of your work has become automatic. That lives in a side panel you open when you want it, not a notification that interrupts you.

## Design principles

**Local-first.** Everything runs in your browser. There is no server and no telemetry — the source contains no network calls at all. Raw prompt text is never written to storage: the extension reads what you type in memory to detect gaps, then persists only the derived signal (a gap type and a confidence score).

**Never in the way.** Suggestions are generated synchronously from local templates and cost nothing to ignore. Cognis never blocks you waiting on itself.

**Bounded memory.** Stored behavioural data expires after 90 days.

## Prompt enrichment

Cognis intercepts submit on supported sites. Before the prompt reaches the model it prepends context blocks assembled from local templates in [`src/core/config/enrichment_layers.json`](src/core/config/enrichment_layers.json), rewrites the input field with the result, and re-fires the site's own submit.

This is the most intrusive thing the extension does, so be aware of it:

- The model sees more than you typed. Your own words are never altered or removed, but instructions you did not write are added around them.
- The added text is assembled locally from static templates. Nothing is sent anywhere to produce it.
- The default templates are still placeholders and carry opinionated instructions (for example, suppressing code blocks). Edit the config to match how you actually work.

The behaviour is implemented in [`SubmitInterceptor`](src/platforms/observers/SubmitInterceptor.ts) and [`EnrichmentEngine`](src/engines/enrichment/EnrichmentEngine.ts). Making it opt-in and user-visible is a priority — see [Status](#status).

## Install

Requires Node 20+ and a Chromium browser.

```bash
git clone https://github.com/prajein/cognis.git
cd cognis
npm install
npm run build
```

Then load it:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` folder

Open ChatGPT, Claude, or Gemini and start typing. Click the extension icon for the side panel.

## Development

```bash
npm run build      # build the extension
npm run test       # validate schemas and generated assets
npm run selftest   # run engine self-tests
```

The codebase is event-driven: modules never call each other directly, they publish and consume domain events on a central bus. Detection, suggestion, and analysis are pure logic with no DOM or storage access, which keeps them testable in isolation and makes adding another AI platform a matter of writing an adapter rather than a new pipeline.

See [CONTRIBUTING.md](CONTRIBUTING.md) if you would like to help.

## Status

Early and under active development. Interfaces and behaviour will change.

Cognis modifies the page it runs on and reads what you type into it. It is a research prototype, not a hardened product — read the source before trusting it with anything sensitive.

## License

MIT — see [LICENSE](LICENSE).
