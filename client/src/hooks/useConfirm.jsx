import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((message) => {
    setState({ message });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const handle = (result) => {
    setState(null);
    if (resolver.current) {
      resolver.current(result);
      resolver.current = null;
    }
  };

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="antigravity-card bg-white max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-50 text-amber-600 rounded-xl shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                </svg>
              </div>
              <h3 className="font-brand font-bold text-base text-gray-900">Confirmar</h3>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">{state.message}</p>
            <div className="flex items-center justify-end gap-3 pt-1">
              <button type="button" onClick={() => handle(false)} className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-xl">
                Cancelar
              </button>
              <button type="button" onClick={() => handle(true)} className="btn-bissu px-5 py-2 text-xs font-bold uppercase tracking-wider">
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm debe usarse dentro de ConfirmProvider');
  return ctx.confirm;
}
