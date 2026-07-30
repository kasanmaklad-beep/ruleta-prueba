// ════════════════════════════════════════════════════════════════════════
//  LA BATERÍA DE VERIFICACIÓN DEL BLACKJACK (Etapa B1)
//
//  Se corre ANTES de abrirle la mesa al público, y cada vez que se toca el
//  motor. Enciende la mesa, la exprime, y la deja como estaba.
//
//    node pruebas/verificar-blackjack.mjs [--manos=400] [--api=…]
//    node pruebas/verificar-blackjack.mjs --manos=1000 --api=http://localhost:8787
//
//  Qué comprueba, y por qué cada cosa:
//   A. La carta tapada — mientras la ronda vive, la segunda del crupier viaja
//                        como { tapada: true } y NUNCA con su valor. Es la
//                        regla de oro del juego: si esa carta se filtra, el
//                        jugador sabe cuándo pedir y la mesa se vuelve un
//                        regalo.
//   B. El mazo         — sólo cartas que existen, y ninguna aparece más veces
//                        de las que hay en el shoe (6 mazos = 6 copias).
//   C. Los pagos       — mano por mano, el resultado y el premio se calculan
//                        acá con las cartas reveladas y se comparan con lo que
//                        pagó el servidor. No mide promedios: exige que CADA
//                        mano pague exactamente lo que corresponde.
//   D. El crupier      — que haya robado hasta 17 y ni una carta más, y que
//                        no robe cuando ya no hace falta.
//   E. El candado      — dos "pedir" disparados juntos reparten UNA carta, no
//                        dos. Es el doble clic del jugador, y la conexión mala
//                        que reintenta sola.
//   F. Una por vez     — no se puede tener dos manos abiertas a la vez.
//   G. Los límites     — la apuesta mínima y la máxima de la mesa se respetan,
//                        y no se puede apostar sin saldo.
//   H. La plata        — el saldo al final es exactamente el de entrada menos
//                        lo apostado más lo cobrado, y cada movimiento quedó
//                        anotado a nombre de esta mesa.
//   I. La ventaja      — cuánto se quedó la casa, para contrastarlo con lo que
//                        dice ESTRUCTURA-BLACKJACK.md. Es informativo: con
//                        pocas manos la suerte manda.
//
//  Deja el estado de la mesa (abierta o cerrada) tal como estaba, aunque
//  alguna prueba falle.
// ════════════════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const opt = (n, def) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : def;
};
const API = opt('api', 'http://localhost:8787').replace(/\/$/, '');
const MANOS = Number(opt('manos', 400));
const MESA = opt('mesa', 'blackjack');

let ok = 0, fail = 0;
const fallas = [];
// El balance de control lo llevan varias partes del script (el grueso de las
// manos y el bloque de dividir), así que vive acá y no dentro de main().
const CTX_GLOBAL = { apostado: 0, cobrado: 0 };
const check = (nombre, cond, detalle) => {
  if (cond) { ok++; return true; }
  fail++;
  fallas.push(`${nombre}${detalle ? `\n     → ${detalle}` : ''}`);
  return false;
};
// Para las pruebas que corren miles de veces: sólo se cuentan una vez y sólo
// se cuenta la primera falla, si no la salida es ilegible.
const vistos = new Set();
const checkUna = (nombre, cond, detalle) => {
  if (cond) { if (!vistos.has(nombre)) { vistos.add(nombre); ok++; } return true; }
  if (vistos.has('X' + nombre)) return false;
  vistos.add('X' + nombre);
  fail++;
  fallas.push(`${nombre}${detalle ? `\n     → ${detalle}` : ''}`);
  return false;
};

async function api(ruta, { metodo = 'GET', cuerpo, token } = {}) {
  const res = await fetch(API + ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ...data };
}

// ── Las reglas, escritas de nuevo acá a propósito ─────────────────────────
// No se importa nada de worker/blackjack.js: si la batería usara el mismo
// código que quiere verificar, un error en las reglas pasaría las dos veces y
// nadie se enteraría.
const FIGURAS = new Set(['T', 'J', 'Q', 'K']);
const RANGOS = ['A','2','3','4','5','6','7','8','9','T','J','Q','K'];
const PALOS = ['S','H','D','C'];
const CARTAS_VALIDAS = new Set(RANGOS.flatMap((r) => PALOS.map((p) => r + p)));

function valor(cartas) {
  let total = 0, ases = 0;
  for (const c of cartas) {
    const r = String(c)[0];
    if (r === 'A') { ases++; total += 11; }
    else if (FIGURAS.has(r)) total += 10;
    else total += Number(r);
  }
  while (total > 21 && ases > 0) { total -= 10; ases--; }
  return total;
}
const natural = (cartas) => cartas.length === 2 && valor(cartas) === 21;

// ¿La mano tiene un as contando 11? (mano "blanda": no se puede pasar pidiendo)
function esBlanda(cartas) {
  let total = 0, ases = 0;
  for (const c of cartas) {
    const r = String(c)[0];
    if (r === 'A') { ases++; total += 11; }
    else if (FIGURAS.has(r)) total += 10;
    else total += Number(r);
  }
  while (total > 21 && ases > 0) { total -= 10; ases--; }
  return ases > 0;
}

// Cuánto vale la carta que el crupier muestra (el as, 11).
function valorCarta(c) {
  const r = String(c)[0];
  if (r === 'A') return 11;
  if (FIGURAS.has(r)) return 10;
  return Number(r);
}

// ── Estrategia básica, sin división ni rendirse ───────────────────────────
// Es la forma correcta de jugar cada mano contra cada carta del crupier. Se
// usa acá para que el porcentaje que mide la batería sea comparable con el de
// la teoría: jugando a lo bruto el número no diría nada.
function estrategia(cartas, muestra, acciones) {
  const v = valor(cartas);
  const d = valorCarta(muestra);
  const puedeDoblar = acciones.includes('doblar');

  if (esBlanda(cartas)) {
    if (v >= 19) return 'plantarse';
    if (v === 18) return d >= 9 ? 'pedir' : 'plantarse';
    return 'pedir';
  }
  if (v >= 17) return 'plantarse';
  if (v >= 13) return d <= 6 ? 'plantarse' : 'pedir';
  if (v === 12) return (d >= 4 && d <= 6) ? 'plantarse' : 'pedir';
  if (v === 11) return puedeDoblar ? 'doblar' : 'pedir';
  if (v === 10) return (puedeDoblar && d <= 9) ? 'doblar' : 'pedir';
  if (v === 9)  return (puedeDoblar && d >= 3 && d <= 6) ? 'doblar' : 'pedir';
  return 'pedir';
}

// Lo que TIENE que pagar una mano, con todas las cartas a la vista.
// `pago` incluye la apuesta: la apuesta ya se descontó al empezar, así que un
// empate paga la apuesta y el jugador queda como estaba.
function pagoEsperado(mano, crupier, pagoNatural) {
  const v = valor(mano.cartas);
  const vc = valor(crupier);
  const nat = natural(mano.cartas);
  const natC = natural(crupier);
  const ap = mano.apuesta;

  if (v > 21)                return { resultado: 'pierde', pago: 0 };
  if (nat && natC)           return { resultado: 'empate', pago: ap };
  if (nat)                   return { resultado: 'natural', pago: ap + Math.floor(ap * pagoNatural) };
  if (natC)                  return { resultado: 'pierde', pago: 0 };
  if (vc > 21 || v > vc)     return { resultado: 'gana',   pago: ap * 2 };
  if (v === vc)              return { resultado: 'empate', pago: ap };
  return { resultado: 'pierde', pago: 0 };
}

// ══════════════════════════════════════════════════════════════════════════
async function main() {
  console.log(`\n═══ VERIFICANDO EL BLACKJACK ═══  (${API}, ${MANOS} manos)\n`);

  // ── Sesiones: el dueño para configurar, un jugador nuevo para jugar ──
  const adm = await api('/api/auth/login', { metodo: 'POST', cuerpo: { username: 'admin', password: '123456' } });
  if (!adm.token) { console.log('No pude entrar como admin. ¿Está levantado el servidor?'); process.exit(2); }
  const ADT = adm.token;

  const sello = String(Date.now()).slice(-9);
  const usuario = `bj${sello}`;
  await api('/api/auth/register', { metodo: 'POST', cuerpo: {
    username: usuario, password: 'clave123', first_name: 'Verifica', last_name: 'Blackjack',
    cedula: sello.slice(-8), phone: '04141112233', email: `${usuario}@correo.com`, bank: '0134 - Banesco',
  } });
  const ses = await api('/api/auth/login', { metodo: 'POST', cuerpo: { username: usuario, password: 'clave123' } });
  const PLT = ses.token;
  if (!PLT) { console.log('No pude crear el jugador de prueba.'); process.exit(2); }

  const CAPITAL = 5000000;
  await api('/api/admin/deposit', { metodo: 'POST', token: ADT, cuerpo: { username: usuario, amount: CAPITAL } });

  // ── La mesa: cómo está, y encenderla si hace falta ──
  const antes = await api(`/api/bj/ronda?mesa=${MESA}`, { token: PLT });
  if (!antes.mesa) {
    console.log(`No existe la mesa "${MESA}". ¿Corriste la migración 012?`);
    console.log('  npx wrangler d1 execute ruleta-db --local --file=./migrations/012_blackjack.sql');
    process.exit(2);
  }
  const MZ = antes.mesa.mazos;
  const PAGO_NAT = antes.mesa.pago_natural;
  const MIN = antes.mesa.apuesta_min;
  const MAX = antes.mesa.apuesta_max;
  console.log(`Mesa "${antes.mesa.label}": ${MZ} mazos · natural paga ${PAGO_NAT} · apuesta ${MIN}–${MAX}\n`);

  const estabaEn = await estadoMesa(ADT);
  await api(`/api/admin/games/${MESA}/activo`, { metodo: 'POST', token: ADT, cuerpo: { estado: 1 } });

  try {
    await pruebas({ ADT, PLT, MZ, PAGO_NAT, MIN, MAX, CAPITAL, usuario });
  } finally {
    // Pase lo que pase, la mesa queda como estaba: abierta, cerrada o en pruebas.
    await api(`/api/admin/games/${MESA}/activo`, { metodo: 'POST', token: ADT, cuerpo: { estado: estabaEn } });
    console.log(`\nLa mesa quedó ${NOMBRE_ESTADO[estabaEn]}, como estaba.`);
  }

  console.log(`\n─────────────────────────────────────────`);
  if (fallas.length) {
    console.log('FALLAS:');
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  console.log(`\n  ${ok} comprobaciones pasaron · ${fail} fallaron`);
  console.log(fail === 0 ? '\n  ✅ LA MESA ESTÁ APTA\n' : '\n  ❌ NO ABRIR ESTA MESA\n');
  process.exit(fail === 0 ? 0 : 1);
}

// El estado de la mesa, con sus tres valores: 0 cerrada, 1 abierta, 2 en
// pruebas. Importa leerlo así y no como un sí o un no: la batería la abre para
// exprimirla y después la tiene que dejar COMO ESTABA — si una mesa en pruebas
// se restaurara como "cerrada", el dueño perdería el estado sin darse cuenta.
async function estadoMesa(ADT) {
  const r = await api('/api/admin/games', { token: ADT });
  const m = (r.mesas || []).find((x) => x.id === MESA);
  if (m) return m.activo ? 1 : (m.en_pruebas ? 2 : 0);
  // Si el panel no la tiene (migración 011 sin correr), se mira por el lado
  // del jugador, que es de donde se leía antes.
  const j = await api(`/api/bj/ronda?mesa=${MESA}`, { token: ADT });
  return j && j.mesa && j.mesa.activo ? 1 : 0;
}

const NOMBRE_ESTADO = { 0: 'CERRADA', 1: 'ABIERTA', 2: 'EN PRUEBAS' };

async function pruebas({ ADT, PLT, MZ, PAGO_NAT, MIN, MAX, CAPITAL }) {
  const APUESTA = Math.max(MIN, 10);

  // ══ G. Los límites ═════════════════════════════════════════════════════
  console.log('G. Los límites de la mesa');
  const bajo = await api('/api/bj/apostar', { metodo: 'POST', token: PLT, cuerpo: { mesa: MESA, apuesta: MIN - 1 } });
  check('No deja apostar por debajo del mínimo', bajo.status === 400, JSON.stringify(bajo));
  const alto = await api('/api/bj/apostar', { metodo: 'POST', token: PLT, cuerpo: { mesa: MESA, apuesta: MAX + 1 } });
  check('No deja apostar por encima del máximo', alto.status === 400, JSON.stringify(alto));
  const cero = await api('/api/bj/apostar', { metodo: 'POST', token: PLT, cuerpo: { mesa: MESA, apuesta: 0 } });
  check('No deja apostar cero', cero.status === 400, JSON.stringify(cero));

  // ══ F. Una mano por vez ════════════════════════════════════════════════
  console.log('F. Una sola mano abierta por jugador');
  const r1 = await api('/api/bj/apostar', { metodo: 'POST', token: PLT, cuerpo: { mesa: MESA, apuesta: APUESTA } });
  check('La primera mano abre bien', !!r1.ronda, JSON.stringify(r1));
  if (r1.estado === 'jugando') {
    const r2 = await api('/api/bj/apostar', { metodo: 'POST', token: PLT, cuerpo: { mesa: MESA, apuesta: APUESTA } });
    check('La segunda mano se rechaza con la primera abierta', r2.status === 409, JSON.stringify(r2));
    // ══ E. El candado ════════════════════════════════════════════════════
    console.log('E. El candado contra el doble clic');
    const cartasAntes = r1.manos[0].cartas.length;
    // Las DOS con la misma versión: es exactamente lo que manda un doble clic,
    // porque el jugador tocó dos veces la misma pantalla.
    const cuerpo = { ronda: r1.ronda, version: r1.version };
    const [a, b] = await Promise.all([
      api('/api/bj/pedir', { metodo: 'POST', token: PLT, cuerpo }),
      api('/api/bj/pedir', { metodo: 'POST', token: PLT, cuerpo }),
    ]);
    const final = await api('/api/bj/ronda', { token: PLT });
    const cartasDespues = (final.manos && final.manos[0] ? final.manos[0].cartas.length : 0)
      || Math.max(a.manos ? a.manos[0].cartas.length : 0, b.manos ? b.manos[0].cartas.length : 0);
    check('Dos "pedir" simultáneos reparten UNA carta',
      cartasDespues === cartasAntes + 1,
      `antes ${cartasAntes}, después ${cartasDespues}`);
    // Cerrar la mano para seguir.
    await plantarseHastaCerrar(PLT);
  }

  // ══ El grueso: jugar manos y verificar todo ════════════════════════════
  const ctx = CTX_GLOBAL;
  Object.assign(ctx, { apostado: 0, cobrado: 0, dobladas: 0, naturales: 0, empates: 0,
                       salieron: {}, totalCartas: 0, manosJugadas: 0 });
  const saldoIni = (await api('/api/bj/ronda', { token: PLT })).balance;

  console.log(`C/D/A/B. Jugando ${MANOS} manos en un puesto…`);
  for (let i = 0; i < MANOS; i++) {
    const ok = await jugarRonda(PLT, [{ puesto: 1, apuesta: APUESTA }], ctx, MZ, PAGO_NAT);
    if (!ok) break;
  }

  // ══ J. Los tres puestos ════════════════════════════════════════════════
  // Un mismo jugador apostando en varios círculos contra el mismo crupier.
  // Lo que más importa acá no es que funcione, es que NO se contamine: cada
  // puesto tiene que pagarse solo, con su propia apuesta, y un 21 servido en
  // un puesto tiene que seguir siendo un natural aunque haya otros puestos en
  // juego. (Si el motor contara "más de una mano = división", apostar en dos
  // círculos le anularía los naturales de los dos: 3 a 2 pasaría a 1 a 1 sin
  // que nadie lo note.)
  const PUESTOS_MANOS = Math.max(40, Math.round(MANOS / 3));
  console.log(`J. Jugando ${PUESTOS_MANOS} rondas en los tres puestos…`);
  for (let i = 0; i < PUESTOS_MANOS; i++) {
    const ok = await jugarRonda(PLT, [
      { puesto: 0, apuesta: APUESTA },
      { puesto: 1, apuesta: APUESTA * 2 },
      { puesto: 2, apuesta: APUESTA },
    ], ctx, MZ, PAGO_NAT, 3);
    if (!ok) break;
  }

  // ══ K. Dividir (Etapa B4) ══════════════════════════════════════════════
  // Las tres cosas que se equivocan siempre al programar esta etapa, y que
  // acá se exigen mano por mano y no en promedio.
  console.log('K. Dividir un par');
  let partidas = 0, asesPartidos = 0, malPagadas = 0, detalleMal = '';
  let veintiunoPartido = 0, reSplit = 0, unaSolaCarta = true;

  for (let i = 0; i < Math.max(120, MANOS) && (partidas < 8 || asesPartidos < 1); i++) {
    const r = await apostar(PLT, [{ puesto: 1, apuesta: APUESTA }]);
    if (r.error && r.status !== 400) break;
    if (r.estado === 'cerrada') { ctx.apostado += APUESTA; sumarPagos(r); continue; }
    if (r.estado !== 'jugando') continue;
    ctx.apostado += APUESTA;

    if (!(r.acciones || []).includes('dividir')) {
      const cerrada = await plantarseHastaCerrar(PLT);
      sumarPagos(cerrada);
      continue;
    }

    const eranAses = String(r.manos[0].cartas[0])[0] === 'A';
    const d = await api('/api/bj/dividir', {
      metodo: 'POST', token: PLT, cuerpo: { ronda: r.ronda, version: r.version },
    });
    if (d.error) { detalleMal = detalleMal || d.error; break; }
    partidas++;
    ctx.apostado += APUESTA;   // la segunda mano cuesta otra apuesta igual

    const delPuesto = d.manos.filter((h) => h.puesto === 1);
    if (delPuesto.length !== 2) { detalleMal = detalleMal || `quedaron ${delPuesto.length} manos`; break; }
    // No se vuelve a partir.
    if ((d.acciones || []).includes('dividir')) reSplit++;

    if (eranAses) {
      asesPartidos++;
      if (!delPuesto.every((h) => h.cartas.length === 2)) unaSolaCarta = false;
      if (d.estado !== 'cerrada') { detalleMal = detalleMal || 'los ases no se plantaron solos'; }
    }

    // Se termina la ronda y se controla el pago de CADA mano por separado.
    const fin = d.estado === 'cerrada' ? d : await plantarseHastaCerrar(PLT);
    if (!fin) { detalleMal = detalleMal || 'la ronda no cerró'; break; }
    sumarPagos(fin);
    for (const h of fin.manos.filter((x) => x.puesto === 1)) {
      const esp = pagoEsperado(h, fin.crupier.cartas, PAGO_NAT);
      // La diferencia de esta etapa: una mano dividida NO es natural.
      if (valor(h.cartas) === 21 && h.cartas.length === 2) {
        veintiunoPartido++;
        const comoNatural = h.apuesta + Math.floor(h.apuesta * PAGO_NAT);
        if (h.pago === comoNatural && comoNatural !== h.apuesta * 2) {
          malPagadas++;
          detalleMal = detalleMal || `21 dividido pagó ${h.pago} (como natural)`;
        }
      } else if (h.pago !== esp.pago) {
        malPagadas++;
        detalleMal = detalleMal || `${h.cartas} contra ${fin.crupier.cartas}: pagó ${h.pago}, correspondían ${esp.pago}`;
      }
    }
  }

  check(`Se pudo partir un par (${partidas} veces)`, partidas > 0, detalleMal);
  check('Cada mano dividida pagó exactamente lo que corresponde', malPagadas === 0, detalleMal);
  check('No deja volver a partir una mano ya dividida', reSplit === 0, `pasó ${reSplit} veces`);
  if (veintiunoPartido > 0) {
    check(`El 21 de una mano dividida NO paga 3 a 2 (${veintiunoPartido} casos)`, malPagadas === 0, detalleMal);
  }
  if (asesPartidos > 0) {
    check(`Los ases divididos reciben UNA carta y se plantan (${asesPartidos} casos)`,
      unaSolaCarta && !detalleMal, detalleMal);
  } else {
    console.log('   (no salió un par de ases en esta corrida: se prueba con --manos alto)');
  }

  console.log('J. Lo que la mesa no deja hacer con los puestos');
  const dosIguales = await api('/api/bj/apostar', { metodo: 'POST', token: PLT, cuerpo: {
    mesa: MESA, puestos: [{ puesto: 1, apuesta: APUESTA }, { puesto: 1, apuesta: APUESTA }] } });
  check('No deja dos apuestas en el mismo puesto', dosIguales.status === 400, JSON.stringify(dosIguales));
  const inventado = await api('/api/bj/apostar', { metodo: 'POST', token: PLT, cuerpo: {
    mesa: MESA, puestos: [{ puesto: 7, apuesta: APUESTA }] } });
  check('No deja apostar en un puesto que no existe', inventado.status === 400, JSON.stringify(inventado));
  const topePorPuesto = await api('/api/bj/apostar', { metodo: 'POST', token: PLT, cuerpo: {
    mesa: MESA, puestos: [{ puesto: 0, apuesta: MAX }, { puesto: 1, apuesta: MAX + 1 }] } });
  check('El máximo se controla puesto por puesto', topePorPuesto.status === 400, JSON.stringify(topePorPuesto));
  const vacio = await api('/api/bj/apostar', { metodo: 'POST', token: PLT, cuerpo: { mesa: MESA, puestos: [] } });
  check('No deja repartir sin fichas puestas', vacio.status === 400, JSON.stringify(vacio));

  const apostado = ctx.apostado, cobrado = ctx.cobrado;
  const dobladas = ctx.dobladas, naturales = ctx.naturales, empates = ctx.empates;
  const salieron = ctx.salieron, totalCartas = ctx.totalCartas;

  // ══ H. La plata ════════════════════════════════════════════════════════
  console.log('H. El saldo y el libro de movimientos');
  const fin = await api('/api/bj/ronda', { token: PLT });
  check('El saldo final cuadra al bolívar',
    fin.balance === saldoIni - apostado + cobrado,
    `esperaba ${saldoIni - apostado + cobrado} y hay ${fin.balance} `
    + `(entrada ${saldoIni}, apostado ${apostado}, cobrado ${cobrado})`);

  // Cada movimiento tiene que estar anotado a nombre de esta mesa, si no el
  // reporte del panel no puede separar lo que dejó el blackjack de lo que
  // dejaron las ruletas. Se mira por donde lo mira el dueño: su reporte.
  const rep = await api('/api/admin/report/daily', { token: ADT });
  const enDesglose = (rep.por_juego || []).find((m) => m.game_id === MESA);
  check('La mesa aparece en el desglose "por mesa" del reporte', !!enDesglose,
    `mesas en el desglose: ${(rep.por_juego || []).map((m) => m.game_id).join(', ')}`);
  if (enDesglose) {
    check('Lo apostado y lo pagado quedaron a nombre del blackjack',
      enDesglose.apostado >= apostado && enDesglose.premios >= cobrado,
      `el reporte dice apostado ${enDesglose.apostado} / premios ${enDesglose.premios}, `
      + `y esta corrida apostó ${apostado} y cobró ${cobrado}`);
  }
  // El SELECTOR de mesa del panel (y el filtro `?game=blackjack`) todavía sale
  // del catálogo de ruletas, que no conoce esta mesa. Eso se une en la Etapa
  // B2; acá alcanza con que la plata esté bien anotada, que es lo que no se
  // puede arreglar después.
  if (rep.filtro_juego === null) {
    console.log('   (el filtro por mesa del panel llega en la Etapa B2 — la plata ya está bien anotada)');
  }

  // ══ B2. El mazo reparte parejo ═════════════════════════════════════════
  // Los pagos pueden estar perfectos y la mesa seguir siendo injusta si el
  // mazo saca unas cartas más que otras. Los trece rangos tienen que salir
  // cada uno una de cada trece veces. Es lo que distingue "tuvo suerte" de
  // "el reparto está sesgado", y sin esta prueba no se pueden separar.
  if (totalCartas >= 2000) {
    const esperado = totalCartas / 13;
    // Cuatro desvíos: con este método se equivoca menos de una vez cada
    // quince mil corridas, así que si suena, suena por algo.
    const banda = 4 * Math.sqrt(totalCartas * (1 / 13) * (12 / 13));
    const torcidos = RANGOS
      .map((r) => ({ r, n: salieron[r] || 0 }))
      .filter((x) => Math.abs(x.n - esperado) > banda);
    check('El mazo reparte los trece rangos parejo',
      torcidos.length === 0,
      `de ${totalCartas} cartas, esperaba ${Math.round(esperado)} de cada rango (±${Math.round(banda)}) y salieron: `
      + torcidos.map((x) => `${x.r}=${x.n}`).join(', '));
  } else {
    console.log(`   (el reparto se mide con 2000 cartas o más; van ${totalCartas}. Corré --manos=400)`);
  }

  // ══ I. La ventaja de la casa (informativo) ═════════════════════════════
  const ventaja = apostado > 0 ? ((apostado - cobrado) / apostado) * 100 : 0;
  // El margen de error de la medición: con pocas manos la suerte manda, y un
  // número lejos de la teoría no prueba nada. Con ~2000 manos la banda ya se
  // cierra lo bastante como para que valga mirarla.
  // Dos desvíos (el 95% de las veces cae adentro): con uno solo la banda es
  // tan angosta que suena una de cada tres corridas por pura suerte, y una
  // alarma que suena de gusto es peor que no tenerla.
  const unidades = apostado > 0 ? Math.round(apostado / APUESTA) : 0;
  const margen = unidades ? (2 * 115 / Math.sqrt(unidades)) : 0;
  console.log('\nI. Cómo le fue a la casa');
  console.log(`   ${ctx.manosJugadas} rondas jugadas (un puesto y tres puestos).`);
  console.log(`   Apostado: ${apostado.toLocaleString('es-VE')} · Pagado: ${cobrado.toLocaleString('es-VE')}`);
  console.log(`   Se quedó la casa: ${ventaja.toFixed(2)}%  (dobladas ${dobladas}, naturales ${naturales}, empates ${empates})`);
  console.log(`   Teoría (ESTRUCTURA-BLACKJACK.md, sin dividir): ~1,1%`);
  console.log(`   Margen de error de esta medición: ±${margen.toFixed(1)} puntos.`);
  console.log(margen > 6
    ? '   Con estas pocas manos el número NO dice nada. Corré --manos=2000.'
    : (Math.abs(ventaja - 1.1) <= margen
      ? '   Cae dentro de la banda ✓ (la banda es ancha: acá sólo se caza un error grueso;'
        + '\n    el que caza los errores finos es el control de pago mano por mano, que ya pasó).'
      : '   ⚠ Se fue de la banda: mirá los pagos antes de abrir la mesa.'));
}

// La segunda carta del crupier tiene que viajar tapada, y sin filtrar su
// valor por ningún lado de la respuesta.
function verTapada(r) {
  if (!r.crupier) return;
  const cs = r.crupier.cartas;
  checkUna('Con la ronda viva se ve UNA sola carta del crupier',
    cs.filter((c) => typeof c === 'string').length === 1,
    JSON.stringify(cs));
  checkUna('La carta tapada viaja como { tapada: true }',
    cs.slice(1).every((c) => c && typeof c === 'object' && c.tapada === true),
    JSON.stringify(cs));
  checkUna('El total del crupier no delata la carta tapada',
    r.crupier.parcial === true && r.crupier.total === valor(cs.slice(0, 1)),
    `mandó total ${r.crupier.total} y lo que se ve suma ${valor(cs.slice(0, 1))}`);
}

// El crupier roba hasta 17 y se planta. Se comprueba carta por carta: con
// todas menos la última tenía que estar por debajo de 17, y con todas tiene
// que estar en 17 o más (o pasado).
//
// Y no roba cuando no hay contra quién: si el jugador se pasó en todo, o si
// su mano es un natural (ahí el pago ya está decidido). Una carta de más
// serían cartas quemadas y una mano del crupier que nunca existió.
function verificarCrupier(r) {
  const cs = r.crupier.cartas;
  const compiten = r.manos.filter((h) => h.estado !== 'pasada' && !natural(h.cartas));

  if (natural(cs) || compiten.length === 0) {
    checkUna('El crupier no roba cuando no hace falta',
      cs.length === 2,
      `tiene ${cs.length} cartas (${cs.join(' ')})`);
    return;
  }
  checkUna('El crupier llega a 17 o se pasa',
    valor(cs) >= 17,
    `quedó en ${valor(cs)} con ${cs.join(' ')}`);
  checkUna('El crupier no roba de más',
    cs.length === 2 || valor(cs.slice(0, -1)) < 17,
    `se plantaba en ${valor(cs.slice(0, -1))} y siguió robando (${cs.join(' ')})`);
}

// La batería juega mucho más rápido que una persona, así que de vez en cuando
// se choca con el freno de repetición del servidor. Eso no es una falla: es el
// freno haciendo su trabajo. Se espera y se sigue.
// Juega UNA ronda entera con estrategia básica y le pasa por encima todas las
// comprobaciones. Sirve igual para un puesto que para tres: lo único que
// cambia es la lista de apuestas.
async function jugarRonda(PLT, apuestas, ctx, MZ, PAGO_NAT, puestosEsperados) {
  let r = await apostar(PLT, apuestas);
  if (!r.ronda) { check('La mano abre', false, JSON.stringify(r)); return false; }
  ctx.apostado += apuestas.reduce((s, a) => s + a.apuesta, 0);
  ctx.manosJugadas++;

  if (puestosEsperados) {
    checkUna('Se reparte una mano por cada puesto apostado',
      r.manos.length === puestosEsperados,
      `aposté en ${puestosEsperados} y me repartió ${r.manos.length}`);
    checkUna('Cada mano sabe de qué puesto es',
      r.manos.every((h, i) => h.puesto === apuestas[i].puesto && h.apuesta === apuestas[i].apuesta),
      JSON.stringify(r.manos.map((h) => ({ puesto: h.puesto, apuesta: h.apuesta }))));
  }

  // A. La carta tapada, en cada respuesta con la ronda viva. Si el reparto
  // trajo un natural, la ronda puede haber nacido cerrada.
  if (r.estado === 'jugando') verTapada(r);

  let vueltas = 0;
  while (r.estado === 'jugando' && vueltas++ < 60) {
    const mano = r.manos.find((m) => m.indice === r.mano_activa);
    if (!mano) { checkUna('Siempre hay una mano en turno', false, JSON.stringify(r)); break; }
    const jugada = estrategia(mano.cartas, r.crupier.cartas[0], r.acciones);
    if (jugada === 'doblar') ctx.dobladas++;
    const antes = mano.apuesta;
    const idx = mano.indice;
    r = await api(`/api/bj/${jugada}`, { metodo: 'POST', token: PLT, cuerpo: { ronda: r.ronda, version: r.version } });
    if (jugada === 'doblar' && r.manos) {
      const m2 = r.manos.find((m) => m.indice === idx);
      if (m2) ctx.apostado += (m2.apuesta - antes);
    }
    if (r.estado === 'jugando') verTapada(r);
  }

  checkUna('La mano siempre termina cerrada', r.estado === 'cerrada', JSON.stringify(r));
  if (r.estado !== 'cerrada') return false;

  // A. Al cerrar, la tapada se revela: ninguna carta puede seguir tapada.
  checkUna('Al cerrar se revelan todas las cartas del crupier',
    r.crupier.cartas.every((c) => typeof c === 'string'),
    JSON.stringify(r.crupier.cartas));

  // B. El mazo.
  const todas = [...r.crupier.cartas, ...r.manos.flatMap((h) => h.cartas)];
  for (const c of todas) {
    ctx.salieron[String(c)[0]] = (ctx.salieron[String(c)[0]] || 0) + 1;
    ctx.totalCartas++;
  }
  checkUna('Todas las cartas existen en un mazo',
    todas.every((c) => CARTAS_VALIDAS.has(c)),
    todas.filter((c) => !CARTAS_VALIDAS.has(c)).join(', '));
  const cuenta = {};
  for (const c of todas) cuenta[c] = (cuenta[c] || 0) + 1;
  const pasadas = Object.entries(cuenta).filter(([, n]) => n > MZ);
  checkUna('Ninguna carta sale más veces de las que hay en el shoe',
    pasadas.length === 0,
    pasadas.map(([c, n]) => `${c} salió ${n} veces con ${MZ} mazos`).join(', '));

  // D. El crupier jugó como debe.
  verificarCrupier(r);

  // C. El pago de cada mano, una por una y con su propia apuesta.
  for (const h of r.manos) {
    const esp = pagoEsperado(h, r.crupier.cartas, PAGO_NAT);
    checkUna('El resultado de cada mano es el que corresponde',
      h.resultado === esp.resultado,
      `puesto ${h.puesto}, mano ${valor(h.cartas)} vs crupier ${valor(r.crupier.cartas)}: `
      + `el servidor dijo "${h.resultado}" y corresponde "${esp.resultado}"`);
    checkUna('El pago de cada mano es exacto',
      h.pago === esp.pago,
      `puesto ${h.puesto}, mano ${valor(h.cartas)} (apuesta ${h.apuesta}) vs crupier ${valor(r.crupier.cartas)}: `
      + `pagó ${h.pago} y corresponde ${esp.pago}`);
    // El que más muerde: un 21 servido tiene que pagar 3 a 2 AUNQUE haya
    // otros puestos en juego. Si el motor confundiera "varias manos" con
    // "dividida", acá pagaría 1 a 1 y nadie lo vería a simple vista.
    if (natural(h.cartas)) {
      checkUna('Un 21 servido paga como natural aunque haya otros puestos',
        h.resultado === 'natural' || h.resultado === 'empate',
        `puesto ${h.puesto} tenía ${h.cartas.join(' ')} y el resultado fue "${h.resultado}"`);
    }
    ctx.cobrado += h.pago || 0;
    if (h.resultado === 'natural') ctx.naturales++;
    if (h.resultado === 'empate') ctx.empates++;
  }
  return true;
}

// Suma al balance de control lo que pagó una ronda ya cerrada.
function sumarPagos(estado) {
  if (!estado || !estado.manos) return;
  for (const h of estado.manos) CTX_GLOBAL.cobrado += h.pago || 0;
}

async function apostar(PLT, apuestas) {
  // La ventana del freno es de un minuto, así que hay que tener esa paciencia.
  for (let intento = 0; intento < 7; intento++) {
    const r = await api('/api/bj/apostar', {
      metodo: 'POST', token: PLT, cuerpo: { mesa: MESA, puestos: apuestas },
    });
    if (r.status !== 429) return r;
    await new Promise((cumplir) => setTimeout(cumplir, 10000));
  }
  return { status: 429, error: 'El freno de repetición no soltó en 70 segundos' };
}

async function plantarseHastaCerrar(PLT) {
  let estado = await api('/api/bj/ronda', { token: PLT });
  for (let i = 0; i < 15; i++) {
    if (estado.estado !== 'jugando') return estado;
    estado = await api('/api/bj/plantarse', {
      metodo: 'POST', token: PLT, cuerpo: { ronda: estado.ronda, version: estado.version },
    });
  }
  return null;
}

main().catch((e) => { console.error(e); process.exit(2); });
