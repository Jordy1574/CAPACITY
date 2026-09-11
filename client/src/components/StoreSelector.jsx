export default function StoreSelector({ tiendas, value, onChange }) {
  return (
    <div className="relative">
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        title="Cambiar tienda"
        className="appearance-none text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 pl-3 pr-7 py-1.5 rounded-lg outline-none focus:ring-2 focus:ring-[#D81B60] cursor-pointer transition-colors"
      >
        {(tiendas || []).map((t) => (
          <option key={t.id_tienda} value={t.id_tienda}>
            {t.codigo_almacen ? `${t.nombre_tienda} (${t.codigo_almacen})` : t.nombre_tienda}
          </option>
        ))}
      </select>
      <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}
