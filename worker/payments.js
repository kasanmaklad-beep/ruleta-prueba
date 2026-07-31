// ════════════════════════════════════════════════════════════════════════
//  Cobros y pagos — modelo franquicia.
//
//  Cada jugador tiene una "ventanilla": su socio, si está afiliado, o la
//  casa si entró solo. Las recargas y retiros van a la cola de ESA
//  ventanilla (topups.cashier_id / withdrawals.cashier_id; NULL = casa).
//
//  · Recarga de afiliado: el jugador le paga a su socio, el socio verifica
//    y aprueba → las fichas salen del CUPO del socio.
//  · Retiro de afiliado: lo paga el socio de su bolsillo → las fichas
//    vuelven a su cupo (no son reembolsables a la casa: las revende).
//  · Jugadores directos: mismo circuito de siempre, con la casa.
//
//  Esta versión maneja SOLO bolívares. El método P2P existe para quien paga
//  en divisas por fuera: lo que se registra es el monto acordado en la moneda
//  de la casa (ver DEFAULT_SETTINGS.moneda).
// ════════════════════════════════════════════════════════════════════════

import {
  json, readJson, str, toPositiveInt, normalizeUsername,
  requireAuth, requireAdmin, requireCashier, getSettings, settingNum,
  validMethod, nowSql, checkMultiplo, normalizeDocumento,
  pagosManuales, plata,
} from './lib.js';
import { getUser } from './accounts.js';

// ─────────────────────────── Billetera del jugador ────────────────────────

// Datos que necesita la pantalla de billetera: a quién pagarle y los límites.
export async function walletInfo(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.response;

  const s = await getSettings(env);
  const user = await getUser(env, auth.userId);

  // Si tiene socio, la plata entra y sale por él.
  let socio = null;
  if (user.cashier_id) {
    const srow = await env.DB.prepare(
      `SELECT username, first_name, last_name, collect_details, payout_details, bank, phone
         FROM users WHERE id = ? AND role = 'cashier'`
    ).bind(user.cashier_id).first();
    if (srow) {
      socio = {
        username: srow.username,
        nombre: [srow.first_name, srow.last_name].filter(Boolean).join(' ') || srow.username,
        datos: srow.collect_details || srow.payout_details
          || `${srow.bank || ''} ${srow.phone || ''}`.trim(),
      };
    }
  }

  const requerido = Math.ceil((user.deposited_total || 0) * settingNum(s, 'wager_pct_required') / 100);
  const jugado = user.wagered_total || 0;

  const manual = pagosManuales(s);

  return json({
    user,
    socio,
    // Con la casa en modo manual el teléfono del jugador no necesita —ni debe
    // recibir— los datos bancarios de nadie: la plata se mueve en la mano.
    pagos_manuales: manual,
    disponible: (user.balance || 0) - (user.held_balance || 0),
    cuentas: (socio || manual) ? null : {
      pago_movil: s.bank_pago_movil,
      transferencia: s.bank_transferencia,
      p2p: s.bank_p2p,
    },
    limites: {
      min_topup: settingNum(s, 'min_topup'),
      min_withdrawal: settingNum(s, 'min_withdrawal'),
      wager_pct_required: settingNum(s, 'wager_pct_required'),
      monto_multiplo: settingNum(s, 'monto_multiplo'),
    },
    juego: { requerido, jugado, falta: Math.max(0, requerido - jugado) },
  });
}

// El jugador informa una transferencia ya hecha. Cae en la cola de su
// ventanilla: su socio si está afiliado, la casa si no.
export async function createTopup(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const s = await getSettings(env);

  // Con la casa en modo manual el jugador no reporta pagos por la app: la
  // plata entra en la mano del taquillero. Se frena acá y no sólo en la
  // pantalla — si no, bastaría con llamar a la API a mano para meter una
  // recarga inventada esperando aprobación.
  if (pagosManuales(s)) {
    return json({
      error: 'Las recargas son en efectivo: hablá con tu taquillero y él te carga el saldo.',
    }, 400);
  }

  const method = validMethod(body.method);
  const reference = str(body.reference, 120);
  if (!method) return json({ error: 'Elegí cómo pagaste' }, 400);
  if (!reference) return json({ error: 'Poné el número de referencia del pago' }, 400);
  const amount = toPositiveInt(body.amount);
  if (amount === null) return json({ error: 'Monto inválido' }, 400);

  const min = settingNum(s, 'min_topup');
  if (amount < min) return json({ error: `La recarga mínima es ${plata(min, s)}` }, 400);

  const multErr = checkMultiplo(amount, settingNum(s, 'monto_multiplo'));
  if (multErr) return json({ error: multErr }, 400);

  // Evita que se acumulen decenas de solicitudes repetidas.
  const pend = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM topups WHERE user_id = ? AND status = 'pending'"
  ).bind(auth.userId).first();
  if ((pend?.n || 0) >= 3) {
    return json({ error: 'Ya tenés 3 recargas esperando revisión. Esperá a que las aprueben.' }, 400);
  }

  // La misma referencia no se puede reportar dos veces.
  const dup = await env.DB.prepare(
    "SELECT id FROM topups WHERE reference = ? AND status != 'rejected'"
  ).bind(reference).first();
  if (dup) return json({ error: 'Esa referencia ya fue reportada' }, 409);

  const u = await env.DB.prepare('SELECT cashier_id FROM users WHERE id = ?')
    .bind(auth.userId).first();

  const res = await env.DB.prepare(
    `INSERT INTO topups (user_id, amount, method, reference, note, cashier_id)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).bind(auth.userId, amount, method, reference, str(body.note, 200), u?.cashier_id || null).run();

  const topup = await env.DB.prepare('SELECT * FROM topups WHERE id = ?')
    .bind(res.meta.last_row_id).first();
  return json({ topup });
}

// El jugador pide un retiro: se valida y el saldo queda congelado.
export async function createWithdrawal(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const s = await getSettings(env);
  const manual = pagosManuales(s);

  const amount = toPositiveInt(body.amount);
  // En efectivo el destino es la taquilla, no una cuenta: el pedido queda
  // igual anotado (quién pidió cuánto y cuándo), que es lo que hace falta para
  // cuadrar la caja después.
  const method = manual ? 'efectivo' : validMethod(body.method);
  const destination = manual ? 'Efectivo en taquilla' : str(body.destination, 200);

  if (amount === null) return json({ error: 'Monto inválido' }, 400);
  if (!method) return json({ error: 'Elegí cómo querés cobrar' }, 400);
  if (!destination) return json({ error: 'Poné a dónde te mandamos la plata (teléfono, cuenta o usuario P2P)' }, 400);
  const min = settingNum(s, 'min_withdrawal');
  if (amount < min) return json({ error: `El retiro mínimo es ${plata(min, s)}` }, 400);

  const multErr = checkMultiplo(amount, settingNum(s, 'monto_multiplo'));
  if (multErr) return json({ error: multErr }, 400);

  const user = await getUser(env, auth.userId);
  const disponible = (user.balance || 0) - (user.held_balance || 0);
  if (amount > disponible) {
    return json({ error: `Solo tenés ${plata(disponible, s)} disponibles` }, 400);
  }

  // Regla anti casa-de-cambio: hay que haber jugado parte de lo recargado.
  const pct = settingNum(s, 'wager_pct_required');
  const requerido = Math.ceil((user.deposited_total || 0) * pct / 100);
  const jugado = user.wagered_total || 0;
  if (jugado < requerido) {
    return json({
      error: `Para retirar tenés que haber jugado al menos ${plata(requerido, s)} (llevás ${plata(jugado, s)}). `
        + `Te faltan ${plata(requerido - jugado, s)}.`,
    }, 400);
  }

  // Un retiro pendiente por vez.
  const pend = await env.DB.prepare(
    "SELECT id FROM withdrawals WHERE user_id = ? AND status = 'pending'"
  ).bind(auth.userId).first();
  if (pend) return json({ error: 'Ya tenés un retiro esperando aprobación' }, 400);

  // El documento es el de la cuenta. Las cuentas viejas sin documento lo
  // cargan acá una única vez.
  let cedula = user.cedula;
  if (!cedula) {
    const doc = normalizeDocumento(body.doc_type, body.cedula);
    if (!doc) return json({ error: 'Poné tu documento (por ejemplo V-12345678)' }, 400);
    const dup = await env.DB.prepare('SELECT id FROM users WHERE cedula = ? AND id != ?')
      .bind(doc.documento, auth.userId).first();
    if (dup) return json({ error: 'Ya hay otra cuenta registrada con ese documento' }, 409);
    cedula = doc.documento;
    await env.DB.prepare('UPDATE users SET cedula = ?, doc_type = ? WHERE id = ?')
      .bind(doc.documento, doc.doc_type, auth.userId).run();
  }

  // Congelar el saldo con guardia: si no alcanza, no se toca nada.
  const hold = await env.DB.prepare(
    'UPDATE users SET held_balance = held_balance + ? WHERE id = ? AND balance - held_balance >= ?'
  ).bind(amount, auth.userId, amount).run();
  if (hold.meta.changes === 0) return json({ error: 'Saldo insuficiente' }, 400);

  try {
    const res = await env.DB.prepare(
      `INSERT INTO withdrawals (user_id, amount, method, destination, cedula, note, cashier_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(auth.userId, amount, method, destination, cedula, str(body.note, 200),
           user.cashier_id || null).run();

    // Se guardan los datos de cobro para la próxima vez.
    await env.DB.prepare(
      'UPDATE users SET payout_method = ?, payout_details = ? WHERE id = ?'
    ).bind(method, destination, auth.userId).run();

    const wd = await env.DB.prepare('SELECT * FROM withdrawals WHERE id = ?')
      .bind(res.meta.last_row_id).first();
    return json({ withdrawal: wd, user: await getUser(env, auth.userId) });
  } catch (err) {
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
      `SELECT id, amount, method, reference, status, note, created_at
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

// ═════════════════════ Ventanilla del SOCIO: recargas ═════════════════════

export async function cashierTopups(request, env, url) {
  const auth = await requireCashier(request, env);
  if (auth.error) return auth.response;

  const status = str(url.searchParams.get('status'), 20) || 'pending';
  const rows = await env.DB.prepare(
    `SELECT t.*, u.username, u.phone, u.first_name, u.last_name
       FROM topups t JOIN users u ON u.id = t.user_id
      WHERE t.cashier_id = ? ${status === 'all' ? '' : 'AND t.status = ?'}
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT 100`
  ).bind(...(status === 'all' ? [auth.userId] : [auth.userId, status])).all();

  return json({ topups: rows.results || [] });
}

// El socio aprueba la recarga de su afiliado: verifica que la plata le llegó
// y acredita. Las fichas salen de SU cupo.
export async function cashierApproveTopup(request, env, topupId) {
  const auth = await requireCashier(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const topup = await env.DB.prepare('SELECT * FROM topups WHERE id = ?').bind(topupId).first();
  if (!topup || topup.cashier_id !== auth.userId) {
    return json({ error: 'Esa recarga no es de tus afiliados' }, 404);
  }
  if (topup.status !== 'pending') return json({ error: 'Esa recarga ya fue procesada' }, 409);

  let amount = topup.amount;
  if (body.amount !== undefined && body.amount !== null && body.amount !== '') {
    const a = toPositiveInt(body.amount);
    if (a === null) return json({ error: 'Monto inválido' }, 400);
    const s = await getSettings(env);
    const err = checkMultiplo(a, settingNum(s, 'monto_multiplo'));
    if (err) return json({ error: err }, 400);
    amount = a;
  }

  // Reclamar primero (evita aprobar dos veces desde dos pestañas).
  const claim = await env.DB.prepare(
    `UPDATE topups SET status = 'approved', amount = ?, reviewed_by = ?, reviewed_at = ?
      WHERE id = ? AND status = 'pending'`
  ).bind(amount, auth.userId, nowSql(), topupId).run();
  if (claim.meta.changes === 0) return json({ error: 'Esa recarga ya fue procesada' }, 409);

  // Descontar del cupo con guardia.
  const debit = await env.DB.prepare(
    `UPDATE users SET credit_balance = credit_balance - ?
      WHERE id = ? AND role = 'cashier' AND credit_balance >= ?`
  ).bind(amount, auth.userId, amount).run();
  if (debit.meta.changes === 0) {
    await env.DB.prepare(
      "UPDATE topups SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL, amount = ? WHERE id = ?"
    ).bind(topup.amount, topupId).run();
    const cur = await env.DB.prepare('SELECT credit_balance FROM users WHERE id = ?')
      .bind(auth.userId).first();
    return json({
      error: `No te alcanza el cupo: tenés ${cur ? cur.credit_balance : 0} y esta recarga es de ${amount}. Comprale fichas a la casa.`,
    }, 400);
  }

  try {
    await env.DB.batch([
      env.DB.prepare(
        'UPDATE users SET balance = balance + ?, deposited_total = deposited_total + ? WHERE id = ?'
      ).bind(amount, amount, topup.user_id),
      env.DB.prepare(
        `INSERT INTO transactions (user_id, type, amount, note, actor_id, ref_id, source)
         VALUES (?, 'deposit', ?, ?, ?, ?, 'cashier')`
      ).bind(topup.user_id, amount,
             `Recarga ${topup.method} ref ${topup.reference} (socio ${auth.username})`,
             auth.userId, topupId),
      env.DB.prepare(
        `INSERT INTO credit_ledger (cashier_id, type, amount, player_id, ref_id, note, actor_id)
         VALUES (?, 'load', ?, ?, ?, ?, ?)`
      ).bind(auth.userId, -amount, topup.user_id, topupId,
             `Recarga aprobada ref ${topup.reference}`, auth.userId),
    ]);
  } catch (err) {
    await env.DB.prepare('UPDATE users SET credit_balance = credit_balance + ? WHERE id = ?')
      .bind(amount, auth.userId).run();
    await env.DB.prepare(
      "UPDATE topups SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL, amount = ? WHERE id = ?"
    ).bind(topup.amount, topupId).run();
    throw err;
  }

  const [player, self] = await Promise.all([
    env.DB.prepare('SELECT id, username, balance FROM users WHERE id = ?').bind(topup.user_id).first(),
    env.DB.prepare('SELECT credit_balance FROM users WHERE id = ?').bind(auth.userId).first(),
  ]);
  return json({ ok: true, player, credit_balance: self ? self.credit_balance : 0 });
}

export async function cashierRejectTopup(request, env, topupId) {
  const auth = await requireCashier(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const note = str(body.note, 200);
  if (!note) return json({ error: 'Poné el motivo del rechazo: el jugador lo va a ver' }, 400);

  const upd = await env.DB.prepare(
    `UPDATE topups SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, note = ?
      WHERE id = ? AND cashier_id = ? AND status = 'pending'`
  ).bind(auth.userId, nowSql(), note, topupId, auth.userId).run();

  if (upd.meta.changes === 0) return json({ error: 'Esa recarga no está pendiente o no es tuya' }, 409);
  return json({ ok: true });
}

// ═════════════════════ Ventanilla del SOCIO: retiros ══════════════════════

export async function cashierWithdrawals(request, env, url) {
  const auth = await requireCashier(request, env);
  if (auth.error) return auth.response;

  const status = str(url.searchParams.get('status'), 20) || 'pending';
  const rows = await env.DB.prepare(
    `SELECT w.*, u.username, u.phone, u.first_name, u.last_name, u.bank,
            u.wagered_total, u.deposited_total
       FROM withdrawals w JOIN users u ON u.id = w.user_id
      WHERE w.cashier_id = ? ${status === 'all' ? '' : 'AND w.status = ?'}
      ORDER BY w.created_at DESC, w.id DESC
      LIMIT 100`
  ).bind(...(status === 'all' ? [auth.userId] : [auth.userId, status])).all();

  return json({ withdrawals: rows.results || [] });
}

// El socio pagó el retiro de su bolsillo: las fichas vuelven a su cupo
// (no son reembolsables a la casa: las revende a sus jugadores).
export async function cashierPayWithdrawal(request, env, wdId) {
  const auth = await requireCashier(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const wd = await env.DB.prepare('SELECT * FROM withdrawals WHERE id = ?').bind(wdId).first();
  if (!wd || wd.cashier_id !== auth.userId) {
    return json({ error: 'Ese retiro no es de tus afiliados' }, 404);
  }
  if (wd.status !== 'pending') return json({ error: 'Ese retiro ya fue procesado' }, 409);

  const claim = await env.DB.prepare(
    `UPDATE withdrawals SET status = 'paid', paid_by = 'cashier', payer_id = ?,
            reviewed_by = ?, reviewed_at = ?, note = ?
      WHERE id = ? AND status = 'pending'`
  ).bind(auth.userId, auth.userId, nowSql(), str(body.note, 200) || wd.note, wdId).run();
  if (claim.meta.changes === 0) return json({ error: 'Ese retiro ya fue procesado' }, 409);

  try {
    await env.DB.batch([
      env.DB.prepare(
        'UPDATE users SET balance = balance - ?, held_balance = held_balance - ? WHERE id = ?'
      ).bind(wd.amount, wd.amount, wd.user_id),
      env.DB.prepare(
        `INSERT INTO transactions (user_id, type, amount, note, actor_id, ref_id, source)
         VALUES (?, 'withdraw', ?, ?, ?, ?, 'cashier')`
      ).bind(wd.user_id, wd.amount,
             `Retiro ${wd.method} a ${wd.destination} — pagó socio ${auth.username}`,
             auth.userId, wdId),
      env.DB.prepare('UPDATE users SET credit_balance = credit_balance + ? WHERE id = ?')
        .bind(wd.amount, auth.userId),
      env.DB.prepare(
        `INSERT INTO credit_ledger (cashier_id, type, amount, player_id, ref_id, note, actor_id)
         VALUES (?, 'withdrawal_refill', ?, ?, ?, ?, ?)`
      ).bind(auth.userId, wd.amount, wd.user_id, wdId, `Pagó el retiro #${wdId}`, auth.userId),
    ]);
  } catch (err) {
    await env.DB.prepare(
      "UPDATE withdrawals SET status = 'pending', paid_by = NULL, payer_id = NULL, reviewed_by = NULL, reviewed_at = NULL WHERE id = ?"
    ).bind(wdId).run();
    throw err;
  }

  const self = await env.DB.prepare('SELECT credit_balance FROM users WHERE id = ?')
    .bind(auth.userId).first();
  return json({ ok: true, credit_balance: self ? self.credit_balance : 0 });
}

export async function cashierRejectWithdrawal(request, env, wdId) {
  const auth = await requireCashier(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const note = str(body.note, 200);
  if (!note) return json({ error: 'Poné el motivo del rechazo: el jugador lo va a ver' }, 400);

  const wd = await env.DB.prepare('SELECT * FROM withdrawals WHERE id = ?').bind(wdId).first();
  if (!wd || wd.cashier_id !== auth.userId) {
    return json({ error: 'Ese retiro no es de tus afiliados' }, 404);
  }

  const claim = await env.DB.prepare(
    `UPDATE withdrawals SET status = 'rejected', reviewed_by = ?, reviewed_at = ?, note = ?
      WHERE id = ? AND status = 'pending'`
  ).bind(auth.userId, nowSql(), note, wdId).run();
  if (claim.meta.changes === 0) return json({ error: 'Ese retiro ya fue procesado' }, 409);

  await env.DB.prepare('UPDATE users SET held_balance = held_balance - ? WHERE id = ?')
    .bind(wd.amount, wd.user_id).run();
  return json({ ok: true });
}

// Los datos de pago que el socio muestra a sus afiliados al recargar.
export async function cashierSetCollectInfo(request, env) {
  const auth = await requireCashier(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const details = str(body.details, 500);
  if (!details) return json({ error: 'Escribí tus datos de cobro' }, 400);

  await env.DB.prepare('UPDATE users SET collect_details = ? WHERE id = ?')
    .bind(details, auth.userId).run();
  return json({ ok: true, collect_details: details });
}

// ═════════════════════ Cola de la CASA (jugadores directos) ═══════════════

export async function adminTopups(request, env, url) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const status = str(url.searchParams.get('status'), 20) || 'pending';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500);

  const rows = await env.DB.prepare(
    `SELECT t.*, u.username, u.phone, u.first_name, u.last_name,
            r.username AS reviewer, sc.username AS socio_username
       FROM topups t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN users r ON r.id = t.reviewed_by
       LEFT JOIN users sc ON sc.id = t.cashier_id
      ${status === 'all' ? '' : 'WHERE t.status = ?'}
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT ?`
  ).bind(...(status === 'all' ? [limit] : [status, limit])).all();

  return json({ topups: rows.results || [] });
}

// La casa solo aprueba recargas de sus jugadores directos. Las de afiliados
// las aprueba el socio: acreditarlas desde acá regalaría fichas que el socio
// nunca compró.
export async function adminApproveTopup(request, env, topupId) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const topup = await env.DB.prepare(
    `SELECT t.*, sc.username AS socio_username
       FROM topups t LEFT JOIN users sc ON sc.id = t.cashier_id
      WHERE t.id = ?`
  ).bind(topupId).first();
  if (!topup) return json({ error: 'Recarga no encontrada' }, 404);
  if (topup.cashier_id) {
    return json({ error: `Esa recarga la maneja el socio ${topup.socio_username}: solo él puede aprobarla (vos podés rechazarla si hace falta).` }, 400);
  }
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
      ).bind(topup.user_id, amount, `Recarga ${topup.method} ref ${topup.reference}`,
             auth.userId, topupId),
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

export async function adminWithdrawals(request, env, url) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const status = str(url.searchParams.get('status'), 20) || 'pending';
  const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500);

  const rows = await env.DB.prepare(
    `SELECT w.*, u.username, u.phone, u.balance, u.wagered_total, u.deposited_total,
            u.first_name, u.last_name, u.bank,
            r.username AS reviewer, p.username AS payer_username,
            sc.username AS socio_username
       FROM withdrawals w
       JOIN users u ON u.id = w.user_id
       LEFT JOIN users r ON r.id = w.reviewed_by
       LEFT JOIN users p ON p.id = w.payer_id
       LEFT JOIN users sc ON sc.id = w.cashier_id
      ${status === 'all' ? '' : 'WHERE w.status = ?'}
      ORDER BY w.created_at DESC, w.id DESC
      LIMIT ?`
  ).bind(...(status === 'all' ? [limit] : [status, limit])).all();

  return json({ withdrawals: rows.results || [] });
}

// La casa paga los retiros de SUS jugadores directos. Los de afiliados los
// paga su socio (y a él le vuelven las fichas al cupo).
export async function adminPayWithdrawal(request, env, wdId) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const wd = await env.DB.prepare(
    `SELECT w.*, sc.username AS socio_username
       FROM withdrawals w LEFT JOIN users sc ON sc.id = w.cashier_id
      WHERE w.id = ?`
  ).bind(wdId).first();
  if (!wd) return json({ error: 'Retiro no encontrado' }, 404);
  if (wd.cashier_id) {
    return json({ error: `Ese retiro lo paga el socio ${wd.socio_username} (vos podés rechazarlo si hace falta).` }, 400);
  }
  if (wd.status !== 'pending') return json({ error: 'Ese retiro ya fue procesado' }, 409);

  const paidBy = String(body.paid_by || 'owner');
  if (!['owner', 'cashier'].includes(paidBy)) return json({ error: 'Indicá quién pagó' }, 400);

  let payer = null;
  if (paidBy === 'cashier') {
    const username = normalizeUsername(body.payer_username);
    if (!username) return json({ error: 'Elegí qué socio lo pagó' }, 400);
    payer = await env.DB.prepare(
      "SELECT id, username FROM users WHERE username = ? AND role = 'cashier'"
    ).bind(username).first();
    if (!payer) return json({ error: 'Socio no encontrado' }, 404);
  }

  const claim = await env.DB.prepare(
    `UPDATE withdrawals SET status = 'paid', paid_by = ?, payer_id = ?, reviewed_by = ?, reviewed_at = ?, note = ?
      WHERE id = ? AND status = 'pending'`
  ).bind(paidBy, payer ? payer.id : null, auth.userId, nowSql(), str(body.note, 200) || wd.note, wdId).run();
  if (claim.meta.changes === 0) return json({ error: 'Ese retiro ya fue procesado' }, 409);

  try {
    const stmts = [
      env.DB.prepare(
        'UPDATE users SET balance = balance - ?, held_balance = held_balance - ? WHERE id = ?'
      ).bind(wd.amount, wd.amount, wd.user_id),
      env.DB.prepare(
        `INSERT INTO transactions (user_id, type, amount, note, actor_id, ref_id, source)
         VALUES (?, 'withdraw', ?, ?, ?, ?, 'player')`
      ).bind(wd.user_id, wd.amount,
             `Retiro ${wd.method} a ${wd.destination}${payer ? ` — pagó ${payer.username}` : ''}`,
             auth.userId, wdId),
    ];
    if (payer) {
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

// Rechazar un retiro: el saldo congelado vuelve. La casa puede rechazar
// cualquiera (también de afiliados: es la válvula de emergencia).
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
