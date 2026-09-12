import { useState, useEffect, useRef } from "react";
import { useSidepanelRuntime } from "../../../runtime/RuntimeContext";
import { SessionState, SessionRecord } from "../types";
import { SessionEvents } from "../../../../core/event-bus/registry";
import { SessionStartedPayload } from "../../../../core/event-bus/contracts";

export function useSession() {
  const { sessionService, eventBus, runtimeState } = useSidepanelRuntime();

  // Map initial active/paused session from container runtime snapshot
  const initialSession: SessionRecord | null = runtimeState.activeSession
    ? {
        id: runtimeState.activeSession.sessionId,
        taskId: runtimeState.activeSession.taskId ?? "general",
        status:
          runtimeState.activeSession.status === "ended"
            ? SessionState.SESSION_ENDED
            : SessionState.SESSION_ACTIVE,
        startedAt: new Date(runtimeState.activeSession.startTime),
        endedAt: runtimeState.activeSession.endTime
          ? new Date(runtimeState.activeSession.endTime)
          : undefined,
        durationMs: runtimeState.activeSession.endTime
          ? runtimeState.activeSession.endTime -
            runtimeState.activeSession.startTime -
            runtimeState.activeSession.totalPauseDurationMs
          : undefined,
        sessionNumber: 1,
      }
    : null;

  const initialStatus: SessionState = runtimeState.activeSession
    ? runtimeState.activeSession.status === "ended"
      ? SessionState.SESSION_ENDED
      : SessionState.SESSION_ACTIVE
    : SessionState.IDLE;

  const [currentState, setCurrentState] = useState<SessionState>(initialStatus);
  const [currentSession, setCurrentSession] = useState<SessionRecord | null>(
    initialSession
  );
  const selectedTaskIdRef = useRef<string | null>(
    initialSession?.taskId ?? null
  );

  // Subscribe to authoritative domain events from EventBus
  useEffect(() => {
    const unsubStarted = eventBus.subscribe(
      SessionEvents.STARTED,
      (event) => {
        // Prevent local command echoing from updating state before authoritative response
        if (!event.isAuthoritative && event.origin !== 'remote') return;

        const payload = event.payload as SessionStartedPayload;
        const taskId =
          payload.taskId ?? selectedTaskIdRef.current ?? "general";
        setCurrentState(SessionState.SESSION_ACTIVE);
        setCurrentSession({
          id: event.sessionId,
          taskId,
          status: SessionState.SESSION_ACTIVE,
          startedAt: new Date(event.timestamp),
          sessionNumber: 1,
        });
      }
    );

    const unsubEnded = eventBus.subscribe(SessionEvents.ENDED, (event) => {
      console.log('[useSession] Received session.ended event:', event);
      if (!event.isAuthoritative && event.origin !== 'remote') {
        console.log('[useSession] Ignored non-authoritative session.ended event.');
        return;
      }
      console.log('[useSession] Processing authoritative session.ended event.');

      setCurrentState(SessionState.SESSION_ENDED);
      setCurrentSession((prev) => {
        const endedAt = new Date(event.timestamp);
        if (!prev) {
          return {
            id: event.sessionId,
            taskId: selectedTaskIdRef.current ?? 'general',
            status: SessionState.SESSION_ENDED,
            startedAt: new Date(event.timestamp),
            endedAt,
            durationMs: 0,
            sessionNumber: 1,
          };
        }
        const durationMs = prev.startedAt
          ? endedAt.getTime() - prev.startedAt.getTime()
          : undefined;
        return {
          ...prev,
          status: SessionState.SESSION_ENDED,
          endedAt,
          durationMs,
        };
      });
    });

    const unsubPaused = eventBus.subscribe(SessionEvents.PAUSED, (event) => {
      if (!event.isAuthoritative && event.origin !== 'remote') return;
      // Session is paused; retain active UI view
    });

    const unsubResumed = eventBus.subscribe(SessionEvents.RESUMED, (event) => {
      if (!event.isAuthoritative && event.origin !== 'remote') return;
      setCurrentState(SessionState.SESSION_ACTIVE);
    });

    return () => {
      unsubStarted();
      unsubEnded();
      unsubPaused();
      unsubResumed();
    };
  }, [eventBus]);

  const selectTask = (taskId: string) => {
    selectedTaskIdRef.current = taskId;
    setCurrentState(SessionState.TASK_SELECTED);
    setCurrentSession({
      id: "pending",
      taskId,
      status: SessionState.TASK_SELECTED,
      sessionNumber: 1,
    });
  };

  const startSession = () => {
    const taskIdToStart =
      selectedTaskIdRef.current ?? currentSession?.taskId ?? "general";
    sessionService.startSession(taskIdToStart);
    // State transitions ONLY when SessionEvents.STARTED is authoritatively received
  };

  const endSession = () => {
    console.log('[useSession] endSession called. Delegating to sessionService...');
    try {
      sessionService.endSession();
      console.log('[useSession] sessionService.endSession() succeeded.');
    } catch (err) {
      console.error('[useSession] sessionService.endSession() threw:', err);
    }
    // State transitions ONLY when SessionEvents.ENDED is authoritatively received
  };

  const pauseSession = () => {
    sessionService.pauseSession();
  };

  const resumeSession = () => {
    sessionService.resumeSession();
  };

  const reset = () => {
    setCurrentState(SessionState.IDLE);
    setCurrentSession(null);
    selectedTaskIdRef.current = null;
  };

  return {
    currentState,
    currentSession,
    connectionStatus: runtimeState.connectionStatus,
    selectTask,
    startSession,
    endSession,
    pauseSession,
    resumeSession,
    reset,
  };
}