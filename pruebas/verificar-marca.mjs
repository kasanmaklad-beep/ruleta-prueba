// ════════════════════════════════════════════════════════════════════════
//  LA FICHA DE MARCA
//
//    node pruebas/verificar-marca.mjs
//
//  Lo que protege es una sola cosa, y es la que puede costar plata: que
//  MYCROSIS NO CAMBIE. El mismo código sirve a dos casas, así que un
//  descuido en los valores por defecto se ve en el salón de un negocio que
//  ya está abierto y funcionando.
//
//  Y dos frenos más: que una variable mal puesta caiga al valor de la casa
//  en vez de dejar el salón sin nombre, y que la ficha publique sólo sus
//  siete campos — nunca otra variable del entorno, que es donde vive el
//  JWT_SECRET.
//
//  No pide servidor ni base: la función es pura.
// ════════════════════════════════════════════════════════════════════════
import { marcaDe } from '../worker/marca.js';

let f = 0;
const ok = (b, m) => { console.log((b ? '✓ ' : '✗ ') + m); if (!b) f++; };

// 1. Sin variables = mycrosis tal como se ve hoy
const d = marcaDe({});
ok(d.nombre === 'VOLTIO', 'sin variables, el nombre sigue siendo VOLTIO');
ok(d.lema === 'JUGÁ CON ENERGÍA', 'el lema del pie del salón se mantiene');
ok(d.subtitulo === 'DONDE CAE EL RELÁMPAGO', 'el subtítulo de la entrada se mantiene');
ok(d.colorPrimario === '#ffd84a', 'el dorado de la casa se mantiene');
ok(d.logo === 'rayo', 'el logo sigue siendo el rayo');
ok(marcaDe(undefined).nombre === 'VOLTIO', 'sin env tampoco se cae');

// 2. Fiesta Animal, con los valores de la SPEC
const fa = marcaDe({
  MARCA_NOMBRE: 'Fiesta Animal',
  MARCA_LEMA: 'Juega. Gana. Vive la Fiesta Animal.',
  MARCA_SUBTITULO: 'EL SALÓN DE LOS ANIMALITOS',
  MARCA_COLOR_PRIMARIO: '#f59e0b',
  MARCA_COLOR_SECUNDARIO: '#f97316',
  MARCA_COLOR_ACENTO: '#10b981',
  MARCA_LOGO: 'huella',
});
ok(fa.nombre === 'Fiesta Animal' && fa.logo === 'huella', 'la otra casa cambia entera');
ok(fa.colorPrimario === '#f59e0b', 'con sus colores');

// 3. Lo que de verdad protege: una variable mal puesta NO deja el salón mudo
const roto = marcaDe({ MARCA_NOMBRE: '   ', MARCA_LEMA: '' });
ok(roto.nombre === 'VOLTIO', 'una variable con espacios cae al valor de la casa');
ok(roto.lema === 'JUGÁ CON ENERGÍA', 'una variable vacía también');

// 4. Que no se cuele nada de más en lo que se publica
ok(Object.keys(marcaDe({ JWT_SECRET: 'no-deberia-salir' })).length === 7,
   'la ficha publica 7 campos y nada más: ninguna otra variable se filtra');
ok(!JSON.stringify(marcaDe({ JWT_SECRET: 'no-deberia-salir' })).includes('no-deberia-salir'),
   'el secreto del entorno NO sale en la ficha');

console.log(f === 0 ? '\nTODO BIEN' : `\n${f} FALLARON`);
process.exit(f ? 1 : 0);
