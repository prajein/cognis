import { GapProfileQueryHandler } from './GapProfileQueryHandler';
import { ReadModelRepository } from '../../storage/repositories/ReadModelRepository';
import { CognisDatabase } from '../../storage/indexeddb/CognisDatabase';
import { migrations } from '../../storage/migrations';
import { GapProfileReadModel } from '../../storage/projections/builders/GapProfileProjectionBuilder';

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
}

export async function runGapProfileQueryHandlerTests(): Promise<{ passed: number; failed: number; failures: string[] }> {
  const c = new Checker();

  const db = new CognisDatabase(migrations);
  const readModelRepo = new ReadModelRepository(db);
  const handler = new GapProfileQueryHandler(readModelRepo);

  // Test 1: Gap Profile exists
  readModelRepo.get = async <T>(id: string) => {
    if (id === 'gap-profile-v1_session123') {
      const mockGaps: any = {
        mechanism: {
          detectedCount: 1,
          displayedCount: 0,
          acceptedCount: 0,
          dismissedCount: 0,
          rejectionCount: 0,
          lastDetectedAt: 12345
        }
      };

      return {
        projectionId: 'gap-profile-v1_session123',
        id: 'gap-profile-v1_session123',
        sessionId: 'session123' as any,
        gaps: mockGaps,
        lastUpdated: 12345,
        version: 1
      } as T;
    }
    return undefined;
  };

  let res = await (handler as any).handleQuerySessionGaps('session123');
  c.ok(res.gapProfile !== null, 'Returns gapProfile when exists');
  c.ok(res.gapProfile?.gaps.mechanism !== undefined, 'Returns correct gap data');

  // Test 2: Gap Profile doesn't exist (Session isolation inherently tested by keying)
  res = await (handler as any).handleQuerySessionGaps('session456');
  c.ok(res.gapProfile === null, 'Returns null when session gap profile missing');

  console.log(`[SelfTest GapProfileQueryHandler] passed=${c.passed} failed=${c.failed}`);
  if (c.failed > 0) console.error('Failures:\n - ' + c.failures.join('\n - '));

  return { passed: c.passed, failed: c.failed, failures: c.failures };
}

if (typeof require !== 'undefined' && require.main === module) {
  runGapProfileQueryHandlerTests().catch(console.error);
}
