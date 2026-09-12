// html2canvas pesa bastante, así que se carga solo cuando alguien descarga
// una imagen y no en el bundle inicial de la app.
export async function descargarNodoComoImagen(nodo, nombreArchivo) {
  if (!nodo) throw new Error('No hay horario que descargar.');

  const { default: html2canvas } = await import('html2canvas');

  // html2canvas captura el tamaño que el nodo ocupa en pantalla. La grilla vive
  // dentro de contenedores con scroll en ambos ejes, así que sin esto la imagen
  // sale recortada a lo visible: se pierden los últimos días de la semana.
  const restaurar = [];
  const fijar = (el, prop, valor) => {
    restaurar.push([el, prop, el.style[prop]]);
    el.style[prop] = valor;
  };

  nodo.querySelectorAll('.table-container').forEach((el) => {
    fijar(el, 'maxHeight', 'none');
    fijar(el, 'overflow', 'visible');
  });

  try {
    // Se mide después de liberar el scroll: recién ahí scrollWidth/Height
    // reflejan el contenido completo y no la ventana.
    const ancho = Math.ceil(nodo.scrollWidth);
    const alto = Math.ceil(nodo.scrollHeight);

    fijar(nodo, 'width', `${ancho}px`);
    fijar(nodo, 'maxWidth', 'none');

    const canvas = await html2canvas(nodo, {
      backgroundColor: '#ffffff',
      scale: 2, // el doble de resolución, para que se lea al imprimir o ampliar
      useCORS: true,
      width: ancho,
      height: alto,
      windowWidth: ancho,
      windowHeight: alto,
      scrollX: 0,
      scrollY: 0
    });

    const enlace = document.createElement('a');
    enlace.href = canvas.toDataURL('image/png');
    enlace.download = nombreArchivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
  } finally {
    restaurar.forEach(([el, prop, valor]) => {
      el.style[prop] = valor;
    });
  }
}
