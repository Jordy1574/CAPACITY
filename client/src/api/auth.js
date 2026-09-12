import { http } from './http';

export function login(identificador, password) {
  return http.post('/auth/login', { identificador, password });
}
