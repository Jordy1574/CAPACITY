import { http } from './http';

export function fetchTiendas() {
  return http.get('/tiendas');
}
