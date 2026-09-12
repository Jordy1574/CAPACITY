import { useEffect, useState } from 'react';
import { useTiendas } from '../../api/useTiendas';
import { generatePassword } from '../../utils/password';

const EMPTY_FORM = {
  email: '',
  rol: 'TIENDA',
  id_tienda: '',
  // Datos de la tienda (su cuenta se crea junto con ella)
  nombre_tienda: '',
  codigo_almacen: '',
  rango_desde: '',
  rango_hasta: '',
  correo_tienda: '',
  // Datos personales del empleado (Oficina / Logística)
  dni: '',
  nombre_completo: '',
  puesto: '',
  celular: '',
  // Cambio de contraseña al editar (vacío = no se toca)
  nueva_password: ''
};

const ROL_LABELS = { TIENDA: 'TIENDA', SUPERVISOR: 'SUPERVISOR', ADMIN: 'ADMIN' };

const inputClass = 'w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-[#D81B60]';
const labelClass = 'block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1';

// El rango se guarda como '0100-0109' pero se edita como dos números, para
// no depender de que el usuario escriba el guion ni los ceros a la izquierda.
function parseRango(rango) {
  if (!rango) return { desde: '', hasta: '' };
  const [desde = '', hasta = ''] = String(rango).split('-');
  return { desde: desde.trim(), hasta: hasta.trim() };
}

function formatRango(desde, hasta) {
  const d = String(desde).trim();
  const h = String(hasta).trim();
  if (!d || !h) return '';
  return `${d.padStart(4, '0')}-${h.padStart(4, '0')}`;
}

export default function UsuarioModal({ open, usuario, saving, onClose, onSubmit, defaultRol = 'TIENDA', rolesDisponibles = ['TIENDA', 'SUPERVISOR', 'ADMIN'], sedeTipo }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const { data: tiendas } = useTiendas();
  const mostrarSelectorRol = rolesDisponibles.length > 1;
  const sedesDisponibles = (tiendas || []).filter((t) => !sedeTipo || t.tipo === sedeTipo);
  const tiendaDelUsuario = usuario ? (tiendas || []).find((t) => t.id_tienda === usuario.id_tienda) : null;

  useEffect(() => {
    if (!open) return;
    if (usuario) {
      const rango = parseRango(tiendaDelUsuario?.rango_codigos);
      setForm({
        ...EMPTY_FORM,
        email: usuario.email || '',
        rol: usuario.rol,
        id_tienda: usuario.id_tienda || '',
        nombre_tienda: tiendaDelUsuario?.nombre_tienda || '',
        codigo_almacen: tiendaDelUsuario?.codigo_almacen || '',
        rango_desde: rango.desde,
        rango_hasta: rango.hasta,
        correo_tienda: tiendaDelUsuario?.correo_tienda || ''
      });
    } else {
      setForm({ ...EMPTY_FORM, rol: defaultRol, id_tienda: sedesDisponibles[0]?.id_tienda || '' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, usuario, tiendas, defaultRol, sedeTipo]);

  if (!open) return null;

  const isEdit = Boolean(usuario);
  const requiereCorreo = form.rol !== 'TIENDA';
  // Tres formas de cuenta:
  //  - Gestión (Admin/Supervisor): se identifica por correo.
  //  - Tienda: una sola cuenta por tienda, creada junto con la tienda misma.
  //  - Oficina/Logística: una cuenta por empleado, para su horario personal.
  const esCuentaDeTienda = form.rol === 'TIENDA' && sedeTipo === 'TIENDA';
  const esCuentaPersonal = form.rol === 'TIENDA' && (sedeTipo === 'OFICINA' || sedeTipo === 'LOGISTICA');
  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const desdeNum = parseInt(form.rango_desde, 10);
  const hastaNum = parseInt(form.rango_hasta, 10);
  const rangoInvertido = Number.isFinite(desdeNum) && Number.isFinite(hastaNum) && hastaNum < desdeNum;
  const plazas = Number.isFinite(desdeNum) && Number.isFinite(hastaNum) && !rangoInvertido ? hastaNum - desdeNum + 1 : null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (rangoInvertido) return;

    if (esCuentaDeTienda) {
      onSubmit({
        rol: 'TIENDA',
        tienda: {
          nombre_tienda: form.nombre_tienda.trim(),
          codigo_almacen: form.codigo_almacen.trim(),
          rango_codigos: formatRango(form.rango_desde, form.rango_hasta),
          correo_tienda: form.correo_tienda.trim()
        },
        nueva_password: form.nueva_password.trim() || null
      });
      return;
    }

    const payload = {
      rol: form.rol,
      id_tienda: form.rol === 'TIENDA' ? parseInt(form.id_tienda, 10) : null,
      nueva_password: form.nueva_password.trim() || null
    };
    if (requiereCorreo) {
      payload.email = form.email.trim();
    }
    if (esCuentaPersonal && !isEdit) {
      payload.empleado = {
        dni: form.dni.trim(),
        nombre_completo: form.nombre_completo.trim(),
        puesto: form.puesto.trim(),
        celular: form.celular.trim()
      };
    }
    onSubmit(payload);
  };

  const subtitulo = () => {
    if (requiereCorreo) {
      return isEdit
        ? 'Actualiza el correo, el rol o la contraseña de la cuenta.'
        : 'Define el correo y el rol. La contraseña se genera automáticamente.';
    }
    if (esCuentaDeTienda) {
      return isEdit
        ? 'Datos de la tienda. Su cuenta es única y la usa la encargada.'
        : 'Se crea la tienda y su cuenta única, para la encargada.';
    }
    return isEdit
      ? 'Cuenta personal del empleado.'
      : 'Cuenta personal: el empleado solo registrará su propio horario.';
  };

  const titulo = () => {
    if (isEdit) return esCuentaDeTienda ? 'Editar Tienda' : 'Editar Usuario';
    return esCuentaDeTienda ? 'Nueva Tienda' : 'Nuevo Usuario';
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="antigravity-card bg-white max-w-lg w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-pink-50 text-[#D81B60] rounded-xl">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div>
              <h3 className="font-brand font-bold text-lg text-gray-900">{titulo()}</h3>
              <p className="text-xs text-gray-500">{subtitulo()}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-black">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Cuenta de gestión: se identifica por correo, editable después. */}
          {requiereCorreo && (
            <div>
              <label className={labelClass}>Correo Electrónico *</label>
              <input type="email" required value={form.email} onChange={set('email')} placeholder="usuario@bissu.pe" className={inputClass} />
            </div>
          )}

          {/* Tienda: sus datos y, al crearla, su cuenta única. */}
          {esCuentaDeTienda && (
            <>
              <div>
                <label className={labelClass}>Nombre de la Tienda *</label>
                <input type="text" required value={form.nombre_tienda} onChange={set('nombre_tienda')} placeholder="ej. San Isidro" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Código de Almacén</label>
                <input type="text" value={form.codigo_almacen} onChange={set('codigo_almacen')} placeholder="ej. ALMA04" className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Rango de Códigos de Vendedor</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={form.rango_desde}
                    onChange={set('rango_desde')}
                    required={Boolean(form.rango_hasta)}
                    placeholder="Desde"
                    className={inputClass}
                  />
                  <span className="text-gray-400 text-xs font-bold">a</span>
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    value={form.rango_hasta}
                    onChange={set('rango_hasta')}
                    required={Boolean(form.rango_desde)}
                    placeholder="Hasta"
                    className={inputClass}
                  />
                </div>
                {rangoInvertido && (
                  <p className="text-[10px] text-red-600 mt-1">El código final debe ser mayor o igual al inicial.</p>
                )}
                {plazas !== null && (
                  <p className="text-[10px] text-gray-500 mt-1">
                    {formatRango(form.rango_desde, form.rango_hasta)} — {plazas} {plazas === 1 ? 'plaza' : 'plazas'}
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass}>Correo de la Tienda (opcional)</label>
                <input type="email" value={form.correo_tienda} onChange={set('correo_tienda')} placeholder="ej. sanisidro@bissu.pe" className={inputClass} />
              </div>
            </>
          )}

          {/* Oficina / Logística: una cuenta por persona. */}
          {esCuentaPersonal && !isEdit && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Nombre Completo *</label>
                  <input type="text" required value={form.nombre_completo} onChange={set('nombre_completo')} placeholder="ej. María Torres" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>DNI *</label>
                  <input type="text" required value={form.dni} onChange={set('dni')} placeholder="ej. 70123456" className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Puesto</label>
                  <input type="text" value={form.puesto} onChange={set('puesto')} placeholder="ej. Analista" className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Celular</label>
                  <input type="text" value={form.celular} onChange={set('celular')} placeholder="ej. 987654321" className={inputClass} />
                </div>
              </div>
            </>
          )}

          {mostrarSelectorRol && (
            <div>
              <label className={labelClass}>Rol</label>
              <select value={form.rol} onChange={set('rol')} className={inputClass}>
                {rolesDisponibles.map((rol) => (
                  <option key={rol} value={rol}>{ROL_LABELS[rol]}</option>
                ))}
              </select>
            </div>
          )}

          {/* Solo hace falta elegir sede si hay más de una de ese tipo. */}
          {esCuentaPersonal && sedesDisponibles.length > 1 && (
            <div>
              <label className={labelClass}>Sede</label>
              <select value={form.id_tienda} onChange={set('id_tienda')} className={inputClass}>
                {sedesDisponibles.map((t) => (
                  <option key={t.id_tienda} value={t.id_tienda}>{t.nombre_tienda}</option>
                ))}
              </select>
            </div>
          )}

          {/* Credenciales de una cuenta existente. La contraseña actual no se
              puede mostrar (se guarda cifrada), solo reemplazar por una nueva. */}
          {isEdit && (
            <div className="p-3 bg-gray-50 border border-gray-100 rounded-xl space-y-3">
              <div>
                <label className={labelClass}>Usuario para Iniciar Sesión</label>
                <input
                  type="text"
                  readOnly
                  value={usuario.username || usuario.email || ''}
                  onFocus={(e) => e.target.select()}
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-mono font-bold text-gray-900 outline-none"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className={labelClass}>Nueva Contraseña</label>
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, nueva_password: generatePassword() }))}
                    className="text-[10px] font-bold text-[#D81B60] hover:underline uppercase tracking-wider"
                  >
                    Generar
                  </button>
                </div>
                <input
                  type="text"
                  value={form.nueva_password}
                  onChange={set('nueva_password')}
                  minLength={6}
                  placeholder="Déjalo vacío para no cambiarla"
                  className="w-full p-2.5 bg-white border border-gray-200 rounded-xl text-xs font-mono outline-none focus:ring-2 focus:ring-[#D81B60]"
                />
                <p className="text-[10px] text-gray-400 mt-1">
                  La contraseña actual no se puede ver: está cifrada. Solo puedes reemplazarla.
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-xl">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="btn-bissu px-5 py-2 text-xs font-bold uppercase tracking-wider">
              {saving ? 'Guardando...' : esCuentaDeTienda && !isEdit ? 'Crear Tienda' : 'Guardar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
