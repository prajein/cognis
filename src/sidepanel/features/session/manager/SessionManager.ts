import { SessionState, SessionRecord, SessionAction } from "../types";
import { SessionRepository } from "../repository/SessionRepository";
import { getNextState } from "../state/SessionMachine";

export class SessionManager {
  private repository: SessionRepository;

  private currentState: SessionState;

  private currentSession: SessionRecord | null;

  private sessionCounter: number;


  constructor(repository: SessionRepository) {
    this.repository = repository;

    this.currentState = SessionState.IDLE;

    this.currentSession = null;

    this.sessionCounter = 1;
  }

  public getCurrentState(): SessionState {
    return this.currentState;
    }

  public getCurrentSession(): SessionRecord | null {
    return this.currentSession;
    }

  private createSession(taskId: string): SessionRecord {
  return {
    id: `session-${this.sessionCounter}`,

    taskId,

    status: SessionState.TASK_SELECTED,

    sessionNumber: this.sessionCounter,
    };
  }

  public selectTask(taskId: string): void {
    this.currentState = getNextState(
      this.currentState,
      SessionAction.SELECT_TASK
    );
    this.currentSession=this.createSession(taskId);

    this.sessionCounter++;
  }

  public startSession(): void {
    if (!this.currentSession) {
        throw new Error("No session selected.");
    }

    this.currentState = getNextState(
        this.currentState,
        SessionAction.START_SESSION
    );

    this.currentSession.status = this.currentState;

    this.currentSession.startedAt = new Date();
  }

  public endSession(): void {
    if (!this.currentSession) {
        throw new Error("No active session.");
    }

    this.currentState = getNextState(
        this.currentState,
        SessionAction.END_SESSION
    );

    this.currentSession.status = this.currentState;

    this.currentSession.endedAt = new Date();

    if (this.currentSession.startedAt) {
        this.currentSession.durationMs =
            this.currentSession.endedAt.getTime() -
            this.currentSession.startedAt.getTime();
    }

    this.repository.save(this.currentSession);
  }

  public reset(): void{
    this.currentState=SessionState.IDLE;

    this.currentSession=null;
  }


}

