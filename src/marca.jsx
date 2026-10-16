// ════════════════════════════════════════════════════════════════════════
//  LA MARCA, DEL LADO DEL NAVEGADOR — expone window.Marca
//
//  El mismo código sirve a mycrosis (VOLTIO) y a Fiesta Animal. Quién es
//  cada uno lo dice el servidor en /api/marca; acá sólo se guarda y se
//  reparte.
//
//  POR QUÉ SE ESPERA ANTES DE DIBUJAR: si la pantalla se dibujara primero y
//  la marca llegara después, el jugador de Fiesta Animal vería "VOLTIO" por
//  un instante y después el nombre correcto. Un parpadeo así, en la primera
//  pantalla de un casino, es de las cosas que hacen desconfiar.
//
//  Pero la espera tiene tope: si el servidor no contesta, se entra igual con
//  los valores de la casa. Una marca equivocada se arregla recargando; una
//  pantalla en blanco deja al jugador afuera.
// ════════════════════════════════════════════════════════════════════════
(function () {
  // Los mismos valores por defecto que el Worker. Están repetidos a
  // propósito: si el servidor no contesta, la página se dibuja igual.
  const CASA = {
    nombre: 'VOLTIO',
    lema: 'JUGÁ CON ENERGÍA',
    subtitulo: 'DONDE CAE EL RELÁMPAGO',
    colorPrimario: '#ffd84a',
    colorSecundario: '#d4a94a',
    colorAcento: '#5ab8ff',
    logo: 'rayo',
  };

  // Lo último que se supo, para que la segunda visita no espere nada. Si el
  // servidor no contesta, al menos se ve la marca correcta de la vez pasada.
  const CLAVE = 'voltio_marca';
  let actual = Object.assign({}, CASA);
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    if (g && typeof g === 'object' && g.nombre) actual = Object.assign({}, CASA, g);
  } catch (e) { /* modo privado o dato viejo roto: queda la casa */ }

  function aplicar(ficha) {
    actual = Object.assign({}, CASA, ficha || {});
    try { localStorage.setItem(CLAVE, JSON.stringify(actual)); } catch (e) { /* da igual */ }
    // El título de la pestaña y el nombre del ícono en el teléfono.
    try {
      document.title = `${actual.nombre} — ${T('Salón de Juegos')}`;
      const m = document.querySelector('meta[name="apple-mobile-web-app-title"]');
      if (m) m.setAttribute('content', actual.nombre);
    } catch (e) { /* navegador viejo */ }
    return actual;
  }

  const T = window.T || ((s) => s);

  window.Marca = {
    get() { return actual; },
    nombre() { return actual.nombre; },
    // Se llama una sola vez, antes de dibujar. Nunca rechaza: si falla,
    // devuelve lo que haya.
    cargar(topeMs) {
      const tope = topeMs || 2500;
      return new Promise((listo) => {
        let cerrado = false;
        const terminar = () => { if (!cerrado) { cerrado = true; listo(aplicar(actual)); } };
        const reloj = setTimeout(terminar, tope);
        fetch('/api/marca')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (cerrado) return;
            clearTimeout(reloj);
            cerrado = true;
            listo(aplicar(d || actual));
          })
          .catch(() => { clearTimeout(reloj); terminar(); });
      });
    },
  };

  // El título se pone ya, con lo último que se supo, para que la pestaña no
  // diga el nombre de la otra casa mientras carga.
  aplicar(actual);
})();
