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

// Cuánto le deja a la casa cada parte de la mesa, para que el dueño lo vea
// ANTES de encenderla. El resto de la mesa sale de la rueda; el pleno depende
// de si hay rayos.
function conCuentas(m, settings) {
  return {
    id: m.id,
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

  await env.DB.prepare(
    `INSERT INTO games (id, label, rueda, animales, rayos, pago_pleno, activo, orden,
                        icono, color, detalle1, detalle2)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(m.id, m.label, m.rueda, m.animales, m.rayos, m.pago_pleno, m.activo, m.orden,
         m.icono, m.color, m.detalle1, m.detalle2).run();

  return adminGames(request, env);
}

export async function adminUpdateGame(request, env, id) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;
  if (!(await hayTabla(env))) return json({ error: SIN_TABLA }, 409);

  const actual = await env.DB.prepare('SELECT id, activo FROM games WHERE id = ?').bind(id).first();
  if (!actual) return json({ error: 'Esa mesa no existe' }, 404);

  const body = await readJson(request);
  const v = validarMesa(body, { creando: false });
  if (v.error) return json({ error: v.error }, 400);
  const m = v.mesa;

  // Apagarla desde la edición cuenta igual que apagarla con el botón.
  if (actual.activo && !m.activo) {
    const err = await noDejarElSalonVacio(env, id);
    if (err) return json({ error: err }, 400);
  }

  await env.DB.prepare(
    `UPDATE games SET label = ?, rueda = ?, animales = ?, rayos = ?, pago_pleno = ?,
                      activo = ?, orden = ?, icono = ?, color = ?, detalle1 = ?, detalle2 = ?
      WHERE id = ?`
  ).bind(m.label, m.rueda, m.animales, m.rayos, m.pago_pleno, m.activo, m.orden,
         m.icono, m.color, m.detalle1, m.detalle2, id).run();

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
