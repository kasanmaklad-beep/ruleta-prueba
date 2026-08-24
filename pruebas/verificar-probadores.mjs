// ════════════════════════════════════════════════════════════════════════
//  QUIÉN ES PROBADOR
//
//    node pruebas/verificar-probadores.mjs
//
//  Un probador ve y juega las mesas EN PRUEBAS: mesas vivas en producción,
//  con plata de verdad, que el público no ve porque todavía no están
//  terminadas. O sea que esta lista es un permiso, no una etiqueta.
//
//  Lo que protege es el borde: que un nombre PARECIDO al de un probador no
//  entre. Sin la prueba, un cambio inocente en la expresión —un prefijo en
//  vez de un nombre completo— le abriría la puerta a "nabila" o a "prueba_x"
//  sin que nadie se entere hasta que un jugador esté adentro.
//
//  No pide servidor ni base: la función es pura.
// ════════════════════════════════════════════════════════════════════════
import { esProbador } from '../worker/lib.js';

const casos = [
  // Adentro
  [{ role: 'player',  username: 'nabil' },     true,  'nabil (equipo del dueño)'],
  [{ role: 'player',  username: 'NABIL' },     true,  'NABIL en mayúsculas'],
  [{ role: 'player',  username: 'prueba' },    true,  'prueba (cuenta de la casa)'],
  [{ role: 'player',  username: 'prueba3' },   true,  'prueba3'],
  [{ role: 'admin',   username: 'admin2026' }, true,  'un administrador'],
  // Afuera — estos son los que de verdad importan
  [{ role: 'player',  username: 'nabila' },    false, 'nabila: empieza igual y NO es'],
  [{ role: 'player',  username: 'pruebas' },   false, 'pruebas: en plural NO es'],
  [{ role: 'player',  username: 'prueba_x' },  false, 'prueba_x NO es'],
  [{ role: 'player',  username: 'juan' },      false, 'un jugador cualquiera'],
  [{ role: 'cashier', username: 'banca1' },    false, 'un banquero'],
  [{ role: 'exec',    username: 'prueba2' },   true,  'prueba2, aunque sea ejecutivo'],
  [{ error: true },                            false, 'sin sesión'],
  [null,                                       false, 'sin nada'],
];

let fallos = 0;
for (const [auth, esperado, texto] of casos) {
  const real = esProbador(auth);
  if (real !== esperado) fallos++;
  console.log(`${real === esperado ? '✓' : '✗'} ${texto} → ${real} (esperado ${esperado})`);
}
console.log(fallos === 0 ? '\nTODO BIEN' : `\n${fallos} FALLARON`);
process.exit(fallos ? 1 : 0);
