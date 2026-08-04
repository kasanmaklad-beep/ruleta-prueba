// ════════════════════════════════════════════════════════════════════════
//  LA CAPA EJECUTIVA — matriz → ejecutivo → banquero → jugador.
//
//  El ejecutivo es el piso del medio: recibe fichas de la casa EN
//  CONSIGNACIÓN (no las paga por adelantado, como sí hace el banquero),
//  arma y maneja su red de banqueros, les cobra a ellos, y rinde cuentas con
//  la matriz cada tanto.
//
//  Qué hay acá: el vínculo (qué banquero cuelga de qué ejecutivo), la MIRADA
//  (ve su red), el ALTA (crea sus propios banqueros) y LAS FICHAS con su
//  DEUDA — la casa se las entrega en consignación, él se las vende a sus
//  banqueros y le rinde a la casa. Ver el bloque LAS FICHAS Y LA DEUDA.
//
//  La regla que manda en este archivo: el ejecutivo VE a los jugadores de sus
//  banqueros pero NO les toca el saldo. Cargar y pagar sigue siendo del
//  banquero, que es quien pone la cara y la plata. Por eso acá no hay ni un
//  UPDATE sobre `balance`, y no lo tiene que haber nunca.
// ════════════════════════════════════════════════════════════════════════

import {
  json, readJson, str, toPositiveInt, normalizeUsername,
  requireAdmin, requireExec, getSettings, settingNum, checkMultiplo,
} from './lib.js';
// El alta de banquero es la MISMA que usa la matriz: una sola función, un solo
// juego de validaciones.
import { crearBanquero } from './accounts.js';

// A quién estoy mirando. El ejecutivo se mira a sí mismo; el dueño puede
// mirar a cualquiera pasando `?exec=<id>`, porque está por encima de él y si
// no tendría que pedirle la clave para ver su red.
async function aQuienMiro(request, env, url) {
  const auth = await requireExec(request, env);
  if (auth.error) return { error: auth.response };

  if (auth.role === 'admin') {
    const pedido = toPositiveInt(url && url.searchParams.get('exec'));
    if (pedido === null) {
      return { error: json({ error: 'Decí qué ejecutivo querés mirar' }, 400) };
    }
    const e = await env.DB.prepare(
      "SELECT id, username FROM users WHERE id = ? AND role = 'exec'"
    ).bind(pedido).first();
    if (!e) return { error: json({ error: 'Ese ejecutivo no existe' }, 404) };
    return { execId: e.id, username: e.username, comoDueño: true };
  }
  return { execId: auth.userId, username: auth.username, comoDueño: false };
}

// ─────────────────────── Lo que ve el ejecutivo ───────────────────────────

// Su red: cada banquero con su cupo y lo que movió.
export async function execSummary(request, env, url) {
  const quien = await aQuienMiro(request, env, url);
  if (quien.error) return quien.error;

  const rows = await env.DB.prepare(
    `SELECT u.id, u.username, u.first_name, u.last_name, u.phone, u.status,
            u.credit_balance, u.commission_pct, u.referral_code, u.created_at,
            COALESCE(l.cargado, 0)   AS total_cargado,
            COALESCE(j.jugadores, 0) AS jugadores
       FROM users u
       LEFT JOIN (SELECT cashier_id, SUM(-amount) AS cargado
                    FROM credit_ledger WHERE type = 'load' GROUP BY cashier_id) l ON l.cashier_id = u.id
       -- Ojo: acá se cuentan JUGADORES, así que se exige el rol. Sin eso, el
       -- día que algo más cuelgue de un banquero se contaría como jugador.
       LEFT JOIN (SELECT cashier_id, COUNT(*) AS jugadores
                    FROM users WHERE cashier_id IS NOT NULL AND role = 'player'
                    GROUP BY cashier_id) j ON j.cashier_id = u.id
      WHERE u.exec_id = ? AND u.role = 'cashier'
      ORDER BY u.username`
  ).bind(quien.execId).all();

  const banqueros = rows.results || [];

  // Los totales de la red, para no hacerlos sumar a mano en la pantalla.
  const totales = banqueros.reduce((t, b) => ({
    banqueros: t.banqueros + 1,
    jugadores: t.jugadores + (b.jugadores || 0),
    cupo: t.cupo + (b.credit_balance || 0),
    cargado: t.cargado + (b.total_cargado || 0),
  }), { banqueros: 0, jugadores: 0, cupo: 0, cargado: 0 });

  const yo = await env.DB.prepare(
    `SELECT id, username, first_name, last_name, credit_balance, exec_limite,
            commission_pct, exec_asalariado
       FROM users WHERE id = ?`
  ).bind(quien.execId).first();

  // La deuda es EL número del ejecutivo: lo que le debe a la casa ahora mismo.
  const cuenta = await deudaDe(env, quien.execId, yo && yo.commission_pct, yo && yo.exec_asalariado);

  // Sus últimos movimientos de fichas, para que pueda seguir su propia cuenta
  // sin depender de que el dueño le pase un papel.
  const movs = await env.DB.prepare(
    `SELECT id, type, amount, paid_amount, note, created_at
       FROM credit_ledger
      WHERE cashier_id = ? AND type IN ('exec_assign', 'exec_sale', 'exec_settle')
      ORDER BY created_at DESC, id DESC LIMIT 40`
  ).bind(quien.execId).all();

  return json({
    ejecutivo: yo,
    cuenta,
    movimientos: movs.results || [],
    banqueros,
    totales,
    como_dueño: !!quien.comoDueño,
  });
}

// Los jugadores de sus banqueros. SÓLO LECTURA: no hay forma de tocarles el
// saldo desde acá, ni siquiera para el dueño (para eso está el PANEL MATRIZ).
export async function execPlayers(request, env, url) {
  const quien = await aQuienMiro(request, env, url);
  if (quien.error) return quien.error;

  const rows = await env.DB.prepare(
    `SELECT j.id, j.username, j.first_name, j.last_name, j.status, j.balance,
            j.held_balance, j.created_at,
            b.username AS banquero,
            COALESCE(d.total, 0) AS total_recargado
       FROM users j
       JOIN users b ON b.id = j.cashier_id AND b.role = 'cashier' AND b.exec_id = ?
       LEFT JOIN (SELECT user_id, SUM(amount) AS total FROM transactions
                   WHERE type = 'deposit' GROUP BY user_id) d ON d.user_id = j.id
      WHERE j.role = 'player'
      ORDER BY j.created_at DESC
      LIMIT 300`
  ).bind(quien.execId).all();

  return json({ jugadores: rows.results || [] });
}

// ──────────────────── Lo que el ejecutivo SÍ puede hacer ──────────────────

// Crear un banquero suyo. Es la única operación de esta etapa que escribe algo:
// arma su red. El banquero nace colgado de él, sin que haya que asignarlo
// después.
//
// Usa la MISMA función de alta que la matriz (crearBanquero), no una copia:
// mismas validaciones de usuario, clave, documento y comisión. Con dos altas
// parecidas en dos archivos, en un mes se comportan distinto.
//
// Dos cosas que el ejecutivo NO decide, a propósito:
//  · la participación en la ganancia (`risk_share_pct`) queda en 0 — eso es
//    plata de la casa y la reparte la matriz, no él;
//  · nada del saldo de los jugadores, que sigue siendo del banquero.
export async function execCreateCashier(request, env) {
  const auth = await requireExec(request, env);
  if (auth.error) return auth.response;

  // El dueño no crea banqueros por acá: para eso tiene el PANEL MATRIZ, donde
  // además puede fijar la participación. Si entra por acá es por error, y es
  // mejor decírselo que dejarle un banquero colgado de nadie.
  if (auth.role === 'admin') {
    return json({
      error: 'Creá el banquero desde el PANEL MATRIZ: ahí podés elegir de qué ejecutivo cuelga.',
    }, 400);
  }

  const body = await readJson(request);

  // Freno contra el error que se paga caro: el banquero tiene que pagar MÁS
  // porcentaje que el que el ejecutivo le rinde a la casa. Si le pone igual o
  // menos, el ejecutivo trabaja gratis o pone plata de su bolsillo en cada
  // venta, y eso no se nota hasta que el mes cierra mal.
  const yo = await env.DB.prepare('SELECT commission_pct, exec_asalariado FROM users WHERE id = ?')
    .bind(auth.userId).first();
  const mio = (yo && yo.commission_pct) || 0;
  const suyo = Number(body.commission_pct);
  // A sueldo no hay margen que cuidar: todo lo que cobre es de la casa, así que
  // el porcentaje del banquero no puede dejarlo en pérdida.
  if (!(yo && yo.exec_asalariado) && Number.isFinite(suyo) && mio > 0 && suyo <= mio) {
    const por10k = Math.round(10000 * (suyo - mio) / 100);
    return json({
      error: `Con ${suyo}% ${suyo === mio ? 'no ganás nada' : `perdés ${-por10k}`} por cada 10.000 de fichas: `
           + `vos le rendís ${mio}% a la casa y él te pagaría ${suyo}%. Ponele un porcentaje mayor a ${mio}.`,
    }, 400);
  }

  const r = await crearBanquero(env, body, {
    creadorId: auth.userId,
    execId: auth.userId,
    permiteRiesgo: false,
  });
  return r.error || json({ cashier: r.cashier });
}

// ═══════════════════════ LAS FICHAS Y LA DEUDA ════════════════════════════
//
//  El ejecutivo NO compra sus fichas: la casa se las entrega EN CONSIGNACIÓN y
//  él rinde después. Ésa es la diferencia de fondo con el banquero, que paga
//  en el acto, y es la razón por la que acá aparece algo que en el resto del
//  sistema no existía: una DEUDA.
//
//  Cuándo nace la deuda: cuando el ejecutivo le VENDE cupo a un banquero. Ése
//  es el instante en que le entra plata al bolsillo —el banquero le paga en el
//  acto, igual que le pagaría a la casa—. Las fichas que todavía tiene sin
//  vender son de la casa, en su poder, y no las debe.
//
//      deuda = Σ(fichas vendidas × su porcentaje) − Σ(lo que rindió)
//
//  `commission_pct` del ejecutivo es EL PORCENTAJE QUE ÉL PAGA sobre el valor
//  de las fichas, igual que en el banquero. Tiene que ser MENOR que el de sus
//  banqueros: si el banquero paga 20% y el ejecutivo rinde 15%, al ejecutivo
//  le quedan 5 de cada 100 de valor vendido. Si fuera al revés, el ejecutivo
//  pondría plata de su bolsillo en cada venta.
//
//  Los tres movimientos nuevos van al MISMO libro que ya existe
//  (`credit_ledger`), con `cashier_id` = el ejecutivo:
//    exec_assign  la casa le entrega fichas   (amount +, sin pago)
//    exec_sale    le vende cupo a un banquero (amount −, y genera deuda)
//    exec_settle  rinde plata a la casa       (amount 0, paid_amount = lo pagado)
// ══════════════════════════════════════════════════════════════════════════

// Cuánto debe HOY. Sale del libro, no de una columna guardada: una columna hay
// que acordarse de actualizarla en todos lados y el día que alguien olvide un
// caso, el número miente sin avisar. Esto siempre cuadra con los movimientos.
async function deudaDe(env, execId, commissionPct, asalariado) {
  const r = await env.DB.prepare(
    `SELECT
       COALESCE(SUM(CASE WHEN type = 'exec_sale'   THEN -amount END), 0) AS vendido,
       COALESCE(SUM(CASE WHEN type = 'exec_sale'   THEN paid_amount END), 0) AS cobrado,
       COALESCE(SUM(CASE WHEN type = 'exec_settle' THEN paid_amount END), 0) AS rendido
     FROM credit_ledger WHERE cashier_id = ?`
  ).bind(execId).first();

  const vendido = (r && r.vendido) || 0;   // valor nominal de las fichas
  const cobrado = (r && r.cobrado) || 0;   // lo que le pagaron sus banqueros
  const rendido = (r && r.rendido) || 0;   // lo que ya le entregó a la casa

  // A SUELDO: no gana por venta, así que debe TODO lo que cobró. Se suma lo
  // que efectivamente le pagaron y no un porcentaje del nominal — más exacto,
  // porque cada banquero puede pagar un porcentaje distinto.
  // POR COMISIÓN: debe su porcentaje del valor vendido y se queda con la
  // diferencia de lo que cobró.
  const generada = asalariado
    ? cobrado
    : Math.round(vendido * ((commissionPct || 0) / 100));

  return {
    vendido, cobrado, rendido, generada,
    asalariado: !!asalariado,
    deuda: Math.max(0, generada - rendido),
    // Lo que le queda a él. A sueldo es cero por definición.
    margen: asalariado ? 0 : cobrado - generada,
  };
}

// ── El ejecutivo le vende cupo a uno de SUS banqueros ─────────────────────
//
// Es la operación donde se mueve todo: le salen fichas al ejecutivo, le entran
// al banquero, el banquero le paga en el acto, y al ejecutivo le nace la deuda
// con la casa por esas fichas.
//
// El descuento va con GUARDIA en la misma instrucción
// (`WHERE credit_balance >= ?`) y no leyendo primero y restando después: entre
// una lectura y una escritura pueden entrar dos ventas a la vez y dejar al
// ejecutivo con fichas negativas. Es el mismo candado que usa el giro de la
// ruleta para el saldo del jugador.
export async function execVenderCupo(request, env) {
  const auth = await requireExec(request, env);
  if (auth.error) return auth.response;
  if (auth.role === 'admin') {
    return json({ error: 'Esta venta la hace el ejecutivo con sus fichas. Desde la matriz, usá VENDER CUPO en BANQUEROS.' }, 400);
  }

  const body = await readJson(request);
  const username = normalizeUsername(body.username);
  const amount = toPositiveInt(body.amount);
  if (!username) return json({ error: 'Falta el banquero' }, 400);
  if (amount === null) return json({ error: 'Monto de cupo inválido' }, 400);

  const s = await getSettings(env);
  const multErr = checkMultiplo(amount, settingNum(s, 'monto_multiplo'));
  if (multErr) return json({ error: multErr }, 400);

  // Sólo a los SUYOS. Sin esta condición un ejecutivo podría venderle al
  // banquero de otro y ensuciarle la cuenta a los dos.
  const banquero = await env.DB.prepare(
    "SELECT id, username, commission_pct, status FROM users WHERE username = ? AND role = 'cashier' AND exec_id = ?"
  ).bind(username, auth.userId).first();
  if (!banquero) {
    return json({ error: `${username} no es un banquero tuyo.` }, 404);
  }
  if (banquero.status === 'blocked') {
    return json({ error: `${banquero.username} está bloqueado.` }, 400);
  }

  // Lo que el banquero le paga, con SU porcentaje.
  let paid;
  if (body.paid_amount === undefined || body.paid_amount === null || body.paid_amount === '') {
    paid = Math.round(amount * ((banquero.commission_pct || 0) / 100));
  } else {
    const p = Number(body.paid_amount);
    if (!Number.isInteger(p) || p < 0 || p > amount) {
      return json({ error: 'Lo pagado tiene que ser un entero entre 0 y el cupo entregado' }, 400);
    }
    paid = p;
  }

  // Descuento con guardia: si no le alcanzan las fichas, no pasa nada.
  const bajada = await env.DB.prepare(
    'UPDATE users SET credit_balance = credit_balance - ? WHERE id = ? AND credit_balance >= ?'
  ).bind(amount, auth.userId, amount).run();
  if (bajada.meta.changes === 0) {
    const yo = await env.DB.prepare('SELECT credit_balance FROM users WHERE id = ?')
      .bind(auth.userId).first();
    return json({
      error: `No te alcanzan las fichas: tenés ${(yo && yo.credit_balance) || 0} y querés entregar ${amount}. Pedile a la matriz.`,
      fichas: (yo && yo.credit_balance) || 0,
    }, 400);
  }

  // Ya se descontó: de acá en más el resto tiene que quedar anotado sí o sí.
  await env.DB.batch([
    env.DB.prepare('UPDATE users SET credit_balance = credit_balance + ? WHERE id = ?')
      .bind(amount, banquero.id),
    // La salida del ejecutivo: es la que genera su deuda con la casa.
    env.DB.prepare(
      `INSERT INTO credit_ledger (cashier_id, type, amount, paid_amount, player_id, note, actor_id)
       VALUES (?, 'exec_sale', ?, ?, ?, ?, ?)`
    ).bind(auth.userId, -amount, paid, banquero.id,
           str(body.note, 200) || `Cupo a ${banquero.username}`, auth.userId),
    // La entrada del banquero: el MISMO tipo 'purchase' de siempre, para que
    // su banca y sus reportes no noten la diferencia de quién se lo vendió.
    env.DB.prepare(
      `INSERT INTO credit_ledger (cashier_id, type, amount, paid_amount, note, actor_id)
       VALUES (?, 'purchase', ?, ?, ?, ?)`
    ).bind(banquero.id, amount, paid,
           str(body.note, 200) || `Venta de cupo (${auth.username})`, auth.userId),
  ]);

  const yo = await env.DB.prepare(
    'SELECT credit_balance, commission_pct, exec_asalariado FROM users WHERE id = ?'
  ).bind(auth.userId).first();
  const info = await deudaDe(env, auth.userId, yo.commission_pct, yo.exec_asalariado);

  return json({
    ok: true,
    banquero: banquero.username,
    entregado: amount,
    cobraste: paid,
    fichas: yo.credit_balance,
    ...info,
  });
}

// ──────────────────── Lo que hace el dueño con ellos ──────────────────────

// La lista de ejecutivos, para el PANEL MATRIZ.
export async function adminExecs(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  // La deuda de todos en UNA consulta y no una por ejecutivo: con diez
  // ejecutivos serían once viajes a la base para dibujar una tabla.
  const rows = await env.DB.prepare(
    `SELECT u.id, u.username, u.first_name, u.last_name, u.phone, u.status,
            u.credit_balance, u.commission_pct, u.exec_limite, u.created_at,
            u.exec_asalariado,
            COALESCE(b.banqueros, 0) AS banqueros,
            COALESCE(v.vendido, 0)   AS vendido,
            COALESCE(v.cobrado, 0)   AS cobrado,
            COALESCE(v.rendido, 0)   AS rendido
       FROM users u
       LEFT JOIN (SELECT exec_id, COUNT(*) AS banqueros
                    FROM users WHERE exec_id IS NOT NULL AND role = 'cashier'
                    GROUP BY exec_id) b ON b.exec_id = u.id
       LEFT JOIN (SELECT cashier_id,
                         COALESCE(SUM(CASE WHEN type = 'exec_sale'   THEN -amount END), 0) AS vendido,
                         COALESCE(SUM(CASE WHEN type = 'exec_sale'   THEN paid_amount END), 0) AS cobrado,
                         COALESCE(SUM(CASE WHEN type = 'exec_settle' THEN paid_amount END), 0) AS rendido
                    FROM credit_ledger GROUP BY cashier_id) v ON v.cashier_id = u.id
      WHERE u.role = 'exec'
      ORDER BY u.username`
  ).all();

  // La misma fórmula que deudaDe(), acá aplicada a la lista entera: a sueldo
  // debe todo lo que cobró; por comisión, su porcentaje de lo vendido.
  const ejecutivos = (rows.results || []).map((e) => {
    const generada = e.exec_asalariado
      ? (e.cobrado || 0)
      : Math.round((e.vendido || 0) * ((e.commission_pct || 0) / 100));
    return { ...e, generada, deuda: Math.max(0, generada - (e.rendido || 0)) };
  });

  return json({ ejecutivos });
}

// Colgar un banquero de un ejecutivo, o devolverlo a la matriz con exec = null.
export async function adminSetExec(request, env, cashierId) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);

  const banquero = await env.DB.prepare(
    'SELECT id, username, role FROM users WHERE id = ?'
  ).bind(cashierId).first();
  if (!banquero) return json({ error: 'Usuario no encontrado' }, 404);
  if (banquero.role !== 'cashier') {
    return json({ error: `${banquero.username} no es banquero.` }, 400);
  }

  // `exec_id: null` lo devuelve a la matriz. Es una operación legítima y hay
  // que poder hacerla: si un ejecutivo se va, sus banqueros no pueden quedar
  // colgando de una cuenta que ya no existe.
  const crudo = body.exec_id;
  if (crudo === null || crudo === '' || crudo === undefined) {
    await env.DB.prepare('UPDATE users SET exec_id = NULL WHERE id = ?').bind(cashierId).run();
    return json({ ok: true, exec_id: null });
  }

  const execId = toPositiveInt(crudo);
  if (execId === null) return json({ error: 'Ejecutivo inválido' }, 400);
  if (execId === Number(cashierId)) {
    return json({ error: 'Nadie puede colgar de sí mismo' }, 400);
  }

  const ejec = await env.DB.prepare(
    "SELECT id, username, status FROM users WHERE id = ? AND role = 'exec'"
  ).bind(execId).first();
  if (!ejec) return json({ error: 'Ese ejecutivo no existe' }, 404);
  if (ejec.status === 'blocked') {
    return json({ error: `${ejec.username} está bloqueado: no se le pueden asignar banqueros.` }, 400);
  }

  await env.DB.prepare('UPDATE users SET exec_id = ? WHERE id = ?')
    .bind(execId, cashierId).run();
  return json({ ok: true, exec_id: execId, ejecutivo: ejec.username });
}

// ── La casa le entrega fichas (consignación) ──────────────────────────────
// No cobra nada acá: por eso `paid_amount` va en NULL y no en 0. Un 0 diría
// "se cobró cero", que es una afirmación; NULL dice "acá no se cobra", que es
// la verdad. La diferencia importa el día que alguien sume la columna.
export async function adminAsignarFichas(request, env, execId) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const amount = toPositiveInt(body.amount);
  if (amount === null) return json({ error: 'Monto de fichas inválido' }, 400);

  const s = await getSettings(env);
  const multErr = checkMultiplo(amount, settingNum(s, 'monto_multiplo'));
  if (multErr) return json({ error: multErr }, 400);

  const ejec = await env.DB.prepare(
    `SELECT id, username, status, commission_pct, exec_limite, credit_balance, exec_asalariado
       FROM users WHERE id = ? AND role = 'exec'`
  ).bind(execId).first();
  if (!ejec) return json({ error: 'Ese ejecutivo no existe' }, 404);
  if (ejec.status === 'blocked') {
    return json({ error: `${ejec.username} está bloqueado.` }, 400);
  }

  // EL TECHO. Frena de verdad: mientras deba lo que acordaron, no recibe más
  // hasta que rinda. Es lo que evita que una deuda crezca sin que nadie mire.
  const { deuda } = await deudaDe(env, ejec.id, ejec.commission_pct, ejec.exec_asalariado);
  if (ejec.exec_limite > 0 && deuda >= ejec.exec_limite) {
    return json({
      error: `${ejec.username} debe ${deuda} y su techo es ${ejec.exec_limite}. `
           + 'No se le puede entregar más hasta que rinda.',
      deuda, techo: ejec.exec_limite,
    }, 400);
  }

  await env.DB.batch([
    env.DB.prepare('UPDATE users SET credit_balance = credit_balance + ? WHERE id = ?')
      .bind(amount, ejec.id),
    env.DB.prepare(
      `INSERT INTO credit_ledger (cashier_id, type, amount, paid_amount, note, actor_id)
       VALUES (?, 'exec_assign', ?, NULL, ?, ?)`
    ).bind(ejec.id, amount, str(body.note, 200) || `Entrega en consignación (${auth.username})`, auth.userId),
  ]);

  const info = await deudaDe(env, ejec.id, ejec.commission_pct, ejec.exec_asalariado);
  const actualizado = await env.DB.prepare(
    'SELECT credit_balance FROM users WHERE id = ?'
  ).bind(ejec.id).first();
  return json({ ok: true, fichas: actualizado.credit_balance, ...info });
}

// ── El ejecutivo rinde plata a la casa ────────────────────────────────────
// Lo registra el DUEÑO, no el ejecutivo: es el que recibe la plata quien dice
// que la recibió. Al revés, el ejecutivo podría bajarse la deuda solo.
export async function adminRendicion(request, env, execId) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const pago = toPositiveInt(body.amount);
  if (pago === null) return json({ error: 'Monto inválido' }, 400);

  const ejec = await env.DB.prepare(
    "SELECT id, username, commission_pct, exec_asalariado FROM users WHERE id = ? AND role = 'exec'"
  ).bind(execId).first();
  if (!ejec) return json({ error: 'Ese ejecutivo no existe' }, 404);

  const antes = await deudaDe(env, ejec.id, ejec.commission_pct, ejec.exec_asalariado);
  if (pago > antes.deuda) {
    return json({
      error: `${ejec.username} debe ${antes.deuda}. No se puede registrar un pago mayor que la deuda.`,
      deuda: antes.deuda,
    }, 400);
  }

  await env.DB.prepare(
    `INSERT INTO credit_ledger (cashier_id, type, amount, paid_amount, note, actor_id)
     VALUES (?, 'exec_settle', 0, ?, ?, ?)`
  ).bind(ejec.id, pago, str(body.note, 200) || `Rendición recibida (${auth.username})`, auth.userId).run();

  const despues = await deudaDe(env, ejec.id, ejec.commission_pct, ejec.exec_asalariado);
  return json({ ok: true, ...despues });
}

// Cómo cobra el ejecutivo: a sueldo o por comisión.
//
// NO alcanzaba con ponerle 0% de comisión, y por eso existe esta casilla: la
// deuda se calcula como "vendido × su porcentaje", así que con 0 le daba CERO
// —cobraba lo del banquero y no le debía nada a nadie—, que es justo al revés
// de lo que significa estar a sueldo.
export async function adminSetExecPago(request, env, execId) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const asalariado = body.asalariado === true || body.asalariado === 1 ? 1 : 0;

  const ejec = await env.DB.prepare(
    "SELECT id, username FROM users WHERE id = ? AND role = 'exec'"
  ).bind(execId).first();
  if (!ejec) return json({ error: 'Ese ejecutivo no existe' }, 404);

  await env.DB.prepare('UPDATE users SET exec_asalariado = ? WHERE id = ?')
    .bind(asalariado, execId).run();

  return json({ ok: true, asalariado: !!asalariado });
}

// El techo de exposición del ejecutivo: cuánto se le puede tener asignado sin
// rendir. Cuando la deuda lo alcanza, adminAsignarFichas() frena la entrega.
export async function adminSetExecLimite(request, env, execId) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const limite = Number(body.exec_limite);
  if (!Number.isFinite(limite) || limite < 0 || !Number.isInteger(limite)) {
    return json({ error: 'El techo tiene que ser un número entero de 0 para arriba (0 = sin techo)' }, 400);
  }

  const ejec = await env.DB.prepare(
    "SELECT id FROM users WHERE id = ? AND role = 'exec'"
  ).bind(execId).first();
  if (!ejec) return json({ error: 'Ese ejecutivo no existe' }, 404);

  await env.DB.prepare('UPDATE users SET exec_limite = ? WHERE id = ?')
    .bind(limite, execId).run();
  return json({ ok: true, exec_limite: limite });
}

// El JUGADOR no sabe que esta capa existe y no tiene por qué saberlo: sigue
// tratando con su banquero y con nadie más. Por eso acá no hay ni un endpoint
// que él pueda llamar.
