import StoreSelector from './StoreSelector';

const ICONO_POR_TIPO = { TIENDA: '🏬', OFICINA: '🏢', LOGISTICA: '📦' };

export default function StoreHeaderBanner({ tienda, showSelector, tiendas, storeId, onChangeStore }) {
  const storeName = tienda ? (tienda.codigo_almacen ? `${tienda.nombre_tienda} (${tienda.codigo_almacen})` : tienda.nombre_tienda) : 'Cargando...';
  const plazasBadge = tienda?.rango_codigos ? `Plazas: ${tienda.rango_codigos}` : '';
  const icono = ICONO_POR_TIPO[tienda?.tipo] || '🏬';

  return (
    <div
      className="rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
      style={{ background: 'linear-gradient(to right, #D81B60, #AD1457)' }}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl leading-none">{icono}</span>
        <div>
          <p className="font-brand font-black text-lg text-white uppercase tracking-wide leading-tight">{storeName}</p>
          {plazasBadge && <p className="text-[11px] text-pink-100 font-semibold">{plazasBadge}</p>}
        </div>
      </div>
      {showSelector && tiendas && <StoreSelector tiendas={tiendas} value={storeId} onChange={onChangeStore} />}
    </div>
  );
}
