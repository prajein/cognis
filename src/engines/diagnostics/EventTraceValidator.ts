import { EventBus } from '../../core/event-bus/EventBus';
import { 
  SessionEvents, 
  ResponseEvents, 
  PromptEvents,
  CognitiveEvents,
  EventType
} from '../../core/event-bus/registry';
import { DomainEvent } from '../../core/event-bus/contracts';

type FsmState = 'Idle' | 'SessionStarted' | 'Typing' | 'PromptSent' | 'Streaming';

export class EventTraceValidator {
  private state: FsmState = 'Idle';
  private eventHistory: DomainEvent<any>[] = [];
  private unsubscribeAll: (() => void)[] = [];

  constructor(private readonly eventBus: EventBus) {}

  public start(): void {
    const eventsToTrace: EventType[] = [
      SessionEvents.STARTED,
      SessionEvents.ENDED,
      PromptEvents.TYPED,
      PromptEvents.SENT,
      ResponseEvents.STARTED,
      ResponseEvents.CHUNK,
      ResponseEvents.COMPLETED,
      ResponseEvents.ABANDONED
    ];

    eventsToTrace.forEach(type => {
      this.unsubscribeAll.push(
        this.eventBus.subscribe(type, (e) => this.handleEvent(e))
      );
    });
    
    console.log('[EventTraceValidator] Attached to EventBus (Development Mode).');
  }

  public stop(): void {
    this.unsubscribeAll.forEach(unsub => unsub());
    this.unsubscribeAll = [];
  }

  private handleEvent(event: DomainEvent<any>): void {
    // Keep a rolling window of the last 10 events
    this.eventHistory.push(event);
    if (this.eventHistory.length > 10) {
      this.eventHistory.shift();
    }

    try {
      this.transition(event);
    } catch (error: any) {
      this.reportViolation(error.message, event);
    }
  }

  private transition(event: DomainEvent<any>): void {
    const t = event.type;
    
    switch (this.state) {
      case 'Idle':
        if (t === SessionEvents.STARTED) {
          this.state = 'SessionStarted';
        } else {
          throw new Error(`Invalid transition from Idle via ${t}`);
        }
        break;

      case 'SessionStarted':
        if (t === SessionEvents.ENDED) {
          this.state = 'Idle';
        } else if (t === PromptEvents.TYPED) {
          this.state = 'Typing';
        } else if (t === ResponseEvents.STARTED) {
          this.state = 'Streaming';
        } else if (t === PromptEvents.SENT) {
          this.state = 'PromptSent';
        } else {
          throw new Error(`Invalid transition from SessionStarted via ${t}`);
        }
        break;

      case 'Typing':
        if (t === PromptEvents.TYPED) {
          // Stay
        } else if (t === PromptEvents.SENT) {
          this.state = 'PromptSent';
        } else if (t === ResponseEvents.STARTED) {
          // Edge case: UI race condition where response starts while user is typing
          this.state = 'Streaming';
        } else if (t === SessionEvents.ENDED) {
          this.state = 'Idle';
        } else {
          throw new Error(`Invalid transition from Typing via ${t}`);
        }
        break;

      case 'PromptSent':
        if (t === ResponseEvents.STARTED) {
          this.state = 'Streaming';
        } else if (t === PromptEvents.TYPED) {
          this.state = 'Typing'; // User started typing another prompt immediately
        } else if (t === SessionEvents.ENDED) {
          this.state = 'Idle';
        } else {
          throw new Error(`Invalid transition from PromptSent via ${t}`);
        }
        break;

      case 'Streaming':
        if (t === ResponseEvents.CHUNK) {
          // Verify monotonically increasing length
          const chunkPayload = event.payload as any;
          if (chunkPayload.totalLength === undefined) {
             throw new Error('Chunk missing totalLength');
          }
          // Note: In a full implementation, we would track previous length.
        } else if (t === ResponseEvents.COMPLETED || t === ResponseEvents.ABANDONED) {
          this.state = 'SessionStarted';
        } else if (t === SessionEvents.ENDED) {
          this.state = 'Idle';
        } else if (t === PromptEvents.TYPED) {
          // Edge case: user types during streaming
          // Allowed, but we remain in streaming to prioritize response tracking, 
          // or we split FSM. For now, allow it to remain in Streaming.
        } else {
          throw new Error(`Invalid transition from Streaming via ${t}`);
        }
        break;
    }
  }

  private reportViolation(message: string, currentEvent: DomainEvent<any>): void {
    console.error(`%c[EventTraceValidator] ARCHITECTURAL VIOLATION`, 'color: red; font-weight: bold; font-size: 14px');
    console.error(`Violation: ${message}`);
    console.error(`Trigger Event:`, currentEvent);
    console.error(`Recent Event Trace:`, this.eventHistory);
    // In strict dev mode, we could throw to crash the extension here
    // throw new Error(`[EventTraceValidator] ${message}`);
  }
}
