// ════════════════════════════════════════════════════════════════════════
//  BLACKJACK — el motor, del lado del servidor (Etapa B1).
//  Ver ESTRUCTURA-BLACKJACK.md para el plan completo.
//
//  La regla que manda sobre todas las demás: el mazo, el barajado, el reparto
//  y la decisión de quién ganó viven ACÁ. El cliente dibuja lo que se le
//  manda y nada más. En particular, la carta tapada del crupier NO sale de
//  este archivo mientras la ronda esté viva: viaja como { tapada: true }.
//  Es la misma disciplina que hizo que la ruleta sortee en el servidor.
//
//  Tres cosas que la ruleta nunca tuvo, porque resuelve todo en una sola
//  llamada, y que acá son el trabajo de verdad:
//   1. Una sola ronda abierta por jugador  → índice único en bj_rondas.
//   2. Dos llamadas al mismo tiempo         → el candado `version` (ver tomar()).
//   3. La ronda que el jugador abandona     → se cierra sola a las 12 horas.
// ════════════════════════════════════════════════════════════════════════

import { json, readJson, requireAuth, toPositiveInt, nowSql } from './lib.js';

// ─────────────────────────────── El mazo ──────────────────────────────────
// Una carta es un texto de dos letras: rango + palo.
//   Rangos: A 2 3 4 5 6 7 8 9 T J Q K   (T es el 10)
//   Palos:  S picas · H corazones · D diamantes · C tréboles
// Compacto para guardar en la base y legible cuando hay que auditar una mano.
const RANGOS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
const PALOS = ['S', 'H', 'D', 'C'];
const TIPOS = [];
for (const r of RANGOS) for (const p of PALOS) TIPOS.push(r + p);

const FIGURAS = new Set(['T', 'J', 'Q', 'K']);

// Cuánto tarda una ronda abandonada en cerrarse sola.
const HORAS_PARA_VENCER = 12;

// Freno de repetición: rondas que un jugador puede abrir por minuto. No es un
// limitador de peticiones completo (eso pide KV o Durable Objects, y va en
// otra etapa); es el techo barato que evita que un script abra mil rondas.
//
// Es un tope contra el bucle desbocado, no un metrónomo para el jugador. Por
// volumen no se le puede ganar a esta mesa (cada ronda se baraja de cero y la
// ventaja de la casa no cambia), así que lo único que hay que cuidar es que un
// programa suelto no cargue la base. Diez por segundo: una persona hace seis o
// siete manos por MINUTO y no lo va a rozar nunca; un script se choca igual.
const RONDAS_POR_MINUTO = 600;

// ─────────────────────────────── El azar ──────────────────────────────────
// Sorteo uniforme de verdad: se descarta el sobrante del rango para que no
// haya números con más chance que otros. Con 38 casillas el sesgo del resto
// es despreciable, pero acá se saca de 52, 312 y demás, y sale gratis hacerlo
// bien. Nunca Math.random().
function azar(n) {
  if (n <= 1) return 0;
  const buf = new Uint32Array(1);
  const limite = Math.floor(0x100000000 / n) * n;
  let v;
  do {
    crypto.getRandomValues(buf);
    v = buf[0];
  } while (v >= limite);
  return v % n;
}

// Saca una carta de lo que QUEDA en el mazo.
//
// No se guarda el mazo entero barajado (serían 312 cartas en cada fila): se
// guarda lo ya repartido, y de ahí se deduce qué queda. Cada tipo de carta
// aparece `mazos` veces, así que sortear un número entre 0 y las que quedan y
// recorrer los tipos descontando da exactamente la misma distribución que
// sacar de un mazo barajado. Sin reposición, como en la mesa de verdad.
function sacarCarta(repartidas, mazos) {
  const usadas = new Map();
  for (const c of repartidas) usadas.set(c, (usadas.get(c) || 0) + 1);

  const quedan = 52 * mazos - repartidas.length;
  if (quedan <= 0) return null; // no puede pasar: una ronda no llega ni a 25 cartas

  let k = azar(quedan);
  for (const t of TIPOS) {
    const disponibles = mazos - (usadas.get(t) || 0);
    if (k < disponibles) return t;
    k -= disponibles;
  }
  return null;
}

// ─────────────────────────── Contar la mano ───────────────────────────────
// El as vale 11 mientras no haga pasarse; ahí pasa a valer 1.
// `blando` = todavía queda un as contando 11 (útil para la pantalla).
export function valorMano(cartas) {
  let total = 0;
  let ases = 0;
  for (const c of cartas) {
    const r = String(c)[0];
    if (r === 'A') { ases++; total += 11; }
    else if (FIGURAS.has(r)) total += 10;
    else total += Number(r);
  }
  while (total > 21 && ases > 0) { total -= 10; ases--; }
  return { total, blando: ases > 0 };
}

// Natural = 21 con las dos primeras cartas y sin haber dividido.
function esNatural(cartas, dividida) {
  return !dividida && cartas.length === 2 && valorMano(cartas).total === 21;
}

// Qué PUESTOS tienen más de una mano, o sea cuáles se dividieron (Etapa B4).
// Se cuenta por puesto y no por ronda: con tres círculos hay tres manos y
// ninguna es una división. Contar las manos de la ronda entera haría que
// apostar en dos círculos le anulara los naturales de los dos, que es una
// forma silenciosa de quedarse con la plata del jugador.
function puestosPartidos(ronda) {
  const cuenta = {};
  for (const h of ronda.manos) cuenta[h.puesto] = (cuenta[h.puesto] || 0) + 1;
  const partido = {};
  for (const p of Object.keys(cuenta)) partido[p] = cuenta[p] > 1;
  return partido;
}

// ──────────────────────────── La ficha de mesa ────────────────────────────
// Si la migración 012 todavía no corrió, o la fila se borró, la mesa igual
// existe con estos valores. Es la misma red de seguridad que usa el catálogo
// de ruletas en lib.js: el juego no se cae por una migración pendiente.
const MESA_RESPALDO = {
  id: 'blackjack',
  label: 'Blackjack Estándar',
  mazos: 6,
  pago_natural: 1.5,
  apuesta_min: 10,
  apuesta_max: 500,
  puestos: 3,
  activo: 0,
};

// Un jugador no puede abrir más círculos que estos, aunque la ficha de la
// mesa diga cualquier cosa. Tres es lo que entra en la pantalla de un
// teléfono y lo que se dibujó en el paño.
const MAX_PUESTOS = 3;

const MESA_POR_DEFECTO = 'blackjack';

// Lee la ficha de una mesa de blackjack. Devuelve null si no existe o si no
// es de blackjack — una mesa de ruleta no se juega por acá.
async function fichaMesa(env, raw) {
  const id = (raw == null || raw === '') ? MESA_POR_DEFECTO : String(raw).trim().toLowerCase();

  let fila = null;
  try {
    fila = await env.DB.prepare(
      `SELECT id, label, tipo, activo, mazos, pago_natural, apuesta_min, apuesta_max, puestos
         FROM games WHERE id = ?`
    ).bind(id).first();
  } catch (e) {
    // Alguna migración todavía no corrió (la 012 trae `tipo`, la 013 `puestos`).
    fila = null;
  }

  if (!fila) {
    return id === MESA_RESPALDO.id ? { ...MESA_RESPALDO } : null;
  }
  if (fila.tipo !== 'blackjack') return null;

  // Una ficha a medio llenar no puede tumbar la mesa: los huecos se rellenan
  // con lo de siempre.
  const mazos = Number(fila.mazos);
  const pago = Number(fila.pago_natural);
  const puestos = Number(fila.puestos);
  return {
    id: fila.id,
    label: fila.label || fila.id,
    mazos: Number.isInteger(mazos) && mazos >= 1 && mazos <= 8 ? mazos : MESA_RESPALDO.mazos,
    pago_natural: Number.isFinite(pago) && pago > 0 ? pago : MESA_RESPALDO.pago_natural,
    apuesta_min: Number(fila.apuesta_min) > 0 ? Number(fila.apuesta_min) : MESA_RESPALDO.apuesta_min,
    apuesta_max: Number(fila.apuesta_max) > 0 ? Number(fila.apuesta_max) : MESA_RESPALDO.apuesta_max,
    puestos: Number.isInteger(puestos) && puestos >= 1 && puestos <= MAX_PUESTOS
      ? puestos : MESA_RESPALDO.puestos,
    activo: fila.activo ? 1 : 0,
  };
}

// ───────────────────────── El candado de la ronda ─────────────────────────
// Todas las jugadas pasan por acá antes de tocar nada. Es un "compará y
// cambiá": sólo avanza el que llega con la versión que está guardada, y al
// avanzar la cambia.
//
// LA VERSIÓN LA MANDA EL CLIENTE, y ahí está la gracia. Si la leyera el
// servidor justo antes de comparar, dos clics separados por milisegundos
// pasarían los dos: el segundo leería la versión que dejó el primero y le
// parecería legítima. Mandándola el cliente, el doble clic manda DOS VECES LA
// MISMA versión — la del estado que el jugador tiene delante — y la segunda
// llamada se encuentra con que ya no es la vigente. En vez de repartir otra
// carta se le contesta con el estado actual, que es lo que quería ver.
//
// Va sobre la RONDA (no sobre la mano) a propósito: así también quedan
// serializadas las jugadas que tocan dos manos a la vez, como el paso del
// turno al crupier.
async function tomar(env, rondaId, version) {
  const r = await env.DB.prepare(
    "UPDATE bj_rondas SET version = version + 1 WHERE id = ? AND version = ? AND estado = 'jugando'"
  ).bind(rondaId, version).run();
  return r.meta.changes > 0;
}

// ───────────────────────── Leer la ronda completa ─────────────────────────
async function leerRonda(env, rondaId, userId) {
  const ronda = await env.DB.prepare(
    `SELECT id, user_id, game_id, mazos, pago_natural, estado, crupier, repartidas,
            mano_activa, version, created_at
       FROM bj_rondas WHERE id = ?`
  ).bind(rondaId).first();
  if (!ronda) return null;
  // Una ronda es de quien la abrió. Sin esto, cualquiera con un id ajeno
  // podría pedir cartas en la mano de otro.
  if (userId != null && ronda.user_id !== userId) return null;

  const m = await env.DB.prepare(
    'SELECT id, indice, puesto, cartas, apuesta, estado, resultado, pago FROM bj_manos WHERE ronda_id = ? ORDER BY indice'
  ).bind(rondaId).all();

  return {
    ...ronda,
    crupier: JSON.parse(ronda.crupier),
    repartidas: JSON.parse(ronda.repartidas),
    manos: (m.results || []).map((x) => ({ ...x, cartas: JSON.parse(x.cartas) })),
  };
}

async function rondaAbierta(env, userId) {
  const r = await env.DB.prepare(
    "SELECT id FROM bj_rondas WHERE user_id = ? AND estado = 'jugando'"
  ).bind(userId).first();
  return r ? r.id : null;
}

// ──────────────────── Lo que ve el cliente (y lo que no) ──────────────────
// Mientras la ronda vive, del crupier sólo se manda la carta de arriba. La
// tapada viaja como { tapada: true } y su total ni se calcula: si el número
// viajara, con restar se sabría la carta.
function paraElCliente(ronda, mesa, saldo) {
  const abierta = ronda.estado === 'jugando';

  const cartasCrupier = abierta
    ? [ronda.crupier[0], ...ronda.crupier.slice(1).map(() => ({ tapada: true }))]
    : ronda.crupier;

  const visibles = abierta ? ronda.crupier.slice(0, 1) : ronda.crupier;
  const vCrupier = valorMano(visibles);

  // Ojo con `dividida`: es por PUESTO, no por ronda. Con tres puestos hay tres
  // manos y ninguna es una división — el 21 servido de cada una sigue siendo
  // un natural y paga 3 a 2. Contar las manos de la ronda entera haría que
  // apostar en dos círculos anulara los naturales de los dos.
  const manosPorPuesto = {};
  for (const h of ronda.manos) manosPorPuesto[h.puesto] = (manosPorPuesto[h.puesto] || 0) + 1;

  const manos = ronda.manos.map((h) => {
    const v = valorMano(h.cartas);
    return {
      indice: h.indice,
      puesto: h.puesto,
      cartas: h.cartas,
      total: v.total,
      blando: v.blando,
      apuesta: h.apuesta,
      estado: h.estado,
      resultado: h.resultado,
      pago: h.pago,
      natural: esNatural(h.cartas, manosPorPuesto[h.puesto] > 1),
    };
  });

  const activa = manos.find((h) => h.indice === ronda.mano_activa && h.estado === 'jugando');

  return {
    ronda: ronda.id,
    estado: ronda.estado,
    mesa: {
      id: mesa.id,
      label: mesa.label,
      mazos: mesa.mazos,
      pago_natural: mesa.pago_natural,
      apuesta_min: mesa.apuesta_min,
      apuesta_max: mesa.apuesta_max,
      puestos: mesa.puestos,
      activo: mesa.activo,
    },
    crupier: {
      cartas: cartasCrupier,
      total: vCrupier.total,
      blando: vCrupier.blando,
      // Con la ronda viva esto es "lo que se ve", no el total de la mano.
      parcial: abierta,
    },
    manos,
    mano_activa: ronda.mano_activa,
    acciones: activa ? accionesDe(activa) : [],
    // El cliente tiene que devolver esta versión en cada jugada: es lo que
    // hace que el doble clic no reparta dos cartas. Ver tomar().
    version: ronda.version,
    ...(saldo || {}),
  };
}

// Qué puede hacer el jugador con la mano que tiene delante.
// Dividir llega en la Etapa B4; hasta entonces no se ofrece.
function accionesDe(mano) {
  if (mano.estado !== 'jugando') return [];
  const acc = ['pedir', 'plantarse'];
  if (mano.cartas.length === 2) acc.push('doblar');
  return acc;
}

async function saldoDe(env, userId) {
  const c = await env.DB.prepare('SELECT balance, held_balance FROM users WHERE id = ?')
    .bind(userId).first();
  return { balance: c ? c.balance : 0, held_balance: c ? c.held_balance : 0 };
}

// ══════════════════════════ Turno del crupier ═════════════════════════════
// Se planta en 17 o más, sin distinguir el 17 blando (regla de la v1).
//
// El crupier sólo roba si hay contra quién jugar. No la hay cuando el jugador
// se pasó en todas sus manos, ni cuando la mano es un natural (ahí el pago ya
// está decidido: se cobra 3 a 2 y se acabó). En los dos casos da vuelta su
// carta y listo, como en la mesa de verdad. Robar de gusto no cambiaría un
// solo bolívar, pero le muestra al jugador una mano del crupier que nunca
// existió — y encima quema cartas del mazo.
//
// Con varios puestos esto importa de verdad: si una mano es natural y la otra
// no, el crupier SÍ tiene que jugar, por la segunda.
function jugarCrupier(ronda) {
  const partido = puestosPartidos(ronda);
  const hayQueCompetir = ronda.manos.some(
    (h) => h.estado !== 'pasada' && !esNatural(h.cartas, partido[h.puesto])
  );
  if (!hayQueCompetir) return;

  for (let guarda = 0; guarda < 20; guarda++) {
    const v = valorMano(ronda.crupier);
    if (v.total >= 17) break;
    const c = sacarCarta(ronda.repartidas, ronda.mazos);
    if (!c) break;
    ronda.crupier.push(c);
    ronda.repartidas.push(c);
  }
}

// ══════════════════════════ Quién ganó y cuánto ═══════════════════════════
// `pago` es lo que se le DEVUELVE al saldo, con la apuesta adentro: la
// apuesta ya se le descontó al empezar, así que un empate paga la apuesta y
// queda en cero.
//
// El redondeo del natural va para abajo (Math.floor). Con pago 3:2 y una
// apuesta impar el premio da con medio bolívar; se redondea a favor de la
// casa, que es lo que se hace en la mesa. Por eso conviene que la apuesta
// mínima de la mesa sea par.
function resolver(ronda, pagoNatural) {
  const vCrupier = valorMano(ronda.crupier).total;
  const crupierNatural = esNatural(ronda.crupier, false);
  const crupierPasado = vCrupier > 21;
  const partido = puestosPartidos(ronda);

  for (const h of ronda.manos) {
    const v = valorMano(h.cartas).total;
    const natural = esNatural(h.cartas, partido[h.puesto]);

    if (h.estado === 'pasada') {
      h.resultado = 'pierde'; h.pago = 0;
    } else if (natural && crupierNatural) {
      h.resultado = 'empate'; h.pago = h.apuesta;
    } else if (natural) {
      h.resultado = 'natural'; h.pago = h.apuesta + Math.floor(h.apuesta * pagoNatural);
    } else if (crupierNatural) {
      h.resultado = 'pierde'; h.pago = 0;
    } else if (crupierPasado || v > vCrupier) {
      h.resultado = 'gana'; h.pago = h.apuesta * 2;
    } else if (v === vCrupier) {
      h.resultado = 'empate'; h.pago = h.apuesta;
    } else {
      h.resultado = 'pierde'; h.pago = 0;
    }
  }
}

// Cierra la ronda: juega el crupier, reparte los resultados, acredita y anota
// el movimiento. Deja la ronda en 'cerrada'.
async function cerrarRonda(env, ronda, mesa) {
  jugarCrupier(ronda);
  resolver(ronda, ronda.pago_natural);

  const total = ronda.manos.reduce((s, h) => s + (h.pago || 0), 0);

  const ops = [
    env.DB.prepare(
      "UPDATE bj_rondas SET estado = 'cerrada', crupier = ?, repartidas = ?, cerrada_at = ? WHERE id = ?"
    ).bind(JSON.stringify(ronda.crupier), JSON.stringify(ronda.repartidas), nowSql(), ronda.id),
  ];
  for (const h of ronda.manos) {
    ops.push(env.DB.prepare('UPDATE bj_manos SET resultado = ?, pago = ? WHERE id = ?')
      .bind(h.resultado, h.pago, h.id));
  }
  if (total > 0) {
    ops.push(env.DB.prepare('UPDATE users SET balance = balance + ? WHERE id = ?')
      .bind(total, ronda.user_id));
    ops.push(env.DB.prepare(
      "INSERT INTO transactions (user_id, type, amount, note, source, game_id) VALUES (?, 'win', ?, ?, 'game', ?)"
    ).bind(ronda.user_id, total, notaDelCierre(ronda), ronda.game_id));
  }

  await env.DB.batch(ops);
  ronda.estado = 'cerrada';
}

function notaDelCierre(ronda) {
  const crupier = valorMano(ronda.crupier).total;
  const detalle = ronda.manos
    .map((h) => `${valorMano(h.cartas).total} ${h.resultado}`)
    .join(' · ');
  return `Blackjack (crupier ${crupier}) — ${detalle}`;
}

// Pasa el turno: si queda otra mano jugando va a esa, y si no juega el
// crupier y se cierra todo.
async function avanzar(env, ronda, mesa) {
  const siguiente = ronda.manos.find((h) => h.estado === 'jugando');
  if (siguiente) {
    if (siguiente.indice !== ronda.mano_activa) {
      ronda.mano_activa = siguiente.indice;
      await env.DB.prepare('UPDATE bj_rondas SET mano_activa = ? WHERE id = ?')
        .bind(siguiente.indice, ronda.id).run();
    }
    return;
  }
  await cerrarRonda(env, ronda, mesa);
}

// ═══════════════════════════════ Endpoints ════════════════════════════════

// GET /api/bj/ronda — la ronda abierta del jugador, o la mesa sola si no hay
// ninguna. Es lo que se pide al entrar y al recargar la página: sin esto, una
// recarga en medio de la mano dejaría al jugador mirando una mesa vacía con
// la apuesta ya descontada.
export async function bjRonda(request, env, url) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.response;

  const mesa = await fichaMesa(env, url && url.searchParams.get('mesa'));
  if (!mesa) return json({ error: 'Esa mesa no existe' }, 400);

  const abiertaId = await rondaAbierta(env, auth.userId);
  if (!abiertaId) {
    return json({
      ronda: null, estado: null, mesa, manos: [], acciones: [],
      ...(await saldoDe(env, auth.userId)),
    });
  }

  let ronda = await leerRonda(env, abiertaId, auth.userId);
  // Si quedó abierta de ayer, se cierra ahora y se contesta ya resuelta.
  if (await vencerSiCorresponde(env, ronda, mesa)) {
    ronda = await leerRonda(env, abiertaId, auth.userId);
  }
  return json(paraElCliente(ronda, mesa, await saldoDe(env, auth.userId)));
}

// La ronda abandonada. El jugador ve una mano fea y cierra el navegador: la
// plata no corre riesgo (la apuesta ya se descontó), pero la ronda le traba
// la mesa para siempre. A las 12 horas se planta sola, juega el crupier y se
// paga lo que corresponda — nunca se le queda la apuesta sin resolver.
async function vencerSiCorresponde(env, ronda, mesa) {
  if (!ronda || ronda.estado !== 'jugando') return false;
  const nacida = Date.parse(String(ronda.created_at).replace(' ', 'T') + 'Z');
  if (!Number.isFinite(nacida)) return false;
  if (Date.now() - nacida < HORAS_PARA_VENCER * 3600 * 1000) return false;

  if (!(await tomar(env, ronda.id, ronda.version))) return false;
  for (const h of ronda.manos) {
    if (h.estado === 'jugando') {
      h.estado = 'plantada';
      await env.DB.prepare("UPDATE bj_manos SET estado = 'plantada' WHERE id = ?").bind(h.id).run();
    }
  }
  await cerrarRonda(env, ronda, mesa);
  return true;
}

// ── Qué se apostó y en qué círculos ──────────────────────────────────────
// Los puestos van numerados de izquierda a derecha, 0 en adelante. Cada uno
// lleva su propia apuesta y su propio mínimo y máximo: el tope es POR PUESTO,
// no por ronda, igual que en la mesa — el riesgo de la casa lo marca cuánto
// puede cobrar una mano, y tres manos de 500 contra un mismo crupier no son
// lo mismo que una de 1500, pero tampoco se cancelan entre sí.
function leerApuestas(body, mesa) {
  // El del medio es donde cae quien no dice nada (un cliente viejo, o la
  // batería de pruebas). Con un solo puesto, el del medio es el 0.
  const delMedio = Math.floor((mesa.puestos - 1) / 2);
  const bruto = Array.isArray(body.puestos) ? body.puestos
    : (body.apuesta != null ? [{ puesto: delMedio, apuesta: body.apuesta }] : null);

  if (!bruto || !bruto.length) return { error: 'No pusiste ninguna ficha' };
  if (bruto.length > mesa.puestos) {
    return { error: `Esta mesa tiene ${mesa.puestos} puesto${mesa.puestos > 1 ? 's' : ''}` };
  }

  const vistos = new Set();
  const apuestas = [];
  for (const p of bruto) {
    const puesto = Number(p && p.puesto);
    if (!Number.isInteger(puesto) || puesto < 0 || puesto >= mesa.puestos) {
      return { error: 'Ese puesto no existe en esta mesa' };
    }
    if (vistos.has(puesto)) return { error: 'Hay dos apuestas en el mismo puesto' };
    vistos.add(puesto);

    const apuesta = toPositiveInt(p && p.apuesta);
    if (apuesta === null) return { error: 'Apuesta inválida' };
    if (apuesta < mesa.apuesta_min) {
      return { error: `La apuesta mínima de esta mesa es ${mesa.apuesta_min}` };
    }
    if (apuesta > mesa.apuesta_max) {
      return { error: `La apuesta máxima de esta mesa es ${mesa.apuesta_max}` };
    }
    apuestas.push({ puesto, apuesta });
  }
  // De izquierda a derecha: es el orden en que se reparte y en que se juega.
  apuestas.sort((a, b) => a.puesto - b.puesto);
  return { apuestas };
}

function notaDeLaApuesta(manos) {
  if (manos.length === 1) return 'Apuesta de blackjack';
  return `Apuesta de blackjack en ${manos.length} puestos (${manos.map((m) => m.apuesta).join(' + ')})`;
}

// POST /api/bj/apostar — arranca la ronda.
export async function bjApostar(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const mesa = await fichaMesa(env, body.mesa);
  if (!mesa) return json({ error: 'Esa mesa no existe' }, 400);
  if (!mesa.activo) return json({ error: 'Esa mesa está cerrada' }, 400);

  // Se puede apostar en varios círculos de la mesa. Se acepta la forma nueva
  // (`puestos: [{puesto, apuesta}]`) y la vieja (`apuesta: 100` a secas, que
  // cae en el círculo del medio) — así un cliente que no sepa de puestos
  // sigue jugando igual.
  const pedido = leerApuestas(body, mesa);
  if (pedido.error) return json({ error: pedido.error }, 400);
  const apuestas = pedido.apuestas;
  const total = apuestas.reduce((s, a) => s + a.apuesta, 0);

  // ¿Ya tiene una ronda abierta? Si venció, se cierra y puede seguir; si no,
  // primero termina la que tiene.
  const abiertaId = await rondaAbierta(env, auth.userId);
  if (abiertaId) {
    const previa = await leerRonda(env, abiertaId, auth.userId);
    const vencida = await vencerSiCorresponde(env, previa, mesa);
    if (!vencida) {
      return json({ error: 'Tenés una mano sin terminar. Cerrala antes de apostar de nuevo.', ronda: abiertaId }, 409);
    }
  }

  if (await demasiadoRapido(env, auth.userId)) {
    return json({ error: 'Estás jugando demasiado rápido. Esperá unos segundos.' }, 429);
  }

  // ── La plata sale primero, y sale del saldo DISPONIBLE (lo retenido por un
  //    retiro pendiente no se puede apostar). Es el mismo UPDATE condicional
  //    que usa el giro de la ruleta: sin leer-y-después-escribir, así dos
  //    apuestas a la vez no pueden gastar el mismo saldo.
  const upd = await env.DB.prepare(
    'UPDATE users SET balance = balance - ?, wagered_total = wagered_total + ? WHERE id = ? AND balance - held_balance >= ?'
  ).bind(total, total, auth.userId, total).run();
  if (upd.meta.changes === 0) {
    const c = await saldoDe(env, auth.userId);
    const disponible = c.balance - c.held_balance;
    return json({
      error: c.held_balance > 0
        ? `Saldo insuficiente: tenés ${disponible} disponible (${c.held_balance} está retenido por un retiro pendiente)`
        : 'Saldo insuficiente',
      balance: c.balance,
    }, 400);
  }

  try {
    // ── Repartir como en la mesa: una carta a cada puesto en orden, después
    //    una al crupier, y otra vuelta igual. No es adorno — el orden decide
    //    qué carta le toca a cada uno, así que tiene que ser el de la mesa.
    const repartidas = [];
    const manos = apuestas.map((a) => ({ puesto: a.puesto, apuesta: a.apuesta, cartas: [] }));
    const crupier = [];
    for (let vuelta = 0; vuelta < 2; vuelta++) {
      for (const m of manos) {
        const c = sacarCarta(repartidas, mesa.mazos);
        repartidas.push(c); m.cartas.push(c);
      }
      const c = sacarCarta(repartidas, mesa.mazos);
      repartidas.push(c); crupier.push(c);
    }

    const id = crypto.randomUUID();
    const ops = [
      env.DB.prepare(
        `INSERT INTO bj_rondas (id, user_id, game_id, mazos, pago_natural, estado,
                                crupier, repartidas, mano_activa, version)
         VALUES (?, ?, ?, ?, ?, 'jugando', ?, ?, 0, 0)`
      ).bind(id, auth.userId, mesa.id, mesa.mazos, mesa.pago_natural,
             JSON.stringify(crupier), JSON.stringify(repartidas)),
    ];
    manos.forEach((m, i) => {
      ops.push(env.DB.prepare(
        "INSERT INTO bj_manos (ronda_id, indice, puesto, cartas, apuesta, estado) VALUES (?, ?, ?, ?, ?, 'jugando')"
      ).bind(id, i, m.puesto, JSON.stringify(m.cartas), m.apuesta));
    });
    // Un solo movimiento por la ronda entera, con el detalle en la nota: el
    // reporte del panel cuenta RONDAS, y tres apuntes por ronda le harían
    // creer que se jugó el triple.
    ops.push(env.DB.prepare(
      "INSERT INTO transactions (user_id, type, amount, note, source, game_id) VALUES (?, 'bet', ?, ?, 'game', ?)"
    ).bind(auth.userId, total, notaDeLaApuesta(manos), mesa.id));
    await env.DB.batch(ops);

    let ronda = await leerRonda(env, id, auth.userId);

    // Naturales: si el crupier tiene 21 servido se termina todo, y si lo tiene
    // un puesto, ese puesto ya no juega. El crupier "mira" su carta tapada acá
    // adentro, donde nadie la ve — por eso esta mesa no ofrece seguro.
    const crupierNatural = esNatural(crupier, false);
    const cerrarTodo = crupierNatural || ronda.manos.every((h) => esNatural(h.cartas, false));
    if (cerrarTodo) {
      await env.DB.prepare("UPDATE bj_manos SET estado = 'plantada' WHERE ronda_id = ? AND estado = 'jugando'")
        .bind(id).run();
      for (const h of ronda.manos) h.estado = 'plantada';
      await cerrarRonda(env, ronda, mesa);
      ronda = await leerRonda(env, id, auth.userId);
    } else {
      // Los puestos con natural se plantan solos; el turno arranca en el
      // primero que de verdad tenga algo que decidir.
      for (const h of ronda.manos) {
        if (esNatural(h.cartas, false)) {
          h.estado = 'plantada';
          await env.DB.prepare("UPDATE bj_manos SET estado = 'plantada' WHERE id = ?").bind(h.id).run();
        }
      }
      await avanzar(env, ronda, mesa);
      ronda = await leerRonda(env, id, auth.userId);
    }

    return json(paraElCliente(ronda, mesa, await saldoDe(env, auth.userId)));
  } catch (err) {
    // Si algo falló después de cobrar, se devuelve la apuesta. Nunca se le
    // queda la plata a un jugador por un error nuestro.
    await env.DB.prepare('UPDATE users SET balance = balance + ?, wagered_total = wagered_total - ? WHERE id = ?')
      .bind(total, total, auth.userId).run();
    throw err;
  }
}

// Cuántas rondas abrió en el último minuto.
async function demasiadoRapido(env, userId) {
  const desde = new Date(Date.now() - 60 * 1000).toISOString().replace('T', ' ').slice(0, 19);
  const r = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM bj_rondas WHERE user_id = ? AND created_at >= ?'
  ).bind(userId, desde).first();
  return !!r && r.n >= RONDAS_POR_MINUTO;
}

// Prepara una jugada: busca la ronda, la mano activa, y toma el candado.
// Devuelve { error } listo para responder, o { ronda, mano, mesa }.
async function prepararJugada(request, env, { exigeDosCartas = false } = {}) {
  const auth = await requireAuth(request, env);
  if (auth.error) return { salida: auth.response };

  const body = await readJson(request);
  const id = String(body.ronda || '').trim();
  const rondaId = id || (await rondaAbierta(env, auth.userId));
  if (!rondaId) return { salida: json({ error: 'No tenés ninguna mano abierta' }, 400) };

  const ronda = await leerRonda(env, rondaId, auth.userId);
  if (!ronda) return { salida: json({ error: 'Esa mano no existe' }, 404) };

  const mesa = await fichaMesa(env, ronda.game_id);
  if (!mesa) return { salida: json({ error: 'Esa mesa no existe' }, 400) };

  if (ronda.estado !== 'jugando') {
    // Ya terminó: no es un error del jugador, se le contesta con el resultado.
    return { salida: json(paraElCliente(ronda, mesa, await saldoDe(env, auth.userId))) };
  }

  const mano = ronda.manos.find((h) => h.indice === ronda.mano_activa && h.estado === 'jugando');
  if (!mano) return { salida: json({ error: 'No hay una mano esperando jugada' }, 400) };
  if (exigeDosCartas && mano.cartas.length !== 2) {
    return { salida: json({ error: 'Sólo se puede doblar con las dos primeras cartas' }, 400) };
  }

  // La versión del estado sobre el que el jugador decidió. Sin esto el candado
  // no sirve de nada (ver tomar()), así que se exige: es la diferencia entre
  // que "dos clics no reparten dos cartas" sea una promesa o sólo una idea.
  const version = Number(body.version);
  if (!Number.isInteger(version) || version < 0) {
    return { salida: json({ error: 'Falta la versión de la mano. Volvé a cargar la mesa.' }, 400) };
  }

  // El candado. Si no se puede tomar, otra llamada igual ya se adelantó: se
  // contesta con el estado que quedó, sin repartir de nuevo.
  if (!(await tomar(env, ronda.id, version))) {
    const fresca = await leerRonda(env, rondaId, auth.userId);
    return { salida: json(paraElCliente(fresca, mesa, await saldoDe(env, auth.userId))) };
  }

  return { auth, ronda, mano, mesa };
}

async function respuesta(env, rondaId, userId, mesa) {
  const fresca = await leerRonda(env, rondaId, userId);
  return json(paraElCliente(fresca, mesa, await saldoDe(env, userId)));
}

// POST /api/bj/pedir
export async function bjPedir(request, env) {
  const p = await prepararJugada(request, env);
  if (p.salida) return p.salida;
  const { auth, ronda, mano, mesa } = p;

  const c = sacarCarta(ronda.repartidas, ronda.mazos);
  mano.cartas.push(c);
  ronda.repartidas.push(c);

  const pasado = valorMano(mano.cartas).total > 21;
  mano.estado = pasado ? 'pasada' : 'jugando';

  await env.DB.batch([
    env.DB.prepare('UPDATE bj_manos SET cartas = ?, estado = ? WHERE id = ?')
      .bind(JSON.stringify(mano.cartas), mano.estado, mano.id),
    env.DB.prepare('UPDATE bj_rondas SET repartidas = ? WHERE id = ?')
      .bind(JSON.stringify(ronda.repartidas), ronda.id),
  ]);

  if (pasado) await avanzar(env, ronda, mesa);
  return respuesta(env, ronda.id, auth.userId, mesa);
}

// POST /api/bj/plantarse
export async function bjPlantarse(request, env) {
  const p = await prepararJugada(request, env);
  if (p.salida) return p.salida;
  const { auth, ronda, mano, mesa } = p;

  mano.estado = 'plantada';
  await env.DB.prepare("UPDATE bj_manos SET estado = 'plantada' WHERE id = ?").bind(mano.id).run();

  await avanzar(env, ronda, mesa);
  return respuesta(env, ronda.id, auth.userId, mesa);
}

// POST /api/bj/doblar — segunda apuesta igual a la primera, una sola carta, y
// la mano se cierra.
export async function bjDoblar(request, env) {
  const p = await prepararJugada(request, env, { exigeDosCartas: true });
  if (p.salida) return p.salida;
  const { auth, ronda, mano, mesa } = p;

  const extra = mano.apuesta;
  const upd = await env.DB.prepare(
    'UPDATE users SET balance = balance - ?, wagered_total = wagered_total + ? WHERE id = ? AND balance - held_balance >= ?'
  ).bind(extra, extra, auth.userId, extra).run();
  if (upd.meta.changes === 0) {
    // No alcanza para doblar: la mano sigue como estaba y puede pedir o
    // plantarse. (La versión ya se movió; el cliente sólo tiene que volver a
    // leer, que es lo que hace con esta respuesta.)
    const c = await saldoDe(env, auth.userId);
    return json({
      error: `No te alcanza para doblar: hacen falta ${extra} y tenés ${c.balance - c.held_balance} disponible.`,
      ...paraElCliente(await leerRonda(env, ronda.id, auth.userId), mesa, c),
    }, 400);
  }

  const c = sacarCarta(ronda.repartidas, ronda.mazos);
  mano.cartas.push(c);
  ronda.repartidas.push(c);
  mano.apuesta += extra;
  mano.estado = valorMano(mano.cartas).total > 21 ? 'pasada' : 'doblada';

  await env.DB.batch([
    env.DB.prepare('UPDATE bj_manos SET cartas = ?, apuesta = ?, estado = ? WHERE id = ?')
      .bind(JSON.stringify(mano.cartas), mano.apuesta, mano.estado, mano.id),
    env.DB.prepare('UPDATE bj_rondas SET repartidas = ? WHERE id = ?')
      .bind(JSON.stringify(ronda.repartidas), ronda.id),
    env.DB.prepare(
      "INSERT INTO transactions (user_id, type, amount, note, source, game_id) VALUES (?, 'bet', ?, ?, 'game', ?)"
    ).bind(auth.userId, extra, 'Blackjack: dobló la apuesta', ronda.game_id),
  ]);

  await avanzar(env, ronda, mesa);
  return respuesta(env, ronda.id, auth.userId, mesa);
}
