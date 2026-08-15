import { ProjectionManager } from './ProjectionManager';
import { EventRepository } from '../repositories/EventRepository';
import { SessionEvents, EventType } from '../../core/event-bus/registry';
import { DomainEvent } from '../../core/event-bus/contracts';
import { toSessionId } from '../../core/types/session.types';

async function runTests() {
  let passed = 0;
  let failed = 0;

  function assertEqual(actual: any, expected: any, message: string) {
    if (actual === expected) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      console.error(`  Expected: ${expected}`);
      console.error(`  Actual:   ${actual}`);
      failed++;
    }
  }

  // Mock Dependencies
  let clearCalledCount = 0;
  let handleEventCalledCount = 0;
  let eventsToReturn: DomainEvent<any>[] = [];

  const mockBuilder = {
    projectionId: 'test-builder',
    consumedEvents: [SessionEvents.STARTED, 'prompt.sent'] as EventType[],
    clear: async () => { clearCalledCount++; },
    handleEvent: async (e: any) => { handleEventCalledCount++; },
    getProjection: () => ({})
  };

  const mockEventRepo = {
    getBySessionOrdered: async (sessionId: string) => eventsToReturn
  } as unknown as EventRepository;

  const mockErrorReporter = {
    report: (e: any, ctx: any) => { console.error('ErrorReporter:', e, ctx); }
  };

  const manager = new ProjectionManager(
    [mockBuilder],
    { subscribe: () => {}, publish: async () => {} } as any,
    mockEventRepo,
    mockErrorReporter
  );

  // Test 1: Complete replay
  eventsToReturn = [
    { type: SessionEvents.STARTED } as unknown as DomainEvent<any>,
    { type: 'prompt.sent' } as unknown as DomainEvent<any>
  ];
  clearCalledCount = 0;
  handleEventCalledCount = 0;
  await manager.rebuildForSession(toSessionId('session_1'));
  assertEqual(clearCalledCount, 1, 'Clear is called when history is complete');
  assertEqual(handleEventCalledCount, 2, 'Events are replayed when history is complete');

  // Test 2: Empty history
  eventsToReturn = [];
  clearCalledCount = 0;
  handleEventCalledCount = 0;
  await manager.rebuildForSession(toSessionId('session_2'));
  assertEqual(clearCalledCount, 0, 'Clear is NOT called when history is empty');
  assertEqual(handleEventCalledCount, 0, 'No events replayed when history is empty');

  // Test 3: Partial history (missing STARTED)
  eventsToReturn = [
    { type: 'prompt.sent' } as unknown as DomainEvent<any>
  ];
  clearCalledCount = 0;
  handleEventCalledCount = 0;
  await manager.rebuildForSession(toSessionId('session_3'));
  assertEqual(clearCalledCount, 0, 'Clear is NOT called when history is partially compacted');
  assertEqual(handleEventCalledCount, 0, 'No events replayed when history is partially compacted');

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
