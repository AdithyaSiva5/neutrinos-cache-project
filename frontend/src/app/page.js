// frontend\src\app\page.js
'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import dynamic from 'next/dynamic';
import ConfigTree from '@/components/ConfigTree';
import CacheMetrics from '@/components/CacheMetrics';
import EventLog from '@/components/EventLog';
import UpdateForm from '@/components/UpdateForm';
import { fetchConfig, fetchMetrics } from '@/lib/api';
import { useSocket, disconnectSocket } from '@/lib/socket';
import 'react-toastify/dist/ReactToastify.css';
import { throttle } from 'lodash';

const ToastContainer = dynamic(() => import('react-toastify').then((mod) => mod.ToastContainer), {
  ssr: false,
});

export default function Dashboard() {
  const [config, setConfig] = useState({});
  const [metrics, setMetrics] = useState([]);
  const [events, setEvents] = useState([]);
  const tenantId = 'T1';
  const configId = 'C1';

  const updateMetrics = useCallback(() => {
    fetchMetrics(tenantId, configId)
      .then((data) => setMetrics(data.metrics))
      .catch((err) => toast.error(`Failed to fetch metrics: ${err.message}`));
  }, [tenantId, configId]);

  const handleSocketUpdate = useCallback(
    throttle(({ path, action, version }) => {
      setEvents((prev) => [
        ...prev,
        { path, action, version, time: new Date().toLocaleTimeString() },
      ].slice(-10));
      updateMetrics();
      toast.info(`Node ${path} ${action} (v${version})`);
    }, 1000),
    [updateMetrics]
  );

  useEffect(() => {
    // Fetch initial config
    fetchConfig(tenantId, configId)
      .then((data) => setConfig(data.config))
      .catch((err) => toast.error(`Failed to fetch config: ${err.message}`));

    updateMetrics();

    const socket = useSocket();
    socket.emit('join', { tenantId, configId });
    socket.on('update', handleSocketUpdate);

    return () => {
      socket.off('update', handleSocketUpdate);
      disconnectSocket();
    };
  }, [tenantId, configId, updateMetrics, handleSocketUpdate]);

  return (
    <div>
      <ToastContainer position="top-right" autoClose={3000} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg transition-smooth">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
            JSON Tree Visualization
          </h2>
          <ConfigTree config={config} metrics={metrics} />
        </div>
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg transition-smooth">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
              Update Config
            </h2>
            <UpdateForm tenantId={tenantId} configId={configId} />
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg transition-smooth">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
              Cache Metrics
            </h2>
            <CacheMetrics metrics={metrics} />
          </div>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg transition-smooth">
            <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
              Invalidation Events
            </h2>
            <EventLog events={events} />
          </div>
        </div>
      </div>
    </div>
  );
}