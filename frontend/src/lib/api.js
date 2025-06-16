import axios from 'axios';
import { usePerformance } from './PerformanceContext';

const API_BASE_URL = 'http://localhost:3000';
const instance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor to measure request time
instance.interceptors.request.use(
  (config) => {
    config.metadata = { startTime: performance.now() };
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor to calculate and store request time
instance.interceptors.response.use(
  (response) => {
    const endTime = performance.now();
    const requestTime = endTime - response.config.metadata.startTime;
    // Access PerformanceContext in a way that works with static exports
    try {
      const { setRequestTime } = require('./PerformanceContext').usePerformance();
      setRequestTime(requestTime);
    } catch (e) {
      console.warn('PerformanceContext not available for request time');
    }
    return response;
  },
  (error) => Promise.reject(error)
);

export const fetchConfig = async (tenantId, configId, path = null) => {
  try {
    const response = await instance.get(`/api/${tenantId}/${configId}${path ? `?path=${encodeURIComponent(path)}` : ''}`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to fetch config');
  }
};

export const fetchMetrics = async (tenantId, configId) => {
  try {
    const response = await instance.get(`/metrics/${tenantId}/${configId}`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to fetch metrics');
  }
};

export const updateConfig = async (tenantId, configId, { path, value, dependencies, userId }) => {
  try {
    const response = await instance.post(`/api/${tenantId}/${configId}`, {
      path,
      value,
      dependencies,
      userId,
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to update config');
  }
};