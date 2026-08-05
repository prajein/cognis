# Milestone 0 — Hello Cognis

**Status:** ✅ Completed
**Owner:** Team Cognis
**Sprint:** Demo Roadmap — Milestone 0
**Started:** 2026-08-03
**Completed:** 2026-08-03

## Objective
Enable a first-time user to install Cognis as an unpacked Chrome extension and successfully open the Sidepanel without runtime errors.

## Deliverables
- Configured Vite + CRX build pipeline
- Valid Manifest V3 configuration
- Runnable Chrome extension bundle
- Sidepanel entry point
- Content script entry point

## Implementation
We resolved the critical blockers preventing Cognis from being built and loaded:
1. **Build Tooling & Dependencies**: 
   - Added `@crxjs/vite-plugin`, `vite`, `react`, and `react-dom` to the project.
   - Configured `vite.config.ts` to utilize the CRX plugin using our `manifest.json`.
   - Added the `build` script to `package.json`.
2. **Extension Manifest**:
   - Replaced the stubbed `manifest.json` with a valid Manifest V3 configuration.
   - Defined `permissions` (`sidePanel`, `storage`, `tabs`, `scripting`).
   - Registered the background service worker, side panel default path, and content scripts for ChatGPT.
3. **Content Script Bootstrapping**:
   - Added a basic console log to `src/content/content-script.ts` to ensure Vite successfully bundles it as a valid entry point.

## Validation Results

### Build Validation
- ✅ `npm run build` completed successfully.
- ✅ Production bundle generated under `dist/`.
- ✅ Manifest generated successfully.

### Installation Validation
- ✅ Chrome loaded the unpacked extension.
- ✅ Background service worker registered.
- ✅ Sidepanel opened successfully.

### Runtime Validation
- ✅ No runtime startup errors observed.

## Scope Boundaries
The following capabilities are intentionally deferred to later milestones:
- Runtime Inspector
- ChatGPT observation
- EventBus initialization
- Platform adapters
- Ghost Text
- Brain Map updates
- Cognitive engines

These omissions are intentional. Milestone 0 focuses solely on proving that Cognis can be built, installed, and launched successfully.

## Exit Criteria
Milestone 0 is complete when:
- The extension builds successfully.
- The extension installs successfully.
- The background service worker starts.
- The sidepanel opens.
- A first-time developer can reproduce this on a clean machine using only the README.

## Success Metric
A developer with no prior Cognis setup can install and launch the extension in under five minutes by following the README.

## Milestone Outcome
> ✅ Cognis has transitioned from an architectural codebase into a runnable Chrome Extension.

This milestone establishes the deployment foundation upon which all future observable product behavior will be built.

## Next Milestone
**Milestone 1 — Cognis Sees**
Building the Runtime Inspector debug view inside the sidepanel.
