// Ordena por hora_inicio y valida: cada bloque hora_fin > hora_inicio, y los
// bloques consecutivos (ya ordenados) no se solapan. Lanza un Error con el
// mensaje a mostrar al usuario si algo no es válido; si es válido, devuelve
// el array ordenado.
export function validateBloques(bloques) {
  const sorted = [...bloques].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

  for (const b of sorted) {
    if (b.hora_fin <= b.hora_inicio) {
      throw new Error('La hora de fin debe ser posterior a la hora de inicio en cada bloque.');
    }
  }
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].hora_inicio < sorted[i - 1].hora_fin) {
      throw new Error('Los bloques de turno no pueden solaparse.');
    }
  }

  return sorted;
}

// Una vez que la semana tiene horario oficial confirmado, la edición de la
// tienda deja de guardarse en vivo: pasa a ser una propuesta (solicitud de
// cambio) que un Admin/Supervisor/RRHH debe aprobar.
export function requiereSolicitud(rol, periodo) {
  if (rol !== 'TIENDA') return false;
  return Boolean(periodo?.confirmado_por);
}
