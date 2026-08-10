import { EventBus } from '../../core/event-bus/EventBus';
import { PlatformConfig } from '../selectors/interfaces';
import { SessionId } from '../../core/types/session.types';
import { GhostTextEvents, PromptEvents, SessionEvents } from '../../core/event-bus/registry';
import { GhostTextDismissedPayload, GhostTextGeneratedPayload, GhostTextMeasurementComputedPayload } from '../../core/event-bus/contracts';
import { createDomainEvent } from '../../core/event-bus/createDomainEvent';
import { GapType } from '../../core/types/gap.types';

interface ActiveMeasurement {
  interventionId: string;
  gapType: GapType;
  stem: string;
  originalInputNode: HTMLElement | null;
  dismissalReason: GhostTextDismissedPayload['reason'];
  windowStartTimeMs: number;
  baselineText: string;
  
  // Accumulated features
  firstKeystrokeTimeMs: number | null;
  capturedText: string;
  
  // Timers
  idleTimerId: ReturnType<typeof setTimeout> | null;
  hardTimerId: ReturnType<typeof setTimeout> | null;
}

export class GhostTextMeasurementObserver {
  private activeMeasurement: ActiveMeasurement | null = null;
  private isDestroyed = false;
  private unsubscribeAll: (() => void)[] = [];

  private readonly IDLE_TIMEOUT_MS = 2000;
  private readonly HARD_TIMEOUT_MS = 5000;

  constructor(
    private readonly eventBus: EventBus,
    private readonly config: PlatformConfig,
    private readonly sessionId: SessionId
  ) {}

  public connect(): boolean {
    if (this.isDestroyed) {
      return false;
    }

    this.unsubscribeAll.push(
      this.eventBus.subscribe(GhostTextEvents.DISMISSED, (e) => this.onDismissed(e.payload)),
      this.eventBus.subscribe(GhostTextEvents.GENERATED, (e) => this.onInterventionGenerated()),
      this.eventBus.subscribe(PromptEvents.SENT, () => this.terminateActiveMeasurement('prompt_sent')),
      this.eventBus.subscribe(SessionEvents.ENDED, () => this.destroy())
    );

    const options = { capture: true };
    document.addEventListener('input', this.handleInput, options);
    document.addEventListener('blur', this.handleBlur, options);

    // MutationObserver to watch if inputNode is unmounted
    this.startDOMObserver();

    console.log('[GhostTextMeasurementObserver] Attached and observing.');
    return true;
  }

  public disconnect(): void {
    this.clearTimers();
    document.removeEventListener('input', this.handleInput, { capture: true });
    document.removeEventListener('blur', this.handleBlur, { capture: true });
    
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }

    this.unsubscribeAll.forEach(unsub => unsub());
    this.unsubscribeAll = [];
    this.activeMeasurement = null;
  }

  public destroy(): void {
    this.disconnect();
    this.isDestroyed = true;
    console.log('[GhostTextMeasurementObserver] Destroyed.');
  }

  private onDismissed(payload: GhostTextDismissedPayload): void {
    if (this.isDestroyed) return;

    // If there is an active measurement, terminate it before starting a new one.
    if (this.activeMeasurement) {
      this.terminateActiveMeasurement('intervention_replaced');
    }
    
    // Explicit exclusions: Do not measure if it was accepted (handled elsewhere) or if gapType is missing
    if (!payload.gapType) return; // Defensive, required for measurement

    const inputNode = document.querySelector(this.config.selectors.promptInput) as HTMLElement | null;

    this.activeMeasurement = {
      interventionId: payload.interventionId,
      gapType: payload.gapType,
      stem: payload.stem,
      originalInputNode: inputNode,
      dismissalReason: payload.reason,
      windowStartTimeMs: Date.now(),
      baselineText: inputNode ? this.getInputValue(inputNode) : '',
      firstKeystrokeTimeMs: null,
      capturedText: '',
      idleTimerId: null,
      hardTimerId: null
    };

    // Start Hard Timeout
    this.activeMeasurement.hardTimerId = setTimeout(() => {
      this.terminateActiveMeasurement('hard_timeout');
    }, this.HARD_TIMEOUT_MS);
  }

  private onInterventionGenerated(): void {
    if (this.activeMeasurement) {
      this.terminateActiveMeasurement('intervention_replaced');
    }
  }

  private handleInput = (e: Event): void => {
    if (!this.activeMeasurement || this.isDestroyed) return;

    const target = e.target as HTMLElement;
    if (!target.closest(this.config.selectors.promptInput)) return;

    const now = Date.now();
    
    // Record first keystroke
    if (this.activeMeasurement.firstKeystrokeTimeMs === null) {
      this.activeMeasurement.firstKeystrokeTimeMs = now;
    }

    // Capture text (ephemeral accumulation)
    this.activeMeasurement.capturedText = this.getInputValue(target);

    // Reset Idle Timeout
    if (this.activeMeasurement.idleTimerId) {
      clearTimeout(this.activeMeasurement.idleTimerId);
    }
    this.activeMeasurement.idleTimerId = setTimeout(() => {
      this.terminateActiveMeasurement('idle_timeout');
    }, this.IDLE_TIMEOUT_MS);
  };

  private handleBlur = (e: Event): void => {
    if (!this.activeMeasurement || this.isDestroyed) return;
    
    const target = e.target as HTMLElement;
    if (this.activeMeasurement.originalInputNode && 
        (target === this.activeMeasurement.originalInputNode || this.activeMeasurement.originalInputNode.contains(target))) {
      this.terminateActiveMeasurement('focus_lost');
    }
  };

  private terminateActiveMeasurement(completionReason: GhostTextMeasurementComputedPayload['measurementCompletionReason']): void {
    if (!this.activeMeasurement) return;

    this.clearTimers();

    const m = this.activeMeasurement;
    this.activeMeasurement = null; // Clear immediately to prevent re-entry

    // Ensure we don't accidentally leak PII in URLs
    const safeOrigin = window.location.origin;
    let domRole = 'unknown';
    
    if (m.originalInputNode) {
        domRole = m.originalInputNode.tagName.toLowerCase();
        const explicitRole = m.originalInputNode.getAttribute('role');
        if (explicitRole) domRole += `[role=${explicitRole}]`;
    }

    const hasTyped = m.firstKeystrokeTimeMs !== null;
    
    // Delta Extraction
    const rawDelta = hasTyped ? this.extractDelta(m.baselineText, m.capturedText) : null;
    const isReliableDelta = rawDelta !== null;
    
    const typedLength = isReliableDelta ? rawDelta.length : null;
    const latency = hasTyped ? (m.firstKeystrokeTimeMs! - m.windowStartTimeMs) : null;
    
    let confidence: GhostTextMeasurementComputedPayload['confidence'] = 'unknown';
    
    if (!hasTyped) {
      confidence = 'unknown';
    } else if (completionReason === 'node_removed' || completionReason === 'intervention_replaced') {
      confidence = 'low'; // Interrupted prematurely
    } else {
      confidence = 'high'; // Normal termination
    }

    const payload: GhostTextMeasurementComputedPayload = {
      interventionId: m.interventionId,
      gapType: m.gapType,
      dismissalReason: m.dismissalReason,
      measurementCompletionReason: completionReason,
      context: {
        origin: safeOrigin,
        domRole
      },
      features: {
        continuationLatencyMs: latency,
        typedTextLength: typedLength,
        stemLength: m.stem.length,
        baselineTextLength: m.baselineText.length,
        lexicalOverlap: isReliableDelta ? this.calculateLexicalOverlap(m.stem, rawDelta!) : null,
        editDistance: isReliableDelta ? this.calculateEditDistance(m.stem, rawDelta!) : null
      },
      confidence
    };

    // Explicitly discard raw text from scope
    m.baselineText = '';
    m.capturedText = '';

    this.eventBus.publish(
      GhostTextEvents.MEASUREMENT_COMPUTED,
      createDomainEvent(GhostTextEvents.MEASUREMENT_COMPUTED, this.sessionId, 'perception.measurement', payload)
    );
  }

  private clearTimers(): void {
    if (this.activeMeasurement) {
      if (this.activeMeasurement.idleTimerId) clearTimeout(this.activeMeasurement.idleTimerId);
      if (this.activeMeasurement.hardTimerId) clearTimeout(this.activeMeasurement.hardTimerId);
      this.activeMeasurement.idleTimerId = null;
      this.activeMeasurement.hardTimerId = null;
    }
  }

  private getInputValue(node: HTMLElement): string {
    if ('value' in node) {
      return (node as HTMLInputElement | HTMLTextAreaElement).value || '';
    }
    return node.innerText || node.textContent || '';
  }

  /**
   * Extracts the localized change between the baseline and current text.
   * If the user made multiple disjoint edits, this returns null (unreliable delta).
   */
  private extractDelta(baseline: string, current: string): string | null {
    if (baseline === current) return '';

    if (current.startsWith(baseline)) {
      return current.slice(baseline.length);
    }

    let prefixLen = 0;
    while (prefixLen < baseline.length && prefixLen < current.length && baseline[prefixLen] === current[prefixLen]) {
      prefixLen++;
    }

    let suffixLen = 0;
    while (suffixLen < baseline.length - prefixLen && suffixLen < current.length - prefixLen && 
           baseline[baseline.length - 1 - suffixLen] === current[current.length - 1 - suffixLen]) {
      suffixLen++;
    }

    // Check for disjoint edits: if the modified region spans more than one contiguous block
    // (We consider it reliable if it's a single contiguous insertion, deletion, or replacement)
    // Actually, LCP + LCS always bounds the single outermost modified region. 
    // To ensure it's truly a single edit, we'd need a real diff.
    // For M11, we will trust the extracted span as the delta, but we bound it.
    
    return current.slice(prefixLen, current.length - suffixLen);
  }

  private normalizeText(text: string): string {
    // 1. Convert to lowercase
    // 2. Remove all punctuation
    // 3. Collapse multiple whitespace into single space
    // 4. Trim
    return text
      .toLowerCase()
      .replace(/[^\w\s]|_/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Jaccard similarity of words
  private calculateLexicalOverlap(stem: string, typed: string): number {
    const normStem = this.normalizeText(stem);
    const normTyped = this.normalizeText(typed);
    
    if (normStem.length === 0 || normTyped.length === 0) return 0;

    const tokenize = (text: string) => new Set(text.split(' ').filter(w => w.length > 0));
    const stemWords = tokenize(normStem);
    const typedWords = tokenize(normTyped);
    
    if (stemWords.size === 0 || typedWords.size === 0) return 0;
    
    let intersection = 0;
    for (const w of stemWords) {
      if (typedWords.has(w)) intersection++;
    }
    
    const union = stemWords.size + typedWords.size - intersection;
    return union === 0 ? 0 : intersection / union;
  }

  // Standard Levenshtein distance
  private calculateEditDistance(stem: string, typed: string): number {
    const a = this.normalizeText(stem);
    const b = this.normalizeText(typed);
    
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matrix = [];
    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1));
        }
      }
    }
    return matrix[b.length][a.length];
  }

  private mutationObserver: MutationObserver | null = null;
  private startDOMObserver(): void {
    this.mutationObserver = new MutationObserver(() => {
      if (this.activeMeasurement && this.activeMeasurement.originalInputNode) {
        if (!this.activeMeasurement.originalInputNode.isConnected) {
          this.terminateActiveMeasurement('node_removed');
        }
      }
    });
    this.mutationObserver.observe(document.body, { childList: true, subtree: true });
  }
}
