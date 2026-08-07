import { ScenarioStep } from './types';

export const demoScenario: ScenarioStep[] = [
  { type: 'startSession', taskId: 'ai_copilot_brainstorming' },
  { type: 'type', text: 'How do I improve my focus during deep work?', delayMs: 80 },
  { type: 'pause', durationMs: 2500 },
  { type: 'type', text: ' Specifically when using AI tools.', delayMs: 60 },
  { type: 'wait', durationMs: 500 },
  { type: 'submit' },
  { 
    type: 'streamResponse', 
    text: 'Improving focus during deep work when using AI tools involves creating a structured environment and setting clear intentions. First, use AI as a collaborator rather than a crutch—outline your goals before prompting so you do not get distracted by tangential responses. Second, turn off notifications and create a dedicated workspace. Third, batch your AI interactions; instead of interrupting your flow every five minutes, save up your queries and process them together.', 
    chunkSizeChars: 15, 
    chunkDelayMs: 60 
  },
  { type: 'wait', durationMs: 2000 },
  {
    type: 'insight',
    domain: 'Automaticity',
    title: 'Prompt Intentionality Transition',
    summary: 'You are demonstrating stronger intentionality by formulating complete problem contexts before engaging the AI.'
  },
  { type: 'wait', durationMs: 2000 },
  { type: 'endSession' }
];
