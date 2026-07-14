export enum SessionState
{
    IDLE="IDLE",
    TASK_SELECTED = "TASK_SELECTED",
    SESSION_ACTIVE = "SESSION_ACTIVE",
    SESSION_ENDED = "SESSION_ENDED",
    INSIGHT_GENERATED = "INSIGHT_GENERATED",
    PROGRESS_UPDATED = "PROGRESS_UPDATED",
}

export enum SessionAction {
  SELECT_TASK = "SELECT_TASK",
  START_SESSION = "START_SESSION",
  END_SESSION = "END_SESSION",
  GENERATE_INSIGHT = "GENERATE_INSIGHT",
  UPDATE_PROGRESS = "UPDATE_PROGRESS",
  RESET = "RESET",
}

export interface SessionRecord
{
    id: string;
    taskId: string;
    status: SessionState;
    startedAt?: Date;
    endedAt?: Date;
    durationMs?: number;
    sessionNumber: number;
}

export interface SessionContext {
  currentState: SessionState;
  currentSession: SessionRecord | null;
}