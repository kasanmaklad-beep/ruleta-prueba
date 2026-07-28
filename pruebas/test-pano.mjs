// Las zonas del paño: qué apuesta entra en cada punto que se toca.
//
// Corre el paño de verdad (public/table.js) sin navegador: se le da un React
// de mentira, se le pide que se arme y se leen las zonas que declaró. Así se
// puede comprobar, punto por punto, que tocar el borde de los ceros da la
// apuesta que corresponde — que es justo lo que a ojo no se distingue.
//
//   node pruebas/test-pano.mjs
//
// Ver ESTRUCTURA-SALON.md (Etapas 3b y 4).

import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const NUM_H = 84, ZERO_W = 50;

// ── Un React mínimo: solo lo que el paño usa ──────────────────────────────
function hacerContexto() {
  const React = {
    createElement: (type, props, ...children) => ({
      type, props: props || {}, children: children.flat(Infinity).filter(Boolean),
    }),
    useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
    useMemo: (fn) => fn(),
    useRef: (v) => ({ current: v }),
    useEffect: () => {},
    useCallback: (fn) => fn,
    Fragment: 'Fragment',
  };
  const ctx = { React, console, Math, JSON, Set, Map, Array, Object, String, Number };
  ctx.window = ctx;
  vm.createContext(ctx);
  for (const archivo of ['public/wheel.js', 'public/table.js']) {
    vm.runInContext(readFileSync(new URL('../' + archivo, import.meta.url), 'utf8'), ctx);
  }
  return ctx;
}

// Arma el paño de una mesa y devuelve todas sus zonas clicables.
function zonasDe(ctx, mesa) {
  const arbol = ctx.BettingTable({
    mesa, bets: [], onPlaceBet: () => {}, onRemoveBet: () => {},
    selectedChip: 5, disabled: false, theme: 'classic',
    lightningNumbers: new Map(), rotateLabels: false, winningNumber: null,
  });
  const zonas = [];
  (function recorrer(n) {
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) return n.forEach(recorrer);
    if (n.props && n.props.hot) zonas.push(n.props.hot);
    (n.children || []).forEach(recorrer);
    if (n.props) Object.values(n.props).forEach((v) => {
      if (v && typeof v === 'object' && (Array.isArray(v) || v.children || v.props)) recorrer(v);
    });
  })(arbol);
  return zonas;
}

// Qué apuesta entra al tocar un punto: gana la zona de arriba de todo, igual
// que en la pantalla (las internas tapan a las externas).
function apuestaEn(zonas, x, y) {
  const candidatas = zonas.filter((h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h);
  if (!candidatas.length) return '(nada)';
  const gana = candidatas[candidatas.length - 1];
  return `${gana.type} ${gana.payload}`;
}

const AMERICANA = { dobleCero: true, animales: true, rayos: true, pagoPleno: 29 };
const EUROPEA = { dobleCero: false, animales: false, rayos: false, pagoPleno: 35 };

let ok = 0, fail = 0;
function check(nombre, esperado, obtenido) {
  if (esperado === obtenido) { console.log(`  ✓ ${nombre}`); ok++; }
  else { console.log(`  ✗ ${nombre}\n     → esperaba "${esperado}" y entró "${obtenido}"`); fail++; }
}

const ctx = hacerContexto();
const ame = zonasDe(ctx, AMERICANA);
const eur = zonasDe(ctx, EUROPEA);

console.log('── Americana: el borde de los ceros ──');
const bordeAme = [
  // Arriba, sobre el 3, no va nada: la línea de cinco vive abajo, del lado de
  // la primera docena, igual que los primeros cuatro de la europea.
  ['arriba del todo ya no hay línea de cinco: es la casilla del 00', 4, 'straight 00'],
  ['split 00-3', NUM_H * 0.5, 'split 00-3'],
  ['trío 00-2-3', NUM_H, 'street 00-2-3'],
  ['trío 0-00-2', NUM_H * 1.5, 'street 0-00-2'],
  ['trío 0-1-2', NUM_H * 2, 'street 0-1-2'],
  ['split 0-1', NUM_H * 2.5, 'split 0-1'],
  ['la punta de abajo: la línea de cinco', NUM_H * 3 - 4, 'topline 0-00-1-2-3'],
];
for (const [nombre, y, esperado] of bordeAme) check(nombre, esperado, apuestaEn(ame, ZERO_W, y));

console.log('\n── Americana: los ceros en su lugar y los vecinos enteros ──');
check('el 00 arriba (del lado del 3)', 'straight 00', apuestaEn(ame, ZERO_W / 2, NUM_H * 0.75));
check('el 0 abajo (del lado del 1)', 'straight 0', apuestaEn(ame, ZERO_W / 2, NUM_H * 2.25));
check('el split 0-00 entre los dos', 'split 0-00', apuestaEn(ame, ZERO_W / 2, NUM_H * 1.5));
check('el pleno al 3 sigue entero', 'straight 3', apuestaEn(ame, ZERO_W + 28, NUM_H * 0.5));
check('el pleno al 1 sigue entero', 'straight 1', apuestaEn(ame, ZERO_W + 28, NUM_H * 2.5));
check('la calle 1-2-3 sigue entrando', 'street 1-2-3', apuestaEn(ame, ZERO_W + 28, NUM_H * 3 - 4));

console.log('\n── Europea: un solo cero, sin 00 ni línea de cinco ──');
check('la punta de abajo: los primeros cuatro', 'corner 0-1-2-3', apuestaEn(eur, ZERO_W, NUM_H * 3 - 4));
check('split 0-3', 'split 0-3', apuestaEn(eur, ZERO_W, NUM_H * 0.5));
check('trío 0-2-3', 'street 0-2-3', apuestaEn(eur, ZERO_W, NUM_H));
check('split 0-2', 'split 0-2', apuestaEn(eur, ZERO_W, NUM_H * 1.5));
check('trío 0-1-2', 'street 0-1-2', apuestaEn(eur, ZERO_W, NUM_H * 2));
check('split 0-1', 'split 0-1', apuestaEn(eur, ZERO_W, NUM_H * 2.5));
check('el 0 ocupa la columna entera', 'straight 0', apuestaEn(eur, ZERO_W / 2, NUM_H * 0.75));
check('y también abajo', 'straight 0', apuestaEn(eur, ZERO_W / 2, NUM_H * 2.25));
check('no hay ninguna apuesta con 00',
  'ninguna', eur.some((h) => String(h.payload).includes('00')) ? 'hay alguna' : 'ninguna');

console.log('\n── Que ninguna zona quede tapada del todo ──');
for (const [nombre, zonas] of [['americana', ame], ['europea', eur]]) {
  const tapadas = zonas.filter((h) => {
    const cx = h.x + h.w / 2, cy = h.y + h.h / 2;
    return apuestaEn(zonas, cx, cy) !== `${h.type} ${h.payload}`;
  });
  check(`${nombre}: todas las apuestas se pueden tocar`, '0 tapadas', `${tapadas.length} tapadas`
    + (tapadas.length ? ' → ' + tapadas.map((h) => h.type + ' ' + h.payload).join(', ') : ''));
}

console.log(`\n═══ ${ok} pasadas, ${fail} fallidas ═══`);
process.exit(fail);
