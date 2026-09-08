// Estado Global Frontend
let currentUser = null;
let currentMonth = '2026-08';
let currentStoreId = null;
let currentCapacityData = null;
let pendingChanges = {}; // Clave: `${id_empleado}_${fecha}` => { id_empleado, fecha, valor }

// Estado Global de Horarios
let currentHorarioMonth = '2026-09'; // "Mes de referencia": el mes del lunes de la semana visible
let currentHorarioWeekStart = getMondayOf('2026-09-01'); // Lunes de la semana visible ('YYYY-MM-DD')
let currentHorarioMonthsData = {}; // { 'YYYY-MM': respuesta de /api/horarios para ese mes }
let currentHorarioStoreId = null;
let currentHorarioData = null;
let pendingHorarioChanges = {};
let horariosLoaded = false;

// Estado del modal de edición de turno (Horarios)
let turnoModalState = { idEmpleado: null, fecha: null, empNombre: '', blocks: [] };

const ROLES_ADMIN = ['ADMIN', 'SUPERVISOR', 'RRHH'];
const API_KEY_EXPORT = 'bissu_power_query_key_98765';

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  const token = localStorage.getItem('bissu_jwt');
  const userJson = localStorage.getItem('bissu_user');

  if (!token || !userJson) {
    window.location.href = '/login';
    return;
  }

  currentUser = JSON.parse(userJson);
  setupUserInfo();

  // Configurar mes inicial
  const monthPicker = document.getElementById('month-picker');
  if (monthPicker) {
    monthPicker.value = currentMonth;
  }
  // Event listener para el formulario de colaborador
  const empForm = document.getElementById('employee-form');
  if (empForm) {
    empForm.addEventListener('submit', handleEmployeeSubmit);
  }

  // Event listener para el formulario de solicitud de permiso
  const solicitudForm = document.getElementById('solicitar-permiso-form');
  if (solicitudForm) {
    solicitudForm.addEventListener('submit', handleSolicitudSubmit);
  }

  // Event listener para el formulario de edición de turno (Horarios)
  const turnoForm = document.getElementById('turno-modal-form');
  if (turnoForm) {
    turnoForm.addEventListener('submit', handleTurnoModalSubmit);
  }

  // Event listeners para el módulo de Usuarios (solo ADMIN)
  const usuarioForm = document.getElementById('usuario-form');
  if (usuarioForm) {
    usuarioForm.addEventListener('submit', handleUsuarioSubmit);
  }
  const resetPasswordForm = document.getElementById('reset-password-form');
  if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', handleResetPasswordSubmit);
  }
  if (currentUser.rol === 'ADMIN') {
    const navUsuarios = document.getElementById('nav-link-usuarios');
    if (navUsuarios) {
      navUsuarios.classList.remove('hidden');
    }
  }

  if (ROLES_ADMIN.includes(currentUser.rol)) {
    const btnSolicitudes = document.getElementById('btn-solicitudes-panel');
    if (btnSolicitudes) {
      btnSolicitudes.classList.remove('hidden');
      btnSolicitudes.classList.add('inline-flex');
    }
  }

  // Configurar selector de tienda si es Admin/Supervisor/RRHH
  if (['ADMIN', 'SUPERVISOR', 'RRHH'].includes(currentUser.rol)) {
    setupStoreSelector();
  } else {
    currentStoreId = currentUser.id_tienda;
    loadCapacityData();
  }

  // Refleja la vista según la URL actual (soporta navegación directa / recarga)
  switchView(viewFromPath(window.location.pathname), { updateHistory: false });
}

function setupUserInfo() {
  const emailEl = document.getElementById('user-email');
  const roleEl = document.getElementById('user-role');
  const avatarEl = document.getElementById('user-avatar');

  if (emailEl) emailEl.textContent = currentUser.email;
  if (roleEl) roleEl.textContent = currentUser.rol;
  if (avatarEl) avatarEl.textContent = currentUser.email.charAt(0).toUpperCase();
}

async function setupStoreSelector() {
  const select = document.getElementById('store-select');

  if (!select) return;

  try {
    const res = await fetchWithAuth('/api/tiendas');
    if (res.ok) {
      const data = await res.json();
      select.innerHTML = '';
      data.tiendas.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id_tienda;
        opt.textContent = `${t.nombre_tienda} (${t.codigo_almacen})`;
        select.appendChild(opt);
      });

      currentStoreId = currentUser.id_tienda || data.tiendas[0]?.id_tienda || 1;
      select.value = currentStoreId;
      loadCapacityData();
    }
  } catch (err) {
    console.error('Error al cargar lista de tiendas', err);
    currentStoreId = 1;
    loadCapacityData();
  }
}

function changeMonth(offset) {
  const picker = document.getElementById('month-picker');
  if (!picker) return;

  const [year, month] = picker.value.split('-').map(Number);
  const newDate = new Date(year, month - 1 + offset, 1);
  const yyyy = newDate.getFullYear();
  const mm = String(newDate.getMonth() + 1).padStart(2, '0');
  
  picker.value = `${yyyy}-${mm}`;
  loadCapacityData();
}

async function loadCapacityData() {
  const monthPicker = document.getElementById('month-picker');
  const storeSelect = document.getElementById('store-select');

  if (monthPicker) currentMonth = monthPicker.value;
  if (storeSelect && !['TIENDA'].includes(currentUser.rol)) {
    currentStoreId = storeSelect.value;
  }

  // Resetear cambios pendientes
  pendingChanges = {};
  updateSaveBar();

  const titleBadge = document.getElementById('store-title-badge');
  if (titleBadge) titleBadge.textContent = 'Cargando...';

  try {
    const url = `/api/capacity?mes=${currentMonth}&id_tienda=${currentStoreId || 1}`;
    const res = await fetchWithAuth(url);

    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Error al obtener datos');
    }

    const data = await res.json();
    currentCapacityData = data;

    if (titleBadge && data.tienda) {
      titleBadge.textContent = ROLES_ADMIN.includes(currentUser.rol)
        ? `Plazas: ${data.tienda.rango_codigos || '0100-0109'}`
        : `${data.tienda.nombre_tienda} (${data.tienda.codigo_almacen}) - Plazas: ${data.tienda.rango_codigos || '0100-0109'}`;
    }

    renderKPIs(data);
    renderTable(data);
  } catch (err) {
    showToast(err.message, 'error');
    console.error(err);
  }
}

function renderKPIs(data) {
  const resumen = data.resumen;
  if (!resumen) return;

  document.getElementById('metric-empleados').textContent = resumen.total_empleados || 0;
  document.getElementById('metric-capacity').textContent = `${resumen.promedio_capacity || 0}%`;
  document.getElementById('metric-completas').textContent = resumen.asistencias_completas || 0;
  document.getElementById('metric-dias').textContent = resumen.dias_trabajados || 0;

  // Plazas asignadas
  const plazasBadge = document.getElementById('plazas-badge');
  if (plazasBadge && data.empleados) {
    const conCodigo = data.empleados.filter(e => e.codigo_empleado).length;
    plazasBadge.textContent = `Plazas asignadas: ${conCodigo} / 10`;
  }
}

function renderTable(data) {
  const headerRow = document.getElementById('table-header-row');
  const tbody = document.getElementById('table-body');

  if (!headerRow || !tbody) return;

  headerRow.innerHTML = `
    <th class="p-3 sticky-col-1 border-b border-gray-200 min-w-[210px] bg-gray-50">Colaborador</th>
    <th class="p-3 sticky-col-2 border-b border-gray-200 min-w-[110px] bg-gray-50 text-center">Código Asesor</th>
    <th class="p-3 border-b border-gray-200 min-w-[140px] bg-gray-50">Puesto</th>
    <th class="p-3 border-b border-gray-200 min-w-[80px] text-center bg-gray-50">Régimen</th>
    <th class="p-3 border-b border-gray-200 min-w-[90px] text-center bg-gray-50">Acciones</th>
  `;

  const days = data.dias_mes || [];
  days.forEach(dayStr => {
    const dayNum = dayStr.split('-')[2];
    const dateObj = new Date(dayStr + 'T00:00:00');
    const dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'narrow' }).toUpperCase();
    const isWeekend = [0, 6].includes(dateObj.getDay());

    const th = document.createElement('th');
    th.className = `p-2 border-b border-gray-200 text-center min-w-[44px] ${isWeekend ? 'bg-pink-50/50 text-[#D81B60]' : 'bg-gray-50'}`;
    th.innerHTML = `
      <div class="text-[10px] opacity-60 font-semibold">${dayName}</div>
      <div class="text-xs font-bold">${dayNum}</div>
    `;
    headerRow.appendChild(th);
  });

  tbody.innerHTML = '';
  if (!data.empleados || data.empleados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${days.length + 5}" class="text-center py-10 text-gray-400 font-medium">
          No hay colaboradores registrados en esta tienda para el mes seleccionado.
        </td>
      </tr>
    `;
    return;
  }

  data.empleados.forEach(emp => {
    const tr = document.createElement('tr');
    const isInactive = emp.situacion === 'INACTIVO';
    tr.className = `hover:bg-gray-50/80 transition-colors ${isInactive ? 'bg-red-50/30' : ''}`;

    // 1. Columna Empleado (Sticky 1)
    const tdEmp = document.createElement('td');
    tdEmp.className = 'p-3 sticky-col-1 border-b border-gray-100 font-medium text-gray-900 bg-white';
    tdEmp.innerHTML = `
      <div>
        <div class="font-bold text-xs ${isInactive ? 'text-red-700 line-through' : 'text-gray-900'}">
          ${escapeHtml(emp.nombre_completo)}
          ${isInactive ? '<span class="ml-1 text-[9px] px-1 bg-red-100 text-red-800 rounded font-normal no-underline">INACTIVO</span>' : ''}
        </div>
        <div class="text-[10px] text-gray-400 font-mono">DNI: ${escapeHtml(emp.dni)} ${emp.celular ? ' | Cel: ' + escapeHtml(emp.celular) : ''}</div>
      </div>
    `;
    tr.appendChild(tdEmp);

    // 2. Columna Código de Asesor (Sticky 2 Separado)
    const tdCodigo = document.createElement('td');
    tdCodigo.className = 'p-3 sticky-col-2 border-b border-gray-100 text-center bg-white';
    const codigoTag = emp.codigo_empleado 
      ? `<span class="px-2.5 py-1 bg-gray-900 text-white text-[11px] font-mono font-bold rounded-lg shadow-xs border border-gray-800">${escapeHtml(emp.codigo_empleado)}</span>`
      : `<span class="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold rounded-lg">EN PRUEBA</span>`;
    tdCodigo.innerHTML = codigoTag;
    tr.appendChild(tdCodigo);

    // 3. Columna Puesto
    const tdPuesto = document.createElement('td');
    tdPuesto.className = 'p-3 border-b border-gray-100 text-gray-700 text-xs font-semibold';
    tdPuesto.textContent = emp.puesto || 'ASESOR DE VENTAS';
    tr.appendChild(tdPuesto);

    // 4. Columna Régimen
    const tdRegimen = document.createElement('td');
    tdRegimen.className = 'p-3 border-b border-gray-100 text-center';
    tdRegimen.innerHTML = `<span class="px-2 py-0.5 text-[10px] font-bold rounded-lg ${emp.regimen === 'FT' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200'}" title="${emp.regimen === 'FT' ? 'Full Time (1.0 -> 0.0 -> 0.5 -> Vacío)' : 'Part Time (0.5 -> 0.0 -> 1.0 -> Vacío)'}">${emp.regimen || 'FT'}</span>`;
    tr.appendChild(tdRegimen);

    // 5. Columna Acciones (Botón Editar Destacado)
    const tdAcciones = document.createElement('td');
    tdAcciones.className = 'p-3 border-b border-gray-100 text-center';
    tdAcciones.innerHTML = `
      <button 
        onclick='openEmployeeModal(${JSON.stringify(emp).replace(/'/g, "&apos;")})' 
        class="btn-edit-emp inline-flex items-center justify-center gap-1 px-2 py-1 text-[11px] font-bold text-[#D81B60] bg-pink-50 hover:bg-[#D81B60] hover:text-white border border-pink-200 rounded-lg transition-all shadow-xs"
        title="Editar datos del colaborador / Asignar código / Registrar baja"
      >
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 2103H3v-3.5L16.732 3.732z"/></svg>
        <span>Editar</span>
      </button>
    `;
    tr.appendChild(tdAcciones);

    // 6. Columnas Diarias de Asistencia
    days.forEach(dayStr => {
      const tdDay = document.createElement('td');
      tdDay.className = 'p-1 border-b border-gray-100 text-center align-middle';

      const val = emp.dias[dayStr];
      const key = `${emp.id_empleado}_${dayStr}`;
      const isPending = pendingChanges[key] !== undefined;
      const currentVal = isPending ? pendingChanges[key].valor : val;

      const badge = document.createElement('div');
      badge.className = `capacity-cell h-8 w-8 mx-auto rounded-lg flex items-center justify-center text-xs ${getBadgeClass(currentVal)} ${isPending ? 'cell-modified' : ''}`;
      badge.textContent = currentVal !== null && currentVal !== undefined ? Number(currentVal).toFixed(1) : '-';

      badge.onclick = () => cycleCellValue(emp.id_empleado, dayStr, val, badge, emp.regimen);

      tdDay.appendChild(badge);
      tr.appendChild(tdDay);
    });

    tbody.appendChild(tr);
  });
}

function getBadgeClass(val) {
  if (val === null || val === undefined) return 'val-null';
  const num = Number(val);
  if (num === 1.0) return 'val-full';
  if (num === 0.5) return 'val-half';
  if (num === 0.0) return 'val-zero';
  return 'val-null';
}

function cycleCellValue(idEmpleado, fecha, initialVal, badgeEl, regimen = 'FT') {
  const key = `${idEmpleado}_${fecha}`;
  const isPending = pendingChanges[key] !== undefined;
  const rawVal = isPending ? pendingChanges[key].valor : initialVal;
  const currentVal = (rawVal !== null && rawVal !== undefined) ? Number(rawVal) : null;

  const isPT = (regimen === 'PT');
  let nextVal;

  if (currentVal === null) {
    // Clic 1: Horario correspondiente (0.5 si es PT, 1.0 si es FT)
    nextVal = isPT ? 0.5 : 1.0;
  } else if (isPT) {
    // Secuencia para PT: null -> 0.5 -> 0.0 -> 1.0 -> null
    if (currentVal === 0.5) nextVal = 0.0;
    else if (currentVal === 0.0) nextVal = 1.0;
    else nextVal = null;
  } else {
    // Secuencia para FT: null -> 1.0 -> 0.0 -> 0.5 -> null
    if (currentVal === 1.0) nextVal = 0.0;
    else if (currentVal === 0.0) nextVal = 0.5;
    else nextVal = null;
  }

  pendingChanges[key] = { id_empleado: idEmpleado, fecha, valor: nextVal };

  badgeEl.className = `capacity-cell h-8 w-8 mx-auto rounded-lg flex items-center justify-center text-xs ${getBadgeClass(nextVal)} cell-modified`;
  badgeEl.textContent = nextVal !== null ? nextVal.toFixed(1) : '-';

  updateSaveBar();
}

function updateSaveBar() {
  const saveBar = document.getElementById('save-bar');
  const countEl = document.getElementById('pending-changes-count');
  const keys = Object.keys(pendingChanges);

  if (!saveBar || !countEl) return;

  if (keys.length > 0) {
    countEl.textContent = `${keys.length} cambio${keys.length > 1 ? 's' : ''} pendiente${keys.length > 1 ? 's' : ''}`;
    saveBar.classList.remove('translate-y-24', 'opacity-0');
    saveBar.classList.add('translate-y-0', 'opacity-100');
  } else {
    saveBar.classList.add('translate-y-24', 'opacity-0');
    saveBar.classList.remove('translate-y-0', 'opacity-100');
  }
}

function discardChanges() {
  pendingChanges = {};
  if (currentCapacityData) {
    renderTable(currentCapacityData);
  }
  updateSaveBar();
  showToast('Cambios descartados.', 'info');
}

async function saveChanges() {
  const btn = document.getElementById('btn-save-changes');
  const cambiosArray = Object.values(pendingChanges);

  if (cambiosArray.length === 0) return;

  btn.disabled = true;
  btn.innerHTML = `
    <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <span>Guardando...</span>
  `;

  try {
    const res = await fetchWithAuth('/api/capacity/bulk-update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cambios: cambiosArray })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al guardar');

    showToast('¡Cambios guardados con éxito!', 'success');
    pendingChanges = {};
    updateSaveBar();
    loadCapacityData();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <span>Guardar Cambios</span>
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
    `;
  }
}

// Lógica de Modal Formulario de Empleado
function openEmployeeModal(emp = null) {
  const modal = document.getElementById('employee-modal');
  const title = document.getElementById('emp-modal-title');
  const empIdInput = document.getElementById('emp-id');
  const dniInput = document.getElementById('emp-dni');
  const celInput = document.getElementById('emp-celular');
  const nombreInput = document.getElementById('emp-nombre');
  const puestoSelect = document.getElementById('emp-puesto');
  const regimenSelect = document.getElementById('emp-regimen');
  const codigoSelect = document.getElementById('emp-codigo');
  const correoInput = document.getElementById('emp-correo');
  const situacionSelect = document.getElementById('emp-situacion');
  const fechaBajaInput = document.getElementById('emp-fecha-baja');

  if (!modal) return;

  // Generar opciones del desplegable de 10 plazas según la tienda activa
  populateAdvisorCodeOptions(codigoSelect, emp ? emp.codigo_empleado : null);

  if (emp) {
    title.textContent = 'Editar Colaborador';
    empIdInput.value = emp.id_empleado;
    dniInput.value = emp.dni || '';
    celInput.value = emp.celular || '';
    nombreInput.value = emp.nombre_completo || '';
    puestoSelect.value = emp.puesto || 'ASESOR DE VENTAS';
    regimenSelect.value = emp.regimen || 'FT';
    codigoSelect.value = emp.codigo_empleado || '';
    correoInput.value = emp.correo_asesor || '';
    situacionSelect.value = emp.situacion || 'ACTIVO';
    fechaBajaInput.value = emp.fecha_baja ? emp.fecha_baja.substring(0, 10) : '';
  } else {
    title.textContent = 'Agregar Nuevo Colaborador';
    empIdInput.value = '';
    dniInput.value = '';
    celInput.value = '';
    nombreInput.value = '';
    puestoSelect.value = 'ASESOR DE VENTAS';
    regimenSelect.value = 'FT';
    codigoSelect.value = '';
    correoInput.value = '';
    situacionSelect.value = 'ACTIVO';
    fechaBajaInput.value = '';
  }

  toggleFechaBaja();
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeEmployeeModal() {
  const modal = document.getElementById('employee-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function toggleFechaBaja() {
  const situacionSelect = document.getElementById('emp-situacion');
  const bajaBox = document.getElementById('fecha-baja-box');
  const fechaBajaInput = document.getElementById('emp-fecha-baja');

  if (!situacionSelect || !bajaBox) return;

  if (situacionSelect.value === 'INACTIVO') {
    bajaBox.classList.remove('hidden');
    if (!fechaBajaInput.value) {
      fechaBajaInput.value = new Date().toISOString().substring(0, 10);
    }
  } else {
    bajaBox.classList.add('hidden');
  }
}

function populateAdvisorCodeOptions(selectEl, currentCode = null) {
  if (!selectEl) return;
  selectEl.innerHTML = '<option value="">(Sin Código - Días de Prueba)</option>';

  const tienda = currentCapacityData?.tienda;
  const rango = tienda?.rango_codigos || '0100-0109';
  const [inicioStr, finStr] = rango.split('-').map(s => s.trim());
  const inicio = parseInt(inicioStr, 10);
  const fin = parseInt(finStr, 10);

  const empExistentes = currentCapacityData?.empleados || [];
  const codigosOcupados = empExistentes
    .map(e => e.codigo_empleado)
    .filter(c => c && c !== currentCode);

  for (let i = inicio; i <= fin; i++) {
    const codeFormatted = String(i).padStart(inicioStr.length, '0');
    const isOccupied = codigosOcupados.includes(codeFormatted);
    const opt = document.createElement('option');
    opt.value = codeFormatted;
    opt.textContent = `${codeFormatted} ${i === inicio ? '(Encargada)' : ''} ${isOccupied ? '- (Ocupado)' : ''}`;
    if (isOccupied) opt.disabled = true;
    selectEl.appendChild(opt);
  }

  if (currentCode) {
    selectEl.value = currentCode;
  }
}

async function handleEmployeeSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-save-emp');
  const empId = document.getElementById('emp-id').value;
  
  const payload = {
    dni: document.getElementById('emp-dni').value.trim(),
    celular: document.getElementById('emp-celular').value.trim(),
    nombre_completo: document.getElementById('emp-nombre').value.trim(),
    puesto: document.getElementById('emp-puesto').value,
    regimen: document.getElementById('emp-regimen').value,
    codigo_empleado: document.getElementById('emp-codigo').value,
    correo_asesor: document.getElementById('emp-correo').value.trim(),
    situacion: document.getElementById('emp-situacion').value,
    fecha_baja: document.getElementById('emp-fecha-baja').value,
    id_tienda: currentStoreId
  };

  btn.disabled = true;

  try {
    const isEdit = !!empId;
    const url = isEdit ? `/api/empleados/${empId}` : '/api/empleados';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetchWithAuth(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al guardar colaborador');

    showToast(data.message || 'Colaborador guardado exitosamente.', 'success');
    closeEmployeeModal();
    loadCapacityData();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

function openPowerQueryModal() {
  const modal = document.getElementById('power-query-modal');
  const input = document.getElementById('export-url-input');

  if (modal && input) {
    const fullUrl = `${window.location.origin}/api/capacity/export?mes=${currentMonth}&api_key=${API_KEY_EXPORT}`;
    input.value = fullUrl;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closePowerQueryModal() {
  const modal = document.getElementById('power-query-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function copyExportUrl() {
  const input = document.getElementById('export-url-input');
  if (input) {
    input.select();
    navigator.clipboard.writeText(input.value);
    showToast('URL copiada al portapapeles', 'success');
  }
}

function logout() {
  localStorage.removeItem('bissu_jwt');
  localStorage.removeItem('bissu_user');
  window.location.href = '/login';
}

async function fetchWithAuth(url, options = {}) {
  const token = localStorage.getItem('bissu_jwt');
  const headers = options.headers || {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  options.headers = headers;

  const response = await fetch(url, options);
  if (response.status === 401) {
    logout();
  }
  return response;
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

// Modal de confirmación propio de la app (reemplaza window.confirm, que se
// ve genérico/feo con el nombre del dominio). Devuelve una promesa que
// resuelve true/false según el botón que se presione.
function showConfirm(message) {
  return new Promise(resolve => {
    const modal = document.getElementById('confirm-modal');
    const msgEl = document.getElementById('confirm-modal-message');
    const btnAccept = document.getElementById('confirm-modal-accept');
    const btnCancel = document.getElementById('confirm-modal-cancel');

    if (!modal || !msgEl || !btnAccept || !btnCancel) {
      resolve(window.confirm(message));
      return;
    }

    msgEl.textContent = message;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const cleanup = (result) => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      btnAccept.onclick = null;
      btnCancel.onclick = null;
      resolve(result);
    };

    btnAccept.onclick = () => cleanup(true);
    btnCancel.onclick = () => cleanup(false);
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// MÓDULO DE HORARIOS
// ============================================================

let usuariosLoaded = false;

// Rutas de la SPA: agregar una nueva vista es sumar una entrada aquí + su <a> en el sidebar.
const APP_ROUTES = {
  capacity: '/capacity',
  horarios: '/horarios',
  usuarios: '/usuarios'
};
const DEFAULT_VIEW = 'capacity';

function viewFromPath(pathname) {
  const match = Object.entries(APP_ROUTES).find(([, path]) => path === pathname);
  return match ? match[0] : DEFAULT_VIEW;
}

function handleNavClick(event, view) {
  event.preventDefault();
  switchView(view);
  return false;
}

function switchView(view, { updateHistory = true } = {}) {
  const views = {
    capacity: document.getElementById('view-capacity'),
    horarios: document.getElementById('view-horarios'),
    usuarios: document.getElementById('view-usuarios')
  };
  const navLinks = {
    capacity: document.getElementById('nav-link-capacity'),
    horarios: document.getElementById('nav-link-horarios'),
    usuarios: document.getElementById('nav-link-usuarios')
  };

  if (!views[view]) view = DEFAULT_VIEW;

  Object.keys(views).forEach(key => {
    if (!views[key] || !navLinks[key]) return;
    if (key === view) {
      views[key].classList.remove('hidden');
      navLinks[key].classList.add('sidebar-link-active');
    } else {
      views[key].classList.add('hidden');
      navLinks[key].classList.remove('sidebar-link-active');
    }
  });

  if (updateHistory && window.location.pathname !== APP_ROUTES[view]) {
    history.pushState({ view }, '', APP_ROUTES[view]);
  }

  // El header comparte un único selector de tienda por vista: solo el de la
  // vista activa queda visible, así queda claro dónde se cambia la tienda.
  const isAdmin = ROLES_ADMIN.includes(currentUser.rol);
  const capSelect = document.getElementById('store-select');
  const capCaret = document.getElementById('store-select-caret');
  const horSelect = document.getElementById('horario-store-select');
  const horCaret = document.getElementById('horario-store-select-caret');
  const titleBadge = document.getElementById('store-title-badge');

  if (capSelect) capSelect.classList.toggle('hidden', !(isAdmin && view === 'capacity'));
  if (capCaret) capCaret.classList.toggle('hidden', !(isAdmin && view === 'capacity'));
  if (horSelect) horSelect.classList.toggle('hidden', !(isAdmin && view === 'horarios'));
  if (horCaret) horCaret.classList.toggle('hidden', !(isAdmin && view === 'horarios'));
  if (titleBadge) titleBadge.classList.toggle('hidden', view !== 'capacity');

  if (view === 'horarios' && !horariosLoaded) {
    horariosLoaded = true;
    if (isAdmin) {
      setupHorarioStoreSelector();
    } else {
      currentHorarioStoreId = currentUser.id_tienda;
      loadHorarioWeek();
    }
  }

  if (view === 'usuarios' && !usuariosLoaded) {
    usuariosLoaded = true;
    loadUsuariosList();
  }
}

window.addEventListener('popstate', () => {
  switchView(viewFromPath(window.location.pathname), { updateHistory: false });
});

// --- Utilidades de fecha para la vista semanal de Horarios ---
function addDaysToDateStr(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Devuelve el lunes de la semana que contiene dateStr.
function getMondayOf(dateStr) {
  const day = new Date(dateStr + 'T00:00:00').getDay(); // 0=domingo ... 6=sábado
  const diffToMonday = (day === 0) ? -6 : (1 - day);
  return addDaysToDateStr(dateStr, diffToMonday);
}

// Las 7 fechas (lunes a domingo) de la semana que empieza en weekStartStr.
function getWeekDates(weekStartStr) {
  return Array.from({ length: 7 }, (_, i) => addDaysToDateStr(weekStartStr, i));
}

async function setupHorarioStoreSelector() {
  const select = document.getElementById('horario-store-select');
  if (!select) return;

  try {
    const res = await fetchWithAuth('/api/tiendas');
    if (res.ok) {
      const data = await res.json();
      select.innerHTML = '';
      data.tiendas.forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id_tienda;
        opt.textContent = `${t.nombre_tienda} (${t.codigo_almacen})`;
        select.appendChild(opt);
      });

      currentHorarioStoreId = currentUser.id_tienda || data.tiendas[0]?.id_tienda || 1;
      select.value = currentHorarioStoreId;
      loadHorarioWeek();
    }
  } catch (err) {
    console.error('Error al cargar lista de tiendas', err);
    currentHorarioStoreId = 1;
    loadHorarioWeek();
  }
}

function changeHorarioWeek(offset) {
  currentHorarioWeekStart = addDaysToDateStr(currentHorarioWeekStart, offset * 7);
  loadHorarioWeek();
}

function updateHorarioWeekLabel(weekDates) {
  const label = document.getElementById('horario-week-label');
  if (!label) return;

  const start = new Date(weekDates[0] + 'T00:00:00');
  const end = new Date(weekDates[6] + 'T00:00:00');

  if (start.getMonth() === end.getMonth()) {
    const mesFmt = start.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    label.textContent = `${start.getDate()} – ${end.getDate()} de ${mesFmt}`;
  } else {
    const startFmt = start.toLocaleDateString('es-ES', { month: 'long' });
    const endFmt = end.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    label.textContent = `${start.getDate()} de ${startFmt} – ${end.getDate()} de ${endFmt}`;
  }
}

// Trae y combina el/los mes(es) necesarios para pintar la semana visible
// (una semana casi siempre cruza el límite de un mes calendario).
async function loadHorarioWeek() {
  const storeSelect = document.getElementById('horario-store-select');
  if (storeSelect && ROLES_ADMIN.includes(currentUser.rol)) {
    currentHorarioStoreId = storeSelect.value;
  }

  pendingHorarioChanges = {};
  updateHorarioSaveBar();

  const weekDates = getWeekDates(currentHorarioWeekStart);
  updateHorarioWeekLabel(weekDates);

  // "Mes de referencia": el del lunes de la semana visible. Enviar/Solicitar
  // Permiso siguen operando sobre este mes, igual que antes.
  currentHorarioMonth = weekDates[0].substring(0, 7);
  const meses = [...new Set(weekDates.map(f => f.substring(0, 7)))];

  try {
    const responses = await Promise.all(meses.map(mes =>
      fetchWithAuth(`/api/horarios?mes=${mes}&id_tienda=${currentHorarioStoreId || 1}`)
    ));

    const monthsData = {};
    for (let i = 0; i < meses.length; i++) {
      const res = responses[i];
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Error al obtener el horario');
      }
      monthsData[meses[i]] = await res.json();
    }

    currentHorarioMonthsData = monthsData;
    const referenceData = monthsData[currentHorarioMonth];
    currentHorarioData = referenceData;

    renderHorarioEstadoUI(referenceData);
    renderHorarioWeekTable(weekDates, referenceData, monthsData);

    if (ROLES_ADMIN.includes(currentUser.rol)) {
      refreshSolicitudesCount();
    }
  } catch (err) {
    showToast(err.message, 'error');
    console.error(err);
  }
}

function isHorarioLockedForDate(fecha) {
  if (currentUser.rol !== 'TIENDA') return false;
  const data = currentHorarioMonthsData[fecha.substring(0, 7)];
  return data?.periodo?.estado === 'ENVIADO';
}

function getTurnosForDia(idEmpleado, fecha, monthsData) {
  const data = monthsData[fecha.substring(0, 7)];
  const emp = data?.empleados.find(e => e.id_empleado === idEmpleado);
  return emp?.dias?.[fecha] || [];
}

function renderHorarioEstadoUI(data) {
  const badge = document.getElementById('horario-estado-badge');
  const btnEnviar = document.getElementById('btn-enviar-horario');
  const btnSolicitar = document.getElementById('btn-solicitar-permiso');

  const estado = data.periodo?.estado || 'BORRADOR';
  const solicitud = data.solicitud_pendiente;

  if (badge) {
    if (solicitud) {
      badge.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border bg-amber-50 text-amber-700 border-amber-300';
      badge.textContent = '⏳ Solicitud de permiso pendiente';
    } else if (estado === 'ENVIADO') {
      badge.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border bg-gray-900 text-white border-gray-900';
      badge.textContent = '🔒 Enviado — Bloqueado';
    } else {
      badge.className = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl border bg-blue-50 text-blue-700 border-blue-200';
      badge.textContent = '📝 Borrador — Editable';
    }
  }

  if (btnEnviar) {
    const showEnviar = estado === 'BORRADOR' && (data.empleados || []).length > 0;
    btnEnviar.classList.toggle('hidden', !showEnviar);
    btnEnviar.classList.toggle('flex', showEnviar);
  }

  if (btnSolicitar) {
    const showSolicitar = currentUser.rol === 'TIENDA' && estado === 'ENVIADO' && !solicitud;
    btnSolicitar.classList.toggle('hidden', !showSolicitar);
    btnSolicitar.classList.toggle('flex', showSolicitar);
  }
}

const HORARIO_HOUR_START = 7; // 07:00
const HORARIO_HOUR_END = 23; // 23:00 (exclusivo) — última fila es 22:00-23:00

// Paleta cíclica para distinguir colaboradores en la grilla semanal. No
// empieza en rosa/magenta a propósito: ese es el color de marca/acento de la
// app (fines de semana, botones, indicador de cambio pendiente), y si el
// primer colaborador también fuera rosa se veía como si tuviera un estado
// especial en vez de ser solo "el primero de la lista".
const EMPLOYEE_COLOR_PALETTE = [
  { bg: '#E3F2FD', text: '#1565C0', border: '#BBDEFB' },
  { bg: '#FFF3E0', text: '#EF6C00', border: '#FFE0B2' },
  { bg: '#E8F5E9', text: '#2E7D32', border: '#C8E6C9' },
  { bg: '#F3E5F5', text: '#6A1B9A', border: '#E1BEE7' },
  { bg: '#FFFDE7', text: '#F9A825', border: '#FFF9C4' },
  { bg: '#E0F7FA', text: '#00838F', border: '#B2EBF2' },
  { bg: '#EFEBE9', text: '#4E342E', border: '#D7CCC8' },
  { bg: '#ECEFF1', text: '#455A64', border: '#CFD8DC' }
];

function horaAMinutos(hora) {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

function calcularHorasTotales(blocks) {
  return (blocks || []).reduce((sum, b) => sum + (horaAMinutos(b.hora_fin) - horaAMinutos(b.hora_inicio)), 0) / 60;
}

// Qué parte (0-100%) de la hora [hourStartMin, hourStartMin+60) cubren los
// bloques de turno. Devuelve null si no cubren nada, o {startPct, endPct}
// indicando desde/hasta dónde pintar la celda (un turno que empieza a mitad
// de hora debe pintarse abajo, uno que termina a mitad de hora debe
// pintarse arriba — no basta con saber "cuántos minutos", importa cuáles).
function coverageForHour(blocks, hourStartMin) {
  const hourEndMin = hourStartMin + 60;
  let start = null;
  let end = null;
  (blocks || []).forEach(b => {
    const overlapStart = Math.max(horaAMinutos(b.hora_inicio), hourStartMin);
    const overlapEnd = Math.min(horaAMinutos(b.hora_fin), hourEndMin);
    if (overlapEnd > overlapStart) {
      if (start === null || overlapStart < start) start = overlapStart;
      if (end === null || overlapEnd > end) end = overlapEnd;
    }
  });
  if (start === null) return null;
  return { startPct: ((start - hourStartMin) / 60) * 100, endPct: ((end - hourStartMin) / 60) * 100 };
}

// Vista semanal tipo Excel: filas = horas (07:00-22:00), columnas = un grupo
// por día con una sub-columna por colaborador. Reemplaza a la antigua tabla
// mensual (colaboradores en filas, días en columnas).
function renderHorarioWeekTable(weekDates, referenceData, monthsData) {
  const headerRow = document.getElementById('horario-table-header-row');
  const subheaderRow = document.getElementById('horario-table-subheader-row');
  const tbody = document.getElementById('horario-table-body');
  if (!headerRow || !subheaderRow || !tbody) return;

  const empleados = referenceData?.empleados || [];
  const totalCols = weekDates.length * Math.max(empleados.length, 1);

  headerRow.innerHTML = '<th class="p-2 sticky-col-1 border-b border-gray-200 min-w-[80px] bg-gray-50">Hora</th>';
  subheaderRow.innerHTML = '<th class="p-2 sticky-col-1 border-b border-gray-200 min-w-[80px] bg-gray-50"></th>';
  tbody.innerHTML = '';

  if (empleados.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${totalCols + 1}" class="text-center py-10 text-gray-400 font-medium">
          No hay colaboradores registrados en esta tienda.
        </td>
      </tr>
    `;
    renderHorarioDescansoSummary(weekDates, empleados, monthsData);
    return;
  }

  const empColors = {};
  empleados.forEach((emp, i) => { empColors[emp.id_empleado] = EMPLOYEE_COLOR_PALETTE[i % EMPLOYEE_COLOR_PALETTE.length]; });

  // Columna angosta en blanco entre cada día, como separador visual real
  // (en vez de solo un borde) para que no se vean todos los días pegados.
  function appendDaySpacer(row, tag, rowSpan) {
    const spacer = document.createElement(tag);
    spacer.className = 'p-0 border-0 bg-white';
    spacer.style.width = '10px';
    spacer.style.minWidth = '10px';
    if (rowSpan) spacer.rowSpan = rowSpan;
    row.appendChild(spacer);
  }

  weekDates.forEach((dayStr, dayIndex) => {
    if (dayIndex > 0) appendDaySpacer(headerRow, 'th', 2);

    const dateObj = new Date(dayStr + 'T00:00:00');
    const dayName = dateObj.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '').toUpperCase();
    const dayNum = dayStr.split('-')[2];
    const isWeekend = [0, 6].includes(dateObj.getDay());

    const th = document.createElement('th');
    th.colSpan = empleados.length;
    th.className = `p-2 border-b border-gray-200 text-center whitespace-nowrap ${isWeekend ? 'bg-pink-50/50 text-[#D81B60]' : 'bg-gray-50'}`;
    th.textContent = `${dayName} ${dayNum}`;
    headerRow.appendChild(th);

    empleados.forEach(emp => {
      const color = empColors[emp.id_empleado];
      const isPending = pendingHorarioChanges[`${emp.id_empleado}_${dayStr}`] !== undefined;
      const subTh = document.createElement('th');
      subTh.className = `relative p-1 border-b border-l border-gray-300/60 text-center font-semibold text-[9px] ${isPending ? 'cell-modified' : ''}`;
      subTh.style.backgroundColor = color.bg;
      subTh.style.color = color.text;
      subTh.style.minWidth = '42px';
      subTh.title = `${emp.nombre_completo} — ${emp.puesto || ''} — ${emp.regimen || ''}${emp.codigo_empleado ? ' — Código: ' + emp.codigo_empleado : ''}`;
      subTh.textContent = (emp.nombre_completo || '').split(' ')[0];
      subheaderRow.appendChild(subTh);
    });
  });

  for (let hour = HORARIO_HOUR_START; hour < HORARIO_HOUR_END; hour++) {
    const tr = document.createElement('tr');
    const tdHour = document.createElement('td');
    tdHour.className = 'p-1 sticky-col-1 border-b border-gray-100 text-[10px] font-bold text-gray-500 bg-white text-center';
    tdHour.textContent = `${String(hour).padStart(2, '0')}:00`;
    tr.appendChild(tdHour);

    weekDates.forEach((dayStr, dayIndex) => {
      if (dayIndex > 0) appendDaySpacer(tr, 'td');

      const locked = isHorarioLockedForDate(dayStr);

      empleados.forEach((emp, i) => {
        const key = `${emp.id_empleado}_${dayStr}`;
        const isPending = pendingHorarioChanges[key] !== undefined;
        const blocks = isPending ? pendingHorarioChanges[key].turnos : getTurnosForDia(emp.id_empleado, dayStr, monthsData);
        const coverage = coverageForHour(blocks, hour * 60);
        const color = empColors[emp.id_empleado];

        const td = document.createElement('td');
        // El punto de "cambio pendiente" se muestra una sola vez, en el
        // encabezado de esa columna (día+colaborador), no en cada hora.
        td.className = `relative p-0 h-6 border-b border-l border-gray-200 text-center text-[9px] font-bold ${locked ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`;
        if (coverage) {
          const fraction = (coverage.endPct - coverage.startPct) / 100;
          td.style.color = color.text;
          td.textContent = fraction >= 1 ? '1' : fraction.toFixed(1);

          if (coverage.startPct <= 0 && coverage.endPct >= 100) {
            td.style.backgroundColor = color.bg;
          } else {
            // Pinta solo el tramo [startPct, endPct] de la celda: si el turno
            // empieza a mitad de hora se pinta abajo, si termina a mitad de
            // hora se pinta arriba.
            td.style.background = `linear-gradient(180deg, transparent ${coverage.startPct}%, ${color.bg} ${coverage.startPct}%, ${color.bg} ${coverage.endPct}%, transparent ${coverage.endPct}%)`;
          }
        }
        if (blocks && blocks.length > 0) {
          td.title = `${emp.nombre_completo}: ${blocks.map(b => `${b.hora_inicio}–${b.hora_fin}`).join(', ')}`;
        }
        if (!locked) {
          td.onclick = () => openTurnoModal(emp.id_empleado, emp.nombre_completo, dayStr, blocks);
        }
        tr.appendChild(td);
      });
    });

    tbody.appendChild(tr);
  }

  // Fila de totales, eco del renglón "Horas" del Excel.
  const trTotal = document.createElement('tr');
  const tdTotalLabel = document.createElement('td');
  tdTotalLabel.className = 'p-1 sticky-col-1 border-t-2 border-gray-300 text-[10px] font-bold text-gray-700 bg-gray-50 text-center';
  tdTotalLabel.textContent = 'Horas';
  trTotal.appendChild(tdTotalLabel);

  weekDates.forEach((dayStr, dayIndex) => {
    if (dayIndex > 0) appendDaySpacer(trTotal, 'td');

    empleados.forEach((emp, i) => {
      const key = `${emp.id_empleado}_${dayStr}`;
      const isPending = pendingHorarioChanges[key] !== undefined;
      const blocks = isPending ? pendingHorarioChanges[key].turnos : getTurnosForDia(emp.id_empleado, dayStr, monthsData);
      const total = calcularHorasTotales(blocks);

      const td = document.createElement('td');
      td.className = 'p-1 border-t-2 border-l border-gray-300 text-center text-[10px] font-bold text-gray-600 bg-gray-50';
      td.textContent = total > 0 ? total.toFixed(1) : '-';
      trTotal.appendChild(td);
    });
  });
  tbody.appendChild(trTotal);

  renderHorarioDescansoSummary(weekDates, empleados, monthsData);
}

const DIA_DESCANSO_OPCIONES = [
  { value: 'LUNES', label: 'Lunes' },
  { value: 'MARTES', label: 'Martes' },
  { value: 'MIERCOLES', label: 'Miércoles' },
  { value: 'JUEVES', label: 'Jueves' },
  { value: 'VIERNES', label: 'Viernes' },
  { value: 'SABADO', label: 'Sábado' },
  { value: 'DOMINGO', label: 'Domingo' }
];

// new Date().getDay(): 0=domingo ... 6=sábado.
const DIA_DESCANSO_A_INDICE = { DOMINGO: 0, LUNES: 1, MARTES: 2, MIERCOLES: 3, JUEVES: 4, VIERNES: 5, SABADO: 6 };

function labelDiaDescanso(valor) {
  return DIA_DESCANSO_OPCIONES.find(o => o.value === valor)?.label || valor;
}

// Tabla "Colaborador / Día de descanso / Horas semana" debajo de la grilla,
// como el resumen que trae el Excel de referencia. El día de descanso es un
// dato fijo por colaborador (no se calcula del horario) que se asigna aquí
// mismo con un selector.
function renderHorarioDescansoSummary(weekDates, empleados, monthsData) {
  const tbody = document.getElementById('horario-descanso-body');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (!empleados || empleados.length === 0) {
    tbody.innerHTML = '<tr><td class="py-3 text-gray-400" colspan="3">No hay colaboradores registrados.</td></tr>';
    return;
  }

  empleados.forEach(emp => {
    let weeklyTotal = 0;
    weekDates.forEach(dayStr => {
      const key = `${emp.id_empleado}_${dayStr}`;
      const isPending = pendingHorarioChanges[key] !== undefined;
      const blocks = isPending ? pendingHorarioChanges[key].turnos : getTurnosForDia(emp.id_empleado, dayStr, monthsData);
      weeklyTotal += calcularHorasTotales(blocks);
    });

    const optionsHtml = DIA_DESCANSO_OPCIONES.map(o =>
      `<option value="${o.value}" ${emp.dia_descanso === o.value ? 'selected' : ''}>${o.label}</option>`
    ).join('');

    const tr = document.createElement('tr');
    tr.className = 'border-b border-gray-100 last:border-0';
    tr.innerHTML = `
      <td class="py-2 pr-4 font-semibold text-gray-800">${escapeHtml(emp.nombre_completo)}</td>
      <td class="py-2 pr-4">
        <select class="p-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#D81B60]" data-id-empleado="${emp.id_empleado}">
          <option value="">— Sin asignar —</option>
          ${optionsHtml}
        </select>
      </td>
      <td class="py-2 pr-2 text-right font-bold text-gray-700">${weeklyTotal.toFixed(1)}</td>
    `;
    tr.querySelector('select').onchange = (e) => updateDiaDescanso(emp.id_empleado, e.target.value, emp.nombre_completo);
    tbody.appendChild(tr);
  });
}

async function updateDiaDescanso(idEmpleado, diaDescanso, empNombre) {
  // Si el nuevo descanso cae en un día de la semana visible que ya tiene un
  // turno registrado, es contradictorio: se ofrece quitarlo de una vez.
  if (diaDescanso) {
    const weekDates = getWeekDates(currentHorarioWeekStart);
    const fechaConflicto = weekDates.find(d => new Date(d + 'T00:00:00').getDay() === DIA_DESCANSO_A_INDICE[diaDescanso]);
    if (fechaConflicto) {
      const key = `${idEmpleado}_${fechaConflicto}`;
      const pending = pendingHorarioChanges[key];
      const blocks = pending ? pending.turnos : getTurnosForDia(idEmpleado, fechaConflicto, currentHorarioMonthsData);
      if (blocks && blocks.length > 0) {
        const quitar = await showConfirm(`${empNombre} tiene un turno registrado el ${labelDiaDescanso(diaDescanso)} de esta semana. ¿Quitarlo para que coincida con su nuevo día de descanso?`);
        if (!quitar) {
          // Si no se quita el turno, no tiene sentido guardar el nuevo día de
          // descanso (quedaría contradictorio) — se cancela todo el cambio y
          // el selector vuelve a mostrar el valor real guardado.
          showToast('Cambio cancelado: primero debes quitar el turno de ese día.', 'info');
          rerenderHorarioWeek();
          return;
        }
        try {
          await fetchWithAuth('/api/horarios/bulk-update', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cambios: [{ id_empleado: idEmpleado, fecha: fechaConflicto, turnos: [] }] })
          });
          delete pendingHorarioChanges[key];
        } catch (err) {
          showToast('No se pudo quitar el turno existente.', 'error');
          rerenderHorarioWeek();
          return;
        }
      }
    }
  }

  try {
    const res = await fetchWithAuth(`/api/horarios/empleados/${idEmpleado}/dia-descanso`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dia_descanso: diaDescanso || null })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al actualizar el día de descanso');

    showToast('Día de descanso actualizado.', 'success');
    loadHorarioWeek();
  } catch (err) {
    showToast(err.message, 'error');
    rerenderHorarioWeek();
  }
}

function openTurnoModal(idEmpleado, empNombre, fecha, blocks) {
  const modal = document.getElementById('turno-modal');
  const subtitle = document.getElementById('turno-modal-subtitle');
  if (!modal) return;

  turnoModalState = {
    idEmpleado,
    fecha,
    empNombre,
    blocks: (blocks && blocks.length > 0)
      ? blocks.map(b => ({ hora_inicio: b.hora_inicio, hora_fin: b.hora_fin }))
      : [{ hora_inicio: '09:00', hora_fin: '18:00' }]
  };

  if (subtitle) {
    const dateObj = new Date(fecha + 'T00:00:00');
    const fechaFmt = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    subtitle.textContent = `${empNombre} — ${fechaFmt}`;
  }

  renderTurnoBlockRows();
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeTurnoModal() {
  const modal = document.getElementById('turno-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function renderTurnoBlockRows() {
  const container = document.getElementById('turno-blocks-container');
  if (!container) return;

  if (turnoModalState.blocks.length === 0) {
    container.innerHTML = '<p class="text-xs text-gray-400 text-center py-2">Día marcado como descanso.</p>';
    return;
  }

  container.innerHTML = '';
  turnoModalState.blocks.forEach((block, index) => {
    const row = document.createElement('div');
    row.className = 'flex items-center gap-2';
    row.innerHTML = `
      <input type="time" value="${block.hora_inicio}" data-role="inicio" data-index="${index}" class="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#D81B60]">
      <span class="text-gray-400 text-xs">a</span>
      <input type="time" value="${block.hora_fin}" data-role="fin" data-index="${index}" class="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-[#D81B60]">
      <button type="button" onclick="removeTurnoBlockRow(${index})" class="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Quitar bloque">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
    `;
    container.appendChild(row);
  });
}

function syncTurnoBlocksFromInputs() {
  const container = document.getElementById('turno-blocks-container');
  if (!container) return;
  const inicios = container.querySelectorAll('input[data-role="inicio"]');
  const fines = container.querySelectorAll('input[data-role="fin"]');
  inicios.forEach((input, i) => {
    if (turnoModalState.blocks[i] && input.value) turnoModalState.blocks[i].hora_inicio = input.value;
  });
  fines.forEach((input, i) => {
    if (turnoModalState.blocks[i] && input.value) turnoModalState.blocks[i].hora_fin = input.value;
  });
}

function addTurnoBlockRow() {
  syncTurnoBlocksFromInputs();
  const last = turnoModalState.blocks[turnoModalState.blocks.length - 1];
  const nuevaHora = last ? last.hora_fin : '09:00';
  turnoModalState.blocks.push({ hora_inicio: nuevaHora, hora_fin: nuevaHora });
  renderTurnoBlockRows();
}

function removeTurnoBlockRow(index) {
  syncTurnoBlocksFromInputs();
  turnoModalState.blocks.splice(index, 1);
  renderTurnoBlockRows();
}

async function handleTurnoModalSubmit(e) {
  e.preventDefault();
  syncTurnoBlocksFromInputs();

  const bloques = turnoModalState.blocks
    .filter(b => b.hora_inicio && b.hora_fin)
    .map(b => ({ hora_inicio: b.hora_inicio, hora_fin: b.hora_fin }))
    .sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));

  for (const b of bloques) {
    if (b.hora_fin <= b.hora_inicio) {
      showToast('La hora de fin debe ser posterior a la hora de inicio en cada bloque.', 'error');
      return;
    }
  }
  for (let i = 1; i < bloques.length; i++) {
    if (bloques[i].hora_inicio < bloques[i - 1].hora_fin) {
      showToast('Los bloques de turno no pueden solaparse.', 'error');
      return;
    }
  }

  const { idEmpleado, fecha, empNombre } = turnoModalState;

  // Si el colaborador tiene ese mismo día marcado como su descanso fijo,
  // registrar un turno ahí sería contradictorio — se avisa antes de guardar.
  if (bloques.length > 0) {
    const empData = currentHorarioData?.empleados?.find(e => e.id_empleado === idEmpleado);
    const diaSemana = new Date(fecha + 'T00:00:00').getDay();
    if (empData?.dia_descanso && DIA_DESCANSO_A_INDICE[empData.dia_descanso] === diaSemana) {
      const continuar = await showConfirm(`${empNombre} tiene ${labelDiaDescanso(empData.dia_descanso)} marcado como su día de descanso. ¿Registrar un turno de todas formas?`);
      if (!continuar) return;
    }
  }

  pendingHorarioChanges[`${idEmpleado}_${fecha}`] = { id_empleado: idEmpleado, fecha, turnos: bloques };

  updateHorarioSaveBar();
  rerenderHorarioWeek();
  closeTurnoModal();
}

// Vuelve a pintar la semana visible con los datos ya cargados (sin refetch),
// por ejemplo tras registrar un cambio pendiente o descartarlo.
function rerenderHorarioWeek() {
  if (!currentHorarioData) return;
  renderHorarioWeekTable(getWeekDates(currentHorarioWeekStart), currentHorarioData, currentHorarioMonthsData);
}

function updateHorarioSaveBar() {
  const saveBar = document.getElementById('horario-save-bar');
  const countEl = document.getElementById('horario-pending-changes-count');
  const keys = Object.keys(pendingHorarioChanges);

  if (!saveBar || !countEl) return;

  if (keys.length > 0) {
    countEl.textContent = `${keys.length} cambio${keys.length > 1 ? 's' : ''} pendiente${keys.length > 1 ? 's' : ''}`;
    saveBar.classList.remove('translate-y-24', 'opacity-0');
    saveBar.classList.add('translate-y-0', 'opacity-100');
  } else {
    saveBar.classList.add('translate-y-24', 'opacity-0');
    saveBar.classList.remove('translate-y-0', 'opacity-100');
  }
}

function discardHorarioChanges() {
  pendingHorarioChanges = {};
  rerenderHorarioWeek();
  updateHorarioSaveBar();
  showToast('Cambios descartados.', 'info');
}

async function saveHorarioChanges() {
  const btn = document.getElementById('btn-save-horario-changes');
  const cambiosArray = Object.values(pendingHorarioChanges);
  if (cambiosArray.length === 0) return;

  btn.disabled = true;

  try {
    const res = await fetchWithAuth('/api/horarios/bulk-update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cambios: cambiosArray })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al guardar');

    showToast('¡Horario guardado con éxito!', 'success');
    pendingHorarioChanges = {};
    updateHorarioSaveBar();
    loadHorarioWeek();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function enviarHorario() {
  if (!confirm('¿Enviar el horario de este mes? Una vez enviado no podrás editarlo salvo que se apruebe una solicitud de permiso.')) {
    return;
  }

  try {
    const res = await fetchWithAuth('/api/horarios/enviar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes: currentHorarioMonth, id_tienda: currentHorarioStoreId })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al enviar el horario');

    showToast(data.message || 'Horario enviado.', 'success');
    loadHorarioWeek();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openSolicitarPermisoModal() {
  const modal = document.getElementById('solicitar-permiso-modal');
  const textarea = document.getElementById('solicitud-motivo');
  if (textarea) textarea.value = '';
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeSolicitarPermisoModal() {
  const modal = document.getElementById('solicitar-permiso-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function handleSolicitudSubmit(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-save-solicitud');
  const motivo = document.getElementById('solicitud-motivo').value.trim();

  btn.disabled = true;
  try {
    const res = await fetchWithAuth('/api/horarios/solicitar-permiso', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mes: currentHorarioMonth, id_tienda: currentHorarioStoreId, motivo })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al enviar la solicitud');

    showToast(data.message || 'Solicitud enviada.', 'success');
    closeSolicitarPermisoModal();
    loadHorarioWeek();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function refreshSolicitudesCount() {
  try {
    const res = await fetchWithAuth('/api/horarios/solicitudes?estado=PENDIENTE');
    if (!res.ok) return;
    const data = await res.json();
    const countEl = document.getElementById('solicitudes-pendientes-count');
    if (!countEl) return;
    const count = (data.solicitudes || []).length;
    countEl.textContent = count;
    countEl.classList.toggle('hidden', count === 0);
  } catch (err) {
    console.error('Error al consultar solicitudes pendientes', err);
  }
}

function openSolicitudesModal() {
  const modal = document.getElementById('solicitudes-modal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
  loadSolicitudesList();
}

function closeSolicitudesModal() {
  const modal = document.getElementById('solicitudes-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function loadSolicitudesList() {
  const container = document.getElementById('solicitudes-list');
  if (!container) return;
  container.innerHTML = '<p class="text-center text-xs text-gray-400 py-8">Cargando solicitudes...</p>';

  try {
    const res = await fetchWithAuth('/api/horarios/solicitudes');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cargar solicitudes');

    renderSolicitudesList(data.solicitudes || []);
  } catch (err) {
    container.innerHTML = `<p class="text-center text-xs text-red-500 py-8">${escapeHtml(err.message)}</p>`;
  }
}

function renderSolicitudesList(solicitudes) {
  const container = document.getElementById('solicitudes-list');
  if (!container) return;

  if (solicitudes.length === 0) {
    container.innerHTML = '<p class="text-center text-xs text-gray-400 py-8">No hay solicitudes registradas.</p>';
    return;
  }

  container.innerHTML = '';
  solicitudes.forEach(s => {
    const card = document.createElement('div');
    card.className = 'p-4 border border-gray-200 rounded-xl space-y-2';

    const estadoColors = {
      PENDIENTE: 'bg-amber-50 text-amber-700 border-amber-200',
      APROBADA: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      RECHAZADA: 'bg-red-50 text-red-700 border-red-200'
    };

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div>
          <p class="text-xs font-bold text-gray-900">${escapeHtml(s.nombre_tienda)} (${escapeHtml(s.codigo_almacen)}) — ${escapeHtml(s.mes)}</p>
          <p class="text-[10px] text-gray-400">Solicitado por ${escapeHtml(s.solicitado_por_email || '—')} el ${new Date(s.fecha_solicitud).toLocaleString('es-PE')}</p>
        </div>
        <span class="px-2 py-0.5 text-[10px] font-bold rounded-lg border ${estadoColors[s.estado] || ''}">${escapeHtml(s.estado)}</span>
      </div>
      <p class="text-xs text-gray-700 bg-gray-50 p-2.5 rounded-lg">${escapeHtml(s.motivo)}</p>
      ${s.estado === 'PENDIENTE' ? `
        <div class="flex items-center justify-end gap-2 pt-1">
          <button data-action="rechazar" data-id="${s.id_solicitud}" class="px-3 py-1.5 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg">Rechazar</button>
          <button data-action="aprobar" data-id="${s.id_solicitud}" class="px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg">Aprobar</button>
        </div>
      ` : (s.comentario_resolucion ? `<p class="text-[10px] text-gray-400 italic">Comentario: ${escapeHtml(s.comentario_resolucion)}</p>` : '')}
    `;

    const btnAprobar = card.querySelector('[data-action="aprobar"]');
    const btnRechazar = card.querySelector('[data-action="rechazar"]');
    if (btnAprobar) btnAprobar.onclick = () => resolverSolicitud(s.id_solicitud, true);
    if (btnRechazar) btnRechazar.onclick = () => resolverSolicitud(s.id_solicitud, false);

    container.appendChild(card);
  });
}

async function resolverSolicitud(idSolicitud, aprobar) {
  const comentario = aprobar
    ? ''
    : (prompt('Motivo del rechazo (opcional):') || '');

  try {
    const res = await fetchWithAuth(`/api/horarios/solicitudes/${idSolicitud}/resolver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aprobar, comentario })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al resolver la solicitud');

    showToast(data.message, 'success');
    loadSolicitudesList();
    refreshSolicitudesCount();
    if (currentHorarioData) loadHorarioWeek();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ============================================================
// MÓDULO DE USUARIOS (Solo ADMIN)
// ============================================================

async function populateUsuarioTiendaSelect(selectedId = null) {
  const select = document.getElementById('usr-tienda');
  if (!select) return;

  try {
    const res = await fetchWithAuth('/api/tiendas');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cargar tiendas');

    select.innerHTML = '';
    (data.tiendas || []).forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id_tienda;
      opt.textContent = `${t.nombre_tienda} (${t.codigo_almacen})`;
      select.appendChild(opt);
    });

    if (selectedId) select.value = selectedId;
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function toggleUsuarioTiendaField() {
  const rolSelect = document.getElementById('usr-rol');
  const tiendaBox = document.getElementById('usr-tienda-box');
  if (!rolSelect || !tiendaBox) return;

  if (rolSelect.value === 'TIENDA') {
    tiendaBox.classList.remove('hidden');
  } else {
    tiendaBox.classList.add('hidden');
  }
}

async function openUsuarioModal(usr = null) {
  const modal = document.getElementById('usuario-modal');
  const title = document.getElementById('usr-modal-title');
  const idInput = document.getElementById('usr-id');
  const emailInput = document.getElementById('usr-email');
  const passwordBox = document.getElementById('usr-password-box');
  const passwordInput = document.getElementById('usr-password');
  const rolSelect = document.getElementById('usr-rol');

  if (!modal) return;

  await populateUsuarioTiendaSelect(usr ? usr.id_tienda : null);

  if (usr) {
    title.textContent = 'Editar Usuario';
    idInput.value = usr.id_usuario;
    emailInput.value = usr.email;
    emailInput.disabled = true;
    passwordBox.classList.add('hidden');
    passwordInput.value = '';
    passwordInput.required = false;
    rolSelect.value = usr.rol;
  } else {
    title.textContent = 'Nuevo Usuario';
    idInput.value = '';
    emailInput.value = '';
    emailInput.disabled = false;
    passwordBox.classList.remove('hidden');
    passwordInput.value = '';
    passwordInput.required = true;
    rolSelect.value = 'TIENDA';
  }

  toggleUsuarioTiendaField();
  modal.classList.remove('hidden');
  modal.classList.add('flex');
}

function closeUsuarioModal() {
  const modal = document.getElementById('usuario-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function handleUsuarioSubmit(e) {
  e.preventDefault();
  const usrId = document.getElementById('usr-id').value;
  const rol = document.getElementById('usr-rol').value;
  const isEdit = !!usrId;

  const payload = { rol };
  if (rol === 'TIENDA') {
    payload.id_tienda = parseInt(document.getElementById('usr-tienda').value, 10);
  } else {
    payload.id_tienda = null;
  }

  if (!isEdit) {
    payload.email = document.getElementById('usr-email').value.trim();
    payload.password = document.getElementById('usr-password').value;
  }

  try {
    const url = isEdit ? `/api/usuarios/${usrId}` : '/api/usuarios';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetchWithAuth(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al guardar el usuario');

    showToast(data.message || 'Usuario guardado exitosamente.', 'success');
    closeUsuarioModal();
    loadUsuariosList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openResetPasswordModal(idUsuario) {
  const modal = document.getElementById('reset-password-modal');
  document.getElementById('reset-usr-id').value = idUsuario;
  document.getElementById('reset-usr-password').value = '';
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }
}

function closeResetPasswordModal() {
  const modal = document.getElementById('reset-password-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

async function handleResetPasswordSubmit(e) {
  e.preventDefault();
  const idUsuario = document.getElementById('reset-usr-id').value;
  const password = document.getElementById('reset-usr-password').value;

  try {
    const res = await fetchWithAuth(`/api/usuarios/${idUsuario}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al restablecer la contraseña');

    showToast(data.message, 'success');
    closeResetPasswordModal();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function toggleActivoUsuario(idUsuario, nuevoActivo) {
  if (!nuevoActivo && !confirm('¿Desactivar este usuario? No podrá iniciar sesión hasta que lo reactives.')) {
    return;
  }

  try {
    const res = await fetchWithAuth(`/api/usuarios/${idUsuario}/toggle-activo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo: nuevoActivo })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al actualizar el estado del usuario');

    showToast(data.message, 'success');
    loadUsuariosList();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadUsuariosList() {
  const container = document.getElementById('usuarios-list');
  if (!container) return;
  container.innerHTML = '<p class="text-center text-xs text-gray-400 py-8">Cargando usuarios...</p>';

  try {
    const res = await fetchWithAuth('/api/usuarios');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al cargar usuarios');

    renderUsuariosList(data.usuarios || []);
  } catch (err) {
    container.innerHTML = `<p class="text-center text-xs text-red-500 py-8">${escapeHtml(err.message)}</p>`;
  }
}

function renderUsuariosList(usuarios) {
  const container = document.getElementById('usuarios-list');
  if (!container) return;

  if (usuarios.length === 0) {
    container.innerHTML = '<p class="text-center text-xs text-gray-400 py-8">No hay usuarios registrados.</p>';
    return;
  }

  const rolColors = {
    ADMIN: 'bg-purple-50 text-purple-700 border-purple-200',
    SUPERVISOR: 'bg-sky-50 text-sky-700 border-sky-200',
    RRHH: 'bg-amber-50 text-amber-700 border-amber-200',
    TIENDA: 'bg-gray-100 text-gray-700 border-gray-200'
  };

  container.innerHTML = '';
  usuarios.forEach(u => {
    const card = document.createElement('div');
    card.className = 'antigravity-card p-4 bg-white flex items-center justify-between gap-3 flex-wrap';

    const activo = !!u.activo;

    card.innerHTML = `
      <div class="flex items-center gap-3 min-w-[220px]">
        <div class="w-9 h-9 rounded-full bg-pink-50 text-[#D81B60] flex items-center justify-center font-bold text-sm">
          ${escapeHtml(u.email.charAt(0).toUpperCase())}
        </div>
        <div>
          <p class="text-xs font-bold text-gray-900">${escapeHtml(u.email)}</p>
          <p class="text-[10px] text-gray-400">${escapeHtml(u.nombre_tienda || 'Todas las tiendas')}</p>
        </div>
      </div>
      <span class="px-2 py-0.5 text-[10px] font-bold rounded-lg border ${rolColors[u.rol] || ''}">${escapeHtml(u.rol)}</span>
      <span class="px-2 py-0.5 text-[10px] font-bold rounded-lg border ${activo ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}">${activo ? 'ACTIVO' : 'INACTIVO'}</span>
      <div class="flex items-center gap-2 ml-auto">
        <button data-action="editar" class="px-3 py-1.5 text-[11px] font-bold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg">Editar</button>
        <button data-action="reset" class="px-3 py-1.5 text-[11px] font-bold text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-lg">Contraseña</button>
        <button data-action="toggle" class="px-3 py-1.5 text-[11px] font-bold rounded-lg border ${activo ? 'text-red-600 bg-red-50 hover:bg-red-100 border-red-200' : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'}">${activo ? 'Desactivar' : 'Activar'}</button>
      </div>
    `;

    card.querySelector('[data-action="editar"]').onclick = () => openUsuarioModal(u);
    card.querySelector('[data-action="reset"]').onclick = () => openResetPasswordModal(u.id_usuario);
    card.querySelector('[data-action="toggle"]').onclick = () => toggleActivoUsuario(u.id_usuario, !activo);

    container.appendChild(card);
  });
}
