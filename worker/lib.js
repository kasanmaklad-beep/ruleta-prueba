// ════════════════════════════════════════════════════════════════════════
//  Utilidades compartidas del Worker: respuestas, validación, autenticación,
//  criptografía, JWT y configuración del negocio.
//  Todo lo que usan varios módulos vive acá para no duplicarlo.
// ════════════════════════════════════════════════════════════════════════

// ─────────────────────────── Respuestas HTTP ──────────────────────────────

export function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

export async function readJson(request) {
  try { return await request.json(); } catch (e) { return {}; }
}

// ─────────────────────────── Configuración ────────────────────────────────

// Valores por defecto: si falta una fila en `settings`, el sistema igual
// funciona con estos números (deben coincidir con migrations/002).
export const DEFAULT_SETTINGS = {
  rate_usd: '40',
  max_bet_per_spin: '500',
  max_win_per_spin: '50000',
  min_topup: '100',
  min_withdrawal: '500',
  wager_pct_required: '50',
  registration_open: '1',
  // Todo monto que se convierte en saldo va redondeado a este múltiplo, para
  // que no circulen cifras raras. Poner 1 lo desactiva.
  monto_multiplo: '100',
  bank_pago_movil: '',
  bank_transferencia: '',
  bank_zelle: '',
  bank_binance: '',
};

// Claves numéricas y su rango válido, para no guardar cualquier cosa.
export const NUMERIC_SETTINGS = {
  rate_usd:           { min: 0.01, max: 1e9,  integer: false },
  max_bet_per_spin:   { min: 1,    max: 1e12, integer: true },
  max_win_per_spin:   { min: 1,    max: 1e12, integer: true },
  min_topup:          { min: 0,    max: 1e12, integer: true },
  min_withdrawal:     { min: 0,    max: 1e12, integer: true },
  wager_pct_required: { min: 0,    max: 1000, integer: false },
  registration_open:  { min: 0,    max: 1,    integer: true },
  monto_multiplo:     { min: 1,    max: 100000, integer: true },
};

export async function getSettings(env) {
  const rows = await env.DB.prepare('SELECT key, value FROM settings').all();
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows.results || []) out[r.key] = r.value;
  return out;
}

// Lee un número de la configuración con respaldo en el valor por defecto.
export function settingNum(settings, key) {
  const n = Number(settings[key]);
  if (Number.isFinite(n)) return n;
  return Number(DEFAULT_SETTINGS[key]);
}

// ─────────────────────────── Validación ───────────────────────────────────

export function normalizeUsername(u) {
  return String(u || '').trim().toLowerCase();
}

export function validateUsername(u) {
  if (!u) return 'Falta el nombre de usuario';
  if (u.length < 3 || u.length > 32) return 'El usuario debe tener entre 3 y 32 caracteres';
  if (!/^[a-z0-9_]+$/.test(u)) return 'Solo letras, números y guion bajo';
  return null;
}

export function toPositiveInt(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n <= 0 || n > 1e12) return null;
  return n;
}

export function toNonNegInt(v) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > 1e12) return null;
  return n;
}

// Texto corto y limpio para notas, referencias y datos de contacto.
export function str(v, max = 200) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  return s.slice(0, max);
}

// Teléfono venezolano flexible: dígitos, espacios, guiones y +.
export function normalizePhone(v) {
  const s = str(v, 32);
  if (!s) return null;
  const cleaned = s.replace(/[^\d+]/g, '');
  if (cleaned.replace(/\D/g, '').length < 7) return null;
  return cleaned;
}

// ── Múltiplos ─────────────────────────────────────────────────────────────
// Los montos que se vuelven saldo se manejan en cifras redondas (por defecto
// múltiplos de 100) para que nadie ande con números raros. La casa absorbe la
// diferencia de comisiones bancarias, así que redondear siempre juega a favor
// del jugador.

// Devuelve un mensaje de error si el monto no es múltiplo, o null si está bien.
export function checkMultiplo(amount, multiplo) {
  if (!multiplo || multiplo <= 1) return null;
  if (amount % multiplo === 0) return null;
  const abajo = Math.floor(amount / multiplo) * multiplo;
  const arriba = abajo + multiplo;
  return `Los montos van en múltiplos de ${multiplo}. Probá con ${abajo > 0 ? abajo.toLocaleString('es-VE') + ' o ' : ''}${arriba.toLocaleString('es-VE')}.`;
}

// Redondea hacia arriba al múltiplo (se usa al convertir divisas: lo que sobra
// lo pone la casa).
export function redondearArriba(amount, multiplo) {
  if (!multiplo || multiplo <= 1) return amount;
  return Math.ceil(amount / multiplo) * multiplo;
}

export const PAYMENT_METHODS = ['pago_movil', 'transferencia', 'zelle', 'binance'];
// Métodos que se cobran en divisa y necesitan conversión con la tasa.
export const FX_METHODS = ['zelle', 'binance'];

export function validMethod(v) {
  const s = String(v || '');
  return PAYMENT_METHODS.includes(s) ? s : null;
}

// ─────────────────────────── Fechas ───────────────────────────────────────
// La base guarda todo en UTC (datetime('now')). El negocio cierra el día con
// el calendario de Venezuela (UTC-4), así que los reportes desplazan 4 horas.
export const VE_OFFSET = '-4 hours';

export function nowSql() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

// Fecha de hoy en Venezuela, formato YYYY-MM-DD.
export function todayVE() {
  const d = new Date(Date.now() - 4 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

// ─────────────────────────── Autenticación ────────────────────────────────

// Campos del usuario que se devuelven al cliente (nunca el hash de la clave).
export const USER_FIELDS =
  'id, username, balance, held_balance, is_admin, role, status, phone, cedula, ' +
  'payout_method, payout_details, credit_balance, commission_pct, cashier_id, ' +
  'wagered_total, deposited_total, created_at';

export async function requireAuth(request, env) {
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return { error: true, response: json({ error: 'No autenticado' }, 401) };

  const payload = await verifyJwt(token, env);
  if (!payload) return { error: true, response: json({ error: 'Sesión inválida o expirada' }, 401) };

  // Releer siempre de la base: el rol o el bloqueo pueden haber cambiado
  // después de emitido el token.
  const row = await env.DB.prepare(
    'SELECT id, username, role, status, credit_balance FROM users WHERE id = ?'
  ).bind(payload.sub).first();

  if (!row) return { error: true, response: json({ error: 'Usuario no encontrado' }, 401) };
  if (row.status === 'blocked') {
    return { error: true, response: json({ error: 'Tu cuenta está bloqueada. Contactá al administrador.' }, 403) };
  }

  return {
    error: false,
    userId: row.id,
    username: row.username,
    role: row.role || 'player',
    creditBalance: row.credit_balance || 0,
  };
}

// Exige que el usuario tenga alguno de los roles indicados.
export async function requireRole(request, env, roles) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth;
  if (!roles.includes(auth.role)) {
    return { error: true, response: json({ error: 'Acceso denegado' }, 403) };
  }
  return auth;
}

export function requireAdmin(request, env) {
  return requireRole(request, env, ['admin']);
}

// El dueño puede hacer todo lo que hace un taquillero.
export function requireCashier(request, env) {
  return requireRole(request, env, ['cashier', 'admin']);
}

// ─────────────────────────── Cripto ───────────────────────────────────────

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iterations = 100000;
  const bits = await deriveBits(password, salt, iterations);
  return `pbkdf2$${iterations}$${b64(salt)}$${b64(bits)}`;
}

export async function verifyPassword(password, stored) {
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

export async function signJwt(payload, env) {
  const secret = getSecret(env);
  const now = Math.floor(Date.now() / 1000);
  const full = { ...payload, iat: now, exp: now + 24 * 60 * 60 }; // 24h
  const header = b64urlBytes(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const bodyEnc = b64urlBytes(new TextEncoder().encode(JSON.stringify(full)));
  const data = `${header}.${bodyEnc}`;
  const sig = await hmac(data, secret);
  return `${data}.${b64urlBytes(sig)}`;
}

export async function verifyJwt(token, env) {
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
export function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// ─────────────────────────── Base64 ───────────────────────────────────────

function b64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function unb64(str64) {
  const bin = atob(str64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function b64urlBytes(bytes) {
  return b64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s) {
  let t = s.replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4) t += '=';
  return unb64(t);
}
