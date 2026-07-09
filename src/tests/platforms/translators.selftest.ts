import { translateResponseSnapshot, ResponseSnapshot } from '../../platforms/translators/ResponseTranslator';
import { translateTypingSnapshot, TypingSnapshot } from '../../platforms/translators/TypingTranslator';
import { ResponseEvents, PromptEvents, CognitiveEvents } from '../../core/event-bus/registry';
import { toSessionId } from '../../core/types/session.types';

export async function runTranslatorsTests(): Promise<void> {
  console.log('[SelfTest] Running Stateless Translators tests...');

  const sessionId = toSessionId('test-session');

  // Test ResponseTranslator
  const responseSnapshot: ResponseSnapshot = {
    sessionId,
    promptHash: 'hash',
    isStarting: true,
    deltaText: 'Hello',
    isCompleted: false,
    chunkLength: 5,
    totalLength: 5,
    durationMs: 0
  };

  const responseEvents = translateResponseSnapshot(responseSnapshot);
  if (responseEvents.length !== 2) throw new Error('ResponseTranslator failed: Expected 2 events');
  if (responseEvents[0].type !== ResponseEvents.STARTED) throw new Error('Expected STARTED');
  if (responseEvents[1].type !== ResponseEvents.CHUNK) throw new Error('Expected CHUNK');
  
  if ((responseEvents[1].payload as any).chunkText !== 'Hello') throw new Error('Chunk text missing');

  // Test TypingTranslator
  const typingSnapshot: TypingSnapshot = {
    sessionId,
    isTyping: true,
    textLength: 10,
    wordCount: 2,
    currentTextHash: 'xxx',
    revisionDepth: 0,
    isPause: true,
    pauseDurationMs: 2500,
    isSent: false
  };

  const typingEvents = translateTypingSnapshot(typingSnapshot);
  if (typingEvents.length !== 2) throw new Error('TypingTranslator failed: Expected 2 events');
  if (typingEvents[0].type !== PromptEvents.TYPED) throw new Error('Expected TYPED');
  if (typingEvents[1].type !== CognitiveEvents.PAUSE_DETECTED) throw new Error('Expected PAUSE_DETECTED');

  console.log('[SelfTest] Stateless Translators successfully validated.');
}
