# Milestone 11: Settings / Mode UI Placeholder

This document outlines the implementation details and constraints for the **Settings / Mode UI Placeholder (P3)** implemented as the final task of the Milestone 11 feature scope.

---

## 1. Context & Objectives
To fulfill the requirement for a settings area allowing users to view and toggle execution modes, we introduced a lightweight Mode Selector. 
As this task was scoped as **P3 (Presentation-Only)**:
* We intentionally avoided changes to the core system-wide runtime modes.
* The backend and adapter runtime behavior continues to operate on the default `Full` integration logic.
* The UI communicates mode availability explicitly to avoid deceptive interactive states for features not yet built (e.g., `Guided` or `Shadow` mode).

---

## 2. Implementation Overview

### Component Layer (`Header.tsx`)
* **Settings Toggle**: Added a compact `<button>` within the `<header className="cognis-header">` grouped alongside the system connection status dot in a `.header-controls` container.
* **Local State Control**: Added a local `isSettingsOpen` React state to drive the visibility of the popover.
* **Click-Outside Dismissal**: Implemented a `useEffect`-driven mouse listener to close the settings popover automatically when the user clicks anywhere outside of the popover menu container.
* **Mode Options**:
  * **Full**: Represented as `.active`, styled with highlighted text to denote it is the currently active/operating mode.
  * **Guided**: Rendered with a `.disabled` status and an explicit `Coming soon` badge.
  * **Shadow**: Rendered with a `.disabled` status and an explicit `Coming soon` badge.

### Styling Layer (`surface-b.css`)
* Custom popover styles added under `/* Settings / Mode Popover */`.
* Popover positioned absolutely relative to the header controls container, with appropriate border styling matching the existing glass/panel design system.
* Disabled options use standard opacity reductions and neutral secondary text styling to indicate non-interactivity, preventing click animations or state mutations on hover.

---

## 3. Verification & Compliance
* **TypeScript & Build**: Successfully verified via `npx tsc --noEmit` and `npm run build`.
* **Zero System Intrusion**: Checked that no new EventBus types, config schemas, or persistence hooks were introduced, ensuring the M11 final release remains lightweight and clean.
* **Manual Checkpoints**:
  1. Header settings icon button is visible.
  2. Clicking the icon toggles popover visibility.
  3. Clicking outside the active popover correctly dismisses it.
  4. `Full` mode is active; clicking `Guided` or `Shadow` does nothing.
