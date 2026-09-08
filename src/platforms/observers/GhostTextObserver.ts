import { EventBus } from '../../core/event-bus/EventBus';
import { PlatformConfig } from '../selectors/interfaces';
import { SessionId } from '../../core/types/session.types';
import { GhostTextEvents, SessionEvents } from '../../core/event-bus/registry';
import { GhostTextGeneratedPayload } from '../../core/event-bus/contracts';
import { createDomainEvent } from '../../core/event-bus/createDomainEvent';
import { GapType } from '../../core/types/gap.types';
import { getTextareaCaretCoordinates } from './caret-utils';

export class GhostTextObserver {
  private overlayNode: HTMLElement | null = null;
  /**
   * The suggestion currently being displayed. Treated as an immutable pair:
   * both stem and gapType are captured atomically when the overlay appears,
   * and cleared atomically when it is dismissed or accepted. This guarantees
   * that every dismissal event carries the exact gapType of the visible suggestion.
   */
  private currentSuggestion: { interventionId: string; stem: string; gapType: GapType; generatedAt: number } | null = null;
  private isDestroyed = false;
  private unsubscribeAll: (() => void)[] = [];
  
  // State machine: 'idle' -> 'showing' -> 'idle'
  private state: 'idle' | 'showing' = 'idle';

  private updatePositionFrameId: number | null = null;

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
      this.eventBus.subscribe(GhostTextEvents.GENERATED, (e) => this.onGhostTextGenerated(e.payload, e.timestamp)),
      this.eventBus.subscribe(GhostTextEvents.DISMISSED, (e) => this.handleTerminalEvent(e.payload)),
      this.eventBus.subscribe(GhostTextEvents.ACCEPTED, (e) => this.handleTerminalEvent(e.payload)),
      this.eventBus.subscribe(SessionEvents.ENDED, () => this.destroy())
    );

    const options = { capture: true };
    document.addEventListener('keydown', this.handleKeyDown, options);
    document.addEventListener('mousedown', this.handleMouseDown, options);
    window.addEventListener('blur', this.handleBlur, options);

    console.log('[GhostTextObserver] Attached and observing.');
    return true;
  }

  public disconnect(): void {
    document.removeEventListener('keydown', this.handleKeyDown, { capture: true });
    document.removeEventListener('mousedown', this.handleMouseDown, { capture: true });
    window.removeEventListener('blur', this.handleBlur, { capture: true });
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
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .cognis-ghost-overlay {
        position: fixed;
        pointer-events: none;
        color: #9CA3AF;
        white-space: pre;
        z-index: 10000;
        opacity: 0;
        transform: translateX(2px);
        transition: opacity 200ms ease-out, transform 200ms ease-out;
        max-width: 60ch;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .cognis-ghost-overlay.visible {
        opacity: 0.5;
        transform: translateX(0);
      }
      .cognis-ghost-overlay.fade-out {
        opacity: 0;
        transition: opacity 100ms ease-out;
      }
    `;
    document.head.appendChild(style);
  }

  private onGhostTextGenerated(payload: GhostTextGeneratedPayload, generatedAt: number): void {
    if (this.isDestroyed) return;

    const inputNode = document.querySelector(this.config.selectors.promptInput) as HTMLElement;
    if (!inputNode) return;

    // Truncate stem to ~80 chars to ensure it's a small nudge
    let stem = payload.stem;
    if (stem.length > 80) {
      stem = stem.slice(0, 80) + '...';
    }

    const suggestion = {
      interventionId: payload.interventionId,
      stem,
      gapType: payload.gapType,
      generatedAt
    };

    if (this.state === 'showing') {
        const oldSuggestion = this.currentSuggestion;
        this.currentSuggestion = suggestion;
        
        if (oldSuggestion) {
            this.eventBus.publish(
                GhostTextEvents.DISMISSED,
                createDomainEvent(GhostTextEvents.DISMISSED, this.sessionId, 'perception.ui', {
                    interventionId: oldSuggestion.interventionId,
                    stem: oldSuggestion.stem,
                    gapType: oldSuggestion.gapType,
                    reason: 'replaced'
                })
            );
        }
        
        if (this.overlayNode) {
            this.overlayNode.textContent = stem;
        }
    } else {
        this.state = 'showing';
        this.currentSuggestion = suggestion;
        this.renderOverlay(inputNode, stem);
    }

    this.publishDisplayed(suggestion);
  }



  private renderOverlay(inputNode: HTMLElement, stem: string): void {
    this.overlayNode = document.createElement('span');
    this.overlayNode.className = 'cognis-ghost-overlay';
    this.overlayNode.textContent = stem;

    // Mirror typography
    const styles = window.getComputedStyle(inputNode);
    this.overlayNode.style.fontFamily = styles.fontFamily;
    this.overlayNode.style.fontSize = styles.fontSize;
    this.overlayNode.style.lineHeight = styles.lineHeight;
    this.overlayNode.style.letterSpacing = styles.letterSpacing;
    this.overlayNode.style.fontWeight = styles.fontWeight;

    document.body.appendChild(this.overlayNode);

    // Force reflow
    void this.overlayNode.offsetWidth;
    this.overlayNode.classList.add('visible');

    this.startPositionTracking();
  }

  private startPositionTracking(): void {
    const updatePosition = () => {
      if (this.state !== 'showing' || !this.overlayNode) return;

      const inputNode = document.querySelector(this.config.selectors.promptInput) as HTMLElement | null;
      if (!inputNode) {
          this.dismissGhostText('node_removed');
          return;
      }

      if ('selectionStart' in inputNode && inputNode.tagName.toLowerCase() === 'textarea') {
        const coords = getTextareaCaretCoordinates(inputNode as HTMLTextAreaElement);
        if (coords) {
          // Minor offset to ensure visually pleasing alignment
          this.overlayNode.style.top = `${coords.top}px`;
          this.overlayNode.style.left = `${coords.left}px`;
        }
      } else {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          
          if (rect.height > 0) {
             this.overlayNode.style.top = `${rect.top}px`;
             this.overlayNode.style.left = `${rect.right}px`;
          } else {
             // Fallback for ProseMirror/contenteditable when rect.height is 0 (empty line/trailing space)
             const inputRect = inputNode.getBoundingClientRect();
             this.overlayNode.style.top = `${inputRect.bottom - 24}px`;
             this.overlayNode.style.left = `${inputRect.right - 150}px`;
          }
        } else {
           // Fallback if no selection
           const inputRect = inputNode.getBoundingClientRect();
           this.overlayNode.style.top = `${inputRect.bottom - 24}px`;
           this.overlayNode.style.left = `${inputRect.right - 150}px`;
        }
      }

      this.updatePositionFrameId = requestAnimationFrame(updatePosition);
    };

    this.updatePositionFrameId = requestAnimationFrame(updatePosition);
  }

  private clearOverlay(): void {
    if (this.updatePositionFrameId) {
      cancelAnimationFrame(this.updatePositionFrameId);
      this.updatePositionFrameId = null;
    }

    if (this.overlayNode) {
      const node = this.overlayNode;
      node.classList.remove('visible');
      node.classList.add('fade-out');
      setTimeout(() => {
        if (node.parentNode) node.parentNode.removeChild(node);
      }, 100);
    }
    
    this.overlayNode = null;
    this.currentSuggestion = null;
    this.state = 'idle';
  }

  private handleTerminalEvent(payload: { interventionId: string }): void {
    if (this.currentSuggestion && payload.interventionId === this.currentSuggestion.interventionId) {
      this.clearOverlay();
    }
  }

  private handleMouseDown = (): void => {
    if (this.state !== 'showing') return;
    this.dismissGhostText('caret_moved');
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (this.state !== 'showing' || !this.currentSuggestion) return;

    const target = e.target as HTMLElement;
    if (!target.closest(this.config.selectors.promptInput)) return;

    if (e.key === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      this.acceptGhostText();
    } else {
      // Dismiss if it's a character or structural edit.
      // Ignore meta keys (Ctrl, Alt, Shift, Meta) by themselves.
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) {
          return;
      }
      
      // If a modifier is held, don't dismiss blindly (e.g. Cmd+C) 
      // but let selectionChange handle it if the caret moves or text changes.
      if (e.metaKey || e.ctrlKey || e.altKey) {
          return; 
      }
      
      this.dismissGhostText('continued_typing');
    }
  };

  private handleBlur = (): void => {
    if (this.state !== 'showing') return;
    this.dismissGhostText('lost_focus');
  };

  private acceptGhostText(): void {
    if (!this.currentSuggestion) return;

    // Snapshot the suggestion before clearOverlay() nullifies it.
    const { interventionId, stem: stemToInsert, gapType } = this.currentSuggestion;

    // Use the verified browser-native insertion method
    const success = document.execCommand('insertText', false, stemToInsert);

    if (!success) {
        console.warn('[GhostTextObserver] document.execCommand failed.');
    }

    this.eventBus.publish(
      GhostTextEvents.ACCEPTED,
      createDomainEvent(GhostTextEvents.ACCEPTED, this.sessionId, 'perception.ui', {
        interventionId,
        stem: stemToInsert,
        gapType
      })
    );
  }

  private dismissGhostText(reason: 'explicit' | 'timeout' | 'continued_typing' | 'caret_moved' | 'node_removed' | 'lost_focus' | 'replaced'): void {
    if (!this.currentSuggestion) return;

    // Snapshot the suggestion before clearOverlay() nullifies it.
    const { interventionId, stem, gapType } = this.currentSuggestion;

    this.eventBus.publish(
      GhostTextEvents.DISMISSED,
      createDomainEvent(GhostTextEvents.DISMISSED, this.sessionId, 'perception.ui', {
        interventionId,
        stem,
        gapType,
        reason
      })
    );
  }

  private publishDisplayed(suggestion: { interventionId: string; stem: string; gapType: GapType; generatedAt: number }): void {
    const latency = Date.now() - suggestion.generatedAt;
    this.eventBus.publish(
      GhostTextEvents.DISPLAYED,
      createDomainEvent(GhostTextEvents.DISPLAYED, this.sessionId, 'perception.ui', {
        interventionId: suggestion.interventionId,
        gapType: suggestion.gapType,
        stem: suggestion.stem,
        displayLatencyMs: latency
      })
    );
  }
}
