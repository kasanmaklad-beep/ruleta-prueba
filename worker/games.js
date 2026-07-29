// ════════════════════════════════════════════════════════════════════════
//  Las mesas del salón, en manos del dueño (Etapa 4).
//  Crear, editar, encender y apagar mesas sin tocar código.
//
//  Dos reglas que el servidor hace cumplir aunque la pantalla se distraiga:
//   1. Sin rayos, el pleno paga 35 a 1 (ver validarMesa en lib.js).
//   2. Siempre queda al menos una mesa encendida: si se apagaran todas, el
//      salón quedaría vacío y ningún giro entraría.
//  Y una que no es regla sino consecuencia: el id de una mesa que ya jugó no
//  se toca ni se borra, porque es lo que quedó escrito en cada movimiento.
// ════════════════════════════════════════════════════════════════════════

import {
  json, readJson, requireAdmin, validarMesa, catalogoInterno,
  ventajaMesa, ventajaPleno, ventajaPlenoClasico, getSettings, RUEDAS,
} from './lib.js';

// Lo que le deja al casino una mesa de blackjack, en porcentaje de lo
// apostado. No se configura con una perilla: sale de las reglas. Con el juego
// completo y el natural a 3:2 son ~0,5%; pagando 6:5 el mismo juego trepa a
// ~1,9%. Son los números de la sección 4 de ESTRUCTURA-BLACKJACK.md, y hay que
// mirarlos junto al 5,26% de Catatumbo antes de decidir abrir la mesa.
function ventajaBlackjack(pagoNatural) {
  return pagoNatural >= 1.5 ? 0.5 : 1.9;
}

// Cuánto le deja a la casa cada parte de la mesa, para que el dueño lo vea
// ANTES de encenderla. El resto de la mesa sale de la rueda; el pleno depende
// de si hay rayos.
function conCuentas(m, settings) {
  // Una mesa de blackjack no tiene rueda ni pleno; lo que el dueño necesita
  // ver antes de abrirla es cuánto le deja, y ahí el número lo pone el pago
  // del natural (ver ESTRUCTURA-BLACKJACK.md, sección 4).
  if (m.tipo === 'blackjack') {
    return {
      id: m.id,
      tipo: m.tipo,
      label: m.label,
      activo: m.activo,
      orden: m.orden,
      icono: m.icono,
      color: m.color,
      detalle1: m.detalle1,
      detalle2: m.detalle2,
      mazos: m.mazos,
      pago_natural: m.pagoNatural,
      apuesta_min: m.apuestaMin,
      apuesta_max: m.apuestaMax,
      puestos: m.puestos,
      ventaja_casa: ventajaBlackjack(m.pagoNatural),
    };
  }
  return {
    id: m.id,
    tipo: m.tipo,
    label: m.label,
    rueda: m.rueda,
    rueda_label: m.ruedaLabel,
    casillas: m.casillas,
    doble_cero: m.dobleCero,
    animales: m.animales,
    rayos: m.rayos,
    pago_pleno: m.pagoPleno,
    activo: m.activo,
    orden: m.orden,
    icono: m.icono,
    color: m.color,
    detalle1: m.detalle1,
    detalle2: m.detalle2,
    ventaja_resto_mesa: ventajaMesa(m.casillas),
    ventaja_pleno: m.rayos
      ? ventajaPleno(settings, m.casillas).ventaja
      : ventajaPlenoClasico(m.casillas, m.pagoPleno),
  };
}

// ¿La tabla existe? Si el código se desplegó antes de correr la migración, el
// salón sigue andando con la red de seguridad, pero acá hay que avisar en
// castellano en vez de reventar con un error de SQL.
async function hayTabla(env) {
  try {
    await env.DB.prepare('SELECT id FROM games LIMIT 1').all();
    return true;
  } catch (e) {
    return false;
  }
}

const SIN_TABLA = 'Las mesas todavía no están en la base. Hay que correr la migración 011 '
  + '(wrangler d1 execute ruleta-db --remote --file=./migrations/011_mesas_del_salon.sql).';

export async function adminGames(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const settings = await getSettings(env);
  const cat = await catalogoInterno(env);

  // Cuántas rondas jugó cada mesa: una mesa con historial no se puede borrar
  // (su id quedó escrito en cada movimiento) y conviene que el dueño lo sepa.
  const jugadas = {};
  try {
    const r = await env.DB.prepare(
      "SELECT game_id, COUNT(*) AS n FROM transactions WHERE type = 'bet' GROUP BY game_id"
    ).all();
    for (const f of r.results || []) jugadas[f.game_id] = f.n;
  } catch (e) { /* sin historial, no pasa nada */ }

  return json({
    mesas: cat.map((m) => ({ ...conCuentas(m, settings), rondas: jugadas[m.id] || 0 })),
    ruedas: Object.entries(RUEDAS).map(([id, r]) => ({
      id, label: r.label, casillas: r.orden.length, doble_cero: r.dobleCero,
      ventaja_resto_mesa: ventajaMesa(r.orden.length),
    })),
    en_la_base: await hayTabla(env),
  });
}

export async function adminCreateGame(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;
  if (!(await hayTabla(env))) return json({ error: SIN_TABLA }, 409);

  const body = await readJson(request);
  const v = validarMesa(body, { creando: true });
  if (v.error) return json({ error: v.error }, 400);
  const m = v.mesa;

  const existe = await env.DB.prepare('SELECT id FROM games WHERE id = ?').bind(m.id).first();
  if (existe) return json({ error: `Ya hay una mesa con el id "${m.id}"` }, 400);

  // `rueda` y `pago_pleno` son obligatorias en la tabla porque nacieron con las
  // ruletas (migración 011). Una mesa de blackjack no tiene ni una ni otra, así
  // que van con el mismo relleno que usó la migración 012: 'blackjack' y 35.
  // No se leen nunca en una mesa de 21 — el tipo manda.
  const r = m.tipo === 'blackjack' ? { rueda: 'blackjack', pleno: 35, animales: 0, rayos: 0 }
                                   : { rueda: m.rueda, pleno: m.pago_pleno, animales: m.animales, rayos: m.rayos };
  await env.DB.prepare(
    `INSERT INTO games (id, label, tipo, rueda, animales, rayos, pago_pleno,
                        mazos, pago_natural, apuesta_min, apuesta_max, puestos,
                        activo, orden, icono, color, detalle1, detalle2)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(m.id, m.label, m.tipo, r.rueda, r.animales, r.rayos, r.pleno,
         m.mazos || null, m.pago_natural || null, m.apuesta_min || null, m.apuesta_max || null, m.puestos || null,
         m.activo, m.orden, m.icono, m.color, m.detalle1, m.detalle2).run();

  return adminGames(request, env);
}

export async function adminUpdateGame(request, env, id) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;
  if (!(await hayTabla(env))) return json({ error: SIN_TABLA }, 409);

  const actual = await env.DB.prepare('SELECT id, activo, tipo FROM games WHERE id = ?').bind(id).first();
  if (!actual) return json({ error: 'Esa mesa no existe' }, 404);

  const body = await readJson(request);
  const v = validarMesa(body, { creando: false });
  if (v.error) return json({ error: v.error }, 400);
  const m = v.mesa;

  // El TIPO no se cambia después de creada: la mesa ya tiene movimientos
  // anotados con su id, y una ruleta que de golpe pasa a ser blackjack deja
  // un historial que no se puede leer.
  const tipoActual = actual.tipo || 'ruleta';
  if (m.tipo !== tipoActual) {
    return json({
      error: `Esta mesa es de ${tipoActual} y así se queda. Si querés una mesa de `
        + `${m.tipo}, creá una nueva: el tipo no se cambia porque el historial quedaría mezclado.`,
    }, 400);
  }

  // Apagarla desde la edición cuenta igual que apagarla con el botón.
  if (actual.activo && !m.activo) {
    const err = await noDejarElSalonVacio(env, id);
    if (err) return json({ error: err }, 400);
  }

  // Mismo relleno que en el alta para las columnas que la tabla exige.
  const r = m.tipo === 'blackjack' ? { rueda: 'blackjack', pleno: 35, animales: 0, rayos: 0 }
                                   : { rueda: m.rueda, pleno: m.pago_pleno, animales: m.animales, rayos: m.rayos };
  await env.DB.prepare(
    `UPDATE games SET label = ?, rueda = ?, animales = ?, rayos = ?, pago_pleno = ?,
                      mazos = ?, pago_natural = ?, apuesta_min = ?, apuesta_max = ?, puestos = ?,
                      activo = ?, orden = ?, icono = ?, color = ?, detalle1 = ?, detalle2 = ?
      WHERE id = ?`
  ).bind(m.label, r.rueda, r.animales, r.rayos, r.pleno,
         m.mazos || null, m.pago_natural || null, m.apuesta_min || null, m.apuesta_max || null, m.puestos || null,
         m.activo, m.orden, m.icono, m.color, m.detalle1, m.detalle2, id).run();

  return adminGames(request, env);
}

// Encender o apagar. Es la operación de todos los días (Etapa 5: las mesas se
// encienden de a una, cada una después de verificar sus pagos), así que va
// aparte y no exige mandar la mesa entera.
export async function adminToggleGame(request, env, id) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;
  if (!(await hayTabla(env))) return json({ error: SIN_TABLA }, 409);

  const fila = await env.DB.prepare('SELECT id, activo FROM games WHERE id = ?').bind(id).first();
  if (!fila) return json({ error: 'Esa mesa no existe' }, 404);

  const body = await readJson(request);
  const encender = body.activo === undefined ? !fila.activo : !!body.activo;

  if (!encender) {
    const err = await noDejarElSalonVacio(env, id);
    if (err) return json({ error: err }, 400);
  }

  await env.DB.prepare('UPDATE games SET activo = ? WHERE id = ?').bind(encender ? 1 : 0, id).run();
  return adminGames(request, env);
}

// El salón no puede quedarse sin mesas: un jugador que entra y no encuentra
// dónde jugar es una caja cerrada.
async function noDejarElSalonVacio(env, idQueSeApaga) {
  const r = await env.DB.prepare(
    'SELECT COUNT(*) AS n FROM games WHERE activo = 1 AND id != ?'
  ).bind(idQueSeApaga).first();
  if (!r || r.n > 0) return null;
  return 'Es la única mesa encendida. Encendé otra primero: si se apagan todas, '
    + 'el salón queda sin dónde jugar.';
}
