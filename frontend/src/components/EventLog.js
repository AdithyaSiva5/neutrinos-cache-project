'use client';

import { useState } from 'react';

export default function EventLog({ events }) {
  const [visibleCount, setVisibleCount] = useState(5);

  return (
    <div className="space-y-3 max-h-64 overflow-y-auto">
      {events.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No recent events</p>
      ) : (
        <>
          {events.slice(0, visibleCount).map((e, i) => (
            <div
              key={i}
              className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800 transition-smooth"
            >
              <p className="text-sm text-gray-800 dark:text-gray-100">
                {e.time}: {e.userId} {e.action} <span className="font-medium">{e.path}</span> (Version: {e.version})
              </p>
            </div>
          ))}
          {events.length > visibleCount && (
            <button
              onClick={() => setVisibleCount(visibleCount + 5)}
              className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Show More
            </button>
          )}
        </>
      )}
    </div>
  );
}