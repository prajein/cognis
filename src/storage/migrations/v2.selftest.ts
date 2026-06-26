/**
 * Hardware-Ready Stores (v2 migration) — self-test
 *
 * What & why: the Definition of Done requires a tiny self-test. IndexedDB is not
 * available outside a browser and the repo has no fake-indexeddb dependency, so
 * this test drives the migration with a minimal in-memory mock of the IndexedDB
 * upgrade surface (`createObjectStore` / `createIndex` / `objectStoreNames`). It
 * proves the migration creates the right empty stores and indexes and is
 * idempotent — pure, deterministic, zero dependencies.
 *
 * Run (after a throwaway compile):
 *   tsc --module commonjs --moduleResolution node10 --ignoreDeprecations 6.0 \
 *       --rootDir src --outDir .selftest --noEmit false --resolveJsonModule
 *   node .selftest/storage/migrations/v2.selftest.js
 */

import { v2Migration } from "./v2";
import { migrations } from "./index";

// ---------------------------------------------------------------------------
// Tiny test harness
// ---------------------------------------------------------------------------

interface SelfTestReport {
  readonly passed: number;
  readonly failed: number;
  readonly failures: readonly string[];
}

class Checker {
  passed = 0;
  failed = 0;
  readonly failures: string[] = [];
  ok(condition: boolean, label: string): void {
    if (condition) this.passed++;
    else {
      this.failed++;
      this.failures.push(label);
    }
  }
  eq(actual: unknown, expected: unknown, label: string): void {
    this.ok(actual === expected, `${label} (expected ${String(expected)}, got ${String(actual)})`);
  }
}

// ---------------------------------------------------------------------------
// Minimal IndexedDB upgrade mock
// ---------------------------------------------------------------------------

interface CreatedStore {
  keyPath: string;
  indexes: Map<string, { keyPath: string | string[]; unique: boolean }>;
}

class MockDatabase {
  readonly stores = new Map<string, CreatedStore>();

  constructor(existing: string[] = []) {
    for (const name of existing) {
      this.stores.set(name, { keyPath: "id", indexes: new Map() });
    }
    this.preExisting = new Set(existing);
  }

  /** Names present BEFORE this upgrade ran (so the test can detect re-creation). */
  private readonly preExisting: Set<string>;
  createdNames: string[] = [];

  get objectStoreNames(): { contains(name: string): boolean } {
    return { contains: (name: string) => this.stores.has(name) };
  }

  createObjectStore(name: string, options: { keyPath: string }): {
    createIndex(indexName: string, keyPath: string | string[], options: { unique: boolean }): void;
  } {
    if (this.preExisting.has(name)) {
      throw new Error(`re-created existing store ${name}`);
    }
    const store: CreatedStore = { keyPath: options.keyPath, indexes: new Map() };
    this.stores.set(name, store);
    this.createdNames.push(name);
    return {
      createIndex: (indexName, keyPath, opts) => {
        store.indexes.set(indexName, { keyPath, unique: opts.unique });
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

export function runHardwareStoresSelfTest(): SelfTestReport {
  const c = new Checker();

  // 1. Fresh database → both hardware-ready stores created with indexes.
  {
    const db = new MockDatabase();
    v2Migration.upgrade(db as unknown as IDBDatabase, undefined as unknown as IDBTransaction);

    c.ok(db.stores.has("signal_frame"), "creates signal_frame store");
    c.ok(db.stores.has("state_score"), "creates state_score store");
    c.eq(db.stores.get("signal_frame")?.keyPath, "id", "signal_frame keyPath is id");
    c.eq(db.stores.get("state_score")?.keyPath, "id", "state_score keyPath is id");

    const sigIdx = db.stores.get("signal_frame")?.indexes;
    c.ok(sigIdx?.has("by-session") ?? false, "signal_frame has by-session index");
    c.ok(sigIdx?.has("by-timestamp") ?? false, "signal_frame has by-timestamp index");
    c.ok(sigIdx?.has("by-session-timestamp") ?? false, "signal_frame has compound index");

    const stateIdx = db.stores.get("state_score")?.indexes;
    c.ok(stateIdx?.has("by-session") ?? false, "state_score has by-session index");
    c.ok(stateIdx?.has("by-session-timestamp") ?? false, "state_score has compound index");
  }

  // 2. Idempotent: if the stores already exist, nothing is re-created.
  {
    const db = new MockDatabase(["signal_frame", "state_score"]);
    let threw = false;
    try {
      v2Migration.upgrade(db as unknown as IDBDatabase, undefined as unknown as IDBTransaction);
    } catch {
      threw = true;
    }
    c.ok(!threw, "re-running migration does not attempt to re-create stores");
    c.eq(db.createdNames.length, 0, "no stores created on a second run");
  }

  // 3. Migration registry is ordered and complete.
  {
    c.eq(migrations.length, 2, "registry contains v1 and v2");
    c.eq(migrations[0]?.version, 1, "first migration is version 1");
    c.eq(migrations[1]?.version, 2, "second migration is version 2");
    const ascending = migrations.every((m, i) => i === 0 || m.version > migrations[i - 1].version);
    c.ok(ascending, "registry versions are strictly ascending");
  }

  return { passed: c.passed, failed: c.failed, failures: c.failures };
}

// Auto-run when executed directly (compiled to CommonJS for the throwaway run).
declare const require: undefined | { main?: unknown };
declare const module: unknown;
if (typeof require !== "undefined" && (require as { main?: unknown }).main === module) {
  const report = runHardwareStoresSelfTest();
  // eslint-disable-next-line no-console
  console.log(`[hardware-ready-stores self-test] passed=${report.passed} failed=${report.failed}`);
  if (report.failed > 0) {
    // eslint-disable-next-line no-console
    console.error("Failures:\n - " + report.failures.join("\n - "));
    (globalThis as { process?: { exit(code: number): void } }).process?.exit(1);
  }
}
