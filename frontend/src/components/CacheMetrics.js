'use client';

import { useState, useEffect } from 'react';
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

// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const CacheMetrics = ({ metrics }) => {
  // Use the passed metrics prop instead of fetching again
  if (!metrics || metrics.length === 0) {
    return (
      <div>
        <h2>Cache Metrics</h2>
        <h3>Cache Updates Chart</h3>
        <p>No cached nodes</p>
      </div>
    );
  }

  // Prepare chart data
  const chartData = {
    labels: metrics.map((metric) => metric.path),
    datasets: [
      {
        label: 'Cache Updates',
        data: metrics.map((metric) => parseInt(metric.metadata.version.replace('v', ''))),
        backgroundColor: '#3b82f6',
        borderColor: '#1d4ed8',
        borderWidth: 1,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Version Number',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Node Path',
        },
      },
    },
  };

  return (
    <div>
      <h2>Cache Metrics</h2>
      <h3>Cache Updates Chart</h3>
      <div style={{ height: '300px' }}>
        <Bar data={chartData} options={chartOptions} />
      </div>
      <div style={{ marginTop: '1rem' }}>
        <strong>Cached Nodes:</strong> {metrics.map((m) => m.path).join(', ')}
      </div>
      <ul>
        {metrics.map((metric, index) => (
          <li key={index}>
            <strong>Path:</strong> {metric.path}, <strong>Version:</strong>{' '}
            {metric.metadata.version}, <strong>Dependencies:</strong>{' '}
            {metric.metadata.dependencies.join(', ')}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default CacheMetrics;