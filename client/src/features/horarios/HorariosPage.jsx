import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useSelectedStore } from '../../store/SelectedStoreContext';
import { useTiendas } from '../../api/useTiendas';
import { useToast } from '../../hooks/useToast';
import { useConfirm } from '../../hooks/useConfirm';
import { ROLES_ADMIN } from '../../lib/constants';
import StoreHeaderBanner from '../../components/StoreHeaderBanner';
import SaveBar from '../../components/SaveBar';
import { bulkUpdateHorarios, crearSolicitud, descargarHorarioXlsx, updateDiaDescanso as apiUpdateDiaDescanso } from '../../api/horarios';
import { descargarNodoComoImagen } from '../../utils/descargarImagen';
import { addDaysToDateStr, getMondayOf, getWeekDates, formatWeekLabel } from './dateUtils';
import { useHorarioWeek, useInvalidateHorarios } from './useHorarioWeek';
import { guardarBorrador, leerBorrador, limpiarBorrador } from './borradorHorario';
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
import NovedadesModal from './NovedadesModal';

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
  // Sede+semana a la que pertenece lo que hay en pendingChanges.
  const [claveCargada, setClaveCargada] = useState(null);
  const [saving, setSaving] = useState(false);
  const [turnoModal, setTurnoModal] = useState({ open: false });
  const [motivoModalOpen, setMotivoModalOpen] = useState(false);
  const [savingMotivo, setSavingMotivo] = useState(false);
  const [solicitudesOpen, setSolicitudesOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [novedadesModal, setNovedadesModal] = useState({ open: false, empleado: null });
  const [proponerOpen, setProponerOpen] = useState(false);
  const [cambiosPropuestos, setCambiosPropuestos] = useState(null);
  const [descargando, setDescargando] = useState(false);
  const bloqueHorarioRef = useRef(null);

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

  // Al entrar a una sede/semana se recupera el borrador que haya quedado sin
  // guardar, y cada cambio se persiste: cambiar de módulo ya no lo pierde.
  useEffect(() => {
    const borrador = leerBorrador(storeId, weekStart);
    setPendingChanges(borrador);
    setClaveCargada(`${storeId}_${weekStart}`);
    const cuantos = Object.keys(borrador).length;
    if (cuantos > 0) {
      showToast(`Se recuperaron ${cuantos} cambio(s) que dejaste sin guardar.`, 'info');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, storeId]);

  useEffect(() => {
    // Recién cambiada la semana, pendingChanges todavía es el de la anterior:
    // guardarlo acá lo metería en la clave equivocada.
    if (claveCargada !== `${storeId}_${weekStart}`) return;
    guardarBorrador(storeId, weekStart, pendingChanges);
  }, [pendingChanges, claveCargada, storeId, weekStart]);

  const empleados = data?.empleados || [];
  const periodo = data?.periodo;
  const solicitud = data?.solicitud_pendiente;
  const confirmadoPor = periodo?.confirmado_por;
  const modoSolicitud = requiereSolicitud(user.rol, periodo);

  const changeWeek = (offset) => setWeekStart((w) => addDaysToDateStr(w, offset * 7));

  const handleCellClick = (idEmpleado, empNombre, fecha, blocks) => {
    // Con el horario ya oficial, la tienda no edita la grilla en vivo: se le
    // abre la vista de propuesta para que arme y envíe su solicitud.
    if (modoSolicitud) {
      if (solicitud) {
        showToast('Ya hay una solicitud pendiente de aprobación para esta semana.', 'info');
        return;
      }
      setProponerOpen(true);
      return;
    }
    setTurnoModal({ open: true, idEmpleado, empNombre, fecha, blocks });
  };

  const handleTurnoSubmit = (bloques) => {
    const { idEmpleado, fecha } = turnoModal;
    setPendingChanges((prev) => ({ ...prev, [`${idEmpleado}_${fecha}`]: { id_empleado: idEmpleado, fecha, turnos: bloques } }));
    setTurnoModal({ open: false });
  };

  const discardChanges = () => {
    setPendingChanges({});
    limpiarBorrador(storeId, weekStart);
    showToast('Cambios descartados.', 'info');
  };

  // Turnos que se verían hoy en la grilla, contando lo que aún no se guarda.
  // Sirve para no mandar a aprobación una semana en blanco.
  const hayTurnosEnLaSemana = useMemo(
    () =>
      empleados.some((emp) =>
        weekDates.some((fecha) => {
          const pendiente = pendingChanges[`${emp.id_empleado}_${fecha}`];
          const bloques = pendiente ? pendiente.turnos : emp.dias?.[fecha];
          return Boolean(bloques && bloques.length > 0);
        })
      ),
    [empleados, weekDates, pendingChanges]
  );

  const saveLiveChanges = async () => {
    const cambios = Object.values(pendingChanges);
    if (cambios.length === 0) return;
    setSaving(true);
    try {
      await bulkUpdateHorarios(cambios);
      showToast('¡Horario guardado con éxito!', 'success');
      setPendingChanges({});
      limpiarBorrador(storeId, weekStart);
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

  // Descarta la propuesta enviada y arranca otra desde el horario oficial.
  // El reemplazo lo hace el backend al crear la nueva: borra la pendiente en
  // la misma transacción, y si justo fue aprobada la respeta y deja la nueva
  // como pendiente.
  const handleNuevaSolicitudDesdeOficial = async () => {
    const ok = await confirm(
      'Se descartará la solicitud que enviaste y armarás una nueva partiendo del horario oficial vigente. ¿Continuar?'
    );
    if (!ok) return;
    setProponerOpen(true);
  };

  const nombreTiendaArchivo = (data?.tienda?.nombre_tienda || 'horario').replace(/[^A-Za-z0-9]/g, '_');

  const handleDescargarExcel = async () => {
    setDescargando(true);
    try {
      await descargarHorarioXlsx(weekStart.substring(0, 7), storeId);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDescargando(false);
    }
  };

  const handleDescargarImagen = async () => {
    setDescargando(true);
    try {
      await descargarNodoComoImagen(bloqueHorarioRef.current, `horario_${nombreTiendaArchivo}_${weekStart}.png`);
      showToast('Imagen descargada.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDescargando(false);
    }
  };

  const handleMotivoSubmit = async (motivo) => {
    setSavingMotivo(true);
    try {
      // La propuesta armada en la vista de solicitud tiene prioridad sobre
      // las ediciones sueltas de la grilla.
      const cambios = cambiosPropuestos ?? Object.values(pendingChanges);
      const res = await crearSolicitud(weekStart, storeId, motivo, cambios);
      showToast(res.message || 'Solicitud enviada.', 'success');
      setPendingChanges({});
      limpiarBorrador(storeId, weekStart);
      setCambiosPropuestos(null);
      setMotivoModalOpen(false);
      setProponerOpen(false);
      invalidateHorarios(storeId);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingMotivo(false);
    }
  };

  const handleEnviarPrimeraVez = async () => {
    // Se manda lo que está guardado, así que una semana en blanco solo puede
    // ser un descuido: antes se enviaba vacía sin avisar.
    if (!hayTurnosEnLaSemana) {
      showToast('El horario de esta semana está vacío. Carga los turnos antes de enviarlo.', 'error');
      return;
    }

    const cambiosSinGuardar = Object.values(pendingChanges);
    const mensaje = [
      solicitud
        ? '¿Reenviar el horario de esta semana con los cambios más recientes para aprobación?'
        : '¿Enviar el horario de esta semana para que un Admin/Supervisor/RRHH lo confirme como oficial?',
      cambiosSinGuardar.length > 0
        ? `Se guardarán primero los ${cambiosSinGuardar.length} cambio(s) que tienes sin guardar.`
        : null
    ]
      .filter(Boolean)
      .join('\n\n');
    if (!(await confirm(mensaje))) return;

    setSaving(true);
    try {
      // Guardar antes de enviar: la solicitud se arma con lo que hay en la
      // base, no con el estado de la pantalla.
      if (cambiosSinGuardar.length > 0) {
        await bulkUpdateHorarios(cambiosSinGuardar);
        setPendingChanges({});
        limpiarBorrador(storeId, weekStart);
      }
      const res = await crearSolicitud(weekStart, storeId);
      showToast(res.message || 'Horario enviado.', 'success');
      invalidateHorarios(storeId);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
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

          {/* La imagen sirve para compartir el horario por WhatsApp o imprimirlo:
              disponible para todos, tanto del oficial como de una propuesta. */}
          {(confirmadoPor || solicitud || empleados.length > 0) && (
            <button
              onClick={handleDescargarImagen}
              disabled={descargando}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl transition-all disabled:opacity-60"
              title="Descargar el horario de esta semana como imagen"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>{descargando ? 'Generando...' : 'Imagen'}</span>
            </button>
          )}

          {/* El mes completo en Excel, una hoja por semana. Solo gestión. */}
          {isAdminLike && (
            <button
              onClick={handleDescargarExcel}
              disabled={descargando}
              className="flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all disabled:opacity-60"
              title="Descargar el mes completo en Excel, con una hoja por semana"
            >
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              <span>Excel del Mes</span>
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

          {/* Con el horario ya oficial, la tienda no edita la grilla en vivo:
              propone los cambios en una vista aparte y los manda a aprobación. */}
          {confirmadoPor && !solicitud && modoSolicitud && (
            <button
              onClick={() => setProponerOpen(true)}
              className="btn-bissu px-3.5 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21H3v-3.5L16.732 3.732z" />
              </svg>
              <span>Solicitar Cambio</span>
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

      {/* La solicitud pendiente va arriba porque es el aviso que pide acción.
          El cartel de "oficial" no: ese rotula la grilla, así que viaja pegado
          a ella para que no se confunda con la propuesta en curso. */}
      {solicitud && (
        <PendingBanner
          solicitud={solicitud}
          canRevisar
          esVista={!isAdminLike}
          hayOficial={Boolean(confirmadoPor)}
          onRevisar={() => setReviewOpen(true)}
          onNuevaSolicitud={modoSolicitud ? handleNuevaSolicitudDesdeOficial : undefined}
        />
      )}

      {isLoading ? (
        <div className="antigravity-card bg-white p-12 text-center text-gray-400 font-medium">Cargando horario...</div>
      ) : (
        <>
          <div className="space-y-2" ref={bloqueHorarioRef}>
            {confirmadoPor && <OfficialBanner hayPendiente={Boolean(solicitud)} />}
            <HorarioGrid weekDates={weekDates} empleados={empleados} pendingChanges={pendingChanges} onCellClick={handleCellClick} />
          </div>
          <DescansoSummary
            weekDates={weekDates}
            empleados={empleados}
            pendingChanges={pendingChanges}
            onChangeDiaDescanso={handleChangeDiaDescanso}
            onVerNovedades={(emp) => setNovedadesModal({ open: true, empleado: emp })}
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
        empleado={turnoEmpleadoData}
        diaDescansoEmpleado={turnoEmpleadoData?.dia_descanso}
        onClose={() => setTurnoModal({ open: false })}
        onSubmit={handleTurnoSubmit}
      />

      <MotivoSolicitudModal open={motivoModalOpen} saving={savingMotivo} onClose={() => setMotivoModalOpen(false)} onSubmit={handleMotivoSubmit} />

      <SolicitudesModal open={solicitudesOpen} onClose={() => setSolicitudesOpen(false)} onRevisar={handleRevisarDesdeModal} />

      {/* La tienda arma su propuesta partiendo del oficial vigente. */}
      <SolicitudReviewOverlay
        open={proponerOpen}
        modo="PROPONER"
        weekDates={weekDates}
        empleados={empleados}
        enviando={savingMotivo}
        onChangeDiaDescanso={handleChangeDiaDescanso}
        onClose={() => setProponerOpen(false)}
        onEnviarPropuesta={(cambios) => {
          setCambiosPropuestos(cambios);
          setMotivoModalOpen(true);
        }}
      />

      <SolicitudReviewOverlay
        open={reviewOpen && Boolean(solicitud)}
        modo={isAdminLike ? 'APROBAR' : 'VER'}
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

      <NovedadesModal
        open={novedadesModal.open}
        empleado={novedadesModal.empleado}
        onClose={() => setNovedadesModal({ open: false, empleado: null })}
        onSaved={() => invalidateHorarios(storeId)}
      />
    </main>
  );
}
