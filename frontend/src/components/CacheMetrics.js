'use client';

export default function CacheMetrics({ metrics }) {
  return (
    <div className="space-y-3">
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
              Dependencies: {m.metadata.dependencies || 'None'}
            </p>
          </div>
        ))
      )}
    </div>
  );
}