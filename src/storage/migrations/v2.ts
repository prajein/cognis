/**
 * IndexedDB Schema Migration: Version 2 — Hardware-Ready Stores
 *
 * What & why: Suchit's Week-1 deliverable says to "create the hardware-ready
 * tables now (signal_frame, state_score, and so on) but leave them empty — that
 * way adding Arc later needs no migration." This migration does exactly that: it
 * creates the empty object stores that future Arc hardware will populate, so the
 * day hardware arrives is a matter of *writing* to existing stores, not evolving
 * the schema on a user's live database.
 *
 * Architectural constraints (identical to v1):
 * - Runs once, inside `onupgradeneeded`, when the DB upgrades from < 2 to >= 2.
 * - Idempotent: guarded by `objectStoreNames.contains`.
 * - Structure only — no data is written here. These stores stay empty in v0.1.
 *
 * Note: this is a NEW version rather than an edit to v1. v1 has already shipped;
 * IndexedDB only re-runs upgrades on a version bump, so existing databases pick
 * up these stores via v2 while new databases get v1 + v2 in sequence.
 */

import { Migration } from "../indexeddb/CognisDatabase";

export const v2Migration: Migration = {
  version: 2,
  upgrade(db: IDBDatabase): void {
    // 1. Signal Frame Store — raw Arc biosignal frames (EEG/PPG/IMU/temperature).
    //    Empty in v0.1; populated by the future Arc hardware adapter, whose
    //    `hardware.signal.received` events already exist in the registry.
    if (!db.objectStoreNames.contains("signal_frame")) {
      const signalFrame = db.createObjectStore("signal_frame", { keyPath: "id" });
      signalFrame.createIndex("by-session", "sessionId", { unique: false });
      signalFrame.createIndex("by-timestamp", "timestamp", { unique: false });
      signalFrame.createIndex("by-session-timestamp", ["sessionId", "timestamp"], {
        unique: false,
      });
    }

    // 2. State Score Store — modelled cognitive-state scores over time. Empty in
    //    v0.1; the software State Engine and future Arc state provider will write
    //    here through the same shape, preserving the hardware-agnostic contract.
    if (!db.objectStoreNames.contains("state_score")) {
      const stateScore = db.createObjectStore("state_score", { keyPath: "id" });
      stateScore.createIndex("by-session", "sessionId", { unique: false });
      stateScore.createIndex("by-timestamp", "timestamp", { unique: false });
      stateScore.createIndex("by-session-timestamp", ["sessionId", "timestamp"], {
        unique: false,
      });
    }
  },
};
