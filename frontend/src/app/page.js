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
  const [tenantId, setTenantId] = useState('T1');
  const [configId, setConfigId] = useState('C1');

  const updateConfigAndMetrics = useCallback(() => {
    console.time('fetchConfigFrontend');
    fetchConfig(tenantId, configId)
      .then((data) => {
        setConfig(data.config || {});
        console.timeEnd('fetchConfigFrontend');
      })
      .catch((err) => toast.error(`Config fetch failed: ${err.message}`));
    fetchMetrics(tenantId, configId)
      .then((data) => setMetrics(data.metrics || []))
      .catch((err) => toast.error(`Metrics fetch failed: ${err.message}`));
  }, [tenantId, configId]);

  const handleSocketUpdate = useCallback(
    throttle((updates) => {
      const updateArray = Array.isArray(updates) ? updates : [updates];
      setEvents((prev) =>
        [
          ...updateArray.map((u) => ({
            path: u.path,
            action: u.action,
            version: u.version,
            time: new Date().toLocaleTimeString(),
          })),
          ...prev,
        ].slice(0, 10)
      );
      updateConfigAndMetrics();
      toast.info(`Update received: ${updateArray.length} nodes affected`);
    }, 500),
    [updateConfigAndMetrics]
  );

  useEffect(() => {
    updateConfigAndMetrics();
    const socket = useSocket();
    socket.emit('join', { tenantId, configId });
    socket.on('update', handleSocketUpdate);
    return () => {
      socket.off('update', handleSocketUpdate);
      disconnectSocket();
    };
  }, [tenantId, configId, handleSocketUpdate]);

  return (
    <div className="space-y-6">
      <ToastContainer position="top-right" autoClose={2000} limit={5} />
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-lg">
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">Tenant Config</h2>
        <div className="flex-col space-y-2 mb-4">
          <input
            type="text"
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value.trim())}
            placeholder="Enter Tenant ID (e.g., T1, T2)"
            className="p-2 border rounded-lg dark:bg-gray-700 dark:text-gray-100 w-full"
          />
          <input
            type="text"
            value={configId}
            onChange={(e) => setConfigId(e.target.value.trim())}
            placeholder="Enter Config ID (e.g., C1, C2)"
            className="p-2 border rounded-lg dark:bg-gray-700 dark:text-gray-100 w-full"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg transition-smooth">
          <h2 className="text-2xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
            JSON Tree Visualization
          </h2>
          <ConfigTree config={config} metrics={metrics} tenantId={tenantId} configId={configId} />
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
            <CacheMetrics metrics={metrics} tenantId={tenantId} />
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