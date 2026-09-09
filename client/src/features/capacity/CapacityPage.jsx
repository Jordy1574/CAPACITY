import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useSelectedStore } from '../../store/SelectedStoreContext';
import { useTiendas } from '../../api/useTiendas';
import { bulkUpdateCapacity, createEmpleado, updateEmpleado } from '../../api/capacity';
import { useToast } from '../../hooks/useToast';
import { ROLES_ADMIN } from '../../lib/constants';
import StoreHeaderBanner from '../../components/StoreHeaderBanner';
import SaveBar from '../../components/SaveBar';
import { useCapacityData, useInvalidateCapacity } from './useCapacityData';
import { cycleCellValue } from './cellCycle';
import CapacityKpis from './CapacityKpis';
import CapacityTable from './CapacityTable';
import EmployeeModal from './EmployeeModal';
import PowerQueryModal from './PowerQueryModal';

const DEFAULT_MONTH = '2026-08';

function shiftMonth(month, offset) {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(year, m - 1 + offset, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export default function CapacityPage() {
  const { user } = useAuth();
  const showToast = useToast();
  const isAdminLike = ROLES_ADMIN.includes(user.rol);

  const [mes, setMes] = useState(DEFAULT_MONTH);
  const { selectedStoreId, setSelectedStoreId } = useSelectedStore();
  const storeId = user.rol === 'TIENDA' ? user.id_tienda : selectedStoreId;
  const setStoreId = setSelectedStoreId;
  const [pendingChanges, setPendingChanges] = useState({});
  const [saving, setSaving] = useState(false);
  const [employeeModal, setEmployeeModal] = useState({ open: false, employee: null });
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [powerQueryOpen, setPowerQueryOpen] = useState(false);

  const { data: tiendas } = useTiendas();
  useEffect(() => {
    if (isAdminLike && !storeId && tiendas?.length) {
      setStoreId(user.id_tienda || tiendas[0].id_tienda);
    }
  }, [isAdminLike, storeId, tiendas, user.id_tienda]);

  const { data, isLoading } = useCapacityData(mes, storeId);
  const invalidateCapacity = useInvalidateCapacity();

  useEffect(() => {
    setPendingChanges({});
  }, [mes, storeId]);

  const handleCellClick = (idEmpleado, fecha, initialVal, regimen) => {
    const key = `${idEmpleado}_${fecha}`;
    const isPending = pendingChanges[key] !== undefined;
    const rawVal = isPending ? pendingChanges[key].valor : initialVal;
    const nextVal = cycleCellValue(rawVal, regimen);
    setPendingChanges((prev) => ({ ...prev, [key]: { id_empleado: idEmpleado, fecha, valor: nextVal } }));
  };

  const discardChanges = () => {
    setPendingChanges({});
    showToast('Cambios descartados.', 'info');
  };

  const saveChanges = async () => {
    const cambios = Object.values(pendingChanges);
    if (cambios.length === 0) return;
    setSaving(true);
    try {
      await bulkUpdateCapacity(cambios);
      showToast('¡Cambios guardados con éxito!', 'success');
      setPendingChanges({});
      invalidateCapacity(mes, storeId);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEmployeeSubmit = async (payload) => {
    setSavingEmployee(true);
    try {
      const isEdit = Boolean(payload.id_empleado);
      const body = { ...payload, id_tienda: storeId };
      const result = isEdit ? await updateEmpleado(payload.id_empleado, body) : await createEmpleado(body);
      showToast(result.message || 'Colaborador guardado exitosamente.', 'success');
      setEmployeeModal({ open: false, employee: null });
      invalidateCapacity(mes, storeId);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingEmployee(false);
    }
  };

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
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Mes:</label>
            <div className="flex items-center bg-gray-100 p-1 rounded-xl border border-gray-200">
              <button onClick={() => setMes((m) => shiftMonth(m, -1))} className="p-1.5 text-gray-600 hover:text-black hover:bg-white rounded-lg transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <input
                type="month"
                value={mes}
                onChange={(e) => setMes(e.target.value)}
                className="bg-transparent border-none text-xs font-bold text-gray-900 px-2 outline-none cursor-pointer"
              />
              <button onClick={() => setMes((m) => shiftMonth(m, 1))} className="p-1.5 text-gray-600 hover:text-black hover:bg-white rounded-lg transition-all">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          <button onClick={() => setEmployeeModal({ open: true, employee: null })} className="btn-bissu px-3.5 py-2 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-sm">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Agregar Personal</span>
          </button>

          <button
            onClick={() => setPowerQueryOpen(true)}
            className="hidden md:flex items-center gap-2 px-3.5 py-2 text-xs font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-xl transition-all"
            title="Exportar a Power Query / Power BI"
          >
            <svg className="w-4 h-4 text-sky-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Power Query BI</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs font-medium text-gray-600 overflow-x-auto w-full md:w-auto py-1">
          <span className="text-gray-400 font-bold uppercase text-[10px]">Valores Clic:</span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg val-full text-[11px]" title="1º clic en FT o 3º clic en PT">
            <span>1.0</span> <span className="font-normal text-gray-500">T. Completo</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg val-half text-[11px]" title="1º clic en PT o 3º clic en FT">
            <span>0.5</span> <span className="font-normal text-gray-500">Medio Turno</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg val-zero text-[11px]" title="2º clic para ambos">
            <span>0.0</span> <span className="font-normal text-gray-500">Descanso/Falta</span>
          </span>
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg val-null text-[11px]" title="4º clic reinicia a vacío">
            <span>-</span> <span className="font-normal text-gray-400">Vacío</span>
          </span>
        </div>
      </div>

      <CapacityKpis data={data} />

      {isLoading ? (
        <div className="antigravity-card bg-white p-12 text-center text-gray-400 font-medium">Cargando datos de asistencia...</div>
      ) : (
        <CapacityTable
          data={data}
          pendingChanges={pendingChanges}
          onCellClick={handleCellClick}
          onEditEmployee={(emp) => setEmployeeModal({ open: true, employee: emp })}
        />
      )}

      <SaveBar count={Object.keys(pendingChanges).length} saving={saving} onDiscard={discardChanges} onSave={saveChanges} />

      <EmployeeModal
        open={employeeModal.open}
        employee={employeeModal.employee}
        tienda={data?.tienda}
        empleados={data?.empleados}
        saving={savingEmployee}
        onClose={() => setEmployeeModal({ open: false, employee: null })}
        onSubmit={handleEmployeeSubmit}
      />

      <PowerQueryModal open={powerQueryOpen} mes={mes} onClose={() => setPowerQueryOpen(false)} />
    </main>
  );
}
