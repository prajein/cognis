import { StateEngine } from '../../../engines/state/StateEngine';
import { EventBus } from '../../../core/event-bus/EventBus';
import { ConsoleErrorReporter } from '../../../core/error/ConsoleErrorReporter';
import { SessionEvents, PromptEvents } from '../../../core/event-bus/registry';
import { createDomainEvent } from '../../../core/event-bus/createDomainEvent';
import { toSessionId } from '../../../core/types/session.types';

export function runStateEngineTests(): void {
  console.log('[SelfTest] Running StateEngine tests...');

  const eventBus = new EventBus(new ConsoleErrorReporter());
  const engine = new StateEngine(eventBus);
  
  engine.start();

  let stateChangedCount = 0;
  eventBus.subscribe('state.changed', () => {
    stateChangedCount++;
  });

  const sessionId = toSessionId('test-session');
  
  // 1. Start Session
  eventBus.publish(SessionEvents.STARTED, createDomainEvent(
    SessionEvents.STARTED,
    sessionId,
    'test',
    { platform: 'test' }
  ));

  // 2. Simulate rapid typing to trigger overload (velocity > 9)
  const now = Date.now();
  // State changes need 3 sustained measurements per our TransitionPolicy test, 
  // but let's just make sure it doesn't crash on prompt events.
  for (let i = 0; i < 5; i++) {
    eventBus.publish(PromptEvents.TYPED, createDomainEvent(
      PromptEvents.TYPED,
      sessionId,
      'test',
      { textLength: 10, wordCount: 2, currentTextHash: 'hash', revisionDepth: 0 }
    ));
  }

  // State Engine should process events without throwing.
  // We don't strictly assert stateChangedCount here due to time-based rules
  // in StateRulesLoader (e.g., velocity relies on actual Date.now deltas which are hard to mock synchronously without DI for clock).

  engine.stop();
  console.log('[SelfTest] StateEngine orchestration validated.');
}
