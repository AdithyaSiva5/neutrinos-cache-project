'use client';

import { useState, useEffect } from 'react';
import { fetchConfig } from '@/lib/api';

const ConfigDisplay = ({ tenantId, configId }) => {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const { config } = await fetchConfig(tenantId, configId);
        setConfig(config);
      } catch (err) {
        console.error('Config fetch error:', err);
        setError(err.message);
      }
    };
    loadConfig();
  }, [tenantId, configId]);

  if (error) return <div className="text-red-500">Error: {error}</div>;
  if (!config) return <div className="text-gray-500">Loading...</div>;

  return (
    <div className="space-y-2">
      <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">JSON Tree Visualization</h2>
      <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg overflow-x-auto">
        {JSON.stringify(config, null, 2)}
      </pre>
    </div>
  );
};

export default ConfigDisplay;