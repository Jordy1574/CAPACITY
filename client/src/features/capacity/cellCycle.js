export function getBadgeClass(val) {
  if (val === null || val === undefined) return 'val-null';
  const num = Number(val);
  if (num === 1.0) return 'val-full';
  if (num === 0.5) return 'val-half';
  if (num === 0.0) return 'val-zero';
  return 'val-null';
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
