import { SessionRecord } from "../types";
import { SessionRepository } from "./SessionRepository";

export class InMemorySessionRepository implements SessionRepository {
  private sessions: SessionRecord[] = [];

  save(session: SessionRecord): void {
    this.sessions.push(session);
  }

  getAll(): SessionRecord[] {
    return [...this.sessions];
  }

  getLatest(): SessionRecord | null {
    return this.sessions.length
      ? this.sessions[this.sessions.length - 1]
      : null;
  }

  clear(): void {
    this.sessions = [];
  }
}