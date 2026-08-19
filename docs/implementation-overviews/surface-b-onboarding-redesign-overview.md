# Surface B & Onboarding UI Redesign — Implementation Overview

**Author:** prajein
**Date:** 2026-08-19
**Branch:** `prajein`

## Executive Summary

The sidepanel had drifted a long way from the "quiet, intelligent, observant, understated, computational" brief `surface-b.css` claimed for itself in its own header comment — in practice it had shipped as a generic blue-accented SaaS dashboard (Inter, rounded cards, `#3B82F6` everywhere, drop shadows, gradient buttons), with Surface B's live view crammed into one long vertical scroll: task picker, brain map, current-state hero, response metrics, cognitive topology, observations timeline, session metrics, and the full progress panel, all stacked on top of each other.

This pass replaces the visual system wholesale with the editorial identity already defined and proven out in `design_reference/` (the marketing site) — Instrument Serif for anything read as a sentence, Geist Mono for anything read as instrumentation, one reserved accent (an emerald pulse, meaning "this is live right now") instead of a rainbow of semantic blues, and bigger, more confident type throughout. Surface B's single long scroll is now three tabs — **Task**, **Session**, **Progress** — so a given screen holds one idea instead of eight. `design_reference/` itself is removed from the repo now that its aesthetic has been absorbed into the product; its logo and favicon were pulled out first.

## What Changed

### 1. Visual system rewrite — `src/sidepanel/surface-b.css`
- Full rewrite, same file. Old tokens (`--bg-primary`, `--text-primary/secondary/tertiary`, `--border-color`, `--accent-idle/active/processing`, Inter) are gone; nothing in the codebase referenced them after the rewrite (verified by grep).
- New tokens: `--bg`, `--fg`, `--dim`, `--faint`, `--border`, plus a single `--pulse` accent (green, dark-mode-brighter) reserved for "live" states — the status dot, the streaming brain-map border, the stale-metrics bar, the onboarding brand dot. Light and dark are both first-class, switched via `prefers-color-scheme`, matching the pattern the file already used rather than introducing a manual toggle nobody asked for.
- Two type voices instead of one flat sans scale: `.section-heading` (Instrument Serif, italic, for anything read as a title) and `.micro-label` (Geist Mono, tracked caps, for anything read as instrumentation — timestamps, counts, status). Hero state name went from 24px to a 2.4rem serif italic; body copy sizes came up across the board per the "bigger font" ask.
- New animation vocabulary: `fade-up` entrance on tab panels and timeline items, a sliding underline on the active tab, a breathing pulse on the live topology nodes, a blinking mono cursor accent — replacing the old flat `slide-fade-in`/`pulse-ring` pair with something that reads as considered rather than incidental.
- Fonts loaded via the same Google Fonts `@import` `design_reference/styles.css` already used (Instrument Serif + Geist Mono). The extension has no CSP override in `manifest.json`, so the default MV3 policy — which restricts `script-src`/`object-src`, not `style-src`/`font-src` — allows it; confirmed by building and checking the sidepanel still renders.

### 2. Surface B restructured into 3 tabs — `SurfaceB.tsx`, new `components/TabNav.tsx`
- **Task** — `TaskPicker` + `BrainMap` + `DisclosureLabel`. Picking a task now auto-advances to the Session tab instead of leaving the user staring at a picker.
- **Session** — the live view: current state, response metrics HUD, cognitive topology, observations timeline, session metrics, session review on end, dev telemetry controls.
- **Progress** — the existing `ProgressPanel` (cognitive/motor charts, skill balance, skill transfer), previously just tacked onto the bottom of the same infinite scroll.
- No data-flow changes — same hooks (`useSession`, `useInsights`, `useResponseMetrics`, `useProgress`), same conditional logic for session state, just re-homed under tabs instead of concatenated.

### 3. Component cleanup — fewer, plainer pieces
- Deleted `InsightCard.tsx` — dead code, never imported anywhere, and a near-duplicate of `ObservationsTimeline`'s job.
- `TaskPicker.tsx` — was three overlapping selection mechanisms at once (category pills *and* a native `<select>` dropdown *and* a duplicate chip grid of the first 8 filtered tasks). Cut to two: category pills filter a single chip grid. Same task set, one fewer redundant control to scan.
- `BrainMap.tsx`, `ResponseMetricsHUD.tsx`, `SessionMetrics.tsx`, `SessionReview.tsx`, `ProgressPanel.tsx` — pulled inline `style={{...}}` blocks (hardcoded hex colors, `blue-500`, stray `float: right`) out in favor of the shared CSS classes, so the new tokens are the only place color lives.
- `Header.tsx` — the "COGNIS" all-caps text label is now the Instrument Serif italic wordmark; settings popover kept functionally identical, restyled to match.

### 4. Onboarding redesign — `OnboardingFlow.tsx`
- Same three-question flow and identity-service contract (`answer1`/`answer2`/`answer3`), unchanged logic. Visual pass only: serif headline in place of a bold sans title, mono step numbers (`01`/`02`/`03`) instead of filled-circle badges, chip/input styling matched to the rest of the system, gradient submit button replaced with the same solid ink button used elsewhere.

### 5. `design_reference/` removed, assets preserved
- The marketing site directory (`index.html`, `styles.css`, Three.js hero, financial model, whitepaper, etc.) is deleted — it was reference material for this pass, not part of the shipped extension, and its aesthetic is now encoded directly in `surface-b.css`.
- `design_reference/public/squarelogotransp.png` and `favicon.jpg` copied to `src/assets/brand/cognis-logo.png` and `cognis-favicon.jpg` before deletion, in case a later pass wants a real extension icon (manifest currently declares none) or an in-product mark beyond the text wordmark.

## Test Results

- **VERIFIED**: `npx tsc --noEmit` — 0 errors.
- **VERIFIED**: `npm run build` — succeeds; `dist/assets/app-*.css` includes the rewritten stylesheet.
- **VERIFIED**: `grep` across `src/` for every removed CSS custom property (`--text-primary`, `--border-color`, `--accent-idle`, etc.) — zero remaining references outside the rewritten file itself.
- **NOT DONE**: no live browser check inside the actual Chrome side panel (no interactive browser available in this environment) — worth a manual load-unpacked pass before treating this as final, particularly for the tab-switch animation feel and dark-mode contrast on real hardware.

## Punch List (not attempted here)

- No manual extension icon wired into `manifest.json` — the logo asset is preserved but not hooked up; that's a separate, deliberate decision (icon set at multiple resolutions, `action.default_icon`), not a redesign task.
- Font files are still loaded remotely (Google Fonts `@import`); self-hosting them as local `.woff2` assets would remove the runtime network dependency but wasn't necessary for this pass to build and render correctly.
- `ThemeProvider.tsx` is still an empty stub — theming is entirely `prefers-color-scheme`-driven, matching how the file already worked; a manual light/dark toggle was not part of the ask.
