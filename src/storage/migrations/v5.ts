/**
 * IndexedDB Schema Migration: Version 5 — Remove Hardware-Ready Stores
 *
 * What & why: v2Migration created two empty object stores (`signal_frame`,
 * `state_score`) reserved for a future Arc hardware adapter. Hardware is out
 * of scope for the current MVP — no engine writes to or reads from either
 * store (confirmed by repo-wide search), so they are pure inert scaffolding.
 * This migration removes them so nothing hardware-shaped survives in the
 * schema, matching the same "no placeholder functionality" bar applied to
 * the event contracts and mock harness.
 *
 * Architectural constraints (identical to v1/v2):
 * - Runs once, inside `onupgradeneeded`, when the DB upgrades from < 5 to >= 5.
 * - Idempotent: guarded by `objectStoreNames.contains`.
 * - Deletion only — no other store is touched.
 */

import { Migration } from "../indexeddb/CognisDatabase";

export const v5Migration: Migration = {
  version: 5,
  upgrade(db: IDBDatabase): void {
    if (db.objectStoreNames.contains("signal_frame")) {
      db.deleteObjectStore("signal_frame");
    }
    if (db.objectStoreNames.contains("state_score")) {
      db.deleteObjectStore("state_score");
    }
  },
};
