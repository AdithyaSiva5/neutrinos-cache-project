import axios from 'axios';

const API_BASE_URL = 'http://localhost:3000';

export const fetchConfig = async (tenantId, configId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/api/${tenantId}/${configId}`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to fetch config');
  }
};

export const fetchMetrics = async (tenantId, configId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/metrics/${tenantId}/${configId}`);
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to fetch metrics');
  }
};

export const updateConfig = async (tenantId, configId, { path, value, dependencies }) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/api/${tenantId}/${configId}`, {
      path,
      value,
      dependencies,
    });
    return response.data;
  } catch (error) {
    throw new Error(error.response?.data?.error || 'Failed to update config');
  }
};