/**
 * CognisDatabase - IndexedDB Connection Manager
 * 
 * Provides a Promise-based wrapper around raw IndexedDB.
 * Responsibilities (per Implementation Plan 6.1):
 * - Open and manage the database connection lifecycle.
 * - Run version-ordered migrations during `onupgradeneeded`.
 * - Provide read/readwrite transactions to repositories.
 * - Handle corruption (delete and recreate) and blocked events.
 * 
 * Architectural Constraints:
 * - This class does NOT contain any query or domain logic.
 * - Queries belong entirely to Repository classes.
 * - Enforces the "cognis_v1" canonical database name.
 */

export interface Migration {
  version: number;
  upgrade(db: IDBDatabase, transaction: IDBTransaction): void;
}

export class CognisDatabase {
  private static readonly DB_NAME = 'cognis_v1';
  private db: IDBDatabase | null = null;
  private openPromise: Promise<IDBDatabase> | null = null;

  constructor(private readonly migrations: Migration[]) {
    // Sort migrations by version ascending to ensure correct order
    this.migrations.sort((a, b) => a.version - b.version);
  }

  /**
   * Returns the current expected database version based on the latest migration.
   */
  private getTargetVersion(): number {
    return this.migrations.length > 0
      ? this.migrations[this.migrations.length - 1].version
      : 1;
  }

  /**
   * Initializes the connection to IndexedDB.
   * Ensures only one open request is in flight at a time.
   */
  public async open(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }
    if (this.openPromise) {
      return this.openPromise;
    }

    this.openPromise = this.attemptOpen().catch(async (error) => {
      console.error('[CognisDatabase] Failed to open IndexedDB:', error);
      console.warn('[CognisDatabase] Attempting corruption recovery via deleteDatabase...');
      
      // Corruption recovery mechanism: delete and retry
      await this.deleteDatabase();
      return this.attemptOpen();
    });

    try {
      this.db = await this.openPromise;
      return this.db;
    } finally {
      this.openPromise = null;
    }
  }

  /**
   * Internal attempt to open the database and run migrations.
   */
  private attemptOpen(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const targetVersion = this.getTargetVersion();
      const request = indexedDB.open(CognisDatabase.DB_NAME, targetVersion);

      request.onblocked = () => {
        // Log and wait. Do not force close.
        console.warn(`[CognisDatabase] Blocked from opening ${CognisDatabase.DB_NAME}. Please close other tabs of this application.`);
      };

      request.onupgradeneeded = (event) => {
        console.log(`[CognisDatabase] Upgrading database to version ${targetVersion}...`);
        const db = request.result;
        const transaction = request.transaction;
        const oldVersion = event.oldVersion;

        if (!transaction) {
          reject(new Error('[CognisDatabase] No transaction available during upgrade.'));
          return;
        }

        try {
          for (const migration of this.migrations) {
            if (migration.version > oldVersion) {
              console.log(`[CognisDatabase] Running migration v${migration.version}...`);
              migration.upgrade(db, transaction);
            }
          }
        } catch (error) {
          reject(error);
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        
        // Handle unexpected closure by the browser or another process
        db.onversionchange = () => {
          console.warn(`[CognisDatabase] Another connection wants to upgrade ${CognisDatabase.DB_NAME}. Closing connection.`);
          db.close();
          this.db = null;
        };

        resolve(db);
      };

      request.onerror = () => {
        reject(request.error || new Error(`[CognisDatabase] Unknown open error.`));
      };
    });
  }

  /**
   * Deletes the entire database. Used for corruption recovery or factory resets.
   */
  public deleteDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close();
        this.db = null;
      }

      const request = indexedDB.deleteDatabase(CognisDatabase.DB_NAME);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => {
        console.warn(`[CognisDatabase] Blocked from deleting ${CognisDatabase.DB_NAME}.`);
      };
    });
  }

  /**
   * Helper to execute a read or readwrite transaction safely.
   */
  public async transaction<T>(
    storeNames: string | string[],
    mode: IDBTransactionMode,
    callback: (tx: IDBTransaction) => Promise<T> | T
  ): Promise<T> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction(storeNames, mode);
      } catch (error) {
        return reject(error);
      }

      let result: T;
      
      tx.oncomplete = () => {
        resolve(result);
      };

      tx.onerror = () => {
        reject(tx.error || new Error('[CognisDatabase] Transaction failed.'));
      };

      // Execute the callback safely
      try {
        const callbackResult = callback(tx);
        if (callbackResult instanceof Promise) {
          callbackResult.then(val => {
            result = val;
          }).catch(err => {
            tx.abort();
            reject(err);
          });
        } else {
          result = callbackResult;
        }
      } catch (error) {
        tx.abort();
        reject(error);
      }
    });
  }
}
