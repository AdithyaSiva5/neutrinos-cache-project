'use client';

import { useState, useEffect } from 'react';

const ConfigDisplay = () => {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('http://localhost:3000/api/T1/C1');
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch config');
        }
        setConfig(data.config);
      } catch (err) {
        console.error('Fetch config error:', err);
        setError(err.message);
      }
    };
    fetchConfig();
  }, []);

  if (error) return <div>Error: {error}</div>;
  if (!config) return <div>Loading...</div>;

  return (
    <div>
      <h2>JSON Tree Visualization</h2>
      <pre>{JSON.stringify(config, null, 2)}</pre>
    </div>
  );
};

export default ConfigDisplay;   