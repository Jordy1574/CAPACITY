import { createContext, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'bissu_selected_store';
const SelectedStoreContext = createContext(null);

export function SelectedStoreProvider({ children }) {
  const [selectedStoreId, setSelectedStoreId] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? Number(saved) : null;
  });

  useEffect(() => {
    if (selectedStoreId) {
      localStorage.setItem(STORAGE_KEY, String(selectedStoreId));
    }
  }, [selectedStoreId]);

  return (
    <SelectedStoreContext.Provider value={{ selectedStoreId, setSelectedStoreId }}>
      {children}
    </SelectedStoreContext.Provider>
  );
}

export function useSelectedStore() {
  const ctx = useContext(SelectedStoreContext);
  if (!ctx) throw new Error('useSelectedStore must be used within SelectedStoreProvider');
  return ctx;
}
