import { DefaultPersistenceMapper } from './PersistenceMapper';
import { PromptEvents, ResponseEvents } from '../../core/event-bus/registry';
import { DomainEvent } from '../../core/event-bus/contracts';
import { toEventId, toTimestamp, toSessionId } from '../../core/types/session.types';

// Simple mock for createDomainEvent structure
function mockEvent(type: string, payload: any): DomainEvent<any> {
  return {
    id: toEventId('evt_123'),
    type: type as any,
    timestamp: toTimestamp(1234567890),
    sessionId: toSessionId('session_123'),
    source: 'test',
    payload
  };
}

async function runTests() {
  const mapper = new DefaultPersistenceMapper();
  let passed = 0;
  let failed = 0;

  function assertEqual(actual: any, expected: any, message: string) {
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      console.error(`  Expected: ${JSON.stringify(expected)}`);
      console.error(`  Actual:   ${JSON.stringify(actual)}`);
      failed++;
    }
  }

  // Test 1: Valid prompt.sent metadata survives
  const validSent = mockEvent(PromptEvents.SENT, {
    promptHash: 'hash123',
    textLength: 10,
    wordCount: 2,
    wasEnriched: false
  });
  const mappedValidSent = mapper.sanitize(validSent);
  assertEqual(mappedValidSent.payload, validSent.payload, 'Valid prompt.sent metadata survives');

  // Test 2: Raw prompt text does not survive
  // Test 3: Unknown text-bearing fields do not survive for privacy-sensitive events
  const maliciousSent = mockEvent(PromptEvents.SENT, {
    promptHash: 'hash123',
    textLength: 10,
    wordCount: 2,
    wasEnriched: false,
    rawText: 'Hello world',
    userMessage: 'Hello world',
    unknownField: 'bad'
  });
  const mappedMaliciousSent = mapper.sanitize(maliciousSent);
  assertEqual(mappedMaliciousSent.payload, validSent.payload, 'Unknown/raw text fields are stripped from prompt.sent');

  // Test 4: prompt.typed cannot persist arbitrary text
  const maliciousTyped = mockEvent(PromptEvents.TYPED, {
    textLength: 10,
    wordCount: 2,
    currentTextHash: 'hash123',
    revisionDepth: 1,
    promptText: 'Hello world',
    text: 'Hello world'
  });
  const expectedTyped = {
    textLength: 10,
    wordCount: 2,
    currentTextHash: 'hash123',
    revisionDepth: 1
  };
  const mappedMaliciousTyped = mapper.sanitize(maliciousTyped);
  assertEqual(mappedMaliciousTyped.payload, expectedTyped, 'Raw text fields are stripped from prompt.typed');

  // Test 6: response.chunk cannot persist chunkText
  const maliciousChunk = mockEvent(ResponseEvents.CHUNK, {
    chunkLength: 5,
    totalLength: 10,
    chunkText: 'Hello'
  });
  const expectedChunk = {
    chunkLength: 5,
    totalLength: 10
  };
  const mappedChunk = mapper.sanitize(maliciousChunk);
  assertEqual(mappedChunk.payload, expectedChunk, 'chunkText is removed from response.chunk');

  // Test 8: Sanitization does not mutate the original DomainEvent
  assertEqual(maliciousSent.payload.rawText, 'Hello world', 'Sanitization is functionally pure');

  // Test 9: Existing non-sensitive events retain their permitted behavior
  const nonSensitive = mockEvent('session.started', {
    platform: 'chatgpt',
    taskId: '123',
    someExtraField: 'survives'
  });
  const mappedNonSensitive = mapper.sanitize(nonSensitive);
  assertEqual(mappedNonSensitive.payload, nonSensitive.payload, 'Non-sensitive events keep their full payload');

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

runTests().catch(console.error);
