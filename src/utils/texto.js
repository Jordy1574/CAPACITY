// Los nombres se guardan siempre en mayúsculas y con espacios simples, para
// que el listado se vea uniforme sin importar cómo se haya tipeado el alta.
function normalizarNombre(valor) {
  return String(valor || '').trim().replace(/\s+/g, ' ').toUpperCase();
}

module.exports = { normalizarNombre };
