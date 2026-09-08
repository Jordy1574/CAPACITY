import { useQuery } from '@tanstack/react-query';
import { fetchTiendas } from './tiendas';

export function useTiendas() {
  return useQuery({
    queryKey: ['tiendas'],
    queryFn: fetchTiendas,
    select: (data) => data.tiendas
  });
}
