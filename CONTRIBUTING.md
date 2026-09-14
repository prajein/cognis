# Contributing to Cognis

Thanks for taking a look. Cognis is early, so the most useful contributions right now are bug reports, honest feedback on whether the idea actually helps, and small focused fixes.

## Getting set up

Requires Node 20+ and a Chromium browser.

```bash
npm install
npm run build
```

Load `dist/` as an unpacked extension via `chrome://extensions` → Developer mode → Load unpacked. Rebuild and hit reload on the extension card to pick up changes.

Optionally enable the repo's git hooks, which stop `node_modules/` and `dist/` from being committed by accident:

```bash
git config core.hooksPath .githooks
```

## Before you open a pull request

```bash
npm run test       # schema validation and generated assets
npm run selftest   # engine self-tests
```

Both should pass. If you changed engine behaviour, add or update the matching `*.selftest.ts` file next to it.

## How the codebase is organised

Modules communicate only by publishing and consuming events on a central bus — they never call each other directly. Practically, that means:

- **Engines** (`src/engines/`) are pure logic. No DOM access, no storage access, no network. They consume events and publish events. This is what makes them testable in isolation, so please keep it that way.
- **Platform adapters** (`src/platforms/`) own all DOM knowledge. Supporting a new AI site means writing an adapter plus selectors, not touching the engines.
- **Storage** (`src/storage/`) subscribes to events and builds read models. Schema changes need a migration in `src/storage/migrations/`.

Two rules are worth stating explicitly because violating them is easy and the consequences are not obvious:

1. **Raw prompt text never goes on the event bus.** Engines may read live text in memory, but only derived signals (a gap type, a confidence score, a hash) may be published or persisted. Anything on the bus can end up in storage.
2. **Nothing blocks the user.** Suggestion paths run synchronously from local config. No network calls, no awaiting a model.

## Pull requests

Keep them focused — one concern per PR. Explain what changed and why; if it affects what the user sees or what data is stored, say so directly. Unfinished work is fine if it is marked as such.

## Reporting bugs

Open an issue with your browser and version, which AI site you were on, what you expected, and what happened. Console output from the extension's service worker and the page helps a lot.

Please do not file security issues as public issues — see [SECURITY.md](SECURITY.md).
