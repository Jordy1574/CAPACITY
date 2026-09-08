import { useEffect, useState } from 'react';
import { useTiendas } from '../../api/useTiendas';

const EMPTY_FORM = { email: '', password: '', rol: 'TIENDA', id_tienda: '' };

export default function UsuarioModal({ open, usuario, saving, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const { data: tiendas } = useTiendas();

  useEffect(() => {
    if (!open) return;
    if (usuario) {
      setForm({ email: usuario.email, password: '', rol: usuario.rol, id_tienda: usuario.id_tienda || '' });
    } else {
      setForm({ ...EMPTY_FORM, id_tienda: tiendas?.[0]?.id_tienda || '' });
    }
  }, [open, usuario, tiendas]);

  if (!open) return null;

  const isEdit = Boolean(usuario);
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { rol: form.rol, id_tienda: form.rol === 'TIENDA' ? parseInt(form.id_tienda, 10) : null };
    if (!isEdit) {
      payload.email = form.email.trim();
      payload.password = form.password;
    }
    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="antigravity-card bg-white max-w-lg w-full p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-pink-50 text-[#D81B60] rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h3 className="font-brand font-bold text-lg text-gray-900">{isEdit ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
              <p className="text-xs text-gray-500">Define el correo, rol y tienda asignada.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-black">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Correo Electrónico *</label>
            <input
              type="email"
              required
              disabled={isEdit}
              value={form.email}
              onChange={set('email')}
              placeholder="usuario@bissu.pe"
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#D81B60] disabled:opacity-60"
            />
          </div>

          {!isEdit && (
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Contraseña *</label>
              <input
                type="text"
                required
                minLength={6}
                value={form.password}
                onChange={set('password')}
                placeholder="Mínimo 6 caracteres"
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#D81B60]"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Rol</label>
              <select value={form.rol} onChange={set('rol')} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#D81B60]">
                <option value="TIENDA">TIENDA</option>
                <option value="SUPERVISOR">SUPERVISOR</option>
                <option value="RRHH">RRHH</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>

            {form.rol === 'TIENDA' && (
              <div>
                <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">Tienda</label>
                <select value={form.id_tienda} onChange={set('id_tienda')} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#D81B60]">
                  {(tiendas || []).map((t) => (
                    <option key={t.id_tienda} value={t.id_tienda}>
                      {t.nombre_tienda} ({t.codigo_almacen})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-xl">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-bissu px-5 py-2 text-xs font-bold uppercase tracking-wider">
              {saving ? 'Guardando...' : 'Guardar Usuario'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
