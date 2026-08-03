// ════════════════════════════════════════════════════════════════════════
//  LA CAPA EJECUTIVA — matriz → ejecutivo → banquero → jugador.
//
//  El ejecutivo es el piso del medio: recibe fichas de la casa EN
//  CONSIGNACIÓN (no las paga por adelantado, como sí hace el banquero),
//  arma y maneja su red de banqueros, les cobra a ellos, y rinde cuentas con
//  la matriz cada tanto.
//
//  HASTA ACÁ VAN LAS ETAPAS 1 Y 2: el vínculo (qué banquero cuelga de qué
//  ejecutivo), la MIRADA (ve su red) y el ALTA (arma su red creando sus
//  propios banqueros). Todavía no se mueve una sola ficha ni existe la deuda:
//  eso llega en la etapa 3.
//
//  La regla que manda en este archivo: el ejecutivo VE a los jugadores de sus
//  banqueros pero NO les toca el saldo. Cargar y pagar sigue siendo del
//  banquero, que es quien pone la cara y la plata. Por eso acá no hay ni un
//  UPDATE sobre `balance`, y no lo tiene que haber nunca.
// ════════════════════════════════════════════════════════════════════════

import {
  json, readJson, toPositiveInt, requireAdmin, requireExec,
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
    'SELECT id, username, first_name, last_name, credit_balance, exec_limite FROM users WHERE id = ?'
  ).bind(quien.execId).first();

  return json({ ejecutivo: yo, banqueros, totales, como_dueño: !!quien.comoDueño });
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
  const r = await crearBanquero(env, body, {
    creadorId: auth.userId,
    execId: auth.userId,
    permiteRiesgo: false,
  });
  return r.error || json({ cashier: r.cashier });
}

// ──────────────────── Lo que hace el dueño con ellos ──────────────────────

// La lista de ejecutivos, para el PANEL MATRIZ.
export async function adminExecs(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const rows = await env.DB.prepare(
    `SELECT u.id, u.username, u.first_name, u.last_name, u.phone, u.status,
            u.credit_balance, u.commission_pct, u.exec_limite, u.created_at,
            COALESCE(b.banqueros, 0) AS banqueros
       FROM users u
       LEFT JOIN (SELECT exec_id, COUNT(*) AS banqueros
                    FROM users WHERE exec_id IS NOT NULL AND role = 'cashier'
                    GROUP BY exec_id) b ON b.exec_id = u.id
      WHERE u.role = 'exec'
      ORDER BY u.username`
  ).all();

  return json({ ejecutivos: rows.results || [] });
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

// El techo de exposición del ejecutivo: cuánto se le puede tener asignado sin
// rendir. Se guarda desde la etapa 1 aunque todavía no frene nada — el freno
// es de la etapa 3, cuando existan las fichas y la deuda.
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
