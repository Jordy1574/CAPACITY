import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './auth/AuthContext';
import { SelectedStoreProvider } from './store/SelectedStoreContext';
import { ToastProvider } from './hooks/useToast';
import { ConfirmProvider } from './hooks/useConfirm';
import App from './App';
import './styles/index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Sin esto, cada vez que se vuelve a montar una pantalla (por ejemplo
      // al navegar Capacity -> Horarios -> Capacity) React Query la trata
      // como "stale" y dispara un fetch nuevo aunque los datos tengan
      // segundos de antiguedad, sintiendose lento al navegar. Las mutaciones
      // (guardar cambios, aprobar solicitud, etc.) igual invalidan la query
      // explicitamente, asi que esto no muestra datos obsoletos tras editar.
      staleTime: 30_000
    }
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SelectedStoreProvider>
            <ToastProvider>
              <ConfirmProvider>
                <App />
              </ConfirmProvider>
            </ToastProvider>
          </SelectedStoreProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
);
