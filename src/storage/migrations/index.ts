/**
 * Migration Registry
 *
 * What & why: the single ordered list of schema migrations for `cognis_v1`.
 * The composition root passes this array straight to `new CognisDatabase(...)`,
 * which sorts by version and runs each migration whose version exceeds the
 * database's current version. Adding a schema change = appending one migration
 * here; no other wiring changes.
 */

import { Migration } from "../indexeddb/CognisDatabase";
import { v1Migration } from "./v1";
import { v2Migration } from "./v2";

/** All migrations in ascending version order. */
export const migrations: Migration[] = [v1Migration, v2Migration];

export { v1Migration } from "./v1";
export { v2Migration } from "./v2";
