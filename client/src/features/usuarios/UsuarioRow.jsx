const ROL_COLORS = {
  ADMIN: 'bg-purple-50 text-purple-700 border-purple-200',
  SUPERVISOR: 'bg-sky-50 text-sky-700 border-sky-200',
  RRHH: 'bg-amber-50 text-amber-700 border-amber-200',
  TIENDA: 'bg-gray-100 text-gray-700 border-gray-200'
};

export default function UsuarioRow({ usuario, onEdit, onResetPassword, onToggleActivo }) {
  const activo = Boolean(usuario.activo);
  return (
    <div className="antigravity-card p-4 bg-white flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 min-w-[220px]">
        <div className="w-9 h-9 rounded-full bg-pink-50 text-[#D81B60] flex items-center justify-center font-bold text-sm">
          {usuario.email.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-xs font-bold text-gray-900">{usuario.email}</p>
          <p className="text-[10px] text-gray-400">{usuario.nombre_tienda || 'Todas las tiendas'}</p>
        </div>
      </div>
      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border ${ROL_COLORS[usuario.rol] || ''}`}>{usuario.rol}</span>
      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border ${activo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
        {activo ? 'ACTIVO' : 'INACTIVO'}
      </span>
      <div className="flex items-center gap-2 ml-auto">
        <button onClick={() => onEdit(usuario)} className="px-3 py-1.5 text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">
          Editar
        </button>
        <button
          onClick={() => onResetPassword(usuario)}
          className="px-3 py-1.5 text-[11px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg"
        >
          Contraseña
        </button>
        <button
          onClick={() => onToggleActivo(usuario)}
          className={`px-3 py-1.5 text-[11px] font-bold rounded-lg border ${
            activo ? 'text-red-600 bg-red-50 hover:bg-red-100 border-red-200' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
          }`}
        >
          {activo ? 'Desactivar' : 'Activar'}
        </button>
      </div>
    </div>
  );
}
