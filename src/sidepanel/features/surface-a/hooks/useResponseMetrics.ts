import { useState, useEffect, useRef } from 'react';
import { useSidepanelRuntime } from '../../../runtime/RuntimeContext';
import { ResponseEvents, PromptEvents, SessionEvents } from '../../../../core/event-bus/registry';
import type { ResponseAnalysisCompletedPayload, DomainEvent } from '../../../../core/event-bus/contracts';

export enum ResponseAnalysisState {
    NO_ANALYSIS = 'NO_ANALYSIS',
    AVAILABLE = 'AVAILABLE',
    STALE = 'STALE'
}

export function useResponseMetrics() {
    const { eventBus } = useSidepanelRuntime();
    const [state, setState] = useState<ResponseAnalysisState>(ResponseAnalysisState.NO_ANALYSIS);
    const [metrics, setMetrics] = useState<ResponseAnalysisCompletedPayload | null>(null);
    
    // Mutable reference to track the correlation ID without relying on React batching
    const activePromptEventId = useRef<string | null>(null);

    useEffect(() => {
        const handlePromptSent = (event: DomainEvent<any>) => {
            activePromptEventId.current = event.id;
            setState(prev => {
                if (prev === ResponseAnalysisState.NO_ANALYSIS) {
                    return ResponseAnalysisState.NO_ANALYSIS;
                }
                return ResponseAnalysisState.STALE;
            });
        };

        const handleAnalysisCompleted = (event: DomainEvent<any>) => {
            const payload = event.payload as ResponseAnalysisCompletedPayload;
            
            // Malformed payload safety check
            if (!payload || typeof payload.qualityScore !== 'number') {
                console.warn('[useResponseMetrics] Received malformed analysis payload:', payload);
                return;
            }

            // Correlation check: Ignore late responses from older generations
            if (payload.promptEventId !== activePromptEventId.current) {
                console.warn('[useResponseMetrics] Ignored uncorrelated analysis payload:', payload.promptEventId, 'expected:', activePromptEventId.current);
                return;
            }

            setMetrics(payload);
            setState(ResponseAnalysisState.AVAILABLE);
        };

        const handleSessionEnded = () => {
            activePromptEventId.current = null;
            setMetrics(null);
            setState(ResponseAnalysisState.NO_ANALYSIS);
        };

        const unsubPrompt = eventBus.subscribe(PromptEvents.SENT, handlePromptSent);
        const unsubAnalysis = eventBus.subscribe(ResponseEvents.ANALYSIS_COMPLETED, handleAnalysisCompleted);
        const unsubSession = eventBus.subscribe(SessionEvents.ENDED, handleSessionEnded);

        // Deterministic cleanup
        return () => {
            unsubPrompt();
            unsubAnalysis();
            unsubSession();
        };
    }, [eventBus]);

    return { state, metrics };
}
