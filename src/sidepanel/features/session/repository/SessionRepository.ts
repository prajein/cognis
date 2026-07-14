import { SessionRecord } from "../types";

export interface SessionRepository {
  save(session: SessionRecord): void;

  getAll(): SessionRecord[];

  getLatest(): SessionRecord | null;

  clear(): void;
}