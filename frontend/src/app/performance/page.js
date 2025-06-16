'use client';

import { usePerformance } from '@/lib/PerformanceContext';
import Link from 'next/link';

export default function Performance() {
  const { fetchTime, renderTime } = usePerformance();

  return (
    <div className="container mx-auto p-6">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
          Performance Metrics
        </h1>
        <Link
          href="/"
          className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 text-sm mb-4 inline-block"
        >
          ← Back to Dashboard
        </Link>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Config Fetch Time
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {fetchTime ? `${fetchTime.toFixed(2)}ms` : 'N/A'}
              </p>
            </div>
            <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-lg">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                Tree Render Time
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {renderTime ? `${renderTime.toFixed(2)}ms` : 'N/A'}
              </p>
            </div>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            These metrics reflect the latest recorded times for fetching configuration data and rendering the JSON tree visualization. Navigate back to the dashboard and interact with the app to update these values.
          </p>
        </div>
      </div>
    </div>
  );
}