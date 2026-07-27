// ════════════════════════════════════════════════════════════════════════
//  Reportes del negocio.
//
//  El día cierra con el calendario de Venezuela (UTC-4): la base guarda
//  todo en UTC, así que cada consulta desplaza 4 horas antes de agrupar.
//
//  Dos números distintos que conviene no mezclar:
//   · CAJA  = recargas − retiros  → plata real que entró o salió del bolsillo.
//   · JUEGO = apostado − premios  → lo que la ruleta le ganó a los jugadores.
// ════════════════════════════════════════════════════════════════════════

import {
  json, str, requireAdmin, VE_OFFSET, todayVE, getSettings, settingNum, JUEGOS,
} from './lib.js';

// Mesa por la que se está filtrando, si se pidió una. Devuelve null cuando
// hay que mostrar todo junto (que es lo normal).
function gameFilter(url) {
  const g = str(url.searchParams.get('game'), 40);
  if (!g || g === 'todos') return null;
  return JUEGOS[g] ? g : null;
}

// Rango de fechas pedido, con tope de un año para no barrer la base entera.
function dateRange(url, defaultDays = 30) {
  const to = str(url.searchParams.get('to'), 10) || todayVE();
  let from = str(url.searchParams.get('from'), 10);
  if (!from) {
    const d = new Date(`${to}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - (defaultDays - 1));
    from = d.toISOString().slice(0, 10);
  }
  return { from, to };
}

// ─────────────────────────── Tablero principal ────────────────────────────

// Lo que se ve al entrar al panel: pendientes por resolver y el día de hoy.
export async function adminSummary(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const hoy = todayVE();

  const [pend, dia, totales, cupo] = await Promise.all([
    env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM topups      WHERE status = 'pending' AND cashier_id IS NULL) AS recargas_pendientes,
         (SELECT COUNT(*) FROM withdrawals WHERE status = 'pending' AND cashier_id IS NULL) AS retiros_pendientes,
         (SELECT COALESCE(SUM(amount), 0) FROM withdrawals WHERE status = 'pending' AND cashier_id IS NULL) AS retiros_pendientes_monto,
         (SELECT COUNT(*) FROM topups      WHERE status = 'pending' AND cashier_id IS NOT NULL) AS recargas_socios,
         (SELECT COUNT(*) FROM withdrawals WHERE status = 'pending' AND cashier_id IS NOT NULL) AS retiros_socios`
    ).first(),
    env.DB.prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'deposit'  THEN amount END), 0) AS recargas,
         COALESCE(SUM(CASE WHEN type = 'withdraw' THEN amount END), 0) AS retiros,
         COALESCE(SUM(CASE WHEN type = 'bet'      THEN amount END), 0) AS apostado,
         COALESCE(SUM(CASE WHEN type = 'win'      THEN amount END), 0) AS premios,
         COUNT(CASE WHEN type = 'bet' THEN 1 END)                      AS giros,
         COUNT(DISTINCT CASE WHEN type = 'bet' THEN user_id END)       AS jugadores
       FROM transactions WHERE date(created_at, ?) = ?`
    ).bind(VE_OFFSET, hoy).first(),
    env.DB.prepare(
      `SELECT
         (SELECT COUNT(*) FROM users WHERE role = 'player')  AS jugadores,
         (SELECT COUNT(*) FROM users WHERE role = 'cashier') AS socios,
         (SELECT COALESCE(SUM(balance), 0)      FROM users WHERE role = 'player') AS saldo_jugadores,
         (SELECT COALESCE(SUM(held_balance), 0) FROM users WHERE role = 'player') AS saldo_congelado`
    ).first(),
    env.DB.prepare(
      "SELECT COALESCE(SUM(credit_balance), 0) AS cupo_en_calle FROM users WHERE role = 'cashier'"
    ).first(),
  ]);

  return json({
    fecha: hoy,
    pendientes: pend,
    hoy: {
      ...dia,
      caja: (dia?.recargas || 0) - (dia?.retiros || 0),
      juego: (dia?.apostado || 0) - (dia?.premios || 0),
    },
    totales: { ...totales, cupo_en_calle: cupo?.cupo_en_calle || 0 },
  });
}

// ─────────────────────────── Cierre diario ────────────────────────────────

export async function reportDaily(request, env, url) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const { from, to } = dateRange(url, 30);
  const juego = gameFilter(url);

  // Filtrando por mesa solo cuentan los movimientos DE esa mesa. Las recargas
  // y retiros no pertenecen a ninguna (son de la billetera), así que en ese
  // caso la caja queda en cero a propósito: la plata entra al salón, no a
  // una mesa. Lo que sí es por mesa es el juego (apostado − premios).
  // COALESCE y no `game_id = ?` a secas: un movimiento sin mesa (de antes de
  // la Etapa 2, o de la ventana entre migrar y publicar) cuenta como Catatumbo,
  // que era la única mesa. Sin esto quedaría afuera del filtro.
  const filtroJuego = juego ? "AND COALESCE(game_id, 'catatumbo') = ?" : '';
  const args = juego
    ? [VE_OFFSET, VE_OFFSET, from, to, juego]
    : [VE_OFFSET, VE_OFFSET, from, to];

  const rows = await env.DB.prepare(
    `SELECT date(created_at, ?) AS dia,
            COALESCE(SUM(CASE WHEN type = 'deposit'  THEN amount END), 0) AS recargas,
            COALESCE(SUM(CASE WHEN type = 'withdraw' THEN amount END), 0) AS retiros,
            COALESCE(SUM(CASE WHEN type = 'bet'      THEN amount END), 0) AS apostado,
            COALESCE(SUM(CASE WHEN type = 'win'      THEN amount END), 0) AS premios,
            COALESCE(SUM(CASE WHEN type = 'adjust'   THEN amount END), 0) AS ajustes,
            COUNT(CASE WHEN type = 'bet' THEN 1 END)                      AS giros,
            COUNT(DISTINCT CASE WHEN type = 'bet' THEN user_id END)       AS jugadores
       FROM transactions
      WHERE date(created_at, ?) BETWEEN ? AND ? ${filtroJuego}
      GROUP BY dia
      ORDER BY dia DESC`
  ).bind(...args).all();

  // Desglose por mesa del mismo período: con qué mesa gana el salón.
  // El COALESCE va en el GROUP BY, no solo al mostrar: si no, los movimientos
  // sin mesa arman su propio grupo y Catatumbo aparece dos veces en la tabla.
  const porJuegoRows = await env.DB.prepare(
    `SELECT COALESCE(game_id, 'catatumbo') AS game_id,
            COALESCE(SUM(CASE WHEN type = 'bet' THEN amount END), 0) AS apostado,
            COALESCE(SUM(CASE WHEN type = 'win' THEN amount END), 0) AS premios,
            COUNT(CASE WHEN type = 'bet' THEN 1 END)                  AS giros,
            COUNT(DISTINCT CASE WHEN type = 'bet' THEN user_id END)   AS jugadores
       FROM transactions
      WHERE date(created_at, ?) BETWEEN ? AND ?
        AND type IN ('bet', 'win')
      GROUP BY COALESCE(game_id, 'catatumbo')`
  ).bind(VE_OFFSET, from, to).all();

  const porJuego = (porJuegoRows.results || []).map((r) => ({
    ...r,
    label: (JUEGOS[r.game_id] && JUEGOS[r.game_id].label) || r.game_id,
    juego: r.apostado - r.premios,
  })).sort((a, b) => b.apostado - a.apostado);

  const dias = (rows.results || []).map((d) => ({
    ...d,
    caja: d.recargas - d.retiros,
    juego: d.apostado - d.premios,
  }));

  const total = dias.reduce((acc, d) => ({
    recargas: acc.recargas + d.recargas,
    retiros: acc.retiros + d.retiros,
    apostado: acc.apostado + d.apostado,
    premios: acc.premios + d.premios,
    ajustes: acc.ajustes + d.ajustes,
    giros: acc.giros + d.giros,
    caja: acc.caja + d.caja,
    juego: acc.juego + d.juego,
  }), { recargas: 0, retiros: 0, apostado: 0, premios: 0, ajustes: 0, giros: 0, caja: 0, juego: 0 });

  return json({
    from, to, dias, total,
    filtro_juego: juego,
    por_juego: porJuego,
    mesas: Object.entries(JUEGOS).map(([id, j]) => ({ id, label: j.label, activo: !!j.activo })),
  });
}

// ─────────────────────────── Reporte por socio ───────────────────────

export async function reportCashiers(request, env, url) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const { from, to } = dateRange(url, 30);

  const rows = await env.DB.prepare(
    `SELECT c.id, c.username, c.first_name, c.last_name, c.credit_balance,
            c.commission_pct, c.risk_share_pct, c.status,
            COALESCE(SUM(CASE WHEN l.type = 'purchase' THEN l.amount END), 0)              AS cupo_comprado,
            COALESCE(SUM(CASE WHEN l.type = 'purchase' THEN l.paid_amount END), 0)         AS pagado,
            COALESCE(SUM(CASE WHEN l.type = 'load' THEN -l.amount END), 0)                 AS cargado,
            COUNT(CASE WHEN l.type = 'load' THEN 1 END)                                    AS cargas,
            COALESCE(SUM(CASE WHEN l.type = 'withdrawal_refill' THEN l.amount END), 0)     AS retiros_pagados,
            (SELECT COUNT(*) FROM users p WHERE p.cashier_id = c.id)                       AS jugadores
       FROM users c
       LEFT JOIN credit_ledger l
              ON l.cashier_id = c.id AND date(l.created_at, ?) BETWEEN ? AND ?
      WHERE c.role = 'cashier'
      GROUP BY c.id
      ORDER BY cargado DESC, c.username`
  ).bind(VE_OFFSET, from, to).all();

  const socios = (rows.results || []).map((c) => {
    // Resultado del período para el socio: lo que cobró a sus jugadores
    // (cargas de cupo) menos lo que les pagó en retiros. Si es negativo y el
    // socio es franquiciado (participación > 0), esa pérdida corre por la casa.
    const resultado = (c.cargado || 0) - (c.retiros_pagados || 0);
    return {
      ...c,
      comision: c.cupo_comprado - c.pagado,
      resultado,
      participacion: c.risk_share_pct > 0 && resultado > 0
        ? Math.round(resultado * c.risk_share_pct / 100)
        : 0,
    };
  });

  return json({ from, to, socios });
}

// ─────────────────────────── Historial de un jugador ──────────────────────

export async function reportPlayer(request, env, playerId) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const user = await env.DB.prepare(
    `SELECT u.id, u.username, u.balance, u.held_balance, u.role, u.status, u.phone, u.cedula,
            u.first_name, u.last_name, u.email, u.bank,
            u.payout_method, u.payout_details, u.wagered_total, u.deposited_total,
            u.cashier_id, u.created_at, c.username AS cashier_username
       FROM users u LEFT JOIN users c ON c.id = u.cashier_id
      WHERE u.id = ?`
  ).bind(playerId).first();
  if (!user) return json({ error: 'Jugador no encontrado' }, 404);

  const [resumen, txs, tops, wds] = await Promise.all([
    env.DB.prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN type = 'deposit'  THEN amount END), 0) AS recargas,
         COALESCE(SUM(CASE WHEN type = 'withdraw' THEN amount END), 0) AS retiros,
         COALESCE(SUM(CASE WHEN type = 'bet'      THEN amount END), 0) AS apostado,
         COALESCE(SUM(CASE WHEN type = 'win'      THEN amount END), 0) AS premios,
         COALESCE(SUM(CASE WHEN type = 'adjust'   THEN amount END), 0) AS ajustes,
         COUNT(CASE WHEN type = 'bet' THEN 1 END)                      AS giros
       FROM transactions WHERE user_id = ?`
    ).bind(playerId).first(),
    env.DB.prepare(
      `SELECT t.id, t.type, t.amount, t.note, t.source, t.created_at, a.username AS actor
         FROM transactions t LEFT JOIN users a ON a.id = t.actor_id
        WHERE t.user_id = ? ORDER BY t.created_at DESC, t.id DESC LIMIT 200`
    ).bind(playerId).all(),
    env.DB.prepare(
      `SELECT id, amount, currency, amount_fx, rate, method, reference, status, note, created_at
         FROM topups WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50`
    ).bind(playerId).all(),
    env.DB.prepare(
      `SELECT id, amount, method, destination, status, paid_by, note, created_at, reviewed_at
         FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50`
    ).bind(playerId).all(),
  ]);

  return json({
    user,
    resumen: {
      ...resumen,
      // Positivo = la casa le ganó; negativo = el jugador va ganando.
      juego: (resumen?.apostado || 0) - (resumen?.premios || 0),
      caja: (resumen?.recargas || 0) - (resumen?.retiros || 0),
    },
    transactions: txs.results || [],
    topups: tops.results || [],
    withdrawals: wds.results || [],
  });
}

// ─────────────────────────── Alertas ──────────────────────────────────────

// Tres señales que conviene mirar todos los días.
export async function reportAlerts(request, env, url) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const limit = Math.min(Number(url.searchParams.get('limit')) || 10, 50);
  const settings = await getSettings(env);
  const umbralCupo = settingNum(settings, 'cupo_alert');

  const [ganadores, sinJugar, viejos, cupoBajo] = await Promise.all([
    // 1. Jugadores que le vienen ganando a la casa.
    env.DB.prepare(
      `SELECT u.id, u.username, u.balance,
              COALESCE(SUM(CASE WHEN t.type = 'bet' THEN t.amount END), 0) AS apostado,
              COALESCE(SUM(CASE WHEN t.type = 'win' THEN t.amount END), 0) AS premios
         FROM users u JOIN transactions t ON t.user_id = u.id
        WHERE u.role = 'player'
        GROUP BY u.id
       HAVING premios > apostado
        ORDER BY (premios - apostado) DESC
        LIMIT ?`
    ).bind(limit).all(),

    // 2. Recargan y retiran jugando muy poco (posible uso como casa de cambio).
    env.DB.prepare(
      `SELECT u.id, u.username, u.deposited_total, u.wagered_total,
              COALESCE(SUM(w.amount), 0) AS retirado
         FROM users u JOIN withdrawals w ON w.user_id = u.id AND w.status = 'paid'
        WHERE u.role = 'player' AND u.deposited_total > 0
        GROUP BY u.id
       HAVING u.wagered_total < u.deposited_total * 0.2
        ORDER BY retirado DESC
        LIMIT ?`
    ).bind(limit).all(),

    // 3. Retiros que llevan más de un día esperando respuesta.
    env.DB.prepare(
      `SELECT w.id, w.amount, w.created_at, u.username
         FROM withdrawals w JOIN users u ON u.id = w.user_id
        WHERE w.status = 'pending' AND w.created_at < datetime('now', '-1 day')
        ORDER BY w.created_at
        LIMIT ?`
    ).bind(limit).all(),

    // 4. Socios con el cupo por agotarse: sin fichas no pueden vender.
    env.DB.prepare(
      `SELECT id, username, first_name, last_name, credit_balance
         FROM users
        WHERE role = 'cashier' AND status = 'active' AND credit_balance < ?
        ORDER BY credit_balance
        LIMIT ?`
    ).bind(umbralCupo, limit).all(),
  ]);

  return json({
    ganadores: (ganadores.results || []).map((g) => ({ ...g, neto: g.premios - g.apostado })),
    poco_juego: sinJugar.results || [],
    retiros_demorados: viejos.results || [],
    socios_cupo_bajo: cupoBajo.results || [],
    umbral_cupo: umbralCupo,
  });
}
