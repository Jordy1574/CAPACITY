import { http } from './http';

export function fetchTiendas() {
  return http.get('/tiendas');
}

export function createTienda(payload) {
  return http.post('/tiendas', payload);
}

export function updateTienda(idTienda, payload) {
  return http.put(`/tiendas/${idTienda}`, payload);
}
