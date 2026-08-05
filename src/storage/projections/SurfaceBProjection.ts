import {ProjectionBuilder,} from "./interfaces";
import {DomainEvent,} from "../../core/event-bus/contracts";
import {SessionEvents,CognitiveEvents,InsightEvents,} from "../../core/event-bus/registry";
import {ReadModelRepository,} from "../repositories/ReadModelRepository";
import {SurfaceBReadModel,} from "./surface-b.read-model";

export class SurfaceBProjection implements ProjectionBuilder {

  readonly projectionId = "surface-b-v1";

  readonly consumedEvents = [

    SessionEvents.STARTED,
    SessionEvents.PAUSED,
    SessionEvents.RESUMED,
    SessionEvents.ENDED,

    CognitiveEvents.STATE_CHANGED,

    InsightEvents.GENERATED,
    InsightEvents.AUTOMATICITY_UPDATED,

  ];

  constructor(

    private readonly repository: ReadModelRepository,

  ) {}

  async handleEvent(event: DomainEvent<any>): Promise<void> {

    switch (event.type) {

        case SessionEvents.STARTED:

            await this.repository.update<SurfaceBReadModel>(
                this.projectionId,

                (current) => {

                    return {

                        projectionId: this.projectionId,

                        sessionId: event.sessionId,

                        taskId: event.payload.taskId ?? null,

                        platform: event.payload.platform,

                        sessionState: "active",

                        cognitiveState:
                            current?.cognitiveState ?? null,

                        latestInsight:
                            current?.latestInsight ?? null,

                        automaticity:
                            current?.automaticity ?? null,

                        lastUpdated: event.timestamp,

                    };

                }

            );

            break;

        case SessionEvents.PAUSED:
           await this.repository.update<SurfaceBReadModel>(
            this.projectionId,
            current => {

              if (!current) return current!;

              return {
                ...current,
                sessionState: "paused",
                lastUpdated: event.timestamp,
            };
          }
        );
          break;

        case SessionEvents.RESUMED:

    await this.repository.update<SurfaceBReadModel>(
        this.projectionId,
        current => {

            if (!current) return current!;

            return {
                ...current,
                sessionState: "active",
                lastUpdated: event.timestamp,
            };

        }
    );

    break;case SessionEvents.RESUMED:

    await this.repository.update<SurfaceBReadModel>(
        this.projectionId,
        current => {

            if (!current) return current!;

            return {
                ...current,
                sessionState: "active",
                lastUpdated: event.timestamp,
            };

        }
    );

    break;

    case SessionEvents.ENDED:

    await this.repository.update<SurfaceBReadModel>(
        this.projectionId,
        current => {

            if (!current) return current!;

            return {
                ...current,
                sessionState: "ended",
                lastUpdated: event.timestamp,
            };

        }
    );

    break;case SessionEvents.ENDED:

    await this.repository.update<SurfaceBReadModel>(
        this.projectionId,
        current => {

            if (!current) return current!;

            return {
                ...current,
                sessionState: "ended",
                lastUpdated: event.timestamp,
            };

        }
    );

    break;

    case CognitiveEvents.STATE_CHANGED:

    await this.repository.update<SurfaceBReadModel>(
        this.projectionId,
        current => {

            if (!current) return current!;

            return {
                ...current,
                cognitiveState: event.payload.currentState,
                lastUpdated: event.timestamp,
            };

        }
    );

    break;

    case InsightEvents.GENERATED:

    await this.repository.update<SurfaceBReadModel>(
        this.projectionId,
        current => {

            if (!current) return current!;

            return {
                ...current,
                latestInsight: event.payload,
                lastUpdated: event.timestamp,
            };

        }
    );

    break;

    case InsightEvents.AUTOMATICITY_UPDATED:

    await this.repository.update<SurfaceBReadModel>(
        this.projectionId,
        current => {

            if (!current) return current!;

            return {
                ...current,
                automaticity: event.payload,
                lastUpdated: event.timestamp,
            };

        }
    );

    break;

    default: 
      return;

    }

  }

  async clear(): Promise<void> {

    await this.repository.delete(this.projectionId);

  }

}