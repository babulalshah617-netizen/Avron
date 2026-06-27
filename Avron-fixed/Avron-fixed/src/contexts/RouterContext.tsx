import React, { createContext, useContext, useState, useCallback } from 'react';
import type { AppRoute } from '../types';

interface RouterContextValue {
  route: AppRoute;
  navigate: (to: AppRoute) => void;
  goBack: () => void;
}

const RouterContext = createContext<RouterContextValue | null>(null);

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<AppRoute[]>(['login']);

  const route = history[history.length - 1];

  const navigate = useCallback((to: AppRoute) => {
    setHistory(prev => [...prev, to]);
  }, []);

  const goBack = useCallback(() => {
    setHistory(prev => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  return (
    <RouterContext.Provider value={{ route, navigate, goBack }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  const ctx = useContext(RouterContext);
  if (!ctx) throw new Error('useRouter must be used within RouterProvider');
  return ctx;
}
