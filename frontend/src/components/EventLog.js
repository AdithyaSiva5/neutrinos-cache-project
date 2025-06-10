'use client';

export default function EventLog({ events }) {
  return (
    <div className="space-y-3 max-h-64 overflow-y-auto">
      {events.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No recent events</p>
      ) : (
        events.map((e, i) => (
          <div
            key={i}
            className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg transition-smooth hover:bg-blue-200 dark:hover:bg-blue-800"
          >
            <p className="text-sm text-gray-800 dark:text-gray-100">
              {e.time}: <span className="font-medium">{e.path}</span> {e.action} (Version: {e.version})
            </p>
          </div>
        ))
      )}
    </div>
  );
}