/// <reference types="chrome" />

import { ReadModelRepository } from '../../storage/repositories/ReadModelRepository';
import {
  SessionReadModel,
} from '../../storage/projections/builders/SessionProjectionBuilder';
import {
  ResponseMetricsReadModel,
} from '../../storage/projections/builders/ResponseMetricsProjectionBuilder';
import {
  ProgressSession,
  QueryProgressRequest,
  QueryProgressResponse,
} from '../../core/ipc/messages';

/**
 * ProgressQueryHandler
 *
 * Background-side read handler for historical progress data.
 *
 * Responsibilities:
 * - Retrieve persisted session projections.
 * - Restrict them to the requested task.
 * - Restrict them to completed sessions.
 * - Order sessions chronologically.
 * - Join each session with its response-metrics projection.
 * - Convert accumulated response metric sums into session-level averages.
 * - Return a transport-safe ProgressSession[].
 *
 * Architectural invariant:
 * - This class performs reads only.
 * - It does not modify session state.
 * - It does not calculate cognitive/motor progress curves.
 *   Those calculations belong to the progress domain layer in the sidepanel.
 */
export class ProgressQueryHandler {
  private static readonly SESSION_PREFIX = 'session-v1_';
  private static readonly RESPONSE_METRICS_PREFIX = 'response-metrics-v1_';

  constructor(
    private readonly readModelRepo: ReadModelRepository
  ) {}

  /**
   * Registers the handler with the Chrome runtime message system.
   */
  public register(): () => void {
    const listener = (
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: QueryProgressResponse) => void
    ): boolean | undefined => {
      if (!this.isQueryProgressRequest(message)) {
        return undefined;
      }

      this.handleQueryProgress(message)
        .then(sendResponse)
        .catch((error) => {
          console.error(
            '[ProgressQueryHandler] Unexpected error:',
            error
          );

          sendResponse({
            sessions: [],
            error:
              error instanceof Error
                ? error.message
                : 'Unknown error',
          });
        });

      return true;
    };

    chrome.runtime.onMessage.addListener(listener);

    return () => {
      chrome.runtime.onMessage.removeListener(listener);
    };
  }

  /**
   * Retrieves the completed session history for a task.
   */
  private async handleQueryProgress(
    request: QueryProgressRequest
  ): Promise<QueryProgressResponse> {
    const sessions =
      await this.readModelRepo.getAllByPrefix<SessionReadModel>(
        ProgressQueryHandler.SESSION_PREFIX
      );

    const completedSessions = sessions
      .filter(
        (session) =>
          session.status === 'ended' &&
          session.taskId === request.taskId &&
          session.endTime !== undefined
      )
      .sort((a, b) => a.startTime - b.startTime);

    const progressSessions: ProgressSession[] = [];

    for (let index = 0; index < completedSessions.length; index++) {
      const session = completedSessions[index];

      const metrics =
        await this.readModelRepo.get<ResponseMetricsReadModel>(
          `${ProgressQueryHandler.RESPONSE_METRICS_PREFIX}${session.sessionId}`
        );

      progressSessions.push(
        this.toProgressSession(
          session,
          metrics,
          index + 1
        )
      );
    }

    return {
      sessions: progressSessions,
    };
  }

  /**
   * Converts persistent read models into the transport contract consumed
   * by the sidepanel progress feature.
   */
  private toProgressSession(
    session: SessionReadModel,
    metrics: ResponseMetricsReadModel | undefined,
    sessionNumber: number
  ): ProgressSession {
    const endTime = session.endTime ?? session.startTime;

    const durationMs = Math.max(
      0,
      endTime -
        session.startTime -
        session.totalPauseDurationMs
    );

    const totalResponses = metrics?.totalResponses ?? 0;

    return {
      sessionNumber,
      sessionId: session.sessionId,
      taskId: session.taskId ?? null,
      platform: session.platform,
      startTime: session.startTime,
      endTime,
      durationMs,

      responseMetrics: {
        totalResponses,

        averageQuality:
          totalResponses > 0
            ? metrics!.sumQualityScore / totalResponses
            : null,

        averageReasoning:
          totalResponses > 0
            ? metrics!.sumReasoningScore / totalResponses
            : null,

        averageStructure:
          totalResponses > 0
            ? metrics!.sumStructuralScore / totalResponses
            : null,
      },
    };
  }

  private isQueryProgressRequest(
    message: unknown
  ): message is QueryProgressRequest {
    return (
      typeof message === 'object' &&
      message !== null &&
      (message as QueryProgressRequest).type === 'QUERY_PROGRESS' &&
      typeof (message as QueryProgressRequest).taskId === 'string' &&
      (message as QueryProgressRequest).taskId.length > 0
    );
  }
}