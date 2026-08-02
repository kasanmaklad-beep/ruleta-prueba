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
  // ── La moneda de la casa ───────────────────────────────────────────────
  // 'USD' = dólares (la v1: efectivo y P2P a mano) · 'VES' = bolívares.
  // No convierte nada: los saldos son enteros y esto dice cómo se LEEN y con
  // qué símbolo se muestran. Cambiar la moneda con saldos cargados no los
  // reconvierte — es una decisión de arranque, no una perilla del día a día.
  moneda: 'USD',
  // ── Cómo entra y sale la plata ─────────────────────────────────────────
  // '1' = a mano: el jugador no manda pagos digitales por la app; recarga y
  // cobra en efectivo con su taquillero. Los datos bancarios se ocultan.
  // '0' = el circuito digital de siempre (Pago Móvil, transferencia, P2P).
  pagos_manuales: '1',
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
  pagos_manuales:     { min: 0,    max: 1,    integer: true },
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
// EL CATÁLOGO DE VERDAD VIVE EN LA BASE (tabla `games`, migración 011): es lo
// que el dueño toca desde el panel. Esta lista de acá abajo quedó como RED DE
// SEGURIDAD y arranque: se usa tal cual si la tabla todavía no existe (código
// nuevo desplegado antes de correr la migración) o si viniera vacía. Los
// valores tienen que coincidir con lo que siembra la migración.
// El `id` es lo que se guarda en cada movimiento, así que una vez usado NO se
// cambia: rompería el historial.
//
// `activo: false` = la mesa existe y se anuncia en el salón, pero no se puede
// jugar. Se encienden de a una en la Etapa 5, cada una después de verificar
// sus pagos.
//
// En la BASE `activo` no es un sí o un no: es un estado de tres valores, y por
// eso la columna es un entero.
//   0 = cerrada       — nadie entra, y el salón no la muestra.
//   1 = abierta       — abierta para todos.
//   2 = en pruebas    — la mesa vive en producción, pero sólo la ven y la
//                       juegan el dueño y las cuentas de prueba. Es el paso
//                       que faltaba: hasta ahora, para probar una mesa nueva
//                       con plata de verdad había que abrírsela al público.
// Ojo con esto al leer el código: la ficha que arma armarFicha() sigue
// teniendo `activo` BOOLEANO y significa "abierta para todos". El estado en
// pruebas viaja aparte, en `enPruebas`. Se hizo así a propósito: cualquier
// pantalla vieja que pregunte `if (mesa.activo)` sigue haciendo lo correcto
// (no mostrar una mesa que todavía no es del público) en vez de heredar un
// 2 que le parecería un sí.
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
    orden: 10,
    icono: '🐆⚡',
    color: '#ffd84a',
    detalle1: 'Ruleta americana 0/00 · 38 animales',
    detalle2: 'Rayos con premios hasta 500x',
  },
  americana: {
    label: 'Americana Clásica',
    rueda: 'americana',
    animales: false,
    rayos: false,
    pagoPleno: 35,
    activo: false,
    orden: 20,
    icono: '🎩',
    color: '#4fd1a5',
    detalle1: 'Ruleta americana de toda la vida',
    detalle2: 'Sin animales · el pleno paga 35 a 1',
  },
  europea: {
    label: 'Europea Clásica',
    rueda: 'europea',
    animales: false,
    rayos: false,
    pagoPleno: 35,
    activo: false,
    orden: 30,
    icono: '🎡',
    color: '#a78bfa',
    detalle1: 'Ruleta europea de un solo cero',
    detalle2: 'La favorita de los jugadores finos',
  },
  europea_animales: {
    label: 'Europea Catatumbo',
    rueda: 'europea',
    animales: true,
    rayos: true,
    pagoPleno: 29,
    activo: false,
    orden: 40,
    icono: '🐆🎡',
    color: '#ffd84a',
    detalle1: 'Europea de un solo cero · con animales',
    detalle2: 'Rayos con premios hasta 500x',
  },
};

// Arma la ficha completa de una mesa a partir de una fila (de la base o de la
// red de seguridad de arriba) y de su rueda. Devuelve null si la rueda que
// dice no existe: mejor no dibujar nada que dibujar una ruleta inventada.
function armarFicha(id, j) {
  if (!id || !j) return null;
  const tipo = j.tipo === 'blackjack' ? 'blackjack' : 'ruleta';

  // Lo que comparten todas las mesas, sean del juego que sean: cómo se
  // anuncian en el salón y si están abiertas.
  // El estado de tres valores de la base (ver el comentario de JUEGOS). La red
  // de seguridad de arriba usa true/false, que valen 1 y 0.
  const estado = j.activo === true ? 1 : (j.activo === false ? 0 : Number(j.activo) || 0);

  const comun = {
    id,
    tipo,
    label: j.label || id,
    activo: estado === 1,
    enPruebas: estado === 2,
    orden: Number.isFinite(Number(j.orden)) ? Number(j.orden) : 100,
    icono: j.icono || null,
    color: j.color || null,
    detalle1: j.detalle1 || null,
    detalle2: j.detalle2 || null,
  };

  // Una mesa de blackjack no tiene rueda, ni ceros, ni pleno: tiene mazos,
  // cuánto paga el natural, los límites de la apuesta y cuántos puestos se
  // pueden jugar a la vez.
  if (tipo === 'blackjack') {
    const num = (v, def, min, max) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= min && n <= max ? n : def;
    };
    return {
      ...comun,
      mazos: num(j.mazos, 6, 1, 8),
      pagoNatural: num(j.pago_natural != null ? j.pago_natural : j.pagoNatural, 1.5, 1, 2),
      apuestaMin: num(j.apuesta_min != null ? j.apuesta_min : j.apuestaMin, 10, 1, 1e9),
      apuestaMax: num(j.apuesta_max != null ? j.apuesta_max : j.apuestaMax, 500, 1, 1e9),
      puestos: num(j.puestos, 1, 1, 3),
    };
  }

  const rueda = RUEDAS[j.rueda];
  if (!rueda) return null;
  const pleno = Number(j.pagoPleno != null ? j.pagoPleno : j.pago_pleno);
  return {
    ...comun,
    rueda: j.rueda,
    animales: !!j.animales,
    rayos: !!j.rayos,
    pagoPleno: Number.isFinite(pleno) ? pleno : 35,
    ordenRueda: rueda.orden,
    casillas: rueda.orden.length,
    dobleCero: rueda.dobleCero,
    ruedaLabel: rueda.label,
  };
}

// Lee las mesas de la base. Devuelve null si la tabla todavía no existe (el
// código nuevo desplegado antes de correr la migración) o si vino vacía: ahí
// manda la red de seguridad, y el salón sigue abierto igual.
async function mesasDeLaBase(env) {
  // Se intenta con las columnas del blackjack (migraciones 012 y 013); si esas
  // migraciones todavía no corrieron, se vuelve a pedir sin ellas. Así el salón
  // sigue abierto aunque el código nuevo salga antes que la migración.
  const CON_BJ = `SELECT id, label, rueda, animales, rayos, pago_pleno, activo, orden,
                         icono, color, detalle1, detalle2,
                         tipo, mazos, pago_natural, apuesta_min, apuesta_max, puestos
                    FROM games ORDER BY orden, id`;
  const SIN_BJ = `SELECT id, label, rueda, animales, rayos, pago_pleno, activo, orden,
                         icono, color, detalle1, detalle2
                    FROM games ORDER BY orden, id`;
  for (const sql of [CON_BJ, SIN_BJ]) {
    try {
      const r = await env.DB.prepare(sql).all();
      const filas = r.results || [];
      return filas.length ? filas : null;
    } catch (e) { /* probamos con la consulta más vieja */ }
  }
  return null;
}

// Todas las mesas, en fichas listas para usar. Es la única puerta de entrada
// al catálogo: todo lo demás pasa por acá.
export async function catalogoInterno(env) {
  const filas = await mesasDeLaBase(env);
  if (filas) return filas.map((f) => armarFicha(f.id, f)).filter(Boolean);
  return Object.keys(JUEGOS)
    .map((id) => armarFicha(id, JUEGOS[id]))
    .filter(Boolean)
    .sort((a, b) => a.orden - b.orden);
}

// La ficha de una mesa por id. Sin id válido devuelve null.
export async function juegoDe(env, id) {
  const cat = await catalogoInterno(env);
  return cat.find((m) => m.id === id) || null;
}

export const JUEGO_POR_DEFECTO = 'catatumbo';

// Devuelve la ficha de una mesa válida y ENCENDIDA, o null.
// Sin dato (cliente viejo que todavía no lo manda) cae en la mesa por defecto.
// Ojo: esto es para el GIRO de la ruleta, así que una mesa de blackjack no
// sirve por más abierta que esté — el giro no sabría qué hacer con ella.
export async function mesaJugable(env, raw, auth) {
  const id = (raw == null || raw === '') ? JUEGO_POR_DEFECTO : String(raw).trim().toLowerCase();
  const j = await juegoDe(env, id);
  if (!j || j.tipo !== 'ruleta') return null;
  if (!puedeEntrar(j, auth)) return null;
  return j;
}

// ── Las mesas en pruebas y quién entra ────────────────────────────────────
// Un probador es el dueño (que necesita mirar la mesa con plata de verdad
// antes de abrírsela a nadie) y las cuentas de prueba de la casa. Las cuentas
// de prueba se reconocen por el nombre: se llaman `prueba`, `prueba2`,
// `prueba3`… No es un rol nuevo en la base a propósito — un rol se le puede
// asignar a un jugador por error y quedaría entrando a mesas sin terminar,
// mientras que para llamarse "prueba7" hay que crear la cuenta a mano.
export function esProbador(auth) {
  if (!auth || auth.error) return false;
  if (auth.role === 'admin') return true;
  return /^prueba[0-9]*$/.test(String(auth.username || '').toLowerCase());
}

// ¿Este usuario puede entrar a esta mesa? Abierta, cualquiera; en pruebas,
// sólo un probador; cerrada, nadie.
export function puedeEntrar(mesa, auth) {
  if (!mesa) return false;
  if (mesa.activo) return true;
  return !!mesa.enPruebas && esProbador(auth);
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
//
// `auth` es quién está pidiendo el catálogo. Las mesas EN PRUEBAS sólo salen
// para un probador: al jugador común no se le esconden con un `display:none`,
// simplemente no viajan — si viajaran, cualquiera que abra las herramientas
// del navegador vería una mesa que no existe para él.
export async function catalogoMesas(env, auth) {
  const cat = (await catalogoInterno(env))
    .filter((j) => !j.enPruebas || esProbador(auth));
  return cat.map((j) => (j.tipo === 'blackjack' ? {
    // Una mesa de blackjack: el salón la anuncia y la pantalla del 21 se arma
    // con esto. Nada de ruedas ni de plenos.
    id: j.id,
    tipo: j.tipo,
    label: j.label,
    activo: j.activo,
    en_pruebas: j.enPruebas,
    icono: j.icono,
    color: j.color,
    detalle1: j.detalle1,
    detalle2: j.detalle2,
    mazos: j.mazos,
    pago_natural: j.pagoNatural,
    apuesta_min: j.apuestaMin,
    apuesta_max: j.apuestaMax,
    puestos: j.puestos,
  } : {
    id: j.id,
    tipo: j.tipo,
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
    en_pruebas: j.enPruebas,
    // Presentación: lo que el salón usa para armar la tarjeta.
    icono: j.icono,
    color: j.color,
    detalle1: j.detalle1,
    detalle2: j.detalle2,
    ventaja_resto_mesa: ventajaMesa(j.casillas),
  }));
}

// ── Alta y edición de una mesa (lo que valida el panel) ───────────────────
// Devuelve { error } o { mesa } con los campos ya limpios y listos para
// guardar. La regla que no se negocia: SIN RAYOS EL PLENO PAGA 35. Los 29
// existen solo donde los multiplicadores compensan; permitirlos en una mesa
// clásica sería quedarse con el 21% del pleno, y eso no se arregla después.
export function validarMesa(body, { creando = false } = {}) {
  const out = {};

  if (creando) {
    const id = String(body.id || '').trim().toLowerCase();
    if (!/^[a-z][a-z0-9_]{2,23}$/.test(id)) {
      return { error: 'El id va en minúsculas, empieza con letra y lleva entre 3 y 24 caracteres (letras, números y guion bajo)' };
    }
    out.id = id;
  }

  const label = str(body.label, 40);
  if (!label || label.length < 2) return { error: 'Falta el nombre de la mesa' };
  out.label = label;

  // Lo que se anuncia en el salón vale igual para los dos juegos.
  const presentacion = () => {
    // El estado de la mesa: 0 cerrada, 1 abierta, 2 en pruebas. Se acepta
    // también el `activo: true/false` de antes.
    // Si el panel manda `estado`, manda ese. Si no (cliente viejo, o una mesa
    // que se guardó sin tocar el selector) se deduce de los dos campos que sí
    // vienen: así una mesa EN PRUEBAS no se cierra sola al guardarla.
    const est = body.estado !== undefined ? Number(body.estado)
              : (body.activo ? 1 : (body.en_pruebas ? 2 : 0));
    out.activo = [0, 1, 2].includes(est) ? est : 0;
    const orden = Number(body.orden);
    out.orden = Number.isInteger(orden) && orden >= 0 && orden <= 9999 ? orden : 100;
    out.icono = str(body.icono, 12);
    out.color = /^#[0-9a-fA-F]{6}$/.test(String(body.color || '')) ? String(body.color) : null;
    out.detalle1 = str(body.detalle1, 80);
    out.detalle2 = str(body.detalle2, 80);
  };

  // ── Una mesa de blackjack ────────────────────────────────────────────────
  if (body.tipo === 'blackjack') {
    out.tipo = 'blackjack';

    const mazos = Number(body.mazos);
    if (!Number.isInteger(mazos) || mazos < 1 || mazos > 8) {
      return { error: 'Los mazos van de 1 a 8 (lo habitual son 6)' };
    }
    out.mazos = mazos;

    // El natural es el precio de la mesa. A 3:2 la casa se queda con ~0,5%;
    // a 6:5 con ~1,9% — casi cuatro veces más, y el jugador que sabe lo nota
    // enseguida y no vuelve. Se permite, pero solo esos dos.
    const pago = Number(body.pago_natural);
    if (![1.5, 1.2].includes(pago)) {
      return { error: 'El natural paga 3 a 2 (1.5) o 6 a 5 (1.2). Cualquier otro número no es una mesa de blackjack conocida.' };
    }
    out.pago_natural = pago;

    const min = Number(body.apuesta_min);
    const max = Number(body.apuesta_max);
    if (!Number.isInteger(min) || min < 1) return { error: 'La apuesta mínima tiene que ser un número mayor que cero' };
    if (!Number.isInteger(max) || max < min) return { error: 'La apuesta máxima no puede ser menor que la mínima' };
    out.apuesta_min = min;
    out.apuesta_max = max;

    const puestos = Number(body.puestos);
    if (!Number.isInteger(puestos) || puestos < 1 || puestos > 3) {
      return { error: 'Los puestos van de 1 a 3' };
    }
    out.puestos = puestos;

    presentacion();
    return { mesa: out };
  }

  // ── Una mesa de ruleta ───────────────────────────────────────────────────
  out.tipo = 'ruleta';
  const rueda = String(body.rueda || '').trim().toLowerCase();
  if (!RUEDAS[rueda]) return { error: 'Esa rueda no existe (americana o europea)' };
  out.rueda = rueda;

  out.animales = body.animales ? 1 : 0;
  out.rayos = body.rayos ? 1 : 0;

  const pleno = Number(body.pago_pleno);
  if (![29, 35].includes(pleno)) {
    return { error: 'El pleno paga 35 a 1 (mesa clásica) o 29 a 1 (mesa con rayos)' };
  }
  if (pleno === 29 && !out.rayos) {
    return {
      error: 'Una mesa SIN rayos tiene que pagar 35 a 1. Con 29 a 1 y sin multiplicadores '
        + 'la casa se quedaría con más del 20% del pleno: espanta al jugador y no se nota hasta que es tarde.',
    };
  }
  out.pago_pleno = pleno;

  presentacion();
  return { mesa: out };
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
// 'efectivo' es el método de la v1: el jugador paga y cobra en la mano del
// taquillero, y en la app queda sólo el registro.
export const PAYMENT_METHODS = ['pago_movil', 'transferencia', 'p2p', 'efectivo'];

// ¿La casa está en modo manual? (ver DEFAULT_SETTINGS.pagos_manuales)
export function pagosManuales(settings) {
  return String(settings.pagos_manuales ?? DEFAULT_SETTINGS.pagos_manuales) === '1';
}

// La moneda configurada, para los mensajes del servidor.
export function monedaDe(settings) {
  return String(settings.moneda || DEFAULT_SETTINGS.moneda).toUpperCase() === 'VES' ? 'VES' : 'USD';
}

// Un monto escrito como lo lee la gente: "$1,250" o "1.250 Bs". El símbolo va
// adelante en dólares y atrás en bolívares, que es como se escribe en cada uno.
export function plata(n, settings) {
  const v = Math.round(Number(n) || 0);
  if (monedaDe(settings || {}) === 'VES') {
    return `${v.toLocaleString('es-VE', { maximumFractionDigits: 0 })} Bs`;
  }
  return `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

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
  'wagered_total, deposited_total, created_at, ' +
  // Qué versión de las condiciones aceptó. Viaja con el usuario para que la
  // pantalla sepa, al entrar, si hay que volver a pedírselas.
  'condiciones_version, condiciones_at, mayor_de_edad';

export async function requireAuth(request, env) {
  const header = request.headers.get('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return { error: true, response: json({ error: 'No autenticado' }, 401) };

  const payload = await verifyJwt(token, env);
  if (!payload) return { error: true, response: json({ error: 'Sesión inválida o expirada' }, 401) };

  // Releer siempre de la base: el rol o el bloqueo pueden haber cambiado
  // después de emitido el token.
  const row = await env.DB.prepare(
    'SELECT id, username, role, status, credit_balance, sesion FROM users WHERE id = ?'
  ).bind(payload.sub).first();

  if (!row) return { error: true, response: json({ error: 'Usuario no encontrado' }, 401) };
  if (row.status === 'blocked') {
    return { error: true, response: json({ error: 'Tu cuenta está bloqueada. Contactá al administrador.' }, 403) };
  }

  // ── UNA SOLA SESIÓN POR CUENTA ─────────────────────────────────────────
  // La marca del pase tiene que ser la misma que la guardada en la cuenta.
  // Si no lo es, alguien entró después con este usuario y este aparato ya no
  // manda. El 401 lleva `sesion_tomada` para que la pantalla sepa que no es
  // un pase vencido —eso se arregla volviendo a entrar— sino que lo echaron,
  // que es otra cosa y merece otro mensaje.
  //
  // Cuenta sin marca guardada (NULL) = sesión de antes de esta función: se
  // acepta. Deja de aceptarse sola la primera vez que su dueño vuelve a
  // entrar, y así nadie se quedó afuera en medio de una mano el día que se
  // publicó esto.
  if (row.sesion && payload.sid !== row.sesion) {
    return {
      error: true,
      response: json({
        error: 'Entraste desde otro teléfono. Esta cuenta se usa en un aparato a la vez.',
        sesion_tomada: true,
      }, 401),
    };
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

// Abre una sesión nueva para una cuenta y devuelve su marca.
//
// Cada vez que alguien entra se genera una marca al azar y se GUARDA en la
// cuenta, pisando la anterior. Como el pase que se entrega lleva esa marca
// adentro y requireAuth compara las dos, pisar la marca vieja es lo que echa
// al aparato anterior: su pase sigue siendo válido y sin vencer, pero ya no
// coincide con la cuenta.
//
// Se usa también al cambiar la clave: cambiar la contraseña tiene que sacar a
// cualquiera que estuviera adentro con la anterior, o no sirve de nada.
export async function abrirSesion(env, userId) {
  const sid = crypto.randomUUID();
  await env.DB.prepare('UPDATE users SET sesion = ? WHERE id = ?').bind(sid, userId).run();
  return sid;
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
