/**
 * Migration Registry
 *
 * What & why: the single ordered list of schema migrations for `cognis_v1`.
 * The composition root passes this array straight to `new CognisDatabase(...)`,
 * which sorts by version and runs each migration whose version exceeds the
 * database's current version. Adding a schema change = appending one migration
 * here; no other wiring changes.
 *
 * This is the canonical source of truth for the migration sequence.
 * All composition roots (background/index.ts, tests) must import `migrations`
 * from here rather than constructing their own arrays inline.
 */

import { Migration } from "../indexeddb/CognisDatabase";
import { v1Migration } from "./v1";
import { v2Migration } from "./v2";
import { v3Migration } from "./v3";
import { v4Migration } from "./v4";

/** All migrations in ascending version order. */
export const migrations: Migration[] = [v1Migration, v2Migration, v3Migration, v4Migration];

export { v1Migration } from "./v1";
export { v2Migration } from "./v2";
export { v3Migration } from "./v3";
export { v4Migration } from "./v4";
