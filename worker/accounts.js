// ════════════════════════════════════════════════════════════════════════
//  Cuentas: registro, ingreso, perfil del jugador y gestión de usuarios
//  desde el panel (roles, bloqueo, ajustes manuales de saldo).
// ════════════════════════════════════════════════════════════════════════

import {
  json, readJson, str, normalizePhone, normalizeUsername, validateUsername,
  toPositiveInt, hashPassword, verifyPassword, signJwt, getSettings, settingNum,
  requireAuth, requireAdmin, validMethod, USER_FIELDS, nowSql,
  NUMERIC_SETTINGS, DEFAULT_SETTINGS, checkMultiplo,
  normalizeNombre, normalizeDocumento, normalizeEmail,
  normalizeRefCode, refCodeDeId,
  LTG_VALORES, infoRayos, monedaDe, pagosManuales,
} from './lib.js';

// ─────────────────────── Ficha de datos personales ────────────────────────
// La usan el registro del jugador y el alta de socios desde el panel, para
// que a nadie le falten datos según por dónde haya entrado.
// Devuelve { perfil } o { error }.
// `pideBanco` es falso cuando la casa paga en efectivo: ahí el banco no se
// usa para nada y la pantalla ni lo muestra, así que exigirlo acá dejaría el
// registro trabado con un error de un campo que el jugador no ve.
function parsePerfil(body, { pideBanco = true } = {}) {
  const firstName = normalizeNombre(body.first_name);
  const lastName = normalizeNombre(body.last_name);
  const doc = normalizeDocumento(body.doc_type, body.cedula);
  const phone = normalizePhone(body.phone);
  const email = normalizeEmail(body.email);
  const bank = str(body.bank, 60);

  if (!firstName) return { error: 'Poné el nombre (solo letras)' };
  if (!lastName) return { error: 'Poné el apellido (solo letras)' };
  if (!doc) return { error: 'El documento no es válido para el tipo que elegiste' };
  if (!phone) return { error: 'Poné un teléfono válido: es a donde se paga' };
  if (!email) return { error: 'Poné un correo válido' };
  if (pideBanco && !bank) return { error: 'Elegí el banco' };

  return { perfil: { firstName, lastName, doc, phone, email, bank } };
}

// Chequea que el usuario y el documento no estén tomados.
async function libreONull(env, username, documento) {
  const u = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (u) return 'Ese usuario ya existe';
  const d = await env.DB.prepare('SELECT id FROM users WHERE cedula = ?').bind(documento).first();
  if (d) return `Ya hay una cuenta registrada con el documento ${documento}`;
  return null;
}

// ─────────────────────────── Registro e ingreso ───────────────────────────

export async function register(request, env) {
  const body = await readJson(request);
  const username = normalizeUsername(body.username);
  const password = String(body.password || '');

  const settings = await getSettings(env);
  if (settingNum(settings, 'registration_open') !== 1) {
    return json({ error: 'El registro está cerrado. Pedile una cuenta a tu socio.' }, 403);
  }

  const uErr = validateUsername(username);
  if (uErr) return json({ error: uErr }, 400);
  if (password.length < 6) return json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400);

  const { perfil, error } = parsePerfil(body, { pideBanco: !pagosManuales(settings) });
  if (error) return json({ error }, 400);

  // ── Las condiciones ────────────────────────────────────────────────────
  // Se exigen en el SERVIDOR y no sólo con una casilla en la pantalla: la
  // casilla es para que el jugador lea, el freno de acá es el que hace que no
  // exista una cuenta sin aceptación. Y se guarda QUÉ versión aceptó: sin eso,
  // "aceptó los términos" no dice nada el día que alguien reclame.
  const aceptoCondiciones = body.acepta_condiciones === true || body.acepta_condiciones === 1;
  const mayorDeEdad = body.mayor_de_edad === true || body.mayor_de_edad === 1 || aceptoCondiciones;
  const versionCondiciones = str(body.condiciones_version, 40);
  if (!aceptoCondiciones || !versionCondiciones) {
    return json({ error: 'Para crear la cuenta hay que leer y aceptar las condiciones.' }, 400);
  }

  const tomado = await libreONull(env, username, perfil.doc.documento);
  if (tomado) return json({ error: tomado }, 409);

  // Código de socio: si viene, el jugador queda adjudicado a esa cuenta.
  let cashierId = null;
  let affiliatedAt = null;
  const ref = normalizeRefCode(body.ref);
  if (ref) {
    const socio = await env.DB.prepare(
      "SELECT id FROM users WHERE referral_code = ? AND role = 'cashier' AND status = 'active'"
    ).bind(ref).first();
    if (!socio) return json({ error: `El código de socio "${ref}" no existe` }, 400);
    cashierId = socio.id;
    affiliatedAt = nowSql();
  }

  const password_hash = await hashPassword(password);
  // El primer usuario llamado "admin" se vuelve administrador automáticamente.
  const isAdmin = username === 'admin' ? 1 : 0;
  const role = isAdmin ? 'admin' : 'player';

  const res = await env.DB.prepare(
    `INSERT INTO users (username, password_hash, balance, is_admin, role,
                        phone, first_name, last_name, cedula, doc_type, email, bank,
                        payout_method, payout_details, cashier_id, affiliated_at,
                        condiciones_version, condiciones_at, mayor_de_edad)
     VALUES (?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pago_movil', ?, ?, ?, ?, ?, ?)`
  ).bind(username, password_hash, isAdmin, role, perfil.phone, perfil.firstName,
         perfil.lastName, perfil.doc.documento, perfil.doc.doc_type, perfil.email,
         perfil.bank, `${perfil.bank} ${perfil.phone}`, cashierId, affiliatedAt,
         versionCondiciones, nowSql(), mayorDeEdad ? 1 : 0).run();

  const user = await getUser(env, res.meta.last_row_id);
  const token = await signJwt({ sub: user.id, username, is_admin: isAdmin, role }, env);
  return json({ token, user });
}

// Aceptar las condiciones desde adentro. Es para las cuentas que ya existían
// antes de que hubiera condiciones, y para cuando cambia el texto: se sube la
// versión y a todos se les vuelve a pedir al entrar.
export async function aceptarCondiciones(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const version = str(body.condiciones_version, 40);
  const acepta = body.acepta_condiciones === true || body.acepta_condiciones === 1;
  if (!acepta || !version) {
    return json({ error: 'Hay que aceptar las condiciones para seguir.' }, 400);
  }

  await env.DB.prepare(
    'UPDATE users SET condiciones_version = ?, condiciones_at = ?, mayor_de_edad = 1 WHERE id = ?'
  ).bind(version, nowSql(), auth.userId).run();

  return json({ user: await getUser(env, auth.userId) });
}

// ─────────────────────── Alta de socios (solo la casa) ────────────────────
// El socio no se registra solo: lo da de alta la casa matriz con su ficha
// completa, su comisión y su código de referencia.
export async function adminCreateCashier(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const username = normalizeUsername(body.username);
  const password = String(body.password || '');

  const uErr = validateUsername(username);
  if (uErr) return json({ error: uErr }, 400);
  if (password.length < 6) return json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400);

  const { perfil, error } = parsePerfil(body);
  if (error) return json({ error }, 400);

  const tomado = await libreONull(env, username, perfil.doc.documento);
  if (tomado) return json({ error: tomado }, 409);

  // commission_pct = el % del valor de las fichas que el socio PAGA (típico: 20).
  const comision = Number(body.commission_pct);
  if (!Number.isFinite(comision) || comision < 1 || comision > 100) {
    return json({ error: 'El % que paga por las fichas debe estar entre 1 y 100' }, 400);
  }

  // Participación en la ganancia (franquicia con responsabilidad compartida).
  // 0 = riesgo completo del socio. Máximo 30, por decisión del dueño.
  const share = Number(body.risk_share_pct ?? 0);
  if (!Number.isFinite(share) || share < 0 || share > 30) {
    return json({ error: 'La participación en la ganancia va de 0 a 30%' }, 400);
  }

  // Código propuesto por el dueño, o generado con el id después de insertar.
  let code = null;
  if (body.referral_code) {
    code = normalizeRefCode(body.referral_code);
    if (!code) return json({ error: 'El código debe tener entre 3 y 12 letras o números' }, 400);
    const dup = await env.DB.prepare('SELECT id FROM users WHERE referral_code = ?').bind(code).first();
    if (dup) return json({ error: `El código ${code} ya está usado por otro socio` }, 409);
  }

  const password_hash = await hashPassword(password);
  const res = await env.DB.prepare(
    `INSERT INTO users (username, password_hash, balance, is_admin, role, commission_pct,
                        risk_share_pct, phone, first_name, last_name, cedula, doc_type,
                        email, bank, payout_method, payout_details, collect_details, created_by)
     VALUES (?, ?, 0, 0, 'cashier', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pago_movil', ?, ?, ?)`
  ).bind(username, password_hash, comision, share, perfil.phone, perfil.firstName,
         perfil.lastName, perfil.doc.documento, perfil.doc.doc_type, perfil.email,
         perfil.bank, `${perfil.bank} ${perfil.phone}`, `${perfil.bank} ${perfil.phone}`,
         auth.userId).run();

  const id = res.meta.last_row_id;
  await env.DB.prepare('UPDATE users SET referral_code = ? WHERE id = ?')
    .bind(code || refCodeDeId(id), id).run();

  return json({ cashier: await getUser(env, id) });
}

// Cambiar el código de referencia de un socio.
export async function adminSetRefCode(request, env, userId) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const code = normalizeRefCode(body.referral_code);
  if (!code) return json({ error: 'El código debe tener entre 3 y 12 letras o números' }, 400);

  const target = await getUser(env, userId);
  if (!target) return json({ error: 'Socio no encontrado' }, 404);
  if (target.role !== 'cashier') return json({ error: 'Solo los socios tienen código' }, 400);

  const dup = await env.DB.prepare('SELECT id FROM users WHERE referral_code = ? AND id != ?')
    .bind(code, userId).first();
  if (dup) return json({ error: `El código ${code} ya está usado por otro socio` }, 409);

  await env.DB.prepare('UPDATE users SET referral_code = ? WHERE id = ?').bind(code, userId).run();
  return json({ cashier: await getUser(env, userId) });
}

export async function login(request, env) {
  const body = await readJson(request);
  const username = normalizeUsername(body.username);
  const password = String(body.password || '');

  const row = await env.DB.prepare(
    'SELECT id, password_hash, status FROM users WHERE username = ?'
  ).bind(username).first();

  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return json({ error: 'Usuario o contraseña incorrectos' }, 401);
  }
  if (row.status === 'blocked') {
    return json({ error: 'Tu cuenta está bloqueada. Contactá al administrador.' }, 403);
  }

  const user = await getUser(env, row.id);
  const token = await signJwt(
    { sub: user.id, username: user.username, is_admin: user.is_admin, role: user.role }, env
  );
  return json({ token, user });
}

export async function me(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.response;

  const user = await getUser(env, auth.userId);
  if (!user) return json({ error: 'Usuario no encontrado' }, 404);

  // Los límites viajan con el usuario: la pantalla del juego los necesita
  // para avisar antes de que el servidor rechace la apuesta.
  const s = await getSettings(env);
  return json({
    user,
    config: {
      max_bet_casilla: settingNum(s, 'max_bet_casilla'),
      max_bet_pleno: settingNum(s, 'max_bet_pleno'),
      max_win_per_spin: settingNum(s, 'max_win_per_spin'),
      min_topup: settingNum(s, 'min_topup'),
      min_withdrawal: settingNum(s, 'min_withdrawal'),
      wager_pct_required: settingNum(s, 'wager_pct_required'),
      rate_usd: settingNum(s, 'rate_usd'),
      // Con qué moneda se lee todo y si la plata entra y sale a mano. Van acá
      // para que la pantalla no tenga que adivinarlo ni pedirlo aparte.
      moneda: monedaDe(s),
      pagos_manuales: pagosManuales(s),
    },
  });
}

// Datos de cobro del propio jugador (los completa al pedir su primer retiro).
export async function updateProfile(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const fields = [];
  const values = [];

  if (body.phone !== undefined) {
    const phone = normalizePhone(body.phone);
    if (!phone) return json({ error: 'Teléfono inválido' }, 400);
    fields.push('phone = ?'); values.push(phone);
  }
  if (body.cedula !== undefined) {
    const doc = normalizeDocumento(body.doc_type, body.cedula);
    if (!doc) return json({ error: 'El documento no es válido para el tipo que elegiste' }, 400);
    const dup = await env.DB.prepare('SELECT id FROM users WHERE cedula = ? AND id != ?')
      .bind(doc.documento, auth.userId).first();
    if (dup) return json({ error: 'Ya hay una cuenta registrada con ese documento' }, 409);
    fields.push('cedula = ?'); values.push(doc.documento);
    fields.push('doc_type = ?'); values.push(doc.doc_type);
  }
  if (body.first_name !== undefined) {
    const n = normalizeNombre(body.first_name);
    if (!n) return json({ error: 'Nombre inválido (solo letras)' }, 400);
    fields.push('first_name = ?'); values.push(n);
  }
  if (body.last_name !== undefined) {
    const n = normalizeNombre(body.last_name);
    if (!n) return json({ error: 'Apellido inválido (solo letras)' }, 400);
    fields.push('last_name = ?'); values.push(n);
  }
  if (body.email !== undefined) {
    const e = normalizeEmail(body.email);
    if (!e) return json({ error: 'Correo inválido' }, 400);
    fields.push('email = ?'); values.push(e);
  }
  if (body.bank !== undefined) {
    const b = str(body.bank, 60);
    if (!b) return json({ error: 'Elegí tu banco' }, 400);
    fields.push('bank = ?'); values.push(b);
  }
  if (body.payout_method !== undefined) {
    const m = validMethod(body.payout_method);
    if (!m) return json({ error: 'Método de cobro inválido' }, 400);
    fields.push('payout_method = ?'); values.push(m);
  }
  if (body.payout_details !== undefined) {
    const d = str(body.payout_details, 200);
    if (!d) return json({ error: 'Faltan los datos de cobro' }, 400);
    fields.push('payout_details = ?'); values.push(d);
  }
  if (!fields.length) return json({ error: 'Nada para actualizar' }, 400);

  values.push(auth.userId);
  await env.DB.prepare(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  return json({ user: await getUser(env, auth.userId) });
}

// Cambio de contraseña del propio usuario.
export async function changePassword(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const current = String(body.current_password || '');
  const next = String(body.new_password || '');
  if (next.length < 6) return json({ error: 'La contraseña nueva debe tener al menos 6 caracteres' }, 400);

  const row = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(auth.userId).first();
  if (!row || !(await verifyPassword(current, row.password_hash))) {
    return json({ error: 'La contraseña actual no es correcta' }, 401);
  }

  await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(await hashPassword(next), auth.userId).run();
  return json({ ok: true });
}

// ─────────────────────────── Gestión desde el panel ───────────────────────

export async function adminUsers(request, env, url) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const search = str(url.searchParams.get('search'), 40);
  const role = str(url.searchParams.get('role'), 20);
  const limit = Math.min(Number(url.searchParams.get('limit')) || 200, 500);

  const where = [];
  const binds = [];
  if (search) {
    where.push(`(u.username LIKE ? OR u.phone LIKE ? OR u.cedula LIKE ?
                 OR u.first_name LIKE ? OR u.last_name LIKE ? OR u.email LIKE ?)`);
    const q = `%${search}%`;
    binds.push(q, q, q, q, q, q);
  }
  if (role) { where.push('u.role = ?'); binds.push(role); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = await env.DB.prepare(
    `SELECT u.id, u.username, u.balance, u.held_balance, u.is_admin, u.role, u.status,
            u.phone, u.cedula, u.payout_method, u.payout_details, u.credit_balance,
            u.commission_pct, u.cashier_id, u.wagered_total, u.deposited_total, u.created_at,
            c.username AS cashier_username
       FROM users u
       LEFT JOIN users c ON c.id = u.cashier_id
       ${clause}
      ORDER BY u.created_at DESC
      LIMIT ?`
  ).bind(...binds, limit).all();

  return json({ users: rows.results || [] });
}

// Cambia el rol de un usuario. Al volverlo socio se le fija su comisión.
export async function adminSetRole(request, env, userId) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const role = String(body.role || '');
  if (!['player', 'cashier', 'admin'].includes(role)) return json({ error: 'Rol inválido' }, 400);

  const target = await getUser(env, userId);
  if (!target) return json({ error: 'Usuario no encontrado' }, 404);

  // No permitir quedarse sin ningún administrador.
  if (target.role === 'admin' && role !== 'admin') {
    const admins = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").first();
    if ((admins?.n || 0) <= 1) return json({ error: 'No podés quitar el último administrador' }, 400);
  }
  // Un socio con cupo cargado no puede dejar de serlo sin liquidarlo.
  if (target.role === 'cashier' && role !== 'cashier' && target.credit_balance > 0) {
    return json({ error: `Ese socio todavía tiene ${target.credit_balance} de cupo sin usar. Liquidalo antes de cambiarle el rol.` }, 400);
  }

  let commission = target.commission_pct;
  if (body.commission_pct !== undefined) {
    const c = Number(body.commission_pct);
    if (!Number.isFinite(c) || c < 0 || c > 100) return json({ error: 'El % que paga por las fichas debe estar entre 1 y 100' }, 400);
    commission = c;
  }

  await env.DB.prepare(
    'UPDATE users SET role = ?, is_admin = ?, commission_pct = ? WHERE id = ?'
  ).bind(role, role === 'admin' ? 1 : 0, commission, userId).run();

  // Al volverse socio necesita su código de referencia.
  if (role === 'cashier' && !target.referral_code) {
    await env.DB.prepare('UPDATE users SET referral_code = ? WHERE id = ?')
      .bind(refCodeDeId(userId), userId).run();
  }

  return json({ user: await getUser(env, userId) });
}

// Bloquear / desbloquear una cuenta.
export async function adminSetStatus(request, env, userId) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const status = String(body.status || '');
  if (!['active', 'blocked'].includes(status)) return json({ error: 'Estado inválido' }, 400);
  if (Number(userId) === Number(auth.userId)) return json({ error: 'No podés bloquearte a vos mismo' }, 400);

  const target = await getUser(env, userId);
  if (!target) return json({ error: 'Usuario no encontrado' }, 404);

  await env.DB.prepare('UPDATE users SET status = ? WHERE id = ?').bind(status, userId).run();
  return json({ user: await getUser(env, userId) });
}

// Reset de contraseña desde el panel (el jugador que la olvidó).
export async function adminResetPassword(request, env, userId) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const next = String(body.new_password || '');
  if (next.length < 6) return json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400);

  const target = await getUser(env, userId);
  if (!target) return json({ error: 'Usuario no encontrado' }, 404);

  await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    .bind(await hashPassword(next), userId).run();
  return json({ ok: true });
}

// ─────────────────────────── Movimientos manuales ─────────────────────────

// Carga manual de saldo del dueño (sin pasar por cupo de socio).
export async function adminDeposit(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const username = normalizeUsername(body.username);
  const amount = toPositiveInt(body.amount);
  if (!username) return json({ error: 'Falta el usuario' }, 400);
  if (amount === null) return json({ error: 'Monto inválido' }, 400);

  // La carga manual también va en cifras redondas. Para corregir un error con
  // un monto exacto está el ajuste, que no tiene esta restricción.
  const s = await getSettings(env);
  const multErr = checkMultiplo(amount, settingNum(s, 'monto_multiplo'));
  if (multErr) return json({ error: multErr }, 400);

  const target = await env.DB.prepare('SELECT id, username FROM users WHERE username = ?')
    .bind(username).first();
  if (!target) return json({ error: 'Usuario no encontrado' }, 404);

  await env.DB.batch([
    env.DB.prepare('UPDATE users SET balance = balance + ?, deposited_total = deposited_total + ? WHERE id = ?')
      .bind(amount, amount, target.id),
    env.DB.prepare(
      `INSERT INTO transactions (user_id, type, amount, note, actor_id, source)
       VALUES (?, 'deposit', ?, ?, ?, 'admin')`
    ).bind(target.id, amount, str(body.note, 200) || `Carga manual (${auth.username})`, auth.userId),
  ]);

  return json({ user: await getUser(env, target.id) });
}

// Ajuste manual: suma o resta saldo dejando siempre rastro del motivo.
// Se usa para corregir errores; no cuenta como recarga en los reportes.
export async function adminAdjust(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const username = normalizeUsername(body.username);
  const amount = Number(body.amount);
  const note = str(body.note, 200);

  if (!username) return json({ error: 'Falta el usuario' }, 400);
  if (!Number.isInteger(amount) || amount === 0 || Math.abs(amount) > 1e12) {
    return json({ error: 'Monto inválido (poné un número distinto de cero)' }, 400);
  }
  if (!note) return json({ error: 'Poné el motivo del ajuste: queda en el historial' }, 400);

  const target = await env.DB.prepare('SELECT id, balance, held_balance FROM users WHERE username = ?')
    .bind(username).first();
  if (!target) return json({ error: 'Usuario no encontrado' }, 404);

  if (amount < 0) {
    // Nunca dejar el saldo por debajo de lo congelado en retiros pendientes.
    const available = target.balance - target.held_balance;
    if (available + amount < 0) {
      return json({ error: `Ese jugador solo tiene ${available} disponible (el resto está retenido en retiros pendientes)` }, 400);
    }
  }

  await env.DB.batch([
    env.DB.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').bind(amount, target.id),
    env.DB.prepare(
      `INSERT INTO transactions (user_id, type, amount, note, actor_id, source)
       VALUES (?, 'adjust', ?, ?, ?, 'admin')`
    ).bind(target.id, amount, `${amount > 0 ? '+' : ''}${amount} — ${note} (${auth.username})`, auth.userId),
  ]);

  return json({ user: await getUser(env, target.id) });
}

// ─────────────────────────── Configuración ────────────────────────────────

export async function adminGetSettings(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;
  const settings = await getSettings(env);
  return json({
    settings,
    // Cuánto le deja el pleno a la casa con la configuración actual, más los
    // perfiles listos para elegir desde el panel.
    lightning: infoRayos(settings),
  });
}

export async function adminPutSettings(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const incoming = body && typeof body.settings === 'object' ? body.settings : null;
  if (!incoming) return json({ error: 'Falta la configuración' }, 400);

  const stmts = [];

  for (const [key, raw] of Object.entries(incoming)) {
    if (!(key in DEFAULT_SETTINGS)) continue; // ignorar claves desconocidas
    let value;

    // Los pesos de los rayos vienen como lista: "40,20,15,11,7,4,2,1".
    if (key === 'ltg_pesos') {
      const nums = String(raw).split(',').map((x) => Number(String(x).trim()));
      if (nums.length !== LTG_VALORES.length || nums.some((n) => !Number.isFinite(n) || n < 0)) {
        return json({ error: `Los pesos de los rayos tienen que ser ${LTG_VALORES.length} números de 0 en adelante, separados por coma` }, 400);
      }
      if (!nums.some((n) => n > 0)) {
        return json({ error: 'Al menos un multiplicador tiene que poder salir' }, 400);
      }
      stmts.push(
        env.DB.prepare(
          `INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                                          updated_at = excluded.updated_at,
                                          updated_by = excluded.updated_by`
        ).bind(key, nums.join(','), nowSql(), auth.userId)
      );
      continue;
    }

    const rule = NUMERIC_SETTINGS[key];
    if (rule) {
      const n = Number(raw);
      if (!Number.isFinite(n)) return json({ error: `Valor inválido en ${key}` }, 400);
      if (rule.integer && !Number.isInteger(n)) return json({ error: `${key} tiene que ser un número entero` }, 400);
      if (n < rule.min || n > rule.max) {
        return json({ error: `${key} tiene que estar entre ${rule.min} y ${rule.max}` }, 400);
      }
      value = String(n);
    } else {
      value = String(raw == null ? '' : raw).slice(0, 500);
    }
    stmts.push(
      env.DB.prepare(
        `INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value,
                                        updated_at = excluded.updated_at,
                                        updated_by = excluded.updated_by`
      ).bind(key, value, nowSql(), auth.userId)
    );
  }

  if (!stmts.length) return json({ error: 'Nada para guardar' }, 400);
  await env.DB.batch(stmts);

  const settings = await getSettings(env);
  // Coherencia: el techo de premio por debajo del tope de apuesta no tiene
  // sentido (el jugador no podría ni recuperar lo apostado).
  const lightning = infoRayos(settings);

  if (settingNum(settings, 'max_win_per_spin') < settingNum(settings, 'max_bet_casilla')) {
    return json({
      settings, lightning,
      warning: 'Ojo: el techo de premio quedó por debajo del tope de apuesta. Un jugador podría apostar más de lo que puede cobrar.',
    });
  }
  // Aviso fuerte: con esos pesos la casa PIERDE en los plenos.
  if (lightning.ventaja < 0) {
    return json({
      settings, lightning,
      warning: `Ojo: así el pleno deja ${lightning.ventaja}%, o sea que la casa PIERDE ${Math.abs(lightning.ventaja)}% de todo lo que le apuesten a un número. Bajá el peso de los multiplicadores grandes.`,
    });
  }
  return json({ settings, lightning });
}

// ─────────────────────────── Helper ───────────────────────────────────────

export async function getUser(env, id) {
  return env.DB.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).bind(id).first();
}
