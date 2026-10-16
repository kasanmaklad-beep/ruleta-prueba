// ════════════════════════════════════════════════════════════════════════
//  LA FICHA DE MARCA — un solo código, varias casas.
//
//  El mismo Worker sirve a mycrosis (VOLTIO) y a Fiesta Animal. Lo que
//  cambia entre una y otra no es el motor: es el nombre, el lema y los
//  colores. Eso vive acá y se elige con variables de entorno, una por
//  entorno en wrangler.jsonc.
//
//  REGLA QUE NO SE NEGOCIA: los valores por defecto son los de mycrosis
//  TAL COMO SE VE HOY. Un entorno que no declare ninguna variable tiene que
//  seguir viéndose idéntico. Por eso mycrosis no declara nada: se apoya en
//  estos valores, y así no hay forma de romperlo tocando configuración.
//
//  Ver SPEC-FIESTAANIMAL.md §3.
// ════════════════════════════════════════════════════════════════════════
import { json } from './lib.js';

// Lo que se ve hoy en mycrosis. Si algo de esto cambia, cambia la marca.
const MYCROSIS = {
  nombre: 'VOLTIO',
  // Dos frases y no una, porque en pantalla son dos lugares distintos: el
  // lema va en el pie del salón y el subtítulo debajo del nombre en la
  // entrada. Con una sola, mycrosis dejaría de verse igual — que es
  // justamente lo que no puede pasar.
  lema: 'JUGÁ CON ENERGÍA',
  subtitulo: 'DONDE CAE EL RELÁMPAGO',
  colorPrimario: '#ffd84a',    // el dorado vivo de la casa
  colorSecundario: '#d4a94a',  // el dorado apagado de bordes y textos
  colorAcento: '#5ab8ff',      // el azul eléctrico del relámpago
  logo: 'rayo',
};

// Una variable vacía o con espacios es lo mismo que no haberla puesto: vale
// el valor de la casa. Si no, un error de tipeo en la configuración deja el
// salón sin nombre y nadie se entera hasta verlo en pantalla.
function texto(v, porDefecto) {
  const s = (v == null ? '' : String(v)).trim();
  return s || porDefecto;
}

export function marcaDe(env) {
  const e = env || {};
  return {
    nombre: texto(e.MARCA_NOMBRE, MYCROSIS.nombre),
    lema: texto(e.MARCA_LEMA, MYCROSIS.lema),
    subtitulo: texto(e.MARCA_SUBTITULO, MYCROSIS.subtitulo),
    colorPrimario: texto(e.MARCA_COLOR_PRIMARIO, MYCROSIS.colorPrimario),
    colorSecundario: texto(e.MARCA_COLOR_SECUNDARIO, MYCROSIS.colorSecundario),
    colorAcento: texto(e.MARCA_COLOR_ACENTO, MYCROSIS.colorAcento),
    logo: texto(e.MARCA_LOGO, MYCROSIS.logo),
  };
}

// SIN SESIÓN, igual que /api/config: la entrada necesita el nombre y los
// colores para dibujarse, y ahí todavía no hay usuario. No expone nada que
// no esté a la vista de cualquiera que abra la página.
export async function marcaPublica(request, env) {
  return json(marcaDe(env));
}
