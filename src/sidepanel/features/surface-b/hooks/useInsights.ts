import { useState, useEffect } from "react";
import { useSidepanelRuntime } from "../../../runtime/RuntimeContext";
import { InsightReadModel } from "../../../../storage/projections/builders/InsightProjectionBuilder";

export function useInsights() {
  const { insightGateway, runtimeState } = useSidepanelRuntime();
  const [insights, setInsights] = useState<InsightReadModel | null>(null);
  
  const sessionId = runtimeState.activeSession?.sessionId;
  const isStreaming = runtimeState.isStreaming;

  useEffect(() => {
    // If there's no session, clear insights
    if (!sessionId) {
      setInsights(null);
      return;
    }

    // We fetch insights under two conditions:
    // 1. Initial mount (we just got a sessionId)
    // 2. The AI finishes streaming (isStreaming flips from true -> false)

    // Actually, whenever isStreaming is false and we have a sessionId,
    // we should try to fetch the latest insights.
    if (!isStreaming) {
      // Add a small 300ms delay to allow the background InsightEngine to complete 
      // its async reasoning and write the read model to IndexedDB.
      const timerId = setTimeout(() => {
        insightGateway.getSessionInsights(sessionId).then((readModel) => {
          setInsights(readModel);
        }).catch((err) => {
          console.error('[useInsights] Failed to fetch insights:', err);
        });
      }, 300);
      
      return () => clearTimeout(timerId);
    }

  }, [sessionId, isStreaming, insightGateway]);

  return {
    insights
  };
}