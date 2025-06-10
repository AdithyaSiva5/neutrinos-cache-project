'use client';

import { useMemo } from 'react';

export default function CacheMetrics({ metrics }) {
  const chartData = useMemo(() => ({
    type: 'bar',
    data: {
      labels: metrics.map(m => m.path),
      datasets: [{
        label: 'Cache Updates',
        data: metrics.map(m => parseInt(m.metadata.version?.replace('v', '') || '0')),
        backgroundColor: '#3b82f6',
        borderColor: '#1d4ed8',
        borderWidth: 1,
      }],
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Version Number' },
        },
        x: {
          title: { display: true, text: 'Node Path' },
        },
      },
    },
  }), [metrics]);

  return (
    <div className="space-y-3">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg transition-smooth">
        <h3 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">Cache Update Chart</h3>
        ```chartjs
        ${JSON.stringify(chartData)}
        ```
      </div>
      {metrics.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No cached nodes</p>
      ) : (
        metrics.map(m => (
          <div
            key={m.path}
            className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg transition-smooth hover:bg-gray-200 dark:hover:bg-gray-600"
          >
            <span className="font-medium text-gray-800 dark:text-gray-100">{m.path}</span>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Version: {m.metadata.version || 'N/A'} | Updated: {m.metadata.updated_at || 'N/A'}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Dependencies: {m.metadata.dependencies?.join(', ') || 'None'}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Dependents: {m.metadata.dependents?.join(', ') || 'None'}
            </p>
          </div>
        ))
      )}
    </div>
  );
}