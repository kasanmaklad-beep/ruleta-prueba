// ════════════════════════════════════════════════════════════════
//  Worker de Ruleta Catatumbo — API del juego y del sistema administrativo
//  Sirve la API en /api/* y delega el resto a los assets estáticos.
//  Bindings (wrangler.jsonc): DB (D1), ASSETS (static), JWT_SECRET (secret)
//
//  Este archivo tiene el ruteo y la lógica del juego. Lo demás vive en:
//    lib.js       — utilidades compartidas (auth, validación, configuración)
//    accounts.js  — registro, ingreso, perfil y gestión de usuarios
//    cashiers.js  — banqueros y cupo prepago
//    payments.js  — recargas y retiros
//    reports.js   — cierre diario, reportes y alertas
// ════════════════════════════════════════════════════════════════

import {
  json, readJson, str, toPositiveInt, requireAuth, requireAdmin,
  getSettings, settingNum, ltgPesos, LTG_VALORES, mesaJugable, catalogoMesas,
  monedaDe, pagosManuales,
} from './lib.js';

import {
  adminGames, adminCreateGame, adminUpdateGame, adminToggleGame,
} from './games.js';

// La capa ejecutiva: matriz → ejecutivo → banquero → jugador.
import {
  execSummary, execPlayers, execCreateCashier, execVenderCupo,
  adminExecs, adminSetExec, adminSetExecLimite,
  adminAsignarFichas, adminDevolverFichas, adminRendicion, adminSetExecPago,
  cashierPedirCupo, cashierMisPedidos, pedidosPendientes, aprobarPedido, rechazarPedido,
  execReporte,
} from './execs.js';

import {
  bjRonda, bjApostar, bjPedir, bjPlantarse, bjDoblar, bjDividir, barrerRondasAbandonadas,
} from './blackjack.js';

import {
  register, login, me, updateProfile, changePassword,
  adminUsers, adminSetRole, adminSetStatus, adminResetPassword,
  adminDeposit, adminAdjust, adminGetSettings, adminPutSettings,
  adminCreateCashier, adminSetRefCode, aceptarCondiciones,
} from './accounts.js';

import {
  adminCashiers, adminSellCredit, adminAdjustCredit, adminCreditLedger,
  cashierLoad, cashierSummary,
} from './cashiers.js';

import {
  walletInfo, walletHistory, createTopup, createWithdrawal,
  adminTopups, adminApproveTopup, adminRejectTopup,
  adminWithdrawals, adminPayWithdrawal, adminRejectWithdrawal,
  cashierTopups, cashierApproveTopup, cashierRejectTopup,
  cashierWithdrawals, cashierPayWithdrawal, cashierRejectWithdrawal,
  cashierSetCollectInfo,
} from './payments.js';

import {
  adminSummary, reportDaily, reportCashiers, reportPlayer, reportAlerts, adminPote,
} from './reports.js';

// Rutas de la SPA que no son archivos: hay que servirles el index.html.
const SPA_ROUTES = ['/admin', '/taquilla', '/ejecutivo', '/billetera', '/juego', '/mesa21', '/salon'];

export default {
  // ── La tarea programada (Cron Triggers de Cloudflare) ──────────────────
  // Barre las manos de blackjack que quedaron abiertas. Sin esto, una mano
  // abandonada solo se cierra si el jugador vuelve: si no vuelve, no cobra lo
  // que le tocaba y en el cierre del día queda la apuesta sin su pago.
  //
  // Dos criterios, y por eso hay dos horarios:
  //   cada hora  → cierra las que pasaron 12 horas (le da tiempo al jugador
  //                de volver de una llamada o de dormir).
  //   00:05 VE   → cierra TODAS, para que la jornada termine sin manos
  //                colgando y lo apostado y lo pagado caigan el mismo día.
  async scheduled(event, env, ctx) {
    const cierreDelDia = String(event.cron || '').startsWith('5 4');
    ctx.waitUntil(
      barrerRondasAbandonadas(env, { todas: cierreDelDia })
        .then((r) => console.log(
          `[barrido ${cierreDelDia ? 'cierre del día' : 'vencidas'}] `
          + `miradas ${r.miradas || 0} · cerradas ${r.cerradas} · pagado ${r.pagado}`))
        .catch((e) => console.log('[barrido] falló:', e && e.message))
    );
  },

  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        return json({ error: 'Error interno', detail: String(err && err.message || err) }, 500);
      }
    }

    const clean = url.pathname.replace(/\/+$/, '') || '/';
    if (SPA_ROUTES.includes(clean)) {
      return env.ASSETS.fetch(new Request(new URL('/', url), request));
    }

    // Todo lo demás: assets estáticos (juego React precompilado)
    return env.ASSETS.fetch(request);
  },
};

// ─────────────────────────────── Router API ───────────────────────────────

async function handleApi(request, env, url) {
  const path = url.pathname;
  const method = request.method;
  let m;

  // ── Cuenta ──
  if (method === 'POST' && path === '/api/auth/register') return register(request, env);
  if (method === 'POST' && path === '/api/auth/login')    return login(request, env);
  if (method === 'GET'  && path === '/api/me')            return me(request, env);
  if (method === 'PUT'  && path === '/api/me')            return updateProfile(request, env);
  if (method === 'POST' && path === '/api/me/password')   return changePassword(request, env);

  // ── Juego ──
  // El catálogo lo pide el salón para dibujar las mesas y el juego para saber
  // cómo armarse. No expone nada sensible, pero pide sesión igual.
  // Los números de la casa, SIN sesión: la pantalla de registro los necesita
  // para escribir las condiciones (mínimos, cuánto hay que jugar antes de
  // retirar) y ahí todavía no hay usuario. Sólo salen datos que ya están a la
  // vista de cualquiera que entre al salón.
  if (method === 'GET'  && path === '/api/config')        return configPublica(request, env);
  if (method === 'POST' && path === '/api/condiciones')   return aceptarCondiciones(request, env);
  if (method === 'GET'  && path === '/api/games')         return listGames(request, env);
  if (method === 'POST' && path === '/api/game/spin')     return gameSpin(request, env);

  // ── Blackjack (Etapa B1) ──
  // Mesa aparte, motor aparte: no comparte una línea con el giro de la ruleta.
  if (method === 'GET'  && path === '/api/bj/ronda')      return bjRonda(request, env, url);
  if (method === 'POST' && path === '/api/bj/apostar')    return bjApostar(request, env);
  if (method === 'POST' && path === '/api/bj/pedir')      return bjPedir(request, env);
  if (method === 'POST' && path === '/api/bj/plantarse')  return bjPlantarse(request, env);
  if (method === 'POST' && path === '/api/bj/doblar')     return bjDoblar(request, env);
  if (method === 'POST' && path === '/api/bj/dividir')    return bjDividir(request, env);

  // ── Billetera del jugador ──
  if (method === 'GET'  && path === '/api/wallet/info')     return walletInfo(request, env);
  if (method === 'GET'  && path === '/api/wallet/history')  return walletHistory(request, env);
  if (method === 'POST' && path === '/api/wallet/topup')    return createTopup(request, env);
  if (method === 'POST' && path === '/api/wallet/withdraw') return createWithdrawal(request, env);

  // ── Banca del banquero ──
  if (method === 'GET'  && path === '/api/cashier/summary') return cashierSummary(request, env);
  if (method === 'POST' && path === '/api/cashier/load')    return cashierLoad(request, env);
  if (method === 'PUT'  && path === '/api/cashier/collect-info') return cashierSetCollectInfo(request, env);
  if (method === 'GET'  && path === '/api/cashier/topups')       return cashierTopups(request, env, url);
  if (method === 'POST' && (m = path.match(/^\/api\/cashier\/topups\/(\d+)\/approve$/)))
    return cashierApproveTopup(request, env, Number(m[1]));
  if (method === 'POST' && (m = path.match(/^\/api\/cashier\/topups\/(\d+)\/reject$/)))
    return cashierRejectTopup(request, env, Number(m[1]));
  if (method === 'GET'  && path === '/api/cashier/withdrawals') return cashierWithdrawals(request, env, url);
  if (method === 'POST' && (m = path.match(/^\/api\/cashier\/withdrawals\/(\d+)\/pay$/)))
    return cashierPayWithdrawal(request, env, Number(m[1]));
  if (method === 'POST' && (m = path.match(/^\/api\/cashier\/withdrawals\/(\d+)\/reject$/)))
    return cashierRejectWithdrawal(request, env, Number(m[1]));

  // ── Panel: tablero y usuarios ──
  if (method === 'GET'  && path === '/api/admin/summary')      return adminSummary(request, env);
  if (method === 'GET'  && path === '/api/admin/users')        return adminUsers(request, env, url);
  if (method === 'GET'  && path === '/api/admin/transactions') return adminTransactions(request, env, url);
  if (method === 'POST' && path === '/api/admin/deposit')      return adminDeposit(request, env);
  if (method === 'POST' && path === '/api/admin/adjust')       return adminAdjust(request, env);
  if (method === 'GET'  && path === '/api/admin/settings')     return adminGetSettings(request, env);

  // ── Panel: las mesas del salón ──
  if (method === 'GET'  && path === '/api/admin/games')        return adminGames(request, env);
  if (method === 'POST' && path === '/api/admin/games')        return adminCreateGame(request, env);
  if (method === 'PUT'  && (m = path.match(/^\/api\/admin\/games\/([a-z0-9_]+)$/)))
    return adminUpdateGame(request, env, m[1]);
  if (method === 'POST' && (m = path.match(/^\/api\/admin\/games\/([a-z0-9_]+)\/activo$/)))
    return adminToggleGame(request, env, m[1]);
  // El mismo barrido, a mano: sirve para probarlo y para saldar las manos
  // abiertas antes de mirar un reporte, sin esperar al horario.
  if (method === 'POST' && path === '/api/admin/bj/barrer')     return adminBarrerBlackjack(request, env);
  if (method === 'PUT'  && path === '/api/admin/settings')     return adminPutSettings(request, env);

  if (method === 'POST' && (m = path.match(/^\/api\/admin\/users\/(\d+)\/role$/)))
    return adminSetRole(request, env, Number(m[1]));
  if (method === 'POST' && (m = path.match(/^\/api\/admin\/users\/(\d+)\/status$/)))
    return adminSetStatus(request, env, Number(m[1]));
  if (method === 'POST' && (m = path.match(/^\/api\/admin\/users\/(\d+)\/password$/)))
    return adminResetPassword(request, env, Number(m[1]));

  // ── Panel: banqueros ──
  if (method === 'GET'  && path === '/api/admin/cashiers')        return adminCashiers(request, env);
  if (method === 'POST' && path === '/api/admin/cashiers')        return adminCreateCashier(request, env);
  if (method === 'POST' && path === '/api/admin/cashiers/credit') return adminSellCredit(request, env);
  if (method === 'POST' && (m = path.match(/^\/api\/admin\/users\/(\d+)\/ref-code$/)))
    return adminSetRefCode(request, env, Number(m[1]));
  if (method === 'POST' && path === '/api/admin/cashiers/adjust') return adminAdjustCredit(request, env);
  if (method === 'GET'  && path === '/api/admin/credit-ledger')   return adminCreditLedger(request, env, url);

  // ── La capa ejecutiva ──
  // Lo del ejecutivo va bajo /api/exec y lo mira él mismo; el dueño entra a lo
  // de cualquiera agregando ?exec=<id>, porque está por encima.
  if (method === 'GET'  && path === '/api/exec/summary') return execSummary(request, env, url);
  if (method === 'GET'  && path === '/api/exec/players') return execPlayers(request, env, url);
  // El reporte por fechas: con la casa y con cada banquero. El dueño mira el
  // de cualquiera agregando ?exec=<id>.
  if (method === 'GET'  && path === '/api/exec/reporte') return execReporte(request, env, url);
  // El ejecutivo arma su propia red: el banquero nace colgado de él.
  if (method === 'POST' && path === '/api/exec/cashiers') return execCreateCashier(request, env);
  // El ejecutivo le entrega cupo a uno de SUS banqueros y le cobra.
  if (method === 'POST' && path === '/api/exec/vender')   return execVenderCupo(request, env);

  // ── Pedidos de cupo: el banquero pide, el de arriba responde ──
  if (method === 'POST' && path === '/api/cashier/pedir-cupo') return cashierPedirCupo(request, env);
  if (method === 'GET'  && path === '/api/cashier/pedidos')    return cashierMisPedidos(request, env);
  if (method === 'GET'  && path === '/api/pedidos')            return pedidosPendientes(request, env, url);
  if (method === 'POST' && (m = path.match(/^\/api\/pedidos\/(\d+)\/aprobar$/)))
    return aprobarPedido(request, env, Number(m[1]));
  if (method === 'POST' && (m = path.match(/^\/api\/pedidos\/(\d+)\/rechazar$/)))
    return rechazarPedido(request, env, Number(m[1]));
  if (method === 'GET'  && path === '/api/admin/execs')  return adminExecs(request, env);
  // El pote: cuántas fichas hay en la calle y cuánto respaldo queda.
  if (method === 'GET'  && path === '/api/admin/pote')   return adminPote(request, env);
  // Colgar un banquero de un ejecutivo (o devolverlo a la matriz).
  if (method === 'POST' && (m = path.match(/^\/api\/admin\/cashiers\/(\d+)\/exec$/)))
    return adminSetExec(request, env, Number(m[1]));
  // El techo de exposición del ejecutivo.
  if (method === 'POST' && (m = path.match(/^\/api\/admin\/execs\/(\d+)\/limite$/)))
    return adminSetExecLimite(request, env, Number(m[1]));
  // La casa le entrega fichas en consignación, y registra lo que le rinde.
  if (method === 'POST' && (m = path.match(/^\/api\/admin\/execs\/(\d+)\/fichas$/)))
    return adminAsignarFichas(request, env, Number(m[1]));
  // Las fichas que le quedaron sin vender vuelven a la casa. No toca la deuda:
  // lo que debe nace de lo que vendió, no de lo que tiene en la mano.
  if (method === 'POST' && (m = path.match(/^\/api\/admin\/execs\/(\d+)\/devolver$/)))
    return adminDevolverFichas(request, env, Number(m[1]));
  if (method === 'POST' && (m = path.match(/^\/api\/admin\/execs\/(\d+)\/rendicion$/)))
    return adminRendicion(request, env, Number(m[1]));
  // A sueldo o por comisión: cambia cómo se calcula lo que debe.
  if (method === 'POST' && (m = path.match(/^\/api\/admin\/execs\/(\d+)\/pago$/)))
    return adminSetExecPago(request, env, Number(m[1]));

  // ── Panel: recargas ──
  if (method === 'GET'  && path === '/api/admin/topups') return adminTopups(request, env, url);
  if (method === 'POST' && (m = path.match(/^\/api\/admin\/topups\/(\d+)\/approve$/)))
    return adminApproveTopup(request, env, Number(m[1]));
  if (method === 'POST' && (m = path.match(/^\/api\/admin\/topups\/(\d+)\/reject$/)))
    return adminRejectTopup(request, env, Number(m[1]));

  // ── Panel: retiros ──
  if (method === 'GET'  && path === '/api/admin/withdrawals') return adminWithdrawals(request, env, url);
  if (method === 'POST' && (m = path.match(/^\/api\/admin\/withdrawals\/(\d+)\/pay$/)))
    return adminPayWithdrawal(request, env, Number(m[1]));
  if (method === 'POST' && (m = path.match(/^\/api\/admin\/withdrawals\/(\d+)\/reject$/)))
    return adminRejectWithdrawal(request, env, Number(m[1]));

  // ── Panel: reportes ──
  if (method === 'GET' && path === '/api/admin/report/daily')    return reportDaily(request, env, url);
  if (method === 'GET' && path === '/api/admin/report/cashiers') return reportCashiers(request, env, url);
  if (method === 'GET' && path === '/api/admin/report/alerts')   return reportAlerts(request, env, url);
  if (method === 'GET' && (m = path.match(/^\/api\/admin\/report\/player\/(\d+)$/)))
    return reportPlayer(request, env, Number(m[1]));

  return json({ error: 'No encontrado' }, 404);
}

// ─────────────────────────────── Movimientos ──────────────────────────────

// Barrido de manos de blackjack a pedido del dueño. `todas: true` cierra
// también las que todavía no vencieron — es lo que hace el cierre del día.
async function adminBarrerBlackjack(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;
  const body = await readJson(request);
  const r = await barrerRondasAbandonadas(env, { todas: !!body.todas });
  return json({
    ...r,
    mensaje: (r.cerradas === 0
      ? 'No había manos abiertas para cerrar.'
      : `Se cerraron ${r.cerradas} mano(s) que habían quedado abiertas; se pagaron ${r.pagado}.`)
      + (r.respetadas ? ` Quedaron ${r.respetadas} sin tocar porque recién empezaron.` : ''),
  });
}

async function adminTransactions(request, env, url) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 500);
  const type = str(url.searchParams.get('type'), 20);
  const userId = Number(url.searchParams.get('user_id')) || null;

  const where = [];
  const binds = [];
  if (type) { where.push('t.type = ?'); binds.push(type); }
  if (userId) { where.push('t.user_id = ?'); binds.push(userId); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await env.DB.prepare(
    `SELECT t.id, t.user_id, u.username, t.type, t.amount, t.note, t.source, t.created_at,
            a.username AS actor
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       LEFT JOIN users a ON a.id = t.actor_id
      ${clause}
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT ?`
  ).bind(...binds, limit).all();

  return json({ transactions: rows.results || [] });
}

// ═══════════════════════════════════════════════════════════════════════
//  GAME SPIN — el SERVIDOR es la autoridad del juego.
//  El cliente manda solo las apuestas; el servidor:
//   1. valida y reconstruye cada apuesta (no confía en 'numbers' del cliente),
//   2. aplica el TOPE DE APUESTA configurado,
//   3. descuenta del saldo DISPONIBLE de forma atómica (lo congelado en
//      retiros pendientes no se puede jugar),
//   4. genera los números Lightning y el resultado con RNG del servidor,
//   5. calcula el premio, lo recorta al TECHO DE PREMIO y lo acredita.
//  Así el jugador nunca decide cuánto gana, y un Lightning de 500x no puede
//  vaciar la caja de un solo giro.
//
//  El tope de apuesta es POR CASILLA del paño, no por total de mesa: cubrir
//  varias posiciones no agrega riesgo (las que pierden pagan parte de la que
//  gana), así que limitar la suma solo estorbaba al jugador.
// ═══════════════════════════════════════════════════════════════════════
async function gameSpin(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const rawBets = Array.isArray(body.bets) ? body.bets : null;
  if (!rawBets || rawBets.length === 0) return json({ error: 'No hay apuestas' }, 400);
  if (rawBets.length > 200) return json({ error: 'Demasiadas apuestas' }, 400);

  // En qué mesa se está jugando. La ficha manda: define la rueda, si hay
  // rayos, cuánto paga el pleno y qué apuestas son válidas.
  // `auth` va porque una mesa EN PRUEBAS la juegan sólo el dueño y las cuentas
  // de prueba: quién pide el giro es parte de si la mesa está jugable o no.
  const mesa = await mesaJugable(env, body.game, auth);
  if (!mesa) return json({ error: 'Esa mesa no existe o está cerrada' }, 400);
  const gameId = mesa.id;

  // 1. Validar y normalizar cada apuesta (server-authoritative: reconstruye los números).
  const bets = [];
  let stake = 0;
  for (const rb of rawBets) {
    const amount = toPositiveInt(rb && rb.amount);
    if (amount === null) return json({ error: 'Monto de apuesta inválido' }, 400);
    const type = String(rb && rb.type || '');
    const numbers = deriveBetNumbers(type, rb && rb.payload);
    if (!numbers) return json({ error: `Apuesta inválida: ${type}` }, 400);
    // En una mesa europea no existe el 00, así que tampoco las apuestas que
    // lo tocan (incluido el top line de cinco números).
    if (!mesa.dobleCero && numbers.some((n) => String(n) === '00')) {
      return json({ error: 'En esta mesa no existe el 00' }, 400);
    }
    stake += amount;
    bets.push({ type, payload: String(rb.payload), numbers, amount });
  }
  if (stake <= 0 || stake > 1e12) return json({ error: 'Apuesta total inválida' }, 400);

  // 2. Tope POR CASILLA (no por mesa). El riesgo lo marca cuánto puede cobrar
  //    una sola posición: 500 al rojo y 500 al negro se cancelan entre sí, y
  //    500 en diez plenos expone menos que un solo pleno de 500. Lo que no se
  //    puede permitir es cargar una casilla por encima del tope.
  const settings = await getSettings(env);
  const maxCasilla = settingNum(settings, 'max_bet_casilla');
  const maxPleno = settingNum(settings, 'max_bet_pleno');
  const maxWin = settingNum(settings, 'max_win_per_spin');

  // El pleno tiene su propio tope: paga 29:1 y con Lightning hasta 500x, así
  // que aguanta mucho menos que un color o una docena.
  const porCasilla = new Map();
  for (const b of bets) {
    const key = `${b.type}:${b.payload}`;
    const prev = porCasilla.get(key) || { monto: 0, type: b.type };
    prev.monto += b.amount;
    porCasilla.set(key, prev);
  }
  for (const [, c] of porCasilla) {
    const tope = c.type === 'straight' ? maxPleno : maxCasilla;
    if (c.monto > tope) {
      return json({
        error: c.type === 'straight'
          ? `El máximo por pleno es ${maxPleno.toLocaleString('es-VE')}. Tenés ${c.monto.toLocaleString('es-VE')} en un número.`
          : `El máximo por casilla es ${maxCasilla.toLocaleString('es-VE')}. Tenés ${c.monto.toLocaleString('es-VE')} en una sola.`,
        max_bet_casilla: maxCasilla,
        max_bet_pleno: maxPleno,
      }, 400);
    }
  }

  // 3. Descontar del saldo DISPONIBLE de forma atómica.
  const upd = await env.DB.prepare(
    'UPDATE users SET balance = balance - ?, wagered_total = wagered_total + ? WHERE id = ? AND balance - held_balance >= ?'
  ).bind(stake, stake, auth.userId, stake).run();
  if (upd.meta.changes === 0) {
    const cur = await env.DB.prepare('SELECT balance, held_balance FROM users WHERE id = ?')
      .bind(auth.userId).first();
    const disponible = cur ? cur.balance - cur.held_balance : 0;
    return json({
      error: cur && cur.held_balance > 0
        ? `Saldo insuficiente: tenés ${disponible} disponible (${cur.held_balance} está retenido por un retiro pendiente)`
        : 'Saldo insuficiente',
      balance: cur ? cur.balance : 0,
    }, 400);
  }
  await env.DB.prepare(
    "INSERT INTO transactions (user_id, type, amount, note, source, game_id) VALUES (?, 'bet', ?, ?, 'game', ?)"
  ).bind(auth.userId, stake, `Apuesta ronda (${bets.length} fichas)`, gameId).run();

  // 4. Generar Lightning y resultado con RNG del servidor.
  //    Los rayos solo existen en las mesas que los tienen; en una clásica el
  //    pleno paga 35 a 1 y no hace falta compensar nada.
  const lightning = mesa.rayos ? generateLightning(settings, mesa.ordenRueda) : [];
  const ltgMap = new Map(lightning);
  const resultIndex = randInt(mesa.ordenRueda.length);
  const resultNum = mesa.ordenRueda[resultIndex];

  // 5. Calcular premio (autoritativo).
  let win = 0;
  let anyLightning = false;
  let winDetails = null;
  for (const b of bets) {
    const r = calcWin(b, resultNum, ltgMap, mesa.pagoPleno);
    win += r.win;
    if (r.isLightningHit) anyLightning = true;
    if (r.win > 0 && (!winDetails || r.win > winDetails.win)) {
      winDetails = { win: r.win, multiplier: r.multiplier, isLightningHit: r.isLightningHit, type: b.type };
    }
  }

  // 6. Techo de premio por giro: la protección contra el 500x.
  const grossWin = win;
  const capped = win > maxWin;
  if (capped) win = maxWin;

  if (win > 0) {
    await env.DB.prepare('UPDATE users SET balance = balance + ? WHERE id = ?')
      .bind(win, auth.userId).run();
    await env.DB.prepare(
      "INSERT INTO transactions (user_id, type, amount, note, source, game_id) VALUES (?, 'win', ?, ?, 'game', ?)"
    ).bind(
      auth.userId, win,
      capped
        ? `Ganancia ronda (salió ${resultNum}) — limitada al techo de ${maxWin}, bruto ${grossWin}`
        : `Ganancia ronda (salió ${resultNum})`,
      gameId
    ).run();
  }

  const cur = await env.DB.prepare('SELECT balance, held_balance FROM users WHERE id = ?')
    .bind(auth.userId).first();
  // Enviamos resultNum y las claves Lightning en su tipo original (int o '00')
  // para que el cliente reconstruya el Map con las mismas claves que la rueda.
  return json({
    game: gameId,
    resultIndex,
    resultNum,
    lightning,        // Array<[int|'00', mult]>
    win,
    grossWin,
    capped,
    maxWin,
    anyLightning,
    winDetails,
    balance: cur.balance,
    held_balance: cur.held_balance,
  });
}

// La configuración pública: lo que hace falta para escribir las condiciones
// antes de que el jugador tenga cuenta.
async function configPublica(request, env) {
  const s = await getSettings(env);
  return json({
    config: {
      moneda: monedaDe(s),
      pagos_manuales: pagosManuales(s),
      min_topup: settingNum(s, 'min_topup'),
      min_withdrawal: settingNum(s, 'min_withdrawal'),
      wager_pct_required: settingNum(s, 'wager_pct_required'),
    },
  });
}

// Las mesas del salón: cuáles hay, cómo es cada una y cuáles se pueden jugar.
async function listGames(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.response;
  return json({ mesas: await catalogoMesas(env, auth) });
}

// ═══════════════════════════════════════════════════════════════════════
//  LÓGICA DEL JUEGO (autoritativa en el servidor)
//  Debe mantenerse consistente con src/wheel.jsx y src/table.jsx (visual).
// ═══════════════════════════════════════════════════════════════════════

// El orden de cada rueda vive en lib.js (RUEDAS): lo usa la mesa, no este archivo.
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const BLACK = new Set([2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]);

// Payouts (ganancia neta a 1). Debe coincidir con table.jsx.
// El pleno NO está acá: lo pone la mesa (29 con rayos, 35 sin ellos).
const PAYOUT = {
  split: 17, street: 11, corner: 8, sixline: 5, topline: 6,
  column: 2, dozen: 2, half: 1, parity: 1, color: 1,
};
// Cantidad de números esperada por tipo interno (para validar la apuesta del cliente).
const INNER_COUNT = { straight: 1, split: 2, street: 3, corner: 4, sixline: 6, topline: 5 };

// Entero aleatorio [0, n) con RNG criptográfico (más justo que Math.random).
function randInt(n) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % n;
}

// Normaliza un valor de casilla: '00' se mantiene string; el resto a entero.
function normNum(v) {
  const s = String(v);
  if (s === '00') return '00';
  const n = parseInt(s, 10);
  return Number.isInteger(n) ? n : NaN;
}
function isValidRouletteNum(v) {
  if (v === '00') return true;
  return Number.isInteger(v) && v >= 0 && v <= 36;
}

// Reconstruye (y valida) los números que cubre una apuesta a partir de type+payload.
// NO confía en el array 'numbers' que envíe el cliente. Devuelve null si es inválida.
function deriveBetNumbers(type, payload) {
  const p = payload == null ? '' : String(payload);
  switch (type) {
    case 'straight': case 'split': case 'street': case 'corner': case 'sixline': case 'topline': {
      const nums = p.split('-').map(normNum);
      if (nums.some((x) => !isValidRouletteNum(x))) return null;
      if (nums.length !== INNER_COUNT[type]) return null;
      // sin duplicados
      if (new Set(nums.map(String)).size !== nums.length) return null;
      return nums;
    }
    case 'column': {
      const c = parseInt(p, 10);
      if (![1, 2, 3].includes(c)) return null;
      const out = [];
      for (let n = c; n <= 36; n += 3) out.push(n);
      return out;
    }
    case 'dozen': {
      const d = parseInt(p, 10);
      if (![1, 2, 3].includes(d)) return null;
      const base = (d - 1) * 12 + 1;
      const out = [];
      for (let n = base; n < base + 12; n++) out.push(n);
      return out;
    }
    case 'half': {
      if (p === 'low') return range(1, 18);
      if (p === 'high') return range(19, 36);
      return null;
    }
    case 'parity': {
      if (p === 'even') return range(2, 36).filter((n) => n % 2 === 0);
      if (p === 'odd') return range(1, 36).filter((n) => n % 2 === 1);
      return null;
    }
    case 'color': {
      if (p === 'red') return [...RED];
      if (p === 'black') return [...BLACK];
      return null;
    }
    default:
      return null;
  }
}
function range(a, b) {
  const r = [];
  for (let i = a; i <= b; i++) r.push(i);
  return r;
}

// Genera los números Lightning del giro, según la configuración del panel.
//
// Los multiplicadores NO salen parejos: cada uno tiene su peso, así que el 50x
// aparece seguido y el 500x es raro — como en una mesa real. Si salieran todos
// iguales el promedio sería 222x y el pleno pagaría más de lo que recibe.
function generateLightning(settings, ordenRueda) {
  const min = Math.max(0, Math.round(settingNum(settings, 'ltg_min')));
  const max = Math.max(min, Math.round(settingNum(settings, 'ltg_max')));
  const count = min + (max > min ? randInt(max - min + 1) : 0);

  const pesos = ltgPesos(settings);
  const total = pesos.reduce((a, b) => a + b, 0);

  // Sorteo con peso: se tira un número en [0, total) y se busca en qué tramo cae.
  const sortearMult = () => {
    if (total <= 0) return LTG_VALORES[0];
    // randInt da enteros; se usa una resolución de 10.000 para admitir pesos con decimales.
    let r = (randInt(10000) / 10000) * total;
    for (let i = 0; i < LTG_VALORES.length; i++) {
      r -= pesos[i];
      if (r < 0) return LTG_VALORES[i];
    }
    return LTG_VALORES[LTG_VALORES.length - 1];
  };

  const pool = [...ordenRueda];
  const chosen = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    const idx = randInt(pool.length);
    const n = pool.splice(idx, 1)[0];
    chosen.push([n, sortearMult()]);
  }
  return chosen;
}

// Calcula el premio bruto de una apuesta. Espejo de calcWin en src/table.jsx.
// `pagoPleno` viene de la mesa: 29 a 1 donde hay rayos que lo compensan,
// 35 a 1 en una mesa clásica.
function calcWin(bet, result, ltgMap, pagoPleno = 29) {
  const { type, amount, numbers } = bet;
  let win = 0, multiplier = 1, isLightningHit = false;
  const covers = numbers.some((x) => String(x) === String(result));

  if (type === 'straight' && covers && ltgMap.has(result)) {
    multiplier = ltgMap.get(result);
    isLightningHit = true;
  }
  if (covers) {
    const p = type === 'straight' ? pagoPleno : PAYOUT[type];
    if (p != null) win = isLightningHit ? amount * multiplier : amount * (p + 1);
  }
  // Las apuestas externas nunca cubren 0 ni 00.
  if ((type === 'column' || type === 'dozen' || type === 'half' || type === 'parity' || type === 'color')
      && (result === 0 || result === '00')) {
    win = 0;
  }
  return { win, multiplier, isLightningHit };
}
