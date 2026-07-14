import { SessionState, SessionAction } from "../types";

const SESSION_TRANSITIONS = {
    [SessionState.IDLE]: {
        [SessionAction.SELECT_TASK]: SessionState.TASK_SELECTED,
    },

    [SessionState.TASK_SELECTED]: {
        [SessionAction.START_SESSION]: SessionState.SESSION_ACTIVE,
    },

    [SessionState.SESSION_ACTIVE]: {
        [SessionAction.END_SESSION]: SessionState.SESSION_ENDED,
    },

    [SessionState.SESSION_ENDED]: {
        [SessionAction.GENERATE_INSIGHT]: SessionState.INSIGHT_GENERATED,
    },

    [SessionState.INSIGHT_GENERATED]: {
        [SessionAction.UPDATE_PROGRESS]: SessionState.PROGRESS_UPDATED,
    },

    [SessionState.PROGRESS_UPDATED]: {
        [SessionAction.RESET]: SessionState.IDLE,
    },
};

export function canTransition(
  currentState: SessionState,
  action: SessionAction
): boolean {
  return action in (SESSION_TRANSITIONS[currentState] ?? {});
}

export function getNextState(
  currentState: SessionState,
  action: SessionAction
): SessionState {
  if (!canTransition(currentState, action)) {
    throw new Error(
      `Invalid transition: ${currentState} -> ${action}`
    );
  }

  return (SESSION_TRANSITIONS[currentState] as Record<SessionAction, SessionState>)[action];
}