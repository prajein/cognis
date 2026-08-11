import { AdaptationQueryHandler } from '../../background/handlers/AdaptationQueryHandler';
import { ProfileRepository } from '../../storage/repositories/ProfileRepository';
import { CognisDatabase } from '../../storage/indexeddb/CognisDatabase';
import { migrations } from '../../storage/migrations';
import { GapType } from '../../core/types/gap.types';
import { GapTransferState } from '../../core/types/profile.types';

class Checker {
  passed = 0;
  failed = 0;
  readonly failures: string[] = [];

  ok(condition: boolean, label: string): void {
    if (condition) this.passed++;
    else {
      this.failed++;
      this.failures.push(label);
    }
  }

  eq(actual: unknown, expected: unknown, label: string): void {
    this.ok(actual === expected, `${label} (expected ${expected}, got ${actual})`);
  }
}

class MockProfileRepository {
  private store = new Map<string, any>();
  async get(id: string): Promise<any | undefined> { return this.store.get(id); }
  async put(model: any): Promise<void> { this.store.set(model.profileId, model); }
}

async function runAdaptationQueryHandlerTests() {
  const c = new Checker();

  const repo = new MockProfileRepository() as any;
  const handler = new AdaptationQueryHandler(repo);

  console.log('[AdaptationQueryHandler.selftest] Starting tests...');

  // Test 1: Missing profile -> []
  let response = await (handler as any).handleQuery();
  c.eq(response.suppressedGaps.length, 0, 'Missing profile should return empty array');

  // Test 2: Legacy profile without gapHistory -> []
  await repo.put({
    profileId: 'default-user',
    lastModified: Date.now(),
    onboarding: { answer1: '', answer2: '', answer3: '' }
  } as any);
  response = await (handler as any).handleQuery();
  c.eq(response.suppressedGaps.length, 0, 'Legacy profile should return empty array');

  // Test 3: Profile with mixed states
  await repo.put({
    profileId: 'default-user',
    lastModified: Date.now(),
    onboarding: { answer1: '', answer2: '', answer3: '' },
    recentCountedSessions: [],
    foldedSessions: [],
    gapHistory: {
      'audience': { gapType: 'audience', lastSeen: null, sessionsSinceLastSeen: 0, transferState: 'ACTIVE' },
      'intentionality': { gapType: 'intentionality', lastSeen: null, sessionsSinceLastSeen: 4, transferState: 'MAYBE_TRANSFERRED' },
      'detail': { gapType: 'detail', lastSeen: null, sessionsSinceLastSeen: 8, transferState: 'TRANSFERRED' }
    }
  });

  response = await (handler as any).handleQuery();
  c.eq(response.suppressedGaps.length, 1, 'Should return only 1 suppressed gap');
  c.eq(response.suppressedGaps[0], 'detail', 'Should suppress detail');

  if (c.failed > 0) {
    console.error(`[AdaptationQueryHandler.selftest] FAILED: ${c.failed} failures`);
    for (const f of c.failures) console.error(`  - ${f}`);
    process.exit(1);
  } else {
    console.log(`[AdaptationQueryHandler.selftest] PASSED: ${c.passed} checks`);
    process.exit(0);
  }
}

runAdaptationQueryHandlerTests().catch(err => {
  console.error(err);
  process.exit(1);
});
