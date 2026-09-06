// Estado Global Frontend
let currentUser = null;
let currentMonth = '2026-08';
let currentStoreId = null;
let currentCapacityData = null;
let pendingChanges = {}; // Clave: `${id_empleado}_${fecha}` => { id_empleado, fecha, valor }

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

  // Configurar selector de tienda si es Admin/Supervisor/RRHH
  if (['ADMIN', 'SUPERVISOR', 'RRHH'].includes(currentUser.rol)) {
    setupStoreSelector();
  } else {
    currentStoreId = currentUser.id_tienda;
    loadCapacityData();
  }
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
  const container = document.getElementById('store-selector-container');
  const select = document.getElementById('store-select');

  if (!container || !select) return;

  container.classList.remove('hidden');
  container.classList.add('flex');

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
      titleBadge.textContent = `${data.tienda.nombre_tienda} (${data.tienda.codigo_almacen}) - Plazas: ${data.tienda.rango_codigos || '0100-0109'}`;
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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
