import { useEffect, useState } from 'react';
import { resolverSolicitud } from '../../api/horarios';
import { useToast } from '../../hooks/useToast';
import HorarioGrid from './HorarioGrid';
import DescansoSummary from './DescansoSummary';
import TurnoModal from './TurnoModal';

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

export default function SolicitudReviewOverlay({ open, weekDates, empleados, solicitud, onClose, onResolved, onChangeDiaDescanso }) {
  const [reviewChanges, setReviewChanges] = useState({});
  const [turnoModal, setTurnoModal] = useState({ open: false });
  const [resolving, setResolving] = useState(false);
  const showToast = useToast();

  useEffect(() => {
    if (open) setReviewChanges({});
  }, [open, solicitud?.id_solicitud]);

  if (!open || !solicitud) return null;

  const handleCellClick = (idEmpleado, empNombre, fecha, blocks) => {
    setTurnoModal({ open: true, idEmpleado, empNombre, fecha, blocks });
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
      const data = await resolverSolicitud(solicitud.id_solicitud, true, '', cambiosFinales);
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
            <p className="font-brand font-black text-lg text-gray-900 uppercase tracking-wide">Revisar Solicitud de Horario</p>
            <p className="text-xs text-gray-600 mt-1">
              {solicitud.motivo} — enviado {new Date(solicitud.fecha_solicitud).toLocaleString('es-PE')}
              {solicitud.solicitado_por_email ? ` por ${solicitud.solicitado_por_email}` : ''}
            </p>
            {Object.keys(reviewChanges).length > 0 && (
              <p className="text-[11px] text-amber-700 font-bold mt-1">
                {Object.keys(reviewChanges).length} celda(s) editada(s) en esta revisión — se aprobará con estos cambios.
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-xl">
              Cerrar
            </button>
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
          </div>
        </div>

        <HorarioGrid weekDates={weekDates} empleados={empleados} pendingChanges={reviewChanges} onCellClick={handleCellClick} />
        <DescansoSummary weekDates={weekDates} empleados={empleados} pendingChanges={reviewChanges} onChangeDiaDescanso={onChangeDiaDescanso} />
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
