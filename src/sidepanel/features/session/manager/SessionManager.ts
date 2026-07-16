import { SessionState, SessionRecord, SessionAction } from "../types";
import { SessionCommandGateway } from "../../../runtime/SessionCommandGateway";
import { getNextState } from "../state/SessionMachine";

export class SessionManager {
  private gateway: SessionCommandGateway;

  private currentState: SessionState;

  private currentSession: SessionRecord | null;

  private sessionCounter: number;

  constructor(gateway: SessionCommandGateway) {
    this.gateway = gateway;

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
    if (this.currentState !== SessionState.IDLE) {
      this.reset();
    }

    this.currentState = getNextState(
      this.currentState,
      SessionAction.SELECT_TASK
    );
    this.currentSession = this.createSession(taskId);

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

    this.gateway.startSession(this.currentSession.taskId, "side-panel");
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

    this.gateway.endSession("explicit");
  }

  public pauseSession(): void {
    if (!this.currentSession) {
      throw new Error("No active session.");
    }
    this.gateway.pauseSession("explicit");
  }

  public resumeSession(): void {
    if (!this.currentSession) {
      throw new Error("No active session.");
    }
    this.gateway.resumeSession(0);
  }

  public restoreSession(taskId: string): void {
    this.currentState = SessionState.SESSION_ACTIVE;
    this.currentSession = this.createSession(taskId);
    this.currentSession.status = SessionState.SESSION_ACTIVE;
  }

  public reset(): void {
    this.currentState = SessionState.IDLE;
    this.currentSession = null;
  }
}

