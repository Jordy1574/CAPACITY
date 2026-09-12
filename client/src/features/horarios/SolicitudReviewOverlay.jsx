import { useEffect, useMemo, useState } from 'react';
import { actualizarSolicitud, resolverSolicitud } from '../../api/horarios';
import { useToast } from '../../hooks/useToast';
import HorarioGrid from './HorarioGrid';
import DescansoSummary from './DescansoSummary';
import TurnoModal from './TurnoModal';

// El horario oficial no se toca visualmente en la grilla principal — esta
// vista de revisión es la única que muestra el oficial con los cambios
// propuestos superpuestos, para que el admin pueda ver exactamente qué se
// aprobaría.
function buildBaseEmpleados(empleados, solicitud) {
  if (!solicitud) return empleados;
  const cambiosMap = {};
  (solicitud.cambios || []).forEach((c) => {
    if (!cambiosMap[c.id_empleado]) cambiosMap[c.id_empleado] = {};
    cambiosMap[c.id_empleado][c.fecha] = c.turnos;
  });
  return empleados.map((emp) => {
    const overrides = cambiosMap[emp.id_empleado];
    if (!overrides) return emp;
    return { ...emp, dias: { ...emp.dias, ...overrides } };
  });
}

// Combina los turnos originales de la solicitud con las ediciones que el
// admin haya hecho durante la revisión (estas últimas ganan), para mandar el
// set completo a aprobar — así los días tocados por la solicitud que el
// admin no volvió a tocar no se pierden.
function buildCambiosFinales(solicitud, reviewChanges) {
  const map = {};
  (solicitud?.cambios || []).forEach((c) => {
    map[`${c.id_empleado}_${c.fecha}`] = { id_empleado: c.id_empleado, fecha: c.fecha, turnos: c.turnos };
  });
  Object.values(reviewChanges).forEach((c) => {
    map[`${c.id_empleado}_${c.fecha}`] = c;
  });
  return Object.values(map);
}

// Tres formas de abrir esta vista:
//  APROBAR  — admin: ve el oficial con lo propuesto encima y resuelve.
//  PROPONER — tienda: parte del oficial vigente, lo edita y envía la solicitud.
//  VER      — tienda: revisa lo que envió y puede corregirlo y reenviarlo
//             mientras la solicitud siga pendiente.
export default function SolicitudReviewOverlay({
  open,
  modo = 'APROBAR',
  weekDates,
  empleados,
  solicitud,
  enviando,
  onClose,
  onResolved,
  onEnviarPropuesta,
  onChangeDiaDescanso
}) {
  const [reviewChanges, setReviewChanges] = useState({});
  const [turnoModal, setTurnoModal] = useState({ open: false });
  const [resolving, setResolving] = useState(false);
  const showToast = useToast();

  useEffect(() => {
    if (open) setReviewChanges({});
  }, [open, solicitud?.id_solicitud, modo]);

  // Al proponer se parte del horario oficial vigente, no de una solicitud.
  const baseEmpleados = useMemo(
    () => (modo === 'PROPONER' ? empleados : buildBaseEmpleados(empleados, solicitud)),
    [empleados, solicitud, modo]
  );

  if (!open) return null;
  if (modo !== 'PROPONER' && !solicitud) return null;

  const handleCellClick = (idEmpleado, empNombre, fecha, blocks) => {
    setTurnoModal({ open: true, idEmpleado, empNombre, fecha, blocks });
  };

  // La tienda corrige su propia solicitud sin crear otra: se actualiza la
  // misma, así el admin no se queda con un id que dejó de existir.
  const handleActualizar = async () => {
    setResolving(true);
    try {
      const cambios = buildCambiosFinales(solicitud, reviewChanges);
      const data = await actualizarSolicitud(solicitud.id_solicitud, solicitud.motivo, cambios);
      showToast(data.message || 'Solicitud actualizada.', 'success');
      onResolved();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setResolving(false);
    }
  };

  const handleTurnoSubmit = (bloques) => {
    const { idEmpleado, fecha } = turnoModal;
    setReviewChanges((prev) => ({ ...prev, [`${idEmpleado}_${fecha}`]: { id_empleado: idEmpleado, fecha, turnos: bloques } }));
    setTurnoModal({ open: false });
  };

  const handleAprobar = async () => {
    setResolving(true);
    try {
      const cambiosFinales = buildCambiosFinales(solicitud, reviewChanges);
      const data = await resolverSolicitud(solicitud.id_solicitud, true, '', cambiosFinales, solicitud.version);
      showToast(data.message || 'Solicitud aprobada.', 'success');
      onResolved();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setResolving(false);
    }
  };

  const handleRechazar = async () => {
    const comentario = window.prompt('Motivo del rechazo (opcional):') || '';
    setResolving(true);
    try {
      const data = await resolverSolicitud(solicitud.id_solicitud, false, comentario);
      showToast(data.message || 'Solicitud rechazada.', 'success');
      onResolved();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setResolving(false);
    }
  };

  const turnoBlocksForModal = turnoModal.open
    ? reviewChanges[`${turnoModal.idEmpleado}_${turnoModal.fecha}`]?.turnos ?? turnoModal.blocks
    : [];

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm overflow-y-auto p-4">
      <div className="max-w-[1400px] mx-auto my-4 space-y-4">
        <div className="antigravity-card bg-white p-5 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-brand font-black text-lg text-gray-900 uppercase tracking-wide">
              {modo === 'PROPONER' && 'Solicitar Cambio de Horario'}
              {modo === 'VER' && 'Mi Solicitud Pendiente'}
              {modo === 'APROBAR' && 'Revisar Solicitud de Horario'}
            </p>
            {modo === 'PROPONER' ? (
              <p className="text-xs text-gray-600 mt-1">
                Parte del horario oficial vigente. Edita las celdas que quieras cambiar y envía la solicitud;
                el oficial no se modifica hasta que sea aprobada.
              </p>
            ) : (
              <p className="text-xs text-gray-600 mt-1">
                {solicitud.motivo} — enviado {new Date(solicitud.fecha_solicitud).toLocaleString('es-PE')}
                {solicitud.solicitado_por_email ? ` por ${solicitud.solicitado_por_email}` : ''}
              </p>
            )}
            {modo === 'VER' && Object.keys(reviewChanges).length === 0 && (
              <p className="text-[11px] text-amber-700 font-bold mt-1">
                Así quedaría el horario si se aprueba. Puedes corregirlo mientras siga pendiente.
              </p>
            )}
            {Object.keys(reviewChanges).length > 0 && (
              <p className="text-[11px] text-amber-700 font-bold mt-1">
                {Object.keys(reviewChanges).length} celda(s) editada(s)
                {modo === 'APROBAR'
                  ? ' en esta revisión — se aprobará con estos cambios.'
                  : ' — se enviarán en la solicitud.'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-xl">
              Cerrar
            </button>

            {modo === 'APROBAR' && (
              <>
                <button
                  onClick={handleRechazar}
                  disabled={resolving}
                  className="px-4 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl"
                >
                  Rechazar
                </button>
                <button
                  onClick={handleAprobar}
                  disabled={resolving}
                  className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm"
                >
                  {resolving ? 'Procesando...' : 'Aprobar como Oficial'}
                </button>
              </>
            )}

            {modo === 'PROPONER' && (
              <button
                onClick={() => onEnviarPropuesta(Object.values(reviewChanges))}
                disabled={enviando || Object.keys(reviewChanges).length === 0}
                className="btn-bissu px-5 py-2.5 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {enviando ? 'Enviando...' : 'Enviar Solicitud'}
              </button>
            )}

            {modo === 'VER' && (
              <button
                onClick={handleActualizar}
                disabled={resolving || Object.keys(reviewChanges).length === 0}
                className="btn-bissu px-5 py-2.5 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
              >
                {resolving ? 'Enviando...' : 'Corregir y Reenviar'}
              </button>
            )}
          </div>
        </div>

        <HorarioGrid weekDates={weekDates} empleados={baseEmpleados} pendingChanges={reviewChanges} onCellClick={handleCellClick} />
        <DescansoSummary weekDates={weekDates} empleados={baseEmpleados} pendingChanges={reviewChanges} onChangeDiaDescanso={onChangeDiaDescanso} />
      </div>

      <TurnoModal
        open={turnoModal.open}
        empNombre={turnoModal.empNombre}
        fecha={turnoModal.fecha}
        initialBlocks={turnoBlocksForModal}
        diaDescansoEmpleado={null}
        onClose={() => setTurnoModal({ open: false })}
        onSubmit={handleTurnoSubmit}
      />
    </div>
  );
}
