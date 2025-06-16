'use client';

import { createContext, useContext, useState } from 'react';

const PerformanceContext = createContext();

export function PerformanceProvider({ children }) {
  const [fetchTime, setFetchTime] = useState(null);
  const [renderTime, setRenderTime] = useState(null);
  const [requestTime, setRequestTime] = useState(null);

  return (
    <PerformanceContext.Provider value={{ fetchTime, setFetchTime, renderTime, setRenderTime, requestTime, setRequestTime }}>
      {children}
    </PerformanceContext.Provider>
  );
}

export function usePerformance() {
  return useContext(PerformanceContext);
}