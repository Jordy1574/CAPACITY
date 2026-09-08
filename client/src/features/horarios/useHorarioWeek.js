import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchHorarioSemana } from '../../api/horarios';

export function useHorarioWeek(semanaInicio, idTienda) {
  return useQuery({
    queryKey: ['horarios', semanaInicio, idTienda],
    queryFn: () => fetchHorarioSemana(semanaInicio, idTienda),
    enabled: Boolean(semanaInicio && idTienda)
  });
}

export function useInvalidateHorarios() {
  const queryClient = useQueryClient();
  // Invalida todas las semanas de la tienda: aprobar/rechazar puede afectar
  // el estado mostrado de cualquier semana, no solo la que se está viendo.
  return (idTienda) =>
    queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === 'horarios' && String(query.queryKey[2]) === String(idTienda)
    });
}
