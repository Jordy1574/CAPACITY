import { bloqueEnMinutos } from './coverage';

// Ordena por hora_inicio y valida que los bloques no se solapen. Un bloque
// cuyo fin es menor que su inicio (22:00-02:00) cruza la medianoche y es
// válido. Lanza un Error con el mensaje a mostrar al usuario si algo no es
// válido; si es válido, devuelve el array ordenado.
export function validateBloques(bloques) {
  const sorted = [...bloques].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

  for (const b of sorted) {
    if (b.hora_fin === b.hora_inicio) {
      throw new Error('La hora de fin no puede ser igual a la de inicio.');
    }
  }
  // Se compara en minutos porque un bloque que cruza medianoche (22:00-02:00)
  // termina más allá de 1440 y no se puede comparar como texto.
  for (let i = 1; i < sorted.length; i++) {
    const anterior = bloqueEnMinutos(sorted[i - 1]);
    const actual = bloqueEnMinutos(sorted[i]);
    if (actual.inicio < anterior.fin) {
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
