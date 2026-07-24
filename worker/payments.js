// ════════════════════════════════════════════════════════════════════════
//  Cobros y pagos: recargas a la cuenta principal y retiros.
//
//  Recarga: el jugador transfiere, carga la referencia y queda pendiente
//  hasta que el dueño la verifica en el banco y la aprueba.
//
//  Retiro: el jugador lo pide, el saldo queda CONGELADO (held_balance) para
//  que no pueda jugarlo mientras espera, y el dueño decide si lo paga él o
//  se lo pasa a un taquillero (a quien se le repone el cupo).
// ════════════════════════════════════════════════════════════════════════

import {
  json, readJson, str, toPositiveInt, normalizeUsername,
  requireAuth, requireAdmin, getSettings, settingNum, validMethod,
  FX_METHODS, nowSql, checkMultiplo, redondearArriba,
} from './lib.js';
import { getUser } from './accounts.js';

// ─────────────────────────── Billetera del jugador ────────────────────────

// Datos que necesita la pantalla de billetera: a dónde pagar y los límites.
export async function walletInfo(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.response;

  const s = await getSettings(env);
  const user = await getUser(env, auth.userId);

  const requerido = Math.ceil((user.deposited_total || 0) * settingNum(s, 'wager_pct_required') / 100);
  const jugado = user.wagered_total || 0;

  return json({
    user,
    disponible: (user.balance || 0) - (user.held_balance || 0),
    cuentas: {
      pago_movil: s.bank_pago_movil,
      transferencia: s.bank_transferencia,
      zelle: s.bank_zelle,
      binance: s.bank_binance,
    },
    limites: {
      min_topup: settingNum(s, 'min_topup'),
      min_withdrawal: settingNum(s, 'min_withdrawal'),
      rate_usd: settingNum(s, 'rate_usd'),
      wager_pct_required: settingNum(s, 'wager_pct_required'),
      monto_multiplo: settingNum(s, 'monto_multiplo'),
    },
    juego: { requerido, jugado, falta: Math.max(0, requerido - jugado) },
  });
}

// El jugador informa una transferencia ya hecha.
export async function createTopup(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const method = validMethod(body.method);
  const reference = str(body.reference, 120);
  if (!method) return json({ error: 'Elegí cómo pagaste' }, 400);
  if (!reference) return json({ error: 'Poné el número de referencia de la transferencia' }, 400);

  const s = await getSettings(env);
  const esDivisa = FX_METHODS.includes(method);
  const rate = settingNum(s, 'rate_usd');
  const multiplo = settingNum(s, 'monto_multiplo');

  let amount;      // bolívares a acreditar
  let amountFx = null;

  if (esDivisa) {
    const fx = Number(body.amount_fx);
    if (!Number.isFinite(fx) || fx <= 0 || fx > 1e9) return json({ error: 'Monto en dólares inválido' }, 400);
    amountFx = Math.round(fx * 100) / 100;
    // La conversión rara vez cae redonda: se redondea para arriba y la
    // diferencia la pone la casa.
    amount = redondearArriba(Math.round(amountFx * rate), multiplo);
  } else {
    amount = toPositiveInt(body.amount);
    if (amount === null) return json({ error: 'Monto inválido' }, 400);
  }

  // El mínimo se avisa antes que el múltiplo: si el monto falla en las dos
  // cosas, saber cuánto es lo mínimo le sirve más al jugador.
  const min = settingNum(s, 'min_topup');
  if (amount < min) return json({ error: `La recarga mínima es ${min} Bs` }, 400);

  if (!esDivisa) {
    const err = checkMultiplo(amount, multiplo);
    if (err) return json({ error: err }, 400);
  }

  // Evita que se acumulen decenas de solicitudes repetidas.
  const pend = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM topups WHERE user_id = ? AND status = 'pending'"
  ).bind(auth.userId).first();
  if ((pend?.n || 0) >= 3) {
    return json({ error: 'Ya tenés 3 recargas esperando revisión. Esperá a que las aprobemos.' }, 400);
  }

  // La misma referencia no se puede reportar dos veces.
  const dup = await env.DB.prepare(
    "SELECT id FROM topups WHERE reference = ? AND status != 'rejected'"
  ).bind(reference).first();
  if (dup) return json({ error: 'Esa referencia ya fue reportada' }, 409);

  const res = await env.DB.prepare(
    `INSERT INTO topups (user_id, amount, currency, amount_fx, rate, method, reference, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    auth.userId, amount, esDivisa ? 'USD' : 'BS', amountFx, esDivisa ? rate : null,
    method, reference, str(body.note, 200)
  ).run();

  const topup = await env.DB.prepare('SELECT * FROM topups WHERE id = ?')
    .bind(res.meta.last_row_id).first();
  return json({ topup });
}

// El jugador pide un retiro: se valida y el saldo queda congelado.
export async function createWithdrawal(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const amount = toPositiveInt(body.amount);
  const method = validMethod(body.method);
  const destination = str(body.destination, 200);
  const cedula = str(body.cedula, 20);

  if (amount === null) return json({ error: 'Monto inválido' }, 400);
  if (!method) return json({ error: 'Elegí cómo querés cobrar' }, 400);
  if (!destination) return json({ error: 'Poné a dónde te mandamos la plata (teléfono, cuenta o correo)' }, 400);
  if (!cedula) return json({ error: 'Poné tu cédula: la necesitamos para pagarte' }, 400);

  const s = await getSettings(env);
  const min = settingNum(s, 'min_withdrawal');
  if (amount < min) return json({ error: `El retiro mínimo es ${min} Bs` }, 400);

  const multErr = checkMultiplo(amount, settingNum(s, 'monto_multiplo'));
  if (multErr) return json({ error: multErr }, 400);

  const user = await getUser(env, auth.userId);
  const disponible = (user.balance || 0) - (user.held_balance || 0);
  if (amount > disponible) {
    return json({ error: `Solo tenés ${disponible} Bs disponibles` }, 400);
  }

  // Regla anti casa-de-cambio: hay que haber jugado parte de lo recargado.
  const pct = settingNum(s, 'wager_pct_required');
  const requerido = Math.ceil((user.deposited_total || 0) * pct / 100);
  const jugado = user.wagered_total || 0;
  if (jugado < requerido) {
    return json({
      error: `Para retirar tenés que haber jugado al menos ${requerido} Bs (llevás ${jugado}). Te faltan ${requerido - jugado}.`,
    }, 400);
  }

  // Un retiro pendiente por vez: más simple para el jugador y para el cierre.
  const pend = await env.DB.prepare(
    "SELECT id FROM withdrawals WHERE user_id = ? AND status = 'pending'"
  ).bind(auth.userId).first();
  if (pend) return json({ error: 'Ya tenés un retiro esperando aprobación' }, 400);

  // Congelar el saldo con guardia: si no alcanza, no se toca nada.
  const hold = await env.DB.prepare(
    'UPDATE users SET held_balance = held_balance + ? WHERE id = ? AND balance - held_balance >= ?'
  ).bind(amount, auth.userId, amount).run();
  if (hold.meta.changes === 0) return json({ error: 'Saldo insuficiente' }, 400);

  try {
    const res = await env.DB.prepare(
      `INSERT INTO withdrawals (user_id, amount, method, destination, cedula, note)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).bind(auth.userId, amount, method, destination, cedula, str(body.note, 200)).run();

    // Se guardan los datos de cobro para que no los cargue de nuevo la próxima vez.
    await env.DB.prepare(
      'UPDATE users SET cedula = ?, payout_method = ?, payout_details = ? WHERE id = ?'
    ).bind(cedula, method, destination, auth.userId).run();

    const wd = await env.DB.prepare('SELECT * FROM withdrawals WHERE id = ?')
      .bind(res.meta.last_row_id).first();
    return json({ withdrawal: wd, user: await getUser(env, auth.userId) });
  } catch (err) {
    // Si no se pudo registrar, se descongela el saldo.
    await env.DB.prepare('UPDATE users SET held_balance = held_balance - ? WHERE id = ?')
      .bind(amount, auth.userId).run();
    throw err;
  }
}

// Historial propio del jugador: movimientos, recargas y retiros.
export async function walletHistory(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.response;

  const [txs, tops, wds] = await Promise.all([
    env.DB.prepare(
      `SELECT id, type, amount, note, created_at FROM transactions
        WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 60`
    ).bind(auth.userId).all(),
    env.DB.prepare(
      `SELECT id, amount, currency, amount_fx, rate, method, reference, status, note, created_at
         FROM topups WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 30`
    ).bind(auth.userId).all(),
    env.DB.prepare(
      `SELECT id, amount, method, destination, status, note, created_at, reviewed_at
         FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 30`
    ).bind(auth.userId).all(),
  ]);

  return json({
    transactions: txs.results || [],
    topups: tops.results || [],
    withdrawals: wds.results || [],
  });
}

// ─────────────────────────── Cola del dueño: recargas ─────────────────────

export async function adminTopups(request, env, url) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const status = str(url.searchParams.get('status'), 20) || 'pending';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500);

  const rows = await env.DB.prepare(
    `SELECT t.*, u.username, u.phone, r.username AS reviewer
       FROM topups t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN users r ON r.id = t.reviewed_by
      ${status === 'all' ? '' : 'WHERE t.status = ?'}
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT ?`
  ).bind(...(status === 'all' ? [limit] : [status, limit])).all();

  return json({ topups: rows.results || [] });
}

// Aprobar una recarga: acredita el saldo. El dueño puede corregir el monto
// final (por ejemplo si la transferencia llegó por otra cifra).
export async function adminApproveTopup(request, env, topupId) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const topup = await env.DB.prepare('SELECT * FROM topups WHERE id = ?').bind(topupId).first();
  if (!topup) return json({ error: 'Recarga no encontrada' }, 404);
  if (topup.status !== 'pending') return json({ error: `Esa recarga ya está ${topup.status === 'approved' ? 'aprobada' : 'rechazada'}` }, 409);

  let amount = topup.amount;
  if (body.amount !== undefined && body.amount !== null && body.amount !== '') {
    const a = toPositiveInt(body.amount);
    if (a === null) return json({ error: 'Monto inválido' }, 400);
    const s = await getSettings(env);
    const err = checkMultiplo(a, settingNum(s, 'monto_multiplo'));
    if (err) return json({ error: err }, 400);
    amount = a;
  }

  // Marcar primero con guardia: si otra pestaña ya la aprobó, no se duplica.
  const claim = await env.DB.prepare(
    `UPDATE topups SET status = 'approved', amount = ?, reviewed_by = ?, reviewed_at = ?, note = ?
      WHERE id = ? AND status = 'pending'`
  ).bind(amount, auth.userId, nowSql(), str(body.note, 200) || topup.note, topupId).run();
  if (claim.meta.changes === 0) return json({ error: 'Esa recarga ya fue procesada' }, 409);

  try {
    await env.DB.batch([
      env.DB.prepare(
        'UPDATE users SET balance = balance + ?, deposited_total = deposited_total + ? WHERE id = ?'
      ).bind(amount, amount, topup.user_id),
      env.DB.prepare(
        `INSERT INTO transactions (user_id, type, amount, note, actor_id, ref_id, source)
         VALUES (?, 'deposit', ?, ?, ?, ?, 'player')`
      ).bind(
        topup.user_id, amount,
        `Recarga ${topup.method} ref ${topup.reference}${topup.currency === 'USD' ? ` ($${topup.amount_fx} a ${topup.rate})` : ''}`,
        auth.userId, topupId
      ),
    ]);
  } catch (err) {
    await env.DB.prepare("UPDATE topups SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL WHERE id = ?")
      .bind(topupId).run();
    throw err;
  }

  return json({ ok: true, user: await getUser(env, topup.user_id) });
}

export async function adminRejectTopup(request, env, topupId) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const note = str(body.note, 200);
  if (!note) return json({ error: 'Poné el motivo del rechazo: el jugador lo va a ver' }, 400);

  const upd = await env.DB.prepare(
    `UPDATE topups SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, note = ?
      WHERE id = ? AND status = 'pending'`
  ).bind(auth.userId, nowSql(), note, topupId).run();

  if (upd.meta.changes === 0) return json({ error: 'Esa recarga ya fue procesada' }, 409);
  return json({ ok: true });
}

// ─────────────────────────── Cola del dueño: retiros ──────────────────────

export async function adminWithdrawals(request, env, url) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const status = str(url.searchParams.get('status'), 20) || 'pending';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500);

  const rows = await env.DB.prepare(
    `SELECT w.*, u.username, u.phone, u.balance, u.wagered_total, u.deposited_total,
            c.username AS cashier_username, r.username AS reviewer, p.username AS payer_username
       FROM withdrawals w
       JOIN users u ON u.id = w.user_id
       LEFT JOIN users c ON c.id = u.cashier_id
       LEFT JOIN users r ON r.id = w.reviewed_by
       LEFT JOIN users p ON p.id = w.payer_id
      ${status === 'all' ? '' : 'WHERE w.status = ?'}
      ORDER BY w.created_at DESC, w.id DESC
      LIMIT ?`
  ).bind(...(status === 'all' ? [limit] : [status, limit])).all();

  return json({ withdrawals: rows.results || [] });
}

// Marcar un retiro como pagado. `paid_by` decide de dónde salió la plata:
// 'owner' = de la cuenta principal, 'cashier' = lo pagó un taquillero y se
// le repone el mismo monto en cupo.
export async function adminPayWithdrawal(request, env, wdId) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const paidBy = String(body.paid_by || 'owner');
  if (!['owner', 'cashier'].includes(paidBy)) return json({ error: 'Indicá quién pagó' }, 400);

  const wd = await env.DB.prepare('SELECT * FROM withdrawals WHERE id = ?').bind(wdId).first();
  if (!wd) return json({ error: 'Retiro no encontrado' }, 404);
  if (wd.status !== 'pending') return json({ error: 'Ese retiro ya fue procesado' }, 409);

  let payer = null;
  if (paidBy === 'cashier') {
    const username = normalizeUsername(body.payer_username);
    if (!username) return json({ error: 'Elegí qué taquillero lo pagó' }, 400);
    payer = await env.DB.prepare(
      "SELECT id, username FROM users WHERE username = ? AND role = 'cashier'"
    ).bind(username).first();
    if (!payer) return json({ error: 'Taquillero no encontrado' }, 404);
  }

  // Reclamar el retiro primero: evita pagarlo dos veces desde dos pestañas.
  const claim = await env.DB.prepare(
    `UPDATE withdrawals SET status = 'paid', paid_by = ?, payer_id = ?, reviewed_by = ?, reviewed_at = ?, note = ?
      WHERE id = ? AND status = 'pending'`
  ).bind(paidBy, payer ? payer.id : null, auth.userId, nowSql(), str(body.note, 200) || wd.note, wdId).run();
  if (claim.meta.changes === 0) return json({ error: 'Ese retiro ya fue procesado' }, 409);

  try {
    const stmts = [
      // Se consume el saldo congelado: sale de balance y de held a la vez.
      env.DB.prepare(
        'UPDATE users SET balance = balance - ?, held_balance = held_balance - ? WHERE id = ?'
      ).bind(wd.amount, wd.amount, wd.user_id),
      env.DB.prepare(
        `INSERT INTO transactions (user_id, type, amount, note, actor_id, ref_id, source)
         VALUES (?, 'withdraw', ?, ?, ?, ?, 'player')`
      ).bind(
        wd.user_id, wd.amount,
        `Retiro ${wd.method} a ${wd.destination}${payer ? ` — pagó ${payer.username}` : ''}`,
        auth.userId, wdId
      ),
    ];
    if (payer) {
      // El taquillero puso la plata: se le devuelve en cupo.
      stmts.push(
        env.DB.prepare('UPDATE users SET credit_balance = credit_balance + ? WHERE id = ?')
          .bind(wd.amount, payer.id),
        env.DB.prepare(
          `INSERT INTO credit_ledger (cashier_id, type, amount, player_id, ref_id, note, actor_id)
           VALUES (?, 'withdrawal_refill', ?, ?, ?, ?, ?)`
        ).bind(payer.id, wd.amount, wd.user_id, wdId, `Pagó el retiro #${wdId}`, auth.userId)
      );
    }
    await env.DB.batch(stmts);
  } catch (err) {
    await env.DB.prepare(
      "UPDATE withdrawals SET status = 'pending', paid_by = NULL, payer_id = NULL, reviewed_by = NULL, reviewed_at = NULL WHERE id = ?"
    ).bind(wdId).run();
    throw err;
  }

  return json({ ok: true, user: await getUser(env, wd.user_id) });
}

// Rechazar un retiro: el saldo congelado vuelve a estar disponible.
export async function adminRejectWithdrawal(request, env, wdId) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const note = str(body.note, 200);
  if (!note) return json({ error: 'Poné el motivo del rechazo: el jugador lo va a ver' }, 400);

  const wd = await env.DB.prepare('SELECT * FROM withdrawals WHERE id = ?').bind(wdId).first();
  if (!wd) return json({ error: 'Retiro no encontrado' }, 404);

  const claim = await env.DB.prepare(
    `UPDATE withdrawals SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, note = ?
      WHERE id = ? AND status = 'pending'`
  ).bind(auth.userId, nowSql(), note, wdId).run();
  if (claim.meta.changes === 0) return json({ error: 'Ese retiro ya fue procesado' }, 409);

  await env.DB.prepare('UPDATE users SET held_balance = held_balance - ? WHERE id = ?')
    .bind(wd.amount, wd.user_id).run();

  return json({ ok: true, user: await getUser(env, wd.user_id) });
}
