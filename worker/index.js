// ════════════════════════════════════════════════════════════════
//  Worker de Ruleta Catatumbo — API de usuarios, saldos y juego
//  Sirve la API en /api/* y delega el resto a los assets estáticos.
//  Bindings (wrangler.jsonc): DB (D1), ASSETS (static), JWT_SECRET (secret)
// ════════════════════════════════════════════════════════════════

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Rutas de API
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env, url);
      } catch (err) {
        return json({ error: 'Error interno', detail: String(err && err.message || err) }, 500);
      }
    }

    // /admin no es un archivo: servir el shell de la SPA (index.html)
    if (url.pathname === '/admin' || url.pathname === '/admin/') {
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

  if (method === 'POST' && path === '/api/auth/register') return register(request, env);
  if (method === 'POST' && path === '/api/auth/login')    return login(request, env);
  if (method === 'GET'  && path === '/api/me')            return me(request, env);
  if (method === 'POST' && path === '/api/game/bet')      return gameBet(request, env);
  if (method === 'POST' && path === '/api/game/win')      return gameWin(request, env);
  if (method === 'GET'  && path === '/api/admin/users')         return adminUsers(request, env);
  if (method === 'GET'  && path === '/api/admin/transactions')  return adminTransactions(request, env);
  if (method === 'POST' && path === '/api/admin/deposit')       return adminDeposit(request, env);

  return json({ error: 'No encontrado' }, 404);
}

// ─────────────────────────────── Endpoints ────────────────────────────────

async function register(request, env) {
  const body = await readJson(request);
  const username = normalizeUsername(body.username);
  const password = String(body.password || '');

  const uErr = validateUsername(username);
  if (uErr) return json({ error: uErr }, 400);
  if (password.length < 6) return json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400);

  const existing = await env.DB.prepare('SELECT id FROM users WHERE username = ?').bind(username).first();
  if (existing) return json({ error: 'Ese usuario ya existe' }, 409);

  const password_hash = await hashPassword(password);
  // El primer usuario llamado "admin" se vuelve administrador automáticamente.
  const isAdmin = username === 'admin' ? 1 : 0;

  const res = await env.DB.prepare(
    'INSERT INTO users (username, password_hash, balance, is_admin) VALUES (?, ?, 0, ?)'
  ).bind(username, password_hash, isAdmin).run();

  const user = {
    id: res.meta.last_row_id,
    username,
    balance: 0,
    is_admin: isAdmin,
  };
  const token = await signJwt({ sub: user.id, username, is_admin: isAdmin }, env);
  return json({ token, user });
}

async function login(request, env) {
  const body = await readJson(request);
  const username = normalizeUsername(body.username);
  const password = String(body.password || '');

  const row = await env.DB.prepare(
    'SELECT id, username, password_hash, balance, is_admin FROM users WHERE username = ?'
  ).bind(username).first();

  if (!row || !(await verifyPassword(password, row.password_hash))) {
    return json({ error: 'Usuario o contraseña incorrectos' }, 401);
  }

  const user = { id: row.id, username: row.username, balance: row.balance, is_admin: row.is_admin };
  const token = await signJwt({ sub: user.id, username: user.username, is_admin: user.is_admin }, env);
  return json({ token, user });
}

async function me(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.response;
  const row = await env.DB.prepare(
    'SELECT id, username, balance, is_admin FROM users WHERE id = ?'
  ).bind(auth.userId).first();
  if (!row) return json({ error: 'Usuario no encontrado' }, 404);
  return json({ user: row });
}

async function gameBet(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const amount = toPositiveInt(body.amount);
  if (amount === null) return json({ error: 'Monto inválido' }, 400);

  // Descuento atómico: solo resta si hay saldo suficiente.
  const upd = await env.DB.prepare(
    'UPDATE users SET balance = balance - ? WHERE id = ? AND balance >= ?'
  ).bind(amount, auth.userId, amount).run();

  if (upd.meta.changes === 0) {
    const cur = await env.DB.prepare('SELECT balance FROM users WHERE id = ?').bind(auth.userId).first();
    return json({ error: 'Saldo insuficiente', balance: cur ? cur.balance : 0 }, 400);
  }

  await env.DB.prepare(
    'INSERT INTO transactions (user_id, type, amount, note) VALUES (?, ?, ?, ?)'
  ).bind(auth.userId, 'bet', amount, body.note ? String(body.note).slice(0, 200) : null).run();

  const cur = await env.DB.prepare('SELECT balance FROM users WHERE id = ?').bind(auth.userId).first();
  return json({ balance: cur.balance });
}

async function gameWin(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const amount = toPositiveInt(body.amount);
  if (amount === null) return json({ error: 'Monto inválido' }, 400);

  await env.DB.prepare('UPDATE users SET balance = balance + ? WHERE id = ?')
    .bind(amount, auth.userId).run();
  await env.DB.prepare(
    'INSERT INTO transactions (user_id, type, amount, note) VALUES (?, ?, ?, ?)'
  ).bind(auth.userId, 'win', amount, body.note ? String(body.note).slice(0, 200) : null).run();

  const cur = await env.DB.prepare('SELECT balance FROM users WHERE id = ?').bind(auth.userId).first();
  return json({ balance: cur.balance });
}

async function adminUsers(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;
  const rows = await env.DB.prepare(
    'SELECT id, username, balance, is_admin, created_at FROM users ORDER BY created_at DESC'
  ).all();
  return json({ users: rows.results || [] });
}

async function adminTransactions(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;
  const rows = await env.DB.prepare(
    `SELECT t.id, t.user_id, u.username, t.type, t.amount, t.note, t.created_at
       FROM transactions t JOIN users u ON u.id = t.user_id
      ORDER BY t.created_at DESC, t.id DESC
      LIMIT 50`
  ).all();
  return json({ transactions: rows.results || [] });
}

async function adminDeposit(request, env) {
  const auth = await requireAdmin(request, env);
  if (auth.error) return auth.response;

  const body = await readJson(request);
  const username = normalizeUsername(body.username);
  const amount = toPositiveInt(body.amount);
  if (!username) return json({ error: 'Falta el usuario' }, 400);
  if (amount === null) return json({ error: 'Monto inválido' }, 400);

  const target = await env.DB.prepare('SELECT id, username FROM users WHERE username = ?')
    .bind(username).first();
  if (!target) return json({ error: 'Usuario no encontrado' }, 404);

  await env.DB.prepare('UPDATE users SET balance = balance + ? WHERE id = ?')
    .bind(amount, target.id).run();
  await env.DB.prepare(
    'INSERT INTO transactions (user_id, type, amount, note) VALUES (?, ?, ?, ?)'
  ).bind(target.id, 'deposit', amount, body.note ? String(body.note).slice(0, 200) : `Carga admin (${auth.username})`).run();

  const updated = await env.DB.prepare(
    'SELECT id, username, balance, is_admin, created_at FROM users WHERE id = ?'
  ).bind(target.id).first();
  return json({ user: updated });
}

// ─────────────────────────────── Auth helpers ─────────────────────────────

async function requireAuth(request, env) {
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return { error: true, response: json({ error: 'No autenticado' }, 401) };
  const payload = await verifyJwt(token, env);
  if (!payload) return { error: true, response: json({ error: 'Sesión inválida o expirada' }, 401) };
  return { error: false, userId: payload.sub, username: payload.username };
}

async function requireAdmin(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth;
  // Releer de la DB para no confiar solo en el claim del token.
  const row = await env.DB.prepare('SELECT is_admin FROM users WHERE id = ?').bind(auth.userId).first();
  if (!row || !row.is_admin) return { error: true, response: json({ error: 'Acceso denegado' }, 403) };
  return auth;
}

// ─────────────────────────────── Validación ───────────────────────────────

function normalizeUsername(u) {
  return String(u || '').trim().toLowerCase();
}
function validateUsername(u) {
  if (!u) return 'Falta el nombre de usuario';
  if (u.length < 3 || u.length > 32) return 'El usuario debe tener entre 3 y 32 caracteres';
  if (!/^[a-z0-9_]+$/.test(u)) return 'Solo letras, números y guion bajo';
  return null;
}
function toPositiveInt(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0 || n > 1e12) return null;
  return n;
}

// ─────────────────────────────── Cripto ───────────────────────────────────

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 100000;
  const bits = await deriveBits(password, salt, iterations);
  return `pbkdf2$${iterations}$${b64(salt)}$${b64(bits)}`;
}
async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = parseInt(parts[1], 10);
  const salt = unb64(parts[2]);
  const bits = await deriveBits(password, salt, iterations);
  return timingSafeEqual(b64(bits), parts[3]);
}
async function deriveBits(password, salt, iterations) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, key, 256
  );
  return new Uint8Array(bits);
}

async function signJwt(payload, env) {
  const secret = getSecret(env);
  const now = Math.floor(Date.now() / 1000);
  const full = { ...payload, iat: now, exp: now + 24 * 60 * 60 }; // 24h
  const header = b64url(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const bodyEnc = b64url(new TextEncoder().encode(JSON.stringify(full)));
  const data = `${header}.${bodyEnc}`;
  const sig = await hmac(data, secret);
  return `${data}.${b64urlBytes(sig)}`;
}
async function verifyJwt(token, env) {
  const secret = getSecret(env);
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const data = `${parts[0]}.${parts[1]}`;
  const expected = b64urlBytes(await hmac(data, secret));
  if (!timingSafeEqual(expected, parts[2])) return null;
  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(unb64url(parts[1])));
  } catch (e) {
    return null;
  }
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) return null;
  return payload;
}
async function hmac(data, secret) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}
function getSecret(env) {
  if (!env.JWT_SECRET) throw new Error('Falta JWT_SECRET (configurar con: wrangler secret put JWT_SECRET)');
  return env.JWT_SECRET;
}

// Comparación en tiempo constante (sobre strings ya codificados)
function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// ─────────────────────────────── Base64 ───────────────────────────────────

function b64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function unb64(str) {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64url(bytes) { return b64urlBytes(bytes); }
function b64urlBytes(bytes) {
  return b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return unb64(str);
}

// ─────────────────────────────── Utilidades ───────────────────────────────

async function readJson(request) {
  try { return await request.json(); } catch (e) { return {}; }
}
function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
