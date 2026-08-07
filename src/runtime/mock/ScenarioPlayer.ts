import { MockHarness } from '../../mock/harness/MockHarness';
import { ScenarioStep } from './scenarios/types';

/**
 * Executes individual ScenarioSteps against the MockHarness.
 * Isolated so that higher-level orchestration (like replaying 
 * recorded sessions) can reuse the primitive execution logic.
 */
export class ScenarioStepExecutor {
  constructor(private readonly harness: MockHarness) {}

  public async execute(step: ScenarioStep): Promise<void> {
    switch (step.type) {
      case 'startSession':
        this.harness.startSession();
        break;

      case 'type':
        this.harness.simulateTyping(step.text, {
          // If a delay is provided, we simulate the typist taking time
          // However, MockHarness itself doesn't delay typing natively in the current API,
          // it just emits the typed event.
        });
        // We'll pause manually here if there's a delay associated with the typing action taking time
        if (step.delayMs) {
          await this.wait(step.delayMs * step.text.length);
        }
        break;

      case 'pause':
        // A cognitive pause being detected
        // simulatePause takes (durationMs, textLength)
        // Since we don't have the text length tracked explicitly here, we pass 0 or a dummy
        this.harness.simulatePause(step.durationMs, 0);
        await this.wait(step.durationMs);
        break;

      case 'submit':
        this.harness.simulatePromptSent('dummy_hash', false);
        break;

      case 'streamResponse':
        // simulateResponse returns a promise that resolves when streaming completes
        await this.harness.simulateResponse('dummy_hash', step.text, {
          chunkSize: step.chunkSizeChars,
          chunkDelayMs: step.chunkDelayMs,
        });
        break;

      case 'wait':
        await this.wait(step.durationMs);
        break;

      case 'insight':
        this.harness.simulateInsightGenerated(step.domain, step.title, step.summary);
        break;

      case 'endSession':
        this.harness.endSession();
        break;
    }
  }

  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Orchestrates a complete Scenario against the MockHarness.
 */
export class ScenarioPlayer {
  private readonly executor: ScenarioStepExecutor;

  constructor(harness: MockHarness) {
    this.executor = new ScenarioStepExecutor(harness);
  }

  public async play(scenario: ScenarioStep[]): Promise<void> {
    console.log(`[ScenarioPlayer] Starting playback of ${scenario.length} steps`);
    for (let i = 0; i < scenario.length; i++) {
      const step = scenario[i];
      console.log(`[ScenarioPlayer] Executing step ${i + 1}/${scenario.length}:`, step.type);
      await this.executor.execute(step);
    }
    console.log(`[ScenarioPlayer] Playback complete`);
  }
}
