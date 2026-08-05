# Milestone 2: Surface A Perception Overview

## What We Built

In Milestone 2, we successfully brought Cognis's "Ghost Text" perception loop to life within a live ChatGPT session. We proved that the system can observe typing behavior, run cognitive gap detection against the raw text locally in-memory, and render non-intrusive UI overlays without violating the strict privacy and decoupling constraints of the architecture.

### 1. Transient Gap Detection
The `GapDetectionEngine` was enhanced with a `captureTransientText()` method. Because ADR-019 strictly prohibits raw prompt text from traveling over the EventBus, the `TypingObserver` (Perception Layer) synchronously passes the raw text directly into a temporary memory buffer in the Gap engine just milliseconds before emitting a `pause.detected` event on the EventBus. When the Gap Engine consumes the pause event, it processes the text against its stem configurations and immediately clears the buffer.

### 2. Event-Driven Ghost Text State Machine
We built a completely decoupled `GhostTextObserver` that acts as a pure UI perception layer. It does not contain any intelligence or decision-making logic. It simply listens to `GhostTextEvents.GENERATED` (published by the `GhostTextEngine`) and mounts an idempotent CSS/DOM overlay over the active ChatGPT input area. 

### 3. Engine Bootstrapping
We fixed the content script bootstrapping sequence so that the `GapDetectionEngine`, `GhostTextEngine`, and `StateEngine` all initialize securely in the `content-script.ts` entry point, connecting directly to the local EventBus instances before bridging specific events to the Background Script.

## Key Technical Decisions
* **Idempotent DOM Injections:** Because React aggressively unmounts and remounts elements, the `GhostTextObserver` checks for the existence of its injected `<style>` tags and overlay elements before attempting to render, preventing UI duplication and infinite render loops.
* **Separation of Concerns:** The `TypingObserver` remains oblivious to the existence of stems or Ghost Text, just as the `GhostTextObserver` remains oblivious to how pauses or gaps are detected. Everything is mediated cleanly by EventBus payloads.
* **Transient Text Buffer:** We respected ADR-019 by utilizing a single-use string buffer (`pendingText`) in the Gap Engine instead of modifying the canonical Event Contracts.

## Verification Outcome
The extension was loaded into Chrome and tested against `chatgpt.com`. 
- Typing triggered `prompt.typed` events.
- Pausing for 2 seconds fired `pause.detected` and `gap.detected`.
- The `GhostTextEngine` generated a stem and emitted `ghosttext.generated`.
- The `GhostTextObserver` successfully rendered the grey stem inline with the user's text.
- Pressing `Tab` successfully accepted the text, updated React's internal state via an `input` event, and cleared the UI overlay.

Milestone 2 was successfully integrated and merged to `main`.
