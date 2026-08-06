import { EventBusContract } from '../../core/event-bus/types';
import { ResponseEvents } from '../../core/event-bus/registry';

export class ResponseLifecycleTracker {
  private unsubscribeHandlers: Array<() => void> = [];
  
  constructor(
    private readonly eventBus: EventBusContract,
    private readonly onStateChange: (isStreaming: boolean) => void
  ) {}

  public start(): void {
    if (this.unsubscribeHandlers.length > 0) return; // already started

    this.unsubscribeHandlers.push(
      this.eventBus.subscribe(ResponseEvents.STARTED, () => {
        this.onStateChange(true);
      }),
      this.eventBus.subscribe(ResponseEvents.COMPLETED, () => {
        this.onStateChange(false);
      }),
      this.eventBus.subscribe(ResponseEvents.ABANDONED, () => {
        this.onStateChange(false);
      })
    );
  }

  public stop(): void {
    for (const unsubscribe of this.unsubscribeHandlers) {
      unsubscribe();
    }
    this.unsubscribeHandlers = [];
  }

  public destroy(): void {
    this.stop();
  }
}
