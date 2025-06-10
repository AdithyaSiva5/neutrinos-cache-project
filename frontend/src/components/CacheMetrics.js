'use client';

import { useState, useEffect, useMemo } from 'react';
import { Bar, Line, Doughnut, Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  RadialLinearScale,
  Title,
  Tooltip,
  Legend,
  Filler
);

const CacheMetrics = ({ metrics }) => {
  const [activeChart, setActiveChart] = useState('overview');
  const [animatedValues, setAnimatedValues] = useState({});

  // Process metrics data
  const processedData = useMemo(() => {
    if (!metrics || metrics.length === 0) return null;

    const versions = metrics.map(m => parseInt(m.metadata.version.replace('v', '')) || 0);
    const paths = metrics.map(m => m.path.split('/').pop() || m.path);
    const dependencies = metrics.reduce((acc, m) => acc + (m.metadata.dependencies?.length || 0), 0);
    const avgVersion = versions.reduce((a, b) => a + b, 0) / versions.length;

    return {
      paths,
      versions,
      dependencies,
      avgVersion: avgVersion.toFixed(1),
      totalNodes: metrics.length,
      maxVersion: Math.max(...versions),
      minVersion: Math.min(...versions)
    };
  }, [metrics]);

  // Animate numbers on mount
  useEffect(() => {
    if (processedData) {
      const timer = setTimeout(() => {
        setAnimatedValues({
          totalNodes: processedData.totalNodes,
          dependencies: processedData.dependencies,
          avgVersion: processedData.avgVersion,
          maxVersion: processedData.maxVersion
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [processedData]);

  if (!processedData) {
    return (
      <div className="space-y-6">
        {/* Empty State */}
        <div className="text-center py-16 space-y-4">
          <div className="text-8xl opacity-30">📊</div>
          <h3 className="text-2xl font-bold text-gray-600 dark:text-gray-300">
            No Cache Data Available
          </h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            Cache some nodes to see beautiful metrics and analytics here!
          </p>
          <div className="inline-flex items-center space-x-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-full">
            <span>🚀</span>
            <span className="font-medium">Ready for data</span>
          </div>
        </div>
      </div>
    );
  }

  // Chart data configurations
  const barChartData = {
    labels: processedData.paths,
    datasets: [
      {
        label: 'Version Numbers',
        data: processedData.versions,
        backgroundColor: (ctx) => {
          const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
          gradient.addColorStop(1, 'rgba(147, 51, 234, 0.8)');
          return gradient;
        },
        borderColor: 'rgba(59, 130, 246, 1)',
        borderWidth: 2,
        borderRadius: 8,
        borderSkipped: false,
      },
    ],
  };

  const lineChartData = {
    labels: processedData.paths,
    datasets: [
      {
        label: 'Version Progression',
        data: processedData.versions,
        borderColor: 'rgba(59, 130, 246, 1)',
        backgroundColor: (ctx) => {
          const gradient = ctx.chart.ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
          gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
          return gradient;
        },
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: 'rgba(59, 130, 246, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 3,
        pointRadius: 6,
        pointHoverRadius: 8,
      },
    ],
  };

  const doughnutData = {
    labels: processedData.paths,
    datasets: [
      {
        data: processedData.versions,
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(147, 51, 234, 0.8)',
          'rgba(236, 72, 153, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(16, 185, 129, 0.8)',
          'rgba(239, 68, 68, 0.8)',
        ],
        borderColor: [
          'rgba(59, 130, 246, 1)',
          'rgba(147, 51, 234, 1)',
          'rgba(236, 72, 153, 1)',
          'rgba(245, 158, 11, 1)',
          'rgba(16, 185, 129, 1)',
          'rgba(239, 68, 68, 1)',
        ],
        borderWidth: 3,
        hoverBorderWidth: 4,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: {
            family: 'Inter, sans-serif',
            size: 12,
            weight: '600',
          },
          usePointStyle: true,
          padding: 20,
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(59, 130, 246, 0.5)',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 12,
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          borderDash: [5, 5],
        },
        ticks: {
          font: {
            family: 'Inter, sans-serif',
            size: 11,
          },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          borderDash: [5, 5],
        },
        ticks: {
          font: {
            family: 'Inter, sans-serif',
            size: 11,
          },
        },
      },
    },
    animation: {
      duration: 1000,
      easing: 'easeOutCubic',
    },
  };

  const doughnutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          font: {
            family: 'Inter, sans-serif',
            size: 12,
            weight: '600',
          },
          usePointStyle: true,
          padding: 15,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(59, 130, 246, 0.5)',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 12,
      },
    },
    animation: {
      animateRotate: true,
      duration: 1500,
      easing: 'easeOutBounce',
    },
  };

  const chartTabs = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'bar', label: 'Bar Chart', icon: '📈' },
    { id: 'line', label: 'Trend', icon: '📉' },
    { id: 'doughnut', label: 'Distribution', icon: '🍩' },
  ];

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          {
            title: 'Cached Nodes',
            value: animatedValues.totalNodes || 0,
            icon: '🗄️',
            color: 'from-blue-500 to-blue-600',
            bgColor: 'from-blue-50 to-blue-100 dark:from-blue-900/50 dark:to-blue-800/50'
          },
          {
            title: 'Dependencies',
            value: animatedValues.dependencies || 0,
            icon: '🔗',
            color: 'from-purple-500 to-purple-600',
            bgColor: 'from-purple-50 to-purple-100 dark:from-purple-900/50 dark:to-purple-800/50'
          },
          {
            title: 'Avg Version',
            value: animatedValues.avgVersion || '0.0',
            icon: '📊',
            color: 'from-pink-500 to-pink-600',
            bgColor: 'from-pink-50 to-pink-100 dark:from-pink-900/50 dark:to-pink-800/50'
          },
          {
            title: 'Max Version',
            value: animatedValues.maxVersion || 0,
            icon: '⚡',
            color: 'from-amber-500 to-amber-600',
            bgColor: 'from-amber-50 to-amber-100 dark:from-amber-900/50 dark:to-amber-800/50'
          },
        ].map((stat, index) => (
          <div
            key={stat.title}
            className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${stat.bgColor} p-6 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105`}
            style={{
              animationDelay: `${index * 100}ms`,
              animation: 'slideInUp 0.6s ease-out forwards'
            }}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                  {stat.title}
                </p>
                <p className={`text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                  {stat.value}
                </p>
              </div>
              <div className="text-3xl opacity-80">
                {stat.icon}
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 w-16 h-16 bg-gradient-to-br from-white/20 to-transparent rounded-full"></div>
          </div>
        ))}
      </div>

      {/* Chart Navigation */}
      <div className="flex flex-wrap gap-2 bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg rounded-2xl p-2 border border-white/20 dark:border-gray-700/30">
        {chartTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveChart(tab.id)}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl font-medium transition-all duration-300 ${
              activeChart === tab.id
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg transform scale-105'
                : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-700/50 hover:scale-105'
            }`}
          >
            <span>{tab.icon}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Chart Container */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-2xl border border-white/20 dark:border-gray-700/30 shadow-2xl p-8">
        {activeChart === 'overview' && (
          <div className="space-y-8">
            <div className="text-center space-y-4">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Cache Performance Overview
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Real-time insights into your cache system performance
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="h-80">
                <h4 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
                  📈 Version Distribution
                </h4>
                <Bar data={barChartData} options={chartOptions} />
              </div>
              <div className="h-80">
                <h4 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">
                  🍩 Cache Breakdown
                </h4>
                <Doughnut data={doughnutData} options={doughnutOptions} />
              </div>
            </div>
          </div>
        )}

        {activeChart === 'bar' && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                📊 Version Bar Chart
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Compare version numbers across cached nodes
              </p>
            </div>
            <div className="h-96">
              <Bar data={barChartData} options={chartOptions} />
            </div>
          </div>
        )}

        {activeChart === 'line' && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                📉 Version Trend Analysis
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Track version progression over your cached nodes
              </p>
            </div>
            <div className="h-96">
              <Line data={lineChartData} options={chartOptions} />
            </div>
          </div>
        )}

        {activeChart === 'doughnut' && (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                🍩 Cache Distribution
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Visualize the distribution of versions across nodes
              </p>
            </div>
            <div className="h-96">
              <Doughnut data={doughnutData} options={doughnutOptions} />
            </div>
          </div>
        )}
      </div>

      {/* Detailed Metrics Table */}
      <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-2xl border border-white/20 dark:border-gray-700/30 shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-200/50 dark:border-gray-700/50">
          <h3 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            📋 Detailed Cache Metrics
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-700 dark:to-gray-600">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Node Path
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Version
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Dependencies
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 dark:text-gray-200">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200/50 dark:divide-gray-700/50">
              {metrics.map((metric, index) => (
                <tr
                  key={index}
                  className="hover:bg-white/50 dark:hover:bg-gray-700/50 transition-colors duration-200"
                  style={{
                    animationDelay: `${index * 50}ms`,
                    animation: 'fadeInUp 0.4s ease-out forwards'
                  }}
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-blue-500">📁</span>
                      <code className="text-sm font-mono bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        {metric.path}
                      </code>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                      {metric.metadata.version}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {metric.metadata.dependencies.length > 0 ? (
                        metric.metadata.dependencies.map((dep, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200"
                          >
                            {dep}
                          </span>
                        ))
                      ) : (
                        <span className="text-gray-400 text-sm">None</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                      <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                      Cached
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx global>{`
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default CacheMetrics;