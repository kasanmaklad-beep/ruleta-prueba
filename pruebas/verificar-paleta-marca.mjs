// ════════════════════════════════════════════════════════════════════════
//  LA PALETA SEGÚN LA MARCA
//
//    node pruebas/verificar-paleta-marca.mjs
//
//  Dos cosas, y las dos pueden costar caro si se rompen:
//
//   1. MYCROSIS NO CAMBIA. Sin marca propia, la paleta del jugador es el
//      objeto de siempre, valor por valor. Derivar tonos daría colores
//      parecidos pero no idénticos, y un negocio abierto tiene que verse
//      igual, no parecido.
//   2. LOS PANELES POR ROL NO SE TIÑEN. El azul del dueño, el verde de la
//      banca y el violeta del ejecutivo no dicen qué casa es: dicen EN QUÉ
//      PANEL ESTÁS. Quien maneja la plata de varias casas necesita
//      distinguirlo de un vistazo, así que la marca no los toca.
//
//  No pide navegador: se le da un window de mentira y se lee lo que expone.
// ════════════════════════════════════════════════════════════════════════
import { readFileSync } from 'node:fs';

const fuente = readFileSync(new URL('../public/ui.js', import.meta.url), 'utf8');
const win = { addEventListener() {}, matchMedia: () => ({ matches: false }) };
// ui.js dibuja componentes, así que pide React para definirse. Acá no se
// dibuja nada: sólo se lee UI.paleta, que es una función de colores. Con un
// React de mentira alcanza para que el módulo termine de cargar.
const ReactFalso = new Proxy(function () {}, { get: () => () => null, apply: () => null });
new Function('window', 'document', 'localStorage', 'navigator', 'React', fuente)(
  win,
  { createElement: () => ({ style: {}, setAttribute() {} }), head: { appendChild() {} }, getElementById: () => null },
  { getItem: () => null, setItem() {} },
  { language: 'es' },
  ReactFalso);

const UI = win.UI;
let f = 0;
const ok = (b, m) => { console.log((b ? '✓ ' : '✗ ') + m); if (!b) f++; };

// 1. Sin marca: mycrosis intacta, valor por valor
win.Marca = undefined;
const casa = UI.paleta('jugador');
ok(casa['--acento'] === '#d4a94a', 'sin marca, el acento del jugador sigue siendo el dorado');
ok(casa['--borde'] === '#8b6a20', 'y el borde, exacto');
ok(casa['--boton-texto'] === '#1a1006', 'y el texto del botón, exacto');

// 2. Con la ficha de la casa: igual de intacta
win.Marca = { get: () => ({ colorPrimario: '#ffd84a', colorSecundario: '#d4a94a' }) };
ok(UI.paleta('jugador')['--borde'] === '#8b6a20', 'con la ficha de la casa, tampoco cambia');

// 3. Con otra marca: se tiñe
win.Marca = { get: () => ({ colorPrimario: '#f59e0b', colorSecundario: '#f97316' }) };
const fa = UI.paleta('jugador');
ok(fa['--acento'] === '#f97316', 'con otra marca, el acento es el suyo');
ok(fa['--borde'] !== '#8b6a20' && /^#[0-9a-f]{6}$/.test(fa['--borde']), 'el borde se deriva y es un color válido');
ok(fa['--boton-acento'].includes('#f97316'), 'el botón toma el color de la marca');

// 4. Los paneles por rol, nunca
for (const [rol, color] of [['dueno', '#5aa9e6'], ['socio', '#4fd18b'], ['ejecutivo', '#a78bfa']]) {
  ok(UI.paleta(rol)['--acento'] === color, `el panel ${rol} conserva su color aunque cambie la marca`);
}

// 5. Un color mal escrito no deja la pantalla sin pintar
win.Marca = { get: () => ({ colorPrimario: 'no-es-un-color', colorSecundario: 'tampoco' }) };
const roto = UI.paleta('jugador');
ok(/^#[0-9a-f]{6}$/.test(roto['--borde']), 'con un color mal escrito, igual sale un color válido');

console.log(f === 0 ? '\nTODO BIEN' : `\n${f} FALLARON`);
process.exit(f ? 1 : 0);
