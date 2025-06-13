'use client';

import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function CacheMetrics({ metrics, tenantId, cacheStats }) {
  const memoizedMetrics = useMemo(() => metrics, [JSON.stringify(metrics)]);
  const memoizedCacheStats = useMemo(() => cacheStats, [JSON.stringify(cacheStats)]);

  const chartData = useMemo(() => {
    if (!memoizedMetrics || memoizedMetrics.length === 0) {
      return null; // Return null to handle empty state in JSX
    }
    return {
      labels: [...memoizedMetrics.map((metric) => metric.path), 'Cache Hits', 'Cache Misses'],
      datasets: [
        {
          label: 'Cache Stats',
          data: [
            ...memoizedMetrics.map((metric) => parseInt(metric.metadata.version.replace('v', ''))),
            memoizedCacheStats.hits,
            memoizedCacheStats.misses,
          ],
          backgroundColor: ['#3b82f6', '#10b981', '#ef4444'],
          borderColor: ['#1d4ed8', '#059669', '#dc2626'],
          borderWidth: 1,
        },
      ],
    };
  }, [memoizedMetrics, memoizedCacheStats]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Value',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Node Path / Metric',
        },
      },
    },
  };

  if (!chartData) {
    return (
      <div>
        <h3 className="text-lg font-semibold mb-4">Cache Updates Chart</h3>
        <p className="text-gray-500 dark:text-gray-400">No cached nodes</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Cache Updates Chart</h3>
      <div style={{ height: '300px' }}>
        <Bar data={chartData} options={chartOptions} />
      </div>
      <div className="mt-4">
        <strong>Cached Nodes:</strong> {memoizedMetrics.map((m) => m.path).join(', ')}
      </div>
      <ul className="mt-2 space-y-1">
        {memoizedMetrics.map((metric, index) => (
          <li key={index} className="text-sm text-gray-700 dark:text-gray-300">
            <strong>Path:</strong> {metric.path}, <strong>Version:</strong> {metric.metadata.version}, 
            <strong>Dependencies:</strong> {metric.metadata.dependencies.join(', ')}
          </li>
        ))}
      </ul>
    </div>
  );
}