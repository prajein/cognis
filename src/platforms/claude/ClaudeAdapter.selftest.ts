import { EventBus } from '../../core/event-bus/EventBus';
import { ClaudeAdapter } from './ClaudeAdapter';
import { FakeClaudeDOM } from '../../mock/harness/fake-claude';
import { SessionId } from '../../core/types/session.types';



async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function runTests() {
  console.log('--- Starting ClaudeAdapter E2E Selftest ---');

  const fakeDom = new FakeClaudeDOM();
  const eventBus = new EventBus({ reportError: console.error } as any);
  const adapter = new ClaudeAdapter(eventBus);
  const sessionId = 'session-456' as SessionId;

  const events: any[] = [];
  eventBus.subscribe('prompt.sent', (e) => events.push(e));
  eventBus.subscribe('response.started', (e) => events.push(e));
  eventBus.subscribe('response.chunk', (e) => events.push(e));
  eventBus.subscribe('response.completed', (e) => events.push(e));

  adapter.start(sessionId);

  // 1. Simulate submit
  console.log('Simulating submit...');
  await fakeDom.simulateSubmit('Hello Claude');
  
  // SubmitInterceptor has a hardcoded 50ms wait for React
  await sleep(60); 

  const promptSent = events.find(e => e.type === 'prompt.sent');
  if (!promptSent) {
    throw new Error('prompt.sent was not emitted');
  }
  const promptHash = promptSent.payload.promptHash;
  console.log('Received prompt.sent with hash:', promptHash);

  // 2. Simulate streaming response (including node-replacement adversarial case)
  console.log('Simulating response stream...');
  await fakeDom.simulateAssistantResponse('This is a test response from Claude with node replacement.', 15);

  const started = events.filter(e => e.type === 'response.started');
  const chunks = events.filter(e => e.type === 'response.chunk');
  const completed = events.filter(e => e.type === 'response.completed');

  if (started.length !== 1) throw new Error(`Expected 1 response.started, got ${started.length}`);
  if (completed.length !== 1) throw new Error(`Expected 1 response.completed, got ${completed.length}`);
  
  if (started[0].payload.promptHash !== promptHash) {
    throw new Error(`Correlation mismatch! Expected ${promptHash}, got ${started[0].payload.promptHash}`);
  }

  console.log(`Test passed!`);
  console.log(`- Started: ${started.length}`);
  console.log(`- Chunks: ${chunks.length}`);
  console.log(`- Completed: ${completed.length}`);
  console.log(`- Correlation Hash Match: true`);

  adapter.stop();
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
