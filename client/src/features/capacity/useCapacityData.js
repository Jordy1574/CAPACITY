import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchCapacity } from '../../api/capacity';

export function useCapacityData(mes, idTienda) {
  return useQuery({
    queryKey: ['capacity', mes, idTienda],
    queryFn: () => fetchCapacity(mes, idTienda),
    enabled: Boolean(mes && idTienda)
  });
}

export function useInvalidateCapacity() {
  const queryClient = useQueryClient();
  return (mes, idTienda) => queryClient.invalidateQueries({ queryKey: ['capacity', mes, idTienda] });
}
