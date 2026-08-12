import { IdentityQueryHandler } from './IdentityQueryHandler';
import { ProfileRepository } from '../../storage/repositories/ProfileRepository';
import { CognisDatabase } from '../../storage/indexeddb/CognisDatabase';
import { migrations } from '../../storage/migrations';
import { UserProfileRecord } from '../../core/types/profile.types';

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

export async function runIdentityQueryHandlerTests(): Promise<{ passed: number; failed: number; failures: string[] }> {
  const c = new Checker();

  // Set up an in-memory DB and Repository
  const db = new CognisDatabase(migrations);
  // Hack to force in-memory IndexedDB for tests is usually setup externally via fake-indexeddb,
  // but we can assume the environment provides it during npm test if this runs in jsdom/node with polyfills.

  // To avoid actual DB operations in this pure unit test, we mock the repo.
  const profileRepo = new ProfileRepository(db);
  const handler = new IdentityQueryHandler(profileRepo);

  // Test 1: Profile exists with onboarding
  profileRepo.get = async (id: string) => {
    return {
      profileId: 'default-user',
      onboarding: { answer1: 'A', answer2: 'B', answer3: 'C' }
    } as UserProfileRecord;
  };

  let res = await (handler as any).handleQueryIdentityProfile();
  c.ok(res.hasOnboarded === true, 'Returns hasOnboarded true');
  c.ok(res.onboarding?.answer1 === 'A', 'Returns full onboarding payload');

  // Test 2: Profile doesn't exist
  profileRepo.get = async (id: string) => undefined;
  res = await (handler as any).handleQueryIdentityProfile();
  c.ok(res.hasOnboarded === false, 'Returns hasOnboarded false when missing');
  c.ok(res.onboarding === null, 'Returns null onboarding when missing');

  console.log(`[SelfTest IdentityQueryHandler] passed=${c.passed} failed=${c.failed}`);
  if (c.failed > 0) console.error('Failures:\n - ' + c.failures.join('\n - '));

  return { passed: c.passed, failed: c.failed, failures: c.failures };
}

if (typeof require !== 'undefined' && require.main === module) {
  runIdentityQueryHandlerTests().catch(console.error);
}
