import { useQuery } from '@tanstack/react-query';
import { fetchSolicitudes } from '../../api/horarios';

export function useSolicitudesPendientesCount(enabled) {
  return useQuery({
    queryKey: ['solicitudes', 'PENDIENTE'],
    queryFn: () => fetchSolicitudes('PENDIENTE'),
    enabled,
    select: (data) => (data.solicitudes || []).length
  });
}
