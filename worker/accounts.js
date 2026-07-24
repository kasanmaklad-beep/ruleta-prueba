// ════════════════════════════════════════════════════════════════════════
//  Cuentas: registro, ingreso, perfil del jugador y gestión de usuarios
//  desde el panel (roles, bloqueo, ajustes manuales de saldo).
// ════════════════════════════════════════════════════════════════════════

import {
  json, readJson, str, normalizePhone, normalizeUsername, validateUsername,
  toPositiveInt, hashPassword, verifyPassword, signJwt, getSettings, settingNum,
  requireAuth, requireAdmin, validMethod, USER_FIELDS, nowSql,
  NUMERIC_SETTINGS, DEFAULT_SETTINGS, checkMultiplo,
} from './lib.js';

// ─────────────────────────── Registro e ingreso ───────────────────────────

export async function register(request, env) {
  const body = await readJson(request);
  const username = normalizeUsername(body.username);
  const password = String(body.password || '');
  const phone = normalizePhone(body.phone);

  const settings = await getSettings(env);
  if (settingNum(settings, 'registration_open') !== 1) {
    return json({ error: 'El registro está cerrado. Pedile una cuenta a tu taquillero.' }, 403);
  }

  const uErr = validateUsername(username);
  if (uErr) return json({ error: uErr }, 400);
  if (password.length < 6) return json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400);
  if (!phone) return json({ error: 'Poné un teléfono válido: es a donde te vamos a pagar' }, 400);

  const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (existing) return json({ error: 'Ese usuario ya existe' }, 409);

  const password_hash = await hashPassword(password);
  // El primer usuario llamado "admin" se vuelve administrador automáticamente.
  const isAdmin = username === 'admin' ? 1 : 0;
  const role = isAdmin ? 'admin' : 'player';

  const res = await env.DB.prepare(
    `INSERT INTO users (username, password_hash, balance, is_admin, role, phone)
     VALUES (?, ?, 0, ?, ?, ?)`
  ).bind(username, password_hash, isAdmin, role, phone).run();

  const user = await getUser(env, res.meta.last_row_id);
  const token = await signJwt({ sub: user.id, username, is_admin: isAdmin, role }, env);
  return json({ token, user });
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
      max_bet_per_spin: settingNum(s, 'max_bet_per_spin'),
      max_win_per_spin: settingNum(s, 'max_win_per_spin'),
      min_topup: settingNum(s, 'min_topup'),
      min_withdrawal: settingNum(s, 'min_withdrawal'),
      wager_pct_required: settingNum(s, 'wager_pct_required'),
      rate_usd: settingNum(s, 'rate_usd'),
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
    const cedula = str(body.cedula, 20);
    if (!cedula) return json({ error: 'Cédula inválida' }, 400);
    fields.push('cedula = ?'); values.push(cedula);
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
  if (search) { where.push('(u.username LIKE ? OR u.phone LIKE ? OR u.cedula LIKE ?)'); binds.push(`%${search}%`, `%${search}%`, `%${search}%`); }
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

// Cambia el rol de un usuario. Al volverlo taquillero se le fija su comisión.
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
  // Un taquillero con cupo cargado no puede dejar de serlo sin liquidarlo.
  if (target.role === 'cashier' && role !== 'cashier' && target.credit_balance > 0) {
    return json({ error: `Ese taquillero todavía tiene ${target.credit_balance} de cupo sin usar. Liquidalo antes de cambiarle el rol.` }, 400);
  }

  let commission = target.commission_pct;
  if (body.commission_pct !== undefined) {
    const c = Number(body.commission_pct);
    if (!Number.isFinite(c) || c < 0 || c > 90) return json({ error: 'La comisión debe estar entre 0 y 90%' }, 400);
    commission = c;
  }

  await env.DB.prepare(
    'UPDATE users SET role = ?, is_admin = ?, commission_pct = ? WHERE id = ?'
  ).bind(role, role === 'admin' ? 1 : 0, commission, userId).run();

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

// Carga manual de saldo del dueño (sin pasar por cupo de taquillero).
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
  return json({ settings: await getSettings(env) });
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
  if (settingNum(settings, 'max_win_per_spin') < settingNum(settings, 'max_bet_per_spin')) {
    return json({
      settings,
      warning: 'Ojo: el techo de premio quedó por debajo del tope de apuesta. Un jugador podría apostar más de lo que puede cobrar.',
    });
  }
  return json({ settings });
}

// ─────────────────────────── Helper ───────────────────────────────────────

export async function getUser(env, id) {
  return env.DB.prepare(`SELECT ${USER_FIELDS} FROM users WHERE id = ?`).bind(id).first();
}
