import { useState, useEffect } from "react";
import { useSidepanelRuntime } from "../../../runtime/RuntimeContext";
import { InsightReadModel } from "../../../../storage/projections/builders/InsightProjectionBuilder";
import { InsightEvents } from "../../../../core/event-bus/registry";

export function useInsights(sessionId: string | undefined) {
  const { insightGateway, runtimeState, eventBus } = useSidepanelRuntime();
  const [insights, setInsights] = useState<InsightReadModel | null>(null);
  
  const isStreaming = runtimeState.isStreaming;

  const fetchInsights = () => {
    if (!sessionId) return;
    insightGateway.getSessionInsights(sessionId).then((readModel) => {
      setInsights(readModel);
    }).catch((err) => {
      console.error('[useInsights] Failed to fetch insights:', err);
    });
  };

  useEffect(() => {
    if (!sessionId) {
      setInsights(null);
      return;
    }

    if (!isStreaming) {
      const timerId = setTimeout(fetchInsights, 300);
      return () => clearTimeout(timerId);
    }
  }, [sessionId, isStreaming, insightGateway]);

  useEffect(() => {
    if (!sessionId) return;

    // Real-time updates when an insight is generated (either by Engine or Mock)
    return eventBus.subscribe(InsightEvents.GENERATED, (event) => {
       if (!event.isAuthoritative && event.origin !== 'remote') return;
       if (event.sessionId !== sessionId) return;
       // The event signifies the Projection is being updated asynchronously. 
       // Give IndexedDB 100ms to write before fetching the latest view.
       setTimeout(fetchInsights, 100);
    });
  }, [sessionId, eventBus, insightGateway]);

  return {
    insights
  };
}