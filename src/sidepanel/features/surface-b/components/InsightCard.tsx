import React from 'react';
import type { InsightReadModel } from '../../../../storage/projections/builders/InsightProjectionBuilder';

interface InsightCardProps {
  insightsModel: InsightReadModel | null;
}

export function InsightCard({ insightsModel }: InsightCardProps) {
  if (!insightsModel || insightsModel.insights.length === 0) {
    return null;
  }

  return (
    <section style={{ 
      marginTop: '16px', 
      padding: '16px', 
      backgroundColor: '#f3f4f6', 
      borderRadius: '8px' 
    }}>
      <h3 style={{ marginTop: 0, marginBottom: '8px' }}>Cognitive Insights</h3>
      <ul style={{ paddingLeft: '20px', margin: 0 }}>
        {insightsModel.insights.map((insight) => (
          <li key={insight.id} style={{ marginBottom: '8px' }}>
            <strong>{insight.title}</strong>: {insight.summary}
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              Domain: {insight.domain} | Evidence: {insight.evidenceCount}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
