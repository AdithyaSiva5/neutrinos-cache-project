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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('tree');
  const tenantId = 'T1';
  const configId = 'C1';

  const updateConfigAndMetrics = useCallback(() => {
    fetchConfig(tenantId, configId)
      .then((data) => {
        setConfig(data.config);
        setLoading(false);
      })
      .catch((err) => {
        toast.error(`Failed to fetch config: ${err.message}`);
        setLoading(false);
      });

    fetchMetrics(tenantId, configId)
      .then((data) => setMetrics(data.metrics))
      .catch((err) => toast.error(`Failed to fetch metrics: ${err.message}`));
  }, [tenantId, configId]);

  const handleSocketUpdate = useCallback(
    throttle((updates) => {
      if (Array.isArray(updates)) {
        updates.forEach(({ path, action, version }) => {
          setEvents((prev) =>
            [
              ...prev,
              { path, action, version, time: new Date().toLocaleTimeString() },
            ].slice(-10)
          );
          toast.info(`🚀 Node ${path} ${action} (v${version})`, {
            style: {
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white'
            }
          });
        });
      } else {
        setEvents((prev) =>
          [
            ...prev,
            { path: updates.path, action: updates.action, version: updates.version, time: new Date().toLocaleTimeString() },
          ].slice(-10)
        );
        toast.info(`🚀 Node ${updates.path} ${updates.action} (v${updates.version})`, {
          style: {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }
        });
      }
      updateConfigAndMetrics();
    }, 1000),
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

  const tabs = [
    { id: 'tree', label: 'Tree View', icon: '🌳' },
    { id: 'metrics', label: 'Metrics', icon: '📊' },
    { id: 'events', label: 'Events', icon: '⚡' },
    { id: 'update', label: 'Update', icon: '✏️' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="text-center space-y-4">
          <div className="animate-spin text-6xl">🌟</div>
          <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Loading Configuration...
          </h2>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <ToastContainer 
        position="top-right" 
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="colored"
      />
      
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 animate-pulse"></div>
        <div className="relative px-6 py-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center space-y-4">
              <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Neutrinos Config Dashboard
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                Smart cache invalidation for JSON tree configurations with real-time updates
              </p>
              
              {/* Stats Bar */}
              <div className="flex justify-center space-x-8 mt-8">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    {Object.keys(config).length}
                  </div>
                  <div className="text-sm text-gray-500">Config Nodes</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                    {metrics.length}
                  </div>
                  <div className="text-sm text-gray-500">Cached Items</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-pink-600 dark:text-pink-400">
                    {events.length}
                  </div>
                  <div className="text-sm text-gray-500">Recent Events</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Tab Navigation */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex space-x-1 bg-white/60 dark:bg-gray-800/60 backdrop-blur-lg rounded-2xl p-2 border border-white/20 dark:border-gray-700/30">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-2 px-6 py-3 rounded-xl font-medium transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg transform scale-105'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-white/50 dark:hover:bg-gray-700/50 hover:scale-105'
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="max-w-7xl mx-auto px-6 pb-12">
        {activeTab === 'tree' && (
          <div className="animate-fade-in">
            <ConfigTree config={config} metrics={metrics} />
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="animate-fade-in">
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-2xl border border-white/20 dark:border-gray-700/30 shadow-2xl p-8">
              <div className="flex items-center space-x-3 mb-6">
                <span className="text-3xl">📊</span>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Cache Metrics
                </h2>
              </div>
              <CacheMetrics metrics={metrics} />
            </div>
          </div>
        )}

        {activeTab === 'events' && (
          <div className="animate-fade-in">
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-2xl border border-white/20 dark:border-gray-700/30 shadow-2xl p-8">
              <div className="flex items-center space-x-3 mb-6">
                <span className="text-3xl">⚡</span>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Invalidation Events
                </h2>
              </div>
              <EventLog events={events} />
            </div>
          </div>
        )}

        {activeTab === 'update' && (
          <div className="animate-fade-in">
            <div className="bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-2xl border border-white/20 dark:border-gray-700/30 shadow-2xl p-8">
              <div className="flex items-center space-x-3 mb-6">
                <span className="text-3xl">✏️</span>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Update Configuration
                </h2>
              </div>
              <UpdateForm tenantId={tenantId} configId={configId} />
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .animate-fade-in {
          animation: fadeIn 0.5s ease-in-out;
        }
        
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .Toastify__toast {
          border-radius: 12px;
          backdrop-filter: blur(10px);
        }
      `}</style>
    </div>
  );
}