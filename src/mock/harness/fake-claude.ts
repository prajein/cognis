import { simulateTyping, flushDOM, setupDeterministicDOM } from './response-stream';

export class FakeClaudeDOM {
  public readonly container: HTMLElement;
  public readonly promptTextarea: HTMLElement;
  public readonly submitButton: HTMLElement;

  constructor() {
    setupDeterministicDOM('https://claude.ai/');
    
    // Setup skeleton matching claude-v1.ts selectors
    document.body.innerHTML = `
      <div class="ProseMirror" contenteditable="true"></div>
      <button aria-label="Send Message">Send</button>
    `;
    
    this.container = document.body;
    this.promptTextarea = document.querySelector('.ProseMirror')!;
    this.submitButton = document.querySelector('button')!;
  }

  async simulateSubmit(text: string): Promise<void> {
    await simulateTyping(this.promptTextarea, text);
    
    const event = new (window as any).MouseEvent('click', { bubbles: true, cancelable: true });
    this.submitButton.dispatchEvent(event);
    
    await flushDOM();
  }

  /**
   * Simulates Claude's non-monotonic streaming generation.
   * Streaming happens in one block, and then it is completely replaced.
   */
  async simulateAssistantResponse(fullText: string, chunkSize = 10): Promise<void> {
    const messageRow = document.createElement('div');
    messageRow.className = 'group group/message-row';
    this.container.appendChild(messageRow);
    
    const responseBlock = document.createElement('div');
    responseBlock.className = 'font-claude-response';
    responseBlock.setAttribute('data-is-streaming', 'true');
    messageRow.appendChild(responseBlock);
    
    await flushDOM();
    
    // Stream incrementally
    let currentText = '';
    for (let i = 0; i < fullText.length; i += chunkSize) {
      const chunk = fullText.substring(i, Math.min(i + chunkSize, fullText.length));
      currentText += chunk;
      
      const span = document.createElement('span');
      span.textContent = chunk;
      responseBlock.appendChild(span);
      
      await flushDOM();
    }
    
    // Simulate Claude's adversarial completion case: node is ripped out entirely and replaced
    messageRow.removeChild(responseBlock);
    
    const finalBlock = document.createElement('div');
    finalBlock.className = 'font-claude-response';
    finalBlock.setAttribute('data-is-streaming', 'false');
    // Claude usually renders markdown here. We'll just put the full text.
    finalBlock.textContent = fullText;
    messageRow.appendChild(finalBlock);
    
    await flushDOM();
  }
}
