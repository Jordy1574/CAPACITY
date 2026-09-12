// html2canvas pesa bastante, así que se carga solo cuando alguien descarga
// una imagen y no en el bundle inicial de la app.
export async function descargarNodoComoImagen(nodo, nombreArchivo) {
  if (!nodo) throw new Error('No hay horario que descargar.');

  const { default: html2canvas } = await import('html2canvas');

  // La grilla vive dentro de un contenedor con scroll: se desactiva un momento
  // para que la captura salga completa y no recortada a lo que se ve en pantalla.
  const scrollables = nodo.querySelectorAll('.table-container');
  const estilosPrevios = [];
  scrollables.forEach((el) => {
    estilosPrevios.push([el, el.style.maxHeight, el.style.overflow]);
    el.style.maxHeight = 'none';
    el.style.overflow = 'visible';
  });

  try {
    const canvas = await html2canvas(nodo, {
      backgroundColor: '#ffffff',
      scale: 2, // el doble de resolución, para que se lea al imprimir o ampliar
      useCORS: true,
      windowWidth: nodo.scrollWidth,
      windowHeight: nodo.scrollHeight
    });

    const dataUrl = canvas.toDataURL('image/png');
    const enlace = document.createElement('a');
    enlace.href = dataUrl;
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
  } finally {
    estilosPrevios.forEach(([el, maxHeight, overflow]) => {
      el.style.maxHeight = maxHeight;
      el.style.overflow = overflow;
    });
  }
}
