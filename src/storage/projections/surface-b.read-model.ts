import { SessionId, Timestamp } from "../../core/types/session.types";
import { StateLabel } from "../../core/types/state.types";
import {
  InsightGeneratedPayload,
  AutomaticityUpdatedPayload,
} from "../../core/event-bus/contracts";

export type SurfaceBSessionState =
  | "idle"
  | "active"
  | "paused"
  | "ended";

export interface SurfaceBReadModel {
  projectionId: string;
  sessionId: SessionId;
  taskId: string | null;
  platform: string | null;
  sessionState: SurfaceBSessionState;
  cognitiveState: StateLabel | null;
  latestInsight: InsightGeneratedPayload | null;
  automaticity: AutomaticityUpdatedPayload | null;
  lastUpdated: Timestamp;
}