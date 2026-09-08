import { http } from './http';

export function fetchUsuarios() {
  return http.get('/usuarios');
}

export function createUsuario(payload) {
  return http.post('/usuarios', payload);
}

export function updateUsuario(idUsuario, payload) {
  return http.put(`/usuarios/${idUsuario}`, payload);
}

export function resetPassword(idUsuario, password) {
  return http.post(`/usuarios/${idUsuario}/reset-password`, { password });
}

export function toggleActivo(idUsuario, activo) {
  return http.post(`/usuarios/${idUsuario}/toggle-activo`, { activo });
}
