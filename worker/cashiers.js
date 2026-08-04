// ════════════════════════════════════════════════════════════════════════
//  Banqueros y cupo prepago.
//
//  El dueño le vende cupo al banquero. `commission_pct` es EL PORCENTAJE QUE
//  EL BANQUERO PAGA sobre el valor de las fichas: con 20, paga 2.000 y recibe
//  cupo por 10.000. La diferencia (8.000) es su margen, y la casa la cobra por
//  adelantado en el momento de la venta.
//
//  OJO: este encabezado decía antes "paga 9.000 y recibe 10.000", que es el
//  reparto inverso y NO es lo que hace el código. Se corrigió el 03/08/2026
//  después de que el dueño confirmara que el número es lo que el banquero
//  paga. Si alguna vez el comentario y la cuenta vuelven a discrepar, la
//  cuenta manda y el comentario está mal.
//
//  Después el banquero carga saldo a sus jugadores y cada carga le descuenta
//  del cupo, así que nunca puede cargar más de lo que ya pagó.
// ════════════════════════════════════════════════════════════════════════

import {
  json, readJson, str, toPositiveInt, normalizeUsername,
  requireAdmin, requireCashier, VE_OFFSET, todayVE,
  getSettings, settingNum, checkMultiplo,
} from './lib.js';
import { getUser } from './accounts.js';

// ─────────────────────────── Panel del dueño ──────────────────────────────

// Lista de banqueros con su cupo actual y lo que movieron.
export async function adminCashiers(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const rows = await env.DB.prepare(
    `SELECT u.id, u.username, u.phone, u.status, u.credit_balance, u.commission_pct, u.created_at,
            u.first_name, u.last_name, u.referral_code, u.cedula, u.bank, u.risk_share_pct,
            u.exec_id,
            COALESCE(p.comprado, 0)   AS cupo_comprado,
            COALESCE(p.pagado, 0)     AS total_pagado,
            COALESCE(l.cargado, 0)    AS total_cargado,
            COALESCE(j.jugadores, 0)  AS jugadores
       FROM users u
       LEFT JOIN (SELECT cashier_id, SUM(amount) AS comprado, SUM(COALESCE(paid_amount, 0)) AS pagado
                    FROM credit_ledger WHERE type = 'purchase' GROUP BY cashier_id) p ON p.cashier_id = u.id
       LEFT JOIN (SELECT cashier_id, SUM(-amount) AS cargado
                    FROM credit_ledger WHERE type = 'load' GROUP BY cashier_id) l ON l.cashier_id = u.id
       LEFT JOIN (SELECT cashier_id, COUNT(*) AS jugadores
                    FROM users WHERE cashier_id IS NOT NULL GROUP BY cashier_id) j ON j.cashier_id = u.id
      WHERE u.role = 'cashier'
      ORDER BY u.username`
  ).all();

  const cashiers = (rows.results || []).map((c) => ({
    ...c,
    // Lo que ganó el banquero: la diferencia entre el cupo que recibió y lo que pagó.
    comision_generada: (c.cupo_comprado || 0) - (c.total_pagado || 0),
  }));
  return json({ cashiers });
}

// Venta de cupo. `amount` es el cupo que recibe; `paid_amount` lo que pagó.
export async function adminSellCredit(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const username = normalizeUsername(body.username);
  const amount = toPositiveInt(body.amount);
  if (!username) return json({ error: 'Falta el banquero' }, 400);
  if (amount === null) return json({ error: 'Monto de cupo inválido' }, 400);

  // El cupo entregado va en cifras redondas; lo que el banquero pagó no,
  // porque ahí manda la comisión (10% de 5.000 son 4.500, pero 7% son 4.650).
  const s = await getSettings(env);
  const multErr = checkMultiplo(amount, settingNum(s, 'monto_multiplo'));
  if (multErr) return json({ error: multErr }, 400);

  const cashier = await env.DB.prepare(
    'SELECT id, username, role, commission_pct FROM users WHERE username = ?'
  ).bind(username).first();
  if (!cashier) return json({ error: 'Usuario no encontrado' }, 404);
  if (cashier.role !== 'cashier') return json({ error: `${cashier.username} no es banquero. Cambiale el rol primero.` }, 400);

  // Si no dicen cuánto pagó, se calcula con su porcentaje: el banquero paga el
  // commission_pct% del valor de las fichas (típico: 20% → 10.000 por 2.000).
  let paid;
  if (body.paid_amount === undefined || body.paid_amount === null || body.paid_amount === '') {
    paid = Math.round(amount * ((cashier.commission_pct || 0) / 100));
  } else {
    const p = Number(body.paid_amount);
    if (!Number.isInteger(p) || p < 0 || p > amount) {
      return json({ error: 'Lo pagado tiene que ser un entero entre 0 y el cupo entregado' }, 400);
    }
    paid = p;
  }

  await env.DB.batch([
    env.DB.prepare('UPDATE users SET credit_balance = credit_balance + ? WHERE id = ?')
      .bind(amount, cashier.id),
    env.DB.prepare(
      `INSERT INTO credit_ledger (cashier_id, type, amount, paid_amount, note, actor_id)
       VALUES (?, 'purchase', ?, ?, ?, ?)`
    ).bind(cashier.id, amount, paid, str(body.note, 200) || `Venta de cupo (${auth.username})`, auth.userId),
  ]);

  const updated = await getUser(env, cashier.id);
  return json({
    cashier: updated,
    comision: amount - paid,
  });
}

// Ajuste de cupo a mano (corrección de errores). Puede ser negativo.
export async function adminAdjustCredit(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const username = normalizeUsername(body.username);
  const amount = Number(body.amount);
  const note = str(body.note, 200);

  if (!username) return json({ error: 'Falta el banquero' }, 400);
  if (!Number.isInteger(amount) || amount === 0) return json({ error: 'Monto inválido' }, 400);
  if (!note) return json({ error: 'Poné el motivo del ajuste' }, 400);

  const cashier = await env.DB.prepare(
    "SELECT id, username, credit_balance FROM users WHERE username = ? AND role = 'cashier'"
  ).bind(username).first();
  if (!cashier) return json({ error: 'Banquero no encontrado' }, 404);
  if (amount < 0 && cashier.credit_balance + amount < 0) {
    return json({ error: `Ese banquero solo tiene ${cashier.credit_balance} de cupo` }, 400);
  }

  await env.DB.batch([
    env.DB.prepare('UPDATE users SET credit_balance = credit_balance + ? WHERE id = ?')
      .bind(amount, cashier.id),
    env.DB.prepare(
      `INSERT INTO credit_ledger (cashier_id, type, amount, note, actor_id)
       VALUES (?, 'adjust', ?, ?, ?)`
    ).bind(cashier.id, amount, `${note} (${auth.username})`, auth.userId),
  ]);

  return json({ cashier: await getUser(env, cashier.id) });
}

// Movimientos de cupo de un banquero (o de todos si no se indica).
export async function adminCreditLedger(request, env, url) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const cashierId = Number(url.searchParams.get('cashier_id')) || null;
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500);

  const rows = await env.DB.prepare(
    `SELECT l.*, c.username AS cashier_username, p.username AS player_username
       FROM credit_ledger l
       JOIN users c ON c.id = l.cashier_id
       LEFT JOIN users p ON p.id = l.player_id
      ${cashierId ? 'WHERE l.cashier_id = ?' : ''}
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT ?`
  ).bind(...(cashierId ? [cashierId, limit] : [limit])).all();

  return json({ ledger: rows.results || [] });
}

// ─────────────────────────── Panel del banquero ─────────────────────────

// Carga de saldo a un jugador descontando del cupo.
export async function cashierLoad(request, env) {
  const auth = await requireCashier(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const username = normalizeUsername(body.username);
  const amount = toPositiveInt(body.amount);
  const note = str(body.note, 200);
  if (!username) return json({ error: 'Falta el jugador' }, 400);
  if (amount === null) return json({ error: 'Monto inválido' }, 400);

  const settings = await getSettings(env);
  const multErr = checkMultiplo(amount, settingNum(settings, 'monto_multiplo'));
  if (multErr) return json({ error: multErr }, 400);

  const player = await env.DB.prepare(
    'SELECT id, username, role, status FROM users WHERE username = ?'
  ).bind(username).first();
  if (!player) return json({ error: 'Ese jugador no existe' }, 404);
  if (player.id === auth.userId) return json({ error: 'No podés cargarte saldo a vos mismo' }, 400);
  if (player.role !== 'player') return json({ error: `${player.username} no es un jugador` }, 400);
  if (player.status === 'blocked') return json({ error: 'Esa cuenta está bloqueada' }, 400);

  // El dueño no gasta cupo: carga directo desde la casa.
  const usaCupo = auth.role === 'cashier';

  if (usaCupo) {
    // Descuento del cupo con guardia: si no alcanza, no se toca nada.
    const debit = await env.DB.prepare(
      `UPDATE users SET credit_balance = credit_balance - ?
        WHERE id = ? AND role = 'cashier' AND credit_balance >= ?`
    ).bind(amount, auth.userId, amount).run();

    if (debit.meta.changes === 0) {
      const cur = await env.DB.prepare('SELECT credit_balance FROM users WHERE id = ?')
        .bind(auth.userId).first();
      return json({
        error: `No te alcanza el cupo. Tenés ${cur ? cur.credit_balance : 0} y querés cargar ${amount}.`,
        credit_balance: cur ? cur.credit_balance : 0,
      }, 400);
    }
  }

  try {
    const stmts = [
      env.DB.prepare(
        'UPDATE users SET balance = balance + ?, deposited_total = deposited_total + ? WHERE id = ?'
      ).bind(amount, amount, player.id),
      env.DB.prepare(
        `INSERT INTO transactions (user_id, type, amount, note, actor_id, source)
         VALUES (?, 'deposit', ?, ?, ?, ?)`
      ).bind(
        player.id, amount,
        note || (usaCupo ? `Carga de banca (${auth.username})` : `Carga de la casa (${auth.username})`),
        auth.userId, usaCupo ? 'cashier' : 'admin'
      ),
      // El jugador queda asociado al primer banquero que le cargó.
      env.DB.prepare('UPDATE users SET cashier_id = ? WHERE id = ? AND cashier_id IS NULL')
        .bind(auth.userId, player.id),
    ];
    if (usaCupo) {
      stmts.push(env.DB.prepare(
        `INSERT INTO credit_ledger (cashier_id, type, amount, player_id, note, actor_id)
         VALUES (?, 'load', ?, ?, ?, ?)`
      ).bind(auth.userId, -amount, player.id, note || `Carga a ${player.username}`, auth.userId));
    }
    await env.DB.batch(stmts);
  } catch (err) {
    // Si la carga falló después de descontar, se devuelve el cupo.
    if (usaCupo) {
      await env.DB.prepare('UPDATE users SET credit_balance = credit_balance + ? WHERE id = ?')
        .bind(amount, auth.userId).run();
    }
    throw err;
  }

  const updatedPlayer = await env.DB.prepare(
    'SELECT id, username, balance FROM users WHERE id = ?'
  ).bind(player.id).first();
  const self = await env.DB.prepare('SELECT credit_balance FROM users WHERE id = ?')
    .bind(auth.userId).first();

  return json({
    player: updatedPlayer,
    credit_balance: self ? self.credit_balance : 0,
  });
}

// Resumen del banquero: su cupo, lo que cargó hoy y sus jugadores.
export async function cashierSummary(request, env) {
  const auth = await requireCashier(request, env);
  if (auth.error) return auth.response;

  const self = await getUser(env, auth.userId);

  const hoy = await env.DB.prepare(
    `SELECT COUNT(*) AS cargas, COALESCE(SUM(-amount), 0) AS total
       FROM credit_ledger
      WHERE cashier_id = ? AND type = 'load'
        AND date(created_at, ?) = ?`
  ).bind(auth.userId, VE_OFFSET, todayVE()).first();

  const players = await env.DB.prepare(
    `SELECT u.id, u.username, u.balance, u.held_balance, u.phone, u.status, u.created_at,
            u.first_name, u.last_name, u.affiliated_at,
            COALESCE(d.total, 0) AS total_recargado
       FROM users u
       LEFT JOIN (SELECT user_id, SUM(amount) AS total FROM transactions
                   WHERE type = 'deposit' GROUP BY user_id) d ON d.user_id = u.id
      WHERE u.cashier_id = ?
      ORDER BY u.created_at DESC
      LIMIT 200`
  ).bind(auth.userId).all();

  const movs = await env.DB.prepare(
    `SELECT l.id, l.type, l.amount, l.paid_amount, l.note, l.created_at,
            p.username AS player_username
       FROM credit_ledger l
       LEFT JOIN users p ON p.id = l.player_id
      WHERE l.cashier_id = ?
      ORDER BY l.created_at DESC, l.id DESC
      LIMIT 50`
  ).bind(auth.userId).all();

  // Pendientes en su ventanilla y umbral del aviso de cupo bajo.
  const [pend, settings] = await Promise.all([
    env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM topups      WHERE cashier_id = ?1 AND status = 'pending') AS recargas,
         (SELECT COUNT(*) FROM withdrawals WHERE cashier_id = ?1 AND status = 'pending') AS retiros,
         (SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE cashier_id = ?1 AND status = 'pending') AS retiros_monto`
    ).bind(auth.userId).first(),
    getSettings(env),
  ]);

  return json({
    cashier: self,
    hoy: { cargas: hoy?.cargas || 0, total: hoy?.total || 0 },
    pendientes: {
      recargas: pend?.recargas || 0,
      retiros: pend?.retiros || 0,
      retiros_monto: pend?.retiros_monto || 0,
    },
    cupo_alert: settingNum(settings, 'cupo_alert'),
    players: players.results || [],
    ledger: movs.results || [],
  });
}
