import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useSelectedStore } from '../../store/SelectedStoreContext';
import { useTiendas } from '../../api/useTiendas';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import { ROLES_ADMIN } from '../../lib/constants';
import StoreHeaderBanner from '../../components/StoreHeaderBanner';
import SaveBar from '../../components/SaveBar';
import { bulkUpdateHorarios, crearSolicitud, updateDiaDescanso as apiUpdateDiaDescanso } from '../../api/horarios';
import { addDaysToDateStr, getMondayOf, getWeekDates, formatWeekLabel } from './dateUtils';
import { useHorarioWeek, useInvalidateHorarios } from './useHorarioWeek';
import { useSolicitudesPendientesCount } from './useSolicitudesPendientesCount';
import { DIA_DESCANSO_A_INDICE, labelDiaDescanso } from './coverage';
import { requiereSolicitud } from './turnoValidation';
import HorarioGrid from './HorarioGrid';
import DescansoSummary from './DescansoSummary';
import TurnoModal from './TurnoModal';
import MotivoSolicitudModal from './MotivoSolicitudModal';
import SolicitudesModal from './SolicitudesModal';
import PendingBanner from './PendingBanner';
import OfficialBanner from './OfficialBanner';
import SolicitudReviewOverlay from './SolicitudReviewOverlay';

function todayMonday() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return getMondayOf(`${yyyy}-${mm}-${dd}`);
}

export default function HorariosPage() {
  const { user } = useAuth();
  const showToast = useToast();
  const confirm = useConfirm();
  const isAdminLike = ROLES_ADMIN.includes(user.rol);

  const [weekStart, setWeekStart] = useState(todayMonday);
  const { selectedStoreId, setSelectedStoreId } = useSelectedStore();
  const storeId = user.rol === 'TIENDA' ? user.id_tienda : selectedStoreId;
  const setStoreId = setSelectedStoreId;
  const [pendingChanges, setPendingChanges] = useState({});
  const [saving, setSaving] = useState(false);
  const [turnoModal, setTurnoModal] = useState({ open: false });
  const [motivoModalOpen, setMotivoModalOpen] = useState(false);
  const [savingMotivo, setSavingMotivo] = useState(false);
  const [solicitudesOpen, setSolicitudesOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const { data: tiendas } = useTiendas();
  useEffect(() => {
    if (isAdminLike && !storeId && tiendas?.length) {
      setStoreId(user.id_tienda || tiendas[0].id_tienda);
    }
  }, [isAdminLike, storeId, tiendas, user.id_tienda]);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);

  const { data, isLoading } = useHorarioWeek(weekStart, storeId);
  const invalidateHorarios = useInvalidateHorarios();
  const { data: solicitudesPendientes, refetch: refetchPendientesCount } = useSolicitudesPendientesCount(isAdminLike);

  useEffect(() => {
    setPendingChanges({});
  }, [weekStart, storeId]);

  const empleados = data?.empleados || [];
  const periodo = data?.periodo;
  const solicitud = data?.solicitud_pendiente;
  const confirmadoPor = periodo?.confirmado_por;
  const modoSolicitud = requiereSolicitud(user.rol, periodo);

  const changeWeek = (offset) => setWeekStart((w) => addDaysToDateStr(w, offset * 7));

  const handleCellClick = (idEmpleado, empNombre, fecha, blocks) => {
    setTurnoModal({ open: true, idEmpleado, empNombre, fecha, blocks });
  };

  const handleTurnoSubmit = (bloques) => {
    const { idEmpleado, fecha } = turnoModal;
    setPendingChanges((prev) => ({ ...prev, [`${idEmpleado}_${fecha}`]: { id_empleado: idEmpleado, fecha, turnos: bloques } }));
    setTurnoModal({ open: false });
  };

  const discardChanges = () => {
    setPendingChanges({});
    showToast('Cambios descartados.', 'info');
  };

  const saveLiveChanges = async () => {
    const cambios = Object.values(pendingChanges);
    if (cambios.length === 0) return;
    setSaving(true);
    try {
      await bulkUpdateHorarios(cambios);
      showToast('¡Horario guardado con éxito!', 'success');
      setPendingChanges({});
      invalidateHorarios(storeId);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBarClick = () => {
    if (modoSolicitud) {
      setMotivoModalOpen(true);
    } else {
      saveLiveChanges();
    }
  };

  const handleMotivoSubmit = async (motivo) => {
    setSavingMotivo(true);
    try {
      const cambios = Object.values(pendingChanges);
      const res = await crearSolicitud(weekStart, storeId, motivo, cambios);
      showToast(res.message || 'Solicitud enviada.', 'success');
      setPendingChanges({});
      setMotivoModalOpen(false);
      invalidateHorarios(storeId);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingMotivo(false);
    }
  };

  const handleEnviarPrimeraVez = async () => {
    const mensaje = solicitud
      ? '¿Reenviar el horario de esta semana con los cambios más recientes para aprobación?'
      : '¿Enviar el horario de esta semana para que un Admin/Supervisor/RRHH lo confirme como oficial?';
    if (!window.confirm(mensaje)) return;
    try {
      const res = await crearSolicitud(weekStart, storeId);
      showToast(res.message || 'Horario enviado.', 'success');
      invalidateHorarios(storeId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleChangeDiaDescanso = async (idEmpleado, diaDescanso, empNombre) => {
    if (diaDescanso) {
      const fechaConflicto = weekDates.find((d) => new Date(`${d}T00:00:00`).getDay() === DIA_DESCANSO_A_INDICE[diaDescanso]);
      if (fechaConflicto) {
        const key = `${idEmpleado}_${fechaConflicto}`;
        const emp = empleados.find((e) => e.id_empleado === idEmpleado);
        const blocks = pendingChanges[key] ? pendingChanges[key].turnos : emp?.dias?.[fechaConflicto];
        if (blocks && blocks.length > 0) {
          const quitar = await confirm(
            `${empNombre} tiene un turno registrado el ${labelDiaDescanso(diaDescanso)} de esta semana. ¿Quitarlo para que coincida con su nuevo día de descanso?`
          );
          if (!quitar) {
            showToast('Cambio cancelado: primero debes quitar el turno de ese día.', 'info');
            return;
          }
          try {
            await bulkUpdateHorarios([{ id_empleado: idEmpleado, fecha: fechaConflicto, turnos: [] }]);
            setPendingChanges((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
          } catch (err) {
            showToast('No se pudo quitar el turno existente.', 'error');
            return;
          }
        }
      }
    }

    try {
      await apiUpdateDiaDescanso(idEmpleado, diaDescanso || null);
      showToast('Día de descanso actualizado.', 'success');
      invalidateHorarios(storeId);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleRevisarDesdeModal = (s) => {
    setSolicitudesOpen(false);
    setStoreId(s.id_tienda);
    const cleanSemana = s.semana_inicio ? String(s.semana_inicio).split('T')[0] : weekStart;
    setWeekStart(cleanSemana);
    setReviewOpen(true);
  };

  // El estado "oficial" se muestra como un banner grande (ver más abajo, junto
  // al de solicitud pendiente) en vez de un badge chico — es información
  // relevante, no una advertencia. El badge chico queda solo para "borrador".
  const smallBadge = !solicitud && !confirmadoPor ? { cls: 'bg-blue-50 text-blue-700 border-blue-200', text: '📝 Borrador — Editable' } : null;

  const turnoBlocksForModal = turnoModal.open
    ? pendingChanges[`${turnoModal.idEmpleado}_${turnoModal.fecha}`]?.turnos ?? turnoModal.blocks
    : [];
  const turnoEmpleadoData = turnoModal.open ? empleados.find((e) => e.id_empleado === turnoModal.idEmpleado) : null;

  return (
    <main className="w-full px-4 sm:px-6 pt-6 space-y-6">
      <StoreHeaderBanner
        tienda={data?.tienda}
        showSelector={isAdminLike}
        tiendas={tiendas}
        storeId={storeId}
        onChangeStore={(v) => setStoreId(v)}
      />

      <div className="antigravity-card p-5 bg-white flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Semana:</label>
            <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
              <button onClick={() => changeWeek(-1)} className="p-1.5 text-gray-600 hover:text-black hover:bg-white rounded-lg transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-xs font-bold text-gray-900 px-2 whitespace-nowrap">{formatWeekLabel(weekDates)}</span>
              <button onClick={() => changeWeek(1)} className="p-1.5 text-gray-600 hover:text-black hover:bg-white rounded-lg transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {smallBadge && <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border ${smallBadge.cls}`}>{smallBadge.text}</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {isAdminLike && (
            <button
              onClick={() => setSolicitudesOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span>Solicitudes</span>
              {Boolean(solicitudesPendientes) && (
                <span className="px-1.5 py-0.5 bg-sky-600 text-white rounded-full text-[10px]">{solicitudesPendientes}</span>
              )}
            </button>
          )}

          {!confirmadoPor && (
            <button onClick={handleEnviarPrimeraVez} className="btn-bissu px-3.5 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span>{solicitud ? 'Reenviar Horario' : 'Enviar Horario'}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-gray-500 w-full py-1">
          <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Clic en una celda para editar el turno del día. Pasa el cursor para ver el detalle exacto.</span>
        </div>
      </div>

      {solicitud ? (
        <PendingBanner solicitud={solicitud} canRevisar={isAdminLike} hayOficial={Boolean(confirmadoPor)} onRevisar={() => setReviewOpen(true)} />
      ) : (
        confirmadoPor && <OfficialBanner />
      )}

      {isLoading ? (
        <div className="antigravity-card bg-white p-12 text-center text-gray-400 font-medium">Cargando horario...</div>
      ) : (
        <>
          <HorarioGrid weekDates={weekDates} empleados={empleados} pendingChanges={pendingChanges} onCellClick={handleCellClick} />
          <DescansoSummary
            weekDates={weekDates}
            empleados={empleados}
            pendingChanges={pendingChanges}
            onChangeDiaDescanso={handleChangeDiaDescanso}
          />
        </>
      )}

      <SaveBar
        count={Object.keys(pendingChanges).length}
        saving={saving || savingMotivo}
        onDiscard={discardChanges}
        onSave={handleSaveBarClick}
        saveLabel={modoSolicitud ? 'Enviar Solicitud de Cambio' : 'Guardar Cambios'}
        savingLabel={modoSolicitud ? 'Enviando...' : 'Guardando...'}
      />

      <TurnoModal
        open={turnoModal.open}
        empNombre={turnoModal.empNombre}
        fecha={turnoModal.fecha}
        initialBlocks={turnoBlocksForModal}
        diaDescansoEmpleado={turnoEmpleadoData?.dia_descanso}
        onClose={() => setTurnoModal({ open: false })}
        onSubmit={handleTurnoSubmit}
      />

      <MotivoSolicitudModal open={motivoModalOpen} saving={savingMotivo} onClose={() => setMotivoModalOpen(false)} onSubmit={handleMotivoSubmit} />

      <SolicitudesModal open={solicitudesOpen} onClose={() => setSolicitudesOpen(false)} onRevisar={handleRevisarDesdeModal} />

      <SolicitudReviewOverlay
        open={reviewOpen && Boolean(solicitud)}
        weekDates={weekDates}
        empleados={empleados}
        solicitud={solicitud}
        onChangeDiaDescanso={handleChangeDiaDescanso}
        onClose={() => setReviewOpen(false)}
        onResolved={() => {
          setReviewOpen(false);
          invalidateHorarios(storeId);
          refetchPendientesCount();
        }}
      />
    </main>
  );
}
