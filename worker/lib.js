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
  // Tope POR CASILLA del paño (no por mesa): el riesgo lo da cuánto puede
  // cobrar una sola posición, no la suma de las apuestas.
  max_bet_casilla: '500',
  // El pleno paga 29:1 (y hasta 500x con Lightning), así que lleva su propio
  // tope, más bajo que el del resto de las casillas.
  max_bet_pleno: '100',
  max_bet_per_spin: '500',   // heredado, ya no se usa
  max_win_per_spin: '50000',
  min_topup: '100',
  min_withdrawal: '500',
  wager_pct_required: '50',
  registration_open: '1',
  // Todo monto que se convierte en saldo va redondeado a este múltiplo, para
  // que no circulen cifras raras. Poner 1 lo desactiva.
  monto_multiplo: '100',
  // Aviso de cupo bajo para los socios.
  cupo_alert: '2000',
  // Rayos (Lightning): cuántos números por giro y con qué peso sale cada
  // multiplicador. Ver LTG_VALORES y ventajaPleno().
  ltg_min: '1',
  ltg_max: '5',
  ltg_pesos: '40,20,15,11,7,4,2,1',
  bank_pago_movil: '',
  bank_transferencia: '',
  bank_p2p: '',
  bank_zelle: '',
  bank_binance: '',
};

// Claves numéricas y su rango válido, para no guardar cualquier cosa.
export const NUMERIC_SETTINGS = {
  rate_usd:           { min: 0.01, max: 1e9,  integer: false },
  max_bet_casilla:    { min: 1,    max: 1e12, integer: true },
  max_bet_pleno:      { min: 1,    max: 1e12, integer: true },
  max_bet_per_spin:   { min: 1,    max: 1e12, integer: true },
  max_win_per_spin:   { min: 1,    max: 1e12, integer: true },
  min_topup:          { min: 0,    max: 1e12, integer: true },
  min_withdrawal:     { min: 0,    max: 1e12, integer: true },
  wager_pct_required: { min: 0,    max: 1000, integer: false },
  registration_open:  { min: 0,    max: 1,    integer: true },
  monto_multiplo:     { min: 1,    max: 100000, integer: true },
  cupo_alert:         { min: 0,    max: 1e12, integer: true },
  ltg_min:            { min: 0,    max: 20,   integer: true },
  ltg_max:            { min: 1,    max: 20,   integer: true },
};

// ── Las ruedas ────────────────────────────────────────────────────────────
// El orden es el de la rueda física: importa para dónde cae la bola en la
// animación, no para las probabilidades (cada casilla sale igual de seguido).
//
// La diferencia de negocio entre las dos: en la americana el jugador pelea
// contra dos ceros y en la europea contra uno. Eso solo ya cambia lo que le
// deja la mesa a la casa: 5,26% contra 2,70% en las apuestas de afuera.
export const RUEDAS = {
  americana: {
    label: 'Americana (0 y 00)',
    dobleCero: true,
    orden: [
      0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1,
      '00', 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2,
    ],
  },
  europea: {
    label: 'Europea (un solo cero)',
    dobleCero: false,
    orden: [
      0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
      5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
    ],
  },
};

// ── Las mesas del salón ───────────────────────────────────────────────────
// El catálogo de VOLTIO. Hoy vive acá porque las mesas todavía no se crean
// desde el panel; en la Etapa 4 pasa a la base de datos (ver
// ESTRUCTURA-SALON.md). El `id` es lo que se guarda en cada movimiento, así
// que una vez usado NO se cambia: rompería el historial.
//
// `activo: false` = la mesa existe y se anuncia en el salón, pero no se puede
// jugar. Se encienden de a una en la Etapa 5, cada una después de verificar
// sus pagos.
// OJO con `pagoPleno`: el pleno paga 29 a 1 SOLO en las mesas con rayos, donde
// los multiplicadores compensan la diferencia. En una mesa sin rayos hay que
// pagar los 35 a 1 de cualquier ruleta: con 29 a 1 y sin rayos la casa se
// quedaría con el 21% del pleno (18,9% en la europea), que es un robo y
// además espanta al jugador. Ver ventajaPlenoClasico().
export const JUEGOS = {
  catatumbo: {
    label: 'Catatumbo',
    rueda: 'americana',
    animales: true,
    rayos: true,
    pagoPleno: 29,
    activo: true,
  },
  americana: {
    label: 'Americana Clásica',
    rueda: 'americana',
    animales: false,
    rayos: false,
    pagoPleno: 35,
    activo: false,
  },
  europea: {
    label: 'Europea Clásica',
    rueda: 'europea',
    animales: false,
    rayos: false,
    pagoPleno: 35,
    activo: false,
  },
  europea_animales: {
    label: 'Europea Catatumbo',
    rueda: 'europea',
    animales: true,
    rayos: true,
    pagoPleno: 29,
    activo: false,
  },
};

// La ficha de una mesa. Sin id válido devuelve null.
export function juegoDe(id) {
  const j = JUEGOS[id];
  if (!j) return null;
  const rueda = RUEDAS[j.rueda];
  if (!rueda) return null;
  return {
    id, ...j,
    ordenRueda: rueda.orden,
    casillas: rueda.orden.length,
    dobleCero: rueda.dobleCero,
    ruedaLabel: rueda.label,
  };
}

export const JUEGO_POR_DEFECTO = 'catatumbo';

// Devuelve la ficha de una mesa válida y ENCENDIDA, o null.
// Sin dato (cliente viejo que todavía no lo manda) cae en la mesa por defecto.
export function mesaJugable(raw) {
  const id = (raw == null || raw === '') ? JUEGO_POR_DEFECTO : String(raw).trim().toLowerCase();
  const j = juegoDe(id);
  if (!j || !j.activo) return null;
  return j;
}

// ── Rayos (Lightning) ─────────────────────────────────────────────────────
// Los 8 multiplicadores posibles de un pleno con rayo. Los valores no cambian
// (son parte de la identidad del juego); lo que se ajusta es cada cuánto sale
// cada uno.
export const LTG_VALORES = [50, 75, 100, 150, 200, 300, 400, 500];

// Perfiles listos para el panel. El nombre es lo que ve el dueño.
export const LTG_PERFILES = {
  equilibrado: { label: 'Equilibrado', pesos: '40,20,15,11,7,4,2,1', ventaja: 5.4 },
  casa_fuerte: { label: 'Casa fuerte', pesos: '47,20,14,13,7,3,1.5,0.5', ventaja: 7.0 },
};

// Lee los pesos guardados. Si vienen rotos, cae al perfil equilibrado.
export function ltgPesos(settings) {
  const crudo = String(settings.ltg_pesos || DEFAULT_SETTINGS.ltg_pesos);
  const nums = crudo.split(',').map((x) => Number(String(x).trim()));
  const ok = nums.length === LTG_VALORES.length
    && nums.every((n) => Number.isFinite(n) && n >= 0)
    && nums.some((n) => n > 0);
  if (!ok) return DEFAULT_SETTINGS.ltg_pesos.split(',').map(Number);
  return nums;
}

// Lo que le deja a la casa el RESTO de la mesa (color, docena, línea): sale
// solo de cuántos ceros tiene la rueda, no se configura.
//   americana → 2/38 = 5,26%   ·   europea → 1/37 = 2,70%
export function ventajaMesa(casillas) {
  const ceros = casillas - 36;
  return Math.round((ceros / casillas) * 1000) / 10;
}

// Ventaja de la casa en el PLENO, en porcentaje, según la configuración.
// Positivo = gana la casa.
//
//   P(el número apostado tenga rayo) = promedio de rayos por giro / casillas
//   devuelve = (1/casillas) · [ P · multiplicador promedio + (1-P) · 30 ]
//
// El 30 es lo que devuelve un pleno sin rayo: paga 29 a 1 más la ficha.
// OJO con `casillas`: la misma configuración de rayos deja porcentajes
// distintos en la americana (38) y en la europea (37), porque el pleno pega
// más seguido cuando hay una casilla menos.
export function ventajaPleno(settings, casillas = 38) {
  const min = Math.max(0, Math.round(settingNum(settings, 'ltg_min')));
  const max = Math.max(min, Math.round(settingNum(settings, 'ltg_max')));
  const pesos = ltgPesos(settings);
  const suma = pesos.reduce((a, b) => a + b, 0);
  const multProm = suma > 0
    ? LTG_VALORES.reduce((a, v, i) => a + v * pesos[i], 0) / suma
    : 0;

  const rayosProm = (min + max) / 2;
  const P = Math.min(1, rayosProm / casillas);
  const devuelve = (1 / casillas) * (P * multProm + (1 - P) * 30);
  return {
    ventaja: Math.round((1 - devuelve) * 1000) / 10,  // % con un decimal
    multProm: Math.round(multProm * 10) / 10,
    rayosProm,
    casillas,
  };
}

// Ventaja del pleno en una mesa SIN rayos: sale sola del pago, no se
// configura. Con el pago clásico de 35 a 1 da lo mismo que el resto de la
// mesa (5,26% en la americana, 2,70% en la europea), que es como debe ser.
export function ventajaPlenoClasico(casillas, pagoPleno) {
  return Math.round((1 - (pagoPleno + 1) / casillas) * 1000) / 10;
}

// Todo lo que el panel necesita saber sobre los rayos. Los mismos pesos dejan
// porcentajes distintos según la rueda, así que se informan los dos: el dueño
// tiene que poder ver qué le deja cada mesa antes de encenderla.
export function infoRayos(settings) {
  const americana = ventajaPleno(settings, RUEDAS.americana.orden.length);
  const europea = ventajaPleno(settings, RUEDAS.europea.orden.length);
  return {
    ...americana,   // la referencia sigue siendo la americana (Catatumbo)
    valores: LTG_VALORES,
    perfiles: LTG_PERFILES,
    ventaja_resto_mesa: ventajaMesa(RUEDAS.americana.orden.length),
    por_rueda: Object.entries(RUEDAS).map(([id, r]) => {
      const casillas = r.orden.length;
      return {
        rueda: id,
        label: r.label,
        casillas,
        ventaja_pleno: (id === 'europea' ? europea : americana).ventaja,
        ventaja_resto_mesa: ventajaMesa(casillas),
      };
    }),
  };
}

// El catálogo tal como lo ve el cliente: todo lo que define cómo se dibuja la
// mesa y cuánto paga. El `orden` de la rueda va incluido a propósito: el
// cilindro del navegador tiene que dibujar las casillas EN EL MISMO ORDEN que
// usó el servidor para sortear, o la bola caería en un número distinto al que
// salió. Una sola fuente de verdad (RUEDAS) evita esa desincronización.
export function catalogoMesas() {
  return Object.keys(JUEGOS).map((id) => {
    const j = juegoDe(id);
    return {
      id: j.id,
      label: j.label,
      rueda: j.rueda,
      rueda_label: j.ruedaLabel,
      orden: j.ordenRueda,
      casillas: j.casillas,
      doble_cero: j.dobleCero,
      animales: j.animales,
      rayos: j.rayos,
      pago_pleno: j.pagoPleno,
      activo: j.activo,
      ventaja_resto_mesa: ventajaMesa(j.casillas),
    };
  });
}

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

// ── Datos personales ──────────────────────────────────────────────────────

// Nombre o apellido: letras (con acentos y ñ), espacios, apóstrofes y guiones.
export function normalizeNombre(v) {
  const s = str(v, 60);
  if (!s) return null;
  if (s.length < 2) return null;
  if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ' -]+$/.test(s)) return null;
  // Capitaliza cada palabra: "josé luis" → "José Luis".
  return s.toLowerCase().replace(/(^|[\s'-])([a-záéíóúñü])/g,
    (m, sep, letra) => sep + letra.toUpperCase());
}

// Tipos de documento aceptados. La cédula venezolana va primera porque es el
// caso de casi todos. Si algún día hace falta otro tipo, se agrega acá.
export const DOC_TYPES = {
  V: { label: 'V — Cédula venezolana',    re: /^\d{6,9}$/,        ej: '12345678' },
  E: { label: 'E — Cédula de extranjero', re: /^\d{6,9}$/,        ej: '84123456' },
  J: { label: 'J — RIF jurídico',         re: /^\d{8,10}$/,       ej: '401234567' },
  G: { label: 'G — RIF gubernamental',    re: /^\d{8,10}$/,       ej: '200012345' },
  P: { label: 'P — Pasaporte',            re: /^[A-Z0-9]{5,15}$/, ej: 'AB123456' },
};

// Normaliza un documento a "V-12345678". Acepta el tipo aparte o pegado al
// número ("V12345678"), con puntos, guiones o espacios de por medio.
// Devuelve { doc_type, documento } o null si no es válido.
export function normalizeDocumento(tipo, numero) {
  let n = str(numero, 30);
  if (!n) return null;
  n = n.toUpperCase().replace(/[\s.\-_/]/g, '');

  let t = String(tipo || '').toUpperCase().trim();

  if (!t) {
    // Sin tipo explícito: si el número arranca con una letra conocida, esa manda.
    const m = n.match(/^([VEJGP])(\d.*)$/);
    if (m) { t = m[1]; n = m[2]; } else { t = 'V'; }
  } else if (['V', 'E', 'J', 'G'].includes(t) && n[0] === t && /^\d+$/.test(n.slice(1))) {
    // Vino el tipo aparte y además pegado al número: se saca la letra repetida.
    n = n.slice(1);
  }

  const def = DOC_TYPES[t];
  if (!def || !def.re.test(n)) return null;
  return { doc_type: t, documento: `${t}-${n}` };
}

// Código de referencia del socio: letras y números, 3 a 12, en mayúscula.
export function normalizeRefCode(v) {
  const s = str(v, 20);
  if (!s) return null;
  const c = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (c.length < 3 || c.length > 12) return null;
  return c;
}

// Código por defecto a partir del id: S0009.
export function refCodeDeId(id) {
  return `S${String(id).padStart(4, '0')}`;
}

export function normalizeEmail(v) {
  const s = str(v, 120);
  if (!s) return null;
  const e = s.toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(e)) return null;
  return e;
}

// Esta versión trabaja SOLO en bolívares. El P2P es para quien paga en
// divisas por fuera: el monto que se registra igual es el acordado en Bs.
export const PAYMENT_METHODS = ['pago_movil', 'transferencia', 'p2p'];

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
  'id, username, balance, held_balance, is_admin, role, status, phone, cedula, doc_type, ' +
  'first_name, last_name, email, bank, referral_code, created_by, affiliated_at, ' +
  'collect_details, risk_share_pct, ' +
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

// El dueño puede hacer todo lo que hace un socio.
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
