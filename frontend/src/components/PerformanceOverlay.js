'use client';

import { useState } from 'react';
import { usePerformance } from '@/lib/PerformanceContext';

export default function PerformanceOverlay() {
  const [isVisible, setIsVisible] = useState(false);
  const { fetchTime, renderTime } = usePerformance();

  return (
    <div className={`fixed bottom-4 right-4 ${isVisible ? 'block' : 'hidden'}`}>
      <div className="bg-gray-800 dark:bg-gray-900 text-white p-4 rounded-lg shadow-lg">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold">Performance Metrics</h3>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-gray-200"
          >
            ×
          </button>
        </div>
        <div className="text-xs space-y-1">
          {fetchTime ? (
            <p>Config Fetch: {fetchTime.toFixed(2)}ms</p>
          ) : (
            <p>Config Fetch: N/A</p>
          )}
          {renderTime ? (
            <p>Tree Render: {renderTime.toFixed(2)}ms</p>
          ) : (
            <p>Tree Render: N/A</p>
          )}
        </div>
      </div>
      {!isVisible && (
        <button
          onClick={() => setIsVisible(true)}
          className="absolute bottom-0 right-0 p-2 bg-blue-500 text-white rounded-full hover:bg-blue-600"
        >
          📊
        </button>
      )}
    </div>
  );
}