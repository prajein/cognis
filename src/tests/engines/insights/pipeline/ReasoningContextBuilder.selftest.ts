import { ReasoningContextBuilder } from '../../../../engines/insights/pipeline/ReasoningContextBuilder';
import { ReadModelRepository } from '../../../../storage/repositories/ReadModelRepository';
import { CognisDatabase } from '../../../../storage/indexeddb/CognisDatabase';

export async function runReasoningContextBuilderTests(): Promise<void> {
  console.log('[SelfTest] Running ReasoningContextBuilder tests...');

  // Mock DB & Repo
  const db = new CognisDatabase([]);
  const repo = new ReadModelRepository(db);

  // Mock repo.get to return undefined for everything
  repo.get = async (id: string) => undefined;

  const builder = new ReasoningContextBuilder(repo);
  const sessionId = 'test-session';
  const context = await builder.build(sessionId);

  // Validate missing projection generation
  if (context.sessionId !== sessionId) throw new Error('SessionID mismatch');
  if (context.sessionMetrics.status !== 'active') throw new Error('Default session model invalid');
  if (context.automaticityProfile.skills === undefined) throw new Error('Default automaticity model invalid');
  if (context.gapProfile.gaps['mechanism'].detectedCount !== 0) throw new Error('Default gap profile invalid');
  if (context.identityProfile.insights.length !== 0) throw new Error('Default identity profile invalid');
  if (context.responseMetrics.totalResponses !== 0) throw new Error('Default response metrics invalid');

  console.log('[SelfTest] ReasoningContextBuilder default fallbacks successfully validated.');
}
