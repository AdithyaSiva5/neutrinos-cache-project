'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const TenantConfigContext = createContext();

export function TenantConfigProvider({ children }) {
  const [tenantId, setTenantId] = useState('T1');
  const [configId, setConfigId] = useState('C1');

  useEffect(() => {
    // Persist tenantId and configId in localStorage
    localStorage.setItem('tenantId', tenantId);
    localStorage.setItem('configId', configId);
  }, [tenantId, configId]);

  useEffect(() => {
    // Load tenantId and configId from localStorage on mount
    const savedTenantId = localStorage.getItem('tenantId') || 'T1';
    const savedConfigId = localStorage.getItem('configId') || 'C1';
    setTenantId(savedTenantId);
    setConfigId(savedConfigId);
  }, []);

  return (
    <TenantConfigContext.Provider value={{ tenantId, setTenantId, configId, setConfigId }}>
      {children}
    </TenantConfigContext.Provider>
  );
}


export function useTenantConfig() {
  return useContext(TenantConfigContext);
}