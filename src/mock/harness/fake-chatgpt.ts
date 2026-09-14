import { simulateTyping, simulateDOMStream, flushDOM, setupDeterministicDOM } from './response-stream';

export class FakeChatGPTDOM {
  public readonly container: HTMLElement;
  public readonly promptTextarea: HTMLElement;
  public readonly submitButton: HTMLElement;

  private turnCount = 0;

  constructor() {
    setupDeterministicDOM('https://chatgpt.com/');
    
    // Setup skeleton
    document.body.innerHTML = `
      <main></main>
      <div id="prompt-textarea" contenteditable="true"></div>
      <button data-testid="send-button">Send</button>
    `;
    
    this.container = document.querySelector('main')!;
    this.promptTextarea = document.querySelector('#prompt-textarea')!;
    this.submitButton = document.querySelector('[data-testid="send-button"]')!;
  }

  /**
   * Simulates typing text and triggering the submit lifecycle.
   * Note: The real SubmitInterceptor has an internal setTimeout(50) to wait for React state flushes,
   * so tests calling this must await a real delay after it resolves.
   */
  async simulateSubmit(text: string): Promise<void> {
    await simulateTyping(this.promptTextarea, text);
    
    const event = new (window as any).MouseEvent('click', { bubbles: true, cancelable: true });
    this.submitButton.dispatchEvent(event);
    
    await flushDOM();
  }

  /**
   * Simulates a ChatGPT streaming response matching the exact selectors and streaming indicator lifecycle.
   */
  async simulateAssistantResponse(fullText: string, chunkSize = 10): Promise<void> {
    this.turnCount++;
    const turnDiv = document.createElement('div');
    turnDiv.setAttribute('data-testid', `conversation-turn-${this.turnCount}`);
    
    const assistantDiv = document.createElement('div');
    assistantDiv.setAttribute('data-message-author-role', 'assistant');
    // ChatGPT adds result-streaming class while generating
    assistantDiv.classList.add('result-streaming');
    
    turnDiv.appendChild(assistantDiv);
    this.container.appendChild(turnDiv);
    
    // Flush to trigger response.started
    await flushDOM();
    
    // Simulate a stop button existing while generating
    const stopButton = document.createElement('button');
    stopButton.setAttribute('data-testid', 'stop-button');
    this.container.appendChild(stopButton);
    
    // Stream text
    await simulateDOMStream(assistantDiv, fullText, chunkSize);
    
    // Stop streaming (removing button triggers childList mutation)
    assistantDiv.classList.remove('result-streaming');
    this.container.removeChild(stopButton);
    await flushDOM();
  }
}
