export function getBadgeClass(val) {
  if (val === null || val === undefined) return 'val-null';
  const num = Number(val);
  if (num === 1.0) return 'val-full';
  if (num === 0.5) return 'val-half';
  if (num === 0.0) return 'val-zero';
  return 'val-null';
}

export function cycleCellValue(currentVal, regimen = 'FT') {
  const value = currentVal !== null && currentVal !== undefined ? Number(currentVal) : null;
  const isPT = regimen === 'PT';

  if (value === null) {
    // Clic 1: valor esperado del régimen (0.5 si PT, 1.0 si FT)
    return isPT ? 0.5 : 1.0;
  }

  if (isPT) {
    // Secuencia PT: null -> 0.5 -> 0.0 -> 1.0 -> null
    if (value === 0.5) return 0.0;
    if (value === 0.0) return 1.0;
    return null;
  }

  // Secuencia FT: null -> 1.0 -> 0.0 -> 0.5 -> null
  if (value === 1.0) return 0.0;
  if (value === 0.0) return 0.5;
  return null;
}

export function computeAdvisorCodeOptions(tienda, empleados, currentCode) {
  const rango = tienda?.rango_codigos || '0100-0109';
  const [inicioStr, finStr] = rango.split('-').map((s) => s.trim());
  const inicio = parseInt(inicioStr, 10);
  const fin = parseInt(finStr, 10);

  const codigosOcupados = (empleados || [])
    .map((e) => e.codigo_empleado)
    .filter((c) => c && c !== currentCode);

  const options = [];
  for (let i = inicio; i <= fin; i++) {
    const code = String(i).padStart(inicioStr.length, '0');
    options.push({
      code,
      isEncargada: i === inicio,
      isOccupied: codigosOcupados.includes(code)
    });
  }
  return options;
}
