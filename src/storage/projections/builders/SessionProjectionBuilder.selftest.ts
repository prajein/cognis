import { SessionProjectionBuilder, SessionReadModel } from './SessionProjectionBuilder';
import { CognitiveEvents } from '../../../core/event-bus/registry';
import { createDomainEvent } from '../../../core/event-bus/createDomainEvent';
import { SessionId } from '../../../core/types/session.types';

// Mock Repository
class MockReadModelRepository {
  public store = new Map<string, any>();

  async get<T>(id: string): Promise<T | null> {
    return this.store.get(id) || null;
  }

  async put<T extends { projectionId: string }>(model: T): Promise<void> {
    this.store.set(model.projectionId, model);
  }
}

const mockSessionId = 'test-session-1' as SessionId;

export async function runSessionProjectionBuilderTests(c: any): Promise<void> {
  await c.test('Handles reading.engagement.measured event correctly (initialization)', async () => {
    const repo = new MockReadModelRepository();

    // Seed existing legacy session
    const projectionId = `session-v1_${mockSessionId}`;
    await repo.put({
      projectionId,
      sessionId: mockSessionId,
      platform: 'chatgpt',
      startTime: Date.now(),
      status: 'active',
      totalPauseDurationMs: 0,
      lastUpdated: Date.now()
    } as SessionReadModel);

    const builder = new SessionProjectionBuilder(repo as any);

    await builder.handleEvent(createDomainEvent(CognitiveEvents.READING_ENGAGEMENT_MEASURED, mockSessionId, 'test', {
      promptEventId: 'prompt-1',
      promptHash: 'hash',
      readingDurationMs: 2000,
      scrollVelocityPxPerSec: 500,
      scrollReversals: 2,
      actionType: 'typed'
    }));

    const model = await repo.get<SessionReadModel>(projectionId);
    c.assert(model !== null, 'Model exists');
    c.eq(model?.totalReadingPhases, 1, 'Initialized reading phases to 1');
    c.eq(model?.averageReadingDurationMs, 2000, 'Avg time initialized');
    c.eq(model?.averageScrollVelocityPxPerSec, 500, 'Avg velocity initialized');
    c.eq(model?.totalScrollReversals, 2, 'Total reversals initialized');
    c.eq(model?.processedReadingPrompts?.length, 1, 'Prompt marked processed');
  });

  await c.test('Rolling averages calculation on second event', async () => {
    const repo = new MockReadModelRepository();
    const projectionId = `session-v1_${mockSessionId}`;
    await repo.put({
      projectionId,
      sessionId: mockSessionId,
      platform: 'chatgpt',
      startTime: Date.now(),
      status: 'active',
      totalPauseDurationMs: 0,
      lastUpdated: Date.now(),
      totalReadingPhases: 1,
      averageReadingDurationMs: 2000,
      averageScrollVelocityPxPerSec: 500,
      totalScrollReversals: 2,
      processedReadingPrompts: ['prompt-1']
    } as SessionReadModel);

    const builder = new SessionProjectionBuilder(repo as any);

    await builder.handleEvent(createDomainEvent(CognitiveEvents.READING_ENGAGEMENT_MEASURED, mockSessionId, 'test', {
      promptEventId: 'prompt-2', // New prompt
      promptHash: 'hash',
      readingDurationMs: 4000,
      scrollVelocityPxPerSec: 100,
      scrollReversals: 0,
      actionType: 'typed'
    }));

    const model = await repo.get<SessionReadModel>(projectionId);

    c.eq(model?.totalReadingPhases, 2, 'Incremented reading phases');
    // Average of 2000 and 4000 is 3000
    c.eq(model?.averageReadingDurationMs, 3000, 'Avg time updated correctly');
    // Average of 500 and 100 is 300
    c.eq(model?.averageScrollVelocityPxPerSec, 300, 'Avg velocity updated correctly');
    // Reversals: 2 + 0 = 2
    c.eq(model?.totalScrollReversals, 2, 'Total reversals updated correctly');
  });

  await c.test('Idempotency prevents duplicate processing', async () => {
    const repo = new MockReadModelRepository();
    const projectionId = `session-v1_${mockSessionId}`;
    await repo.put({
      projectionId,
      sessionId: mockSessionId,
      platform: 'chatgpt',
      startTime: Date.now(),
      status: 'active',
      totalPauseDurationMs: 0,
      lastUpdated: Date.now(),
      totalReadingPhases: 1,
      averageReadingDurationMs: 2000,
      averageScrollVelocityPxPerSec: 500,
      totalScrollReversals: 2,
      processedReadingPrompts: ['prompt-1'] // Already processed
    } as SessionReadModel);

    const builder = new SessionProjectionBuilder(repo as any);

    await builder.handleEvent(createDomainEvent(CognitiveEvents.READING_ENGAGEMENT_MEASURED, mockSessionId, 'test', {
      promptEventId: 'prompt-1', // Same prompt ID!
      promptHash: 'hash',
      readingDurationMs: 9999, // Some new data that should be ignored
      scrollVelocityPxPerSec: 9999,
      scrollReversals: 99,
      actionType: 'typed'
    }));

    const model = await repo.get<SessionReadModel>(projectionId);

    // Values should not have changed
    c.eq(model?.totalReadingPhases, 1, 'Reading phases unchanged');
    c.eq(model?.averageReadingDurationMs, 2000, 'Avg time unchanged');
    c.eq(model?.averageScrollVelocityPxPerSec, 500, 'Avg velocity unchanged');
    c.eq(model?.totalScrollReversals, 2, 'Total reversals unchanged');
  });
}

class Checker {
  passed = 0;
  failed = 0;
  failures: string[] = [];
  async test(name: string, fn: () => void | Promise<void>) {
    try {
      const p = fn();
      if (p instanceof Promise) {
         await p.catch(e => {
            this.failed++;
            this.failures.push(`${name} threw async: ${e}`);
         });
      }
      this.passed++;
    } catch (e) {
      this.failed++;
      this.failures.push(`${name} threw: ${e}`);
    }
  }
  eq(actual: any, expected: any, msg: string) {
    if (actual !== expected) {
      throw new Error(`${msg}: Expected ${expected} but got ${actual}`);
    }
  }
  assert(cond: boolean, msg: string) {
    if (!cond) throw new Error(msg);
  }
}

declare const require: undefined | { main?: unknown };
declare const module: unknown;
if (typeof require !== "undefined" && (require as { main?: unknown }).main === module) {
  (async () => {
    const c = new Checker();
    await runSessionProjectionBuilderTests(c);
    const report = { passed: c.passed, failed: c.failed, failures: c.failures };
    console.log(`[session-projection-builder self-test] passed=${report.passed} failed=${report.failed}`);
    if (report.failed > 0) {
      console.error("Failures:\n - " + report.failures.join("\n - "));
      (globalThis as { process?: { exit(code: number): void } }).process?.exit(1);
    }
  })();
}
