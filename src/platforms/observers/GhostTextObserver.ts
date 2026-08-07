import { EventBus } from '../../core/event-bus/EventBus';
import { PlatformConfig } from '../selectors/interfaces';
import { SessionId } from '../../core/types/session.types';
import { GhostTextEvents, SessionEvents } from '../../core/event-bus/registry';
import { GhostTextGeneratedPayload } from '../../core/event-bus/contracts';
import { createDomainEvent } from '../../core/event-bus/createDomainEvent';

export class GhostTextObserver {
  private overlayNode: HTMLElement | null = null;
  private currentStem: string | null = null;
  private currentGapType: string | null = null;
  private isDestroyed = false;
  private unsubscribeAll: (() => void)[] = [];
  
  // State machine: 'idle' -> 'showing' -> 'idle'
  private state: 'idle' | 'showing' = 'idle';

  constructor(
    private readonly eventBus: EventBus,
    private readonly config: PlatformConfig,
    private readonly sessionId: SessionId
  ) {}

  public connect(): boolean {
    if (this.isDestroyed) {
      console.warn('[GhostTextObserver] Cannot reconnect a destroyed observer.');
      return false;
    }

    this.injectStyles();

    // Listen to EventBus for generated stems
    this.unsubscribeAll.push(
      this.eventBus.subscribe(GhostTextEvents.GENERATED, (e) => this.onGhostTextGenerated(e.payload)),
      this.eventBus.subscribe(GhostTextEvents.DISMISSED, () => this.clearOverlay()),
      this.eventBus.subscribe(GhostTextEvents.ACCEPTED, () => this.clearOverlay()),
      this.eventBus.subscribe(SessionEvents.ENDED, () => this.destroy())
    );

    // Listen for DOM events to interact with ghost text
    const options = { capture: true }; // Capture to intercept keys before other listeners
    document.addEventListener('keydown', this.handleKeyDown, options);
    document.addEventListener('blur', this.handleBlur, options);

    console.log('[GhostTextObserver] Attached and observing.');
    return true;
  }

  public disconnect(): void {
    document.removeEventListener('keydown', this.handleKeyDown, { capture: true });
    document.removeEventListener('blur', this.handleBlur, { capture: true });
    this.unsubscribeAll.forEach(unsub => unsub());
    this.unsubscribeAll = [];
    this.clearOverlay();
  }

  public destroy(): void {
    this.disconnect();
    this.isDestroyed = true;
    console.log('[GhostTextObserver] Destroyed.');
  }

  private injectStyles(): void {
    const styleId = 'cognis-ghost-text-styles';
    if (document.getElementById(styleId)) return; // Idempotent

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .cognis-ghost-overlay {
        position: absolute;
        pointer-events: none;
        color: #999;
        font-style: italic;
        white-space: pre-wrap;
        z-index: 10000;
        /* Visual adjustments */
        padding: 4px;
        background: rgba(255, 255, 255, 0.8);
        border-radius: 4px;
      }
    `;
    document.head.appendChild(style);
  }

  private onGhostTextGenerated(payload: GhostTextGeneratedPayload): void {
    if (this.isDestroyed || this.state === 'showing') return;

    const inputNode = document.querySelector(this.config.selectors.promptInput) as HTMLElement;
    if (!inputNode) return;

    this.currentStem = payload.stem;
    this.currentGapType = payload.gapType as any;
    this.state = 'showing';

    this.renderOverlay(inputNode, payload.stem);
  }

  private renderOverlay(inputNode: HTMLElement, stem: string): void {
    this.overlayNode = document.createElement('span');
    this.overlayNode.className = 'cognis-ghost-overlay';
    this.overlayNode.textContent = stem;

    // A simple inline rendering in a visually convincing way per review feedback.
    const rect = inputNode.getBoundingClientRect();
    this.overlayNode.style.top = `${rect.top + 10}px`;
    this.overlayNode.style.left = `${rect.right - 150}px`; // Display near the right edge of input
    
    // Append to body to avoid being stripped by React
    document.body.appendChild(this.overlayNode);
  }

  private clearOverlay(): void {
    if (this.overlayNode && this.overlayNode.parentNode) {
      this.overlayNode.parentNode.removeChild(this.overlayNode);
    }
    this.overlayNode = null;
    this.currentStem = null;
    this.currentGapType = null;
    this.state = 'idle';
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (this.state !== 'showing' || !this.currentStem) return;

    const target = e.target as HTMLElement;
    if (!target.closest(this.config.selectors.promptInput)) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      this.acceptGhostText(target);
    } else if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Enter') {
      // Continued typing or enter
      this.dismissGhostText('continued_typing');
    }
  };

  private handleBlur = (e: FocusEvent): void => {
    if (this.state !== 'showing') return;
    this.dismissGhostText('timeout'); // Using timeout or explicit per event contract
  };

  private acceptGhostText(inputNode: HTMLElement): void {
    if (!this.currentStem || !this.currentGapType) return;

    const stemToInsert = this.currentStem;
    const gapType = this.currentGapType;

    // React-compatible value setter or contenteditable insertion
    if ('value' in inputNode) {
      const el = inputNode as HTMLTextAreaElement | HTMLInputElement;
      el.value = el.value + stemToInsert;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } else {
      // contenteditable fallback
      inputNode.innerText = inputNode.innerText + stemToInsert;
      inputNode.dispatchEvent(new Event('input', { bubbles: true }));
    }

    this.eventBus.publish(
      GhostTextEvents.ACCEPTED,
      createDomainEvent(GhostTextEvents.ACCEPTED, this.sessionId, 'perception.ui', {
        stem: stemToInsert,
        gapType: gapType as any
      })
    );
    // clearOverlay will be called via EventBus subscription
  }

  private dismissGhostText(reason: 'continued_typing' | 'timeout' | 'explicit'): void {
    if (!this.currentStem) return;

    this.eventBus.publish(
      GhostTextEvents.DISMISSED,
      createDomainEvent(GhostTextEvents.DISMISSED, this.sessionId, 'perception.ui', {
        stem: this.currentStem,
        reason
      })
    );
    // clearOverlay will be called via EventBus subscription
  }
}
