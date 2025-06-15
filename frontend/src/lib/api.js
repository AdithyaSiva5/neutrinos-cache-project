// frontend\src\lib\api.js

import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';
const instance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 5000,
  headers: { 'Content-Type': 'application/json' },
});

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