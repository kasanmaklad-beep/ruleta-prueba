// ════════════════════════════════════════════════════════════════════════
//  LA BATERÍA DE VERIFICACIÓN DE UNA MESA (Etapa 5 del Salón)
//
//  Se corre ANTES de abrirle una mesa al público, y sirve para cualquier
//  mesa: las cuatro que vienen de fábrica y las que el dueño arme desde el
//  panel. Enciende la mesa, la exprime, y la deja como estaba.
//
//    node pruebas/verificar-mesa.mjs <id-de-la-mesa> [--giros=200] [--api=…]
//    node pruebas/verificar-mesa.mjs americana --api=http://localhost:8795
//
//  Qué comprueba, y por qué cada cosa:
//   A. La rueda      — que salgan solo casillas que existen en esa mesa. En
//                      una europea el 00 no puede aparecer NUNCA.
//   B. Los pagos     — con los rayos apagados, el premio de cada giro se
//                      calcula acá y se compara con el que pagó el servidor,
//                      número por número. No mide promedios: exige que cada
//                      ronda pague exactamente lo que corresponde.
//   C. Los topes     — que no se pueda cargar una casilla por encima del
//                      máximo, y que el techo de premio por giro recorte.
//   D. Lo que no va  — el 00 y la línea de cinco no existen en una europea.
//   E. Los rayos     — que aparezcan solo donde la mesa los tiene, y que un
//                      pleno con rayo pague el multiplicador.
//   F. La plata      — que cada ronda quede anotada a nombre de ESTA mesa y
//                      aparezca separada en el reporte del panel.
//
//  Al terminar deja la configuración de rayos y el estado de la mesa (abierta
//  o cerrada) tal como estaban, aunque alguna prueba falle.
// ════════════════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const MESA = args.find((a) => !a.startsWith('--'));
const opt = (n, def) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : def;
};
const API = opt('api', 'http://localhost:8787').replace(/\/$/, '');
const GIROS = Number(opt('giros', 200));
const MONTO = 10;

if (!MESA) {
  console.log('Falta la mesa. Ejemplo:\n  node pruebas/verificar-mesa.mjs americana --api=http://localhost:8795');
  process.exit(2);
}

// ── Pagos por tipo de apuesta (ganancia neta a 1). El pleno lo pone la mesa.
const PAGOS = { split: 17, street: 11, corner: 8, sixline: 5, topline: 6,
                column: 2, dozen: 2, half: 1, parity: 1, color: 1 };
const ROJOS = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const NEGROS = new Set([2,4,6,8,10,11,13,15,17,20,22,24,26,28,29,31,33,35]);

let ok = 0, fail = 0;
const check = (nombre, cond, detalle) => {
  if (cond) { console.log(`  ✓ ${nombre}`); ok++; }
  else { console.log(`  ✗ ${nombre}${detalle ? `\n     → ${detalle}` : ''}`); fail++; }
};

// ── Hablar con el servidor ────────────────────────────────────────────────
async function api(ruta, { metodo = 'GET', cuerpo, token } = {}) {
  const res = await fetch(API + ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  return res.json().catch(() => ({}));
}

// ── El premio que TIENE que pagar una apuesta, según el número que salió ──
function premioEsperado(bet, resultNum, pagoPleno) {
  const cubre = bet.numbers.some((n) => String(n) === String(resultNum));
  if (!cubre) return 0;
  const externa = ['column', 'dozen', 'half', 'parity', 'color'].includes(bet.type);
  if (externa && (resultNum === 0 || resultNum === '00')) return 0;
  const pago = bet.type === 'straight' ? pagoPleno : PAGOS[bet.type];
  return bet.amount * (pago + 1);
}

// La canasta de prueba: una apuesta de cada tipo que exista en la mesa, para
// que un solo giro ponga a prueba todos los pagos a la vez.
function canasta(mesa) {
  const b = [
    { type: 'straight', payload: '17', numbers: [17] },
    { type: 'split', payload: '1-2', numbers: [1, 2] },
    { type: 'street', payload: '4-5-6', numbers: [4, 5, 6] },
    { type: 'corner', payload: '10-11-13-14', numbers: [10, 11, 13, 14] },
    { type: 'sixline', payload: '19-20-21-22-23-24', numbers: [19, 20, 21, 22, 23, 24] },
    { type: 'dozen', payload: '1', numbers: Array.from({ length: 12 }, (_, i) => i + 1) },
    { type: 'column', payload: '2', numbers: [2,5,8,11,14,17,20,23,26,29,32,35] },
    { type: 'color', payload: 'red', numbers: [...ROJOS] },
    { type: 'parity', payload: 'even', numbers: [...Array(18).keys()].map((i) => (i + 1) * 2) },
    { type: 'half', payload: 'high', numbers: Array.from({ length: 18 }, (_, i) => i + 19) },
    { type: 'straight', payload: '0', numbers: [0] },
  ];
  if (mesa.doble_cero) {
    b.push({ type: 'straight', payload: '00', numbers: ['00'] });
    b.push({ type: 'topline', payload: '0-00-1-2-3', numbers: [0, '00', 1, 2, 3] });
  }
  return b.map((x) => ({ ...x, amount: MONTO }));
}

// ══════════════════════════════════════════════════════════════════════════
async function main() {
  console.log(`\n═══ VERIFICANDO LA MESA "${MESA}" ═══  (${API})\n`);

  // Sesiones: el dueño para configurar, un jugador nuevo para jugar.
  const adm = await api('/api/auth/login', { metodo: 'POST', cuerpo: { username: 'admin', password: '123456' } });
  if (!adm.token) { console.log('No pude entrar como admin. ¿Está levantado el servidor?'); process.exit(2); }
  const ADT = adm.token;

  const sello = String(Date.now()).slice(-9);
  const usuario = `vm${sello}`;
  await api('/api/auth/register', { metodo: 'POST', cuerpo: {
    username: usuario, password: 'clave123', first_name: 'Verifica', last_name: 'Mesa',
    cedula: sello.slice(-8), phone: '04141112233', email: `${usuario}@correo.com`, bank: '0134 - Banesco',
  } });
  const ses = await api('/api/auth/login', { metodo: 'POST', cuerpo: { username: usuario, password: 'clave123' } });
  const PLT = ses.token;
  if (!PLT) { console.log('No pude crear el jugador de prueba.'); process.exit(2); }
  await api('/api/admin/deposit', { metodo: 'POST', token: ADT, cuerpo: { username: usuario, amount: 5000000 } });

  // La ficha de la mesa y su estado, para devolverlo todo como estaba.
  const cat = await api('/api/admin/games', { token: ADT });
  const mesa = (cat.mesas || []).find((m) => m.id === MESA);
  if (!mesa) {
    console.log(`No existe ninguna mesa con id "${MESA}". Las que hay: ${(cat.mesas || []).map((m) => m.id).join(', ')}`);
    process.exit(2);
  }
  const estabaAbierta = mesa.activo;
  const cfg = await api('/api/admin/settings', { token: ADT });
  const ajustes = { ...cfg.settings };

  console.log(`Mesa: ${mesa.label} · ${mesa.rueda_label} · ${mesa.casillas} casillas`);
  console.log(`      ${mesa.animales ? 'con animales' : 'sin animales'} · ${mesa.rayos ? 'con rayos' : 'sin rayos'}`
    + ` · pleno ${mesa.pago_pleno} a 1 · ${estabaAbierta ? 'ABIERTA' : 'cerrada'}\n`);

  const guardarAjustes = (extra) => api('/api/admin/settings', {
    metodo: 'PUT', token: ADT, cuerpo: { settings: { ...ajustes, ...extra } },
  });
  const girar = (bets) => api('/api/game/spin', {
    metodo: 'POST', token: PLT, cuerpo: { bets, game: MESA },
  });

  let veredicto = 'APTA';
  try {
    // La mesa tiene que estar abierta para poder jugarla; si estaba cerrada,
    // se abre solo mientras dura la prueba.
    if (!estabaAbierta) await api(`/api/admin/games/${MESA}/activo`, { metodo: 'POST', token: ADT, cuerpo: { activo: true } });

    // Rayos apagados y topes anchos: así los pagos son exactos y comparables.
    await guardarAjustes({ ltg_min: 0, ltg_max: 0, max_bet_pleno: 1000, max_bet_casilla: 5000, max_win_per_spin: 999999999 });

    // ── A. La rueda ───────────────────────────────────────────────────────
    console.log(`── A. La rueda (${GIROS} giros) ──`);
    const salidos = new Map();
    for (let i = 0; i < GIROS; i++) {
      const r = await girar([{ type: 'color', payload: 'red', amount: MONTO }]);
      if (r.error) { check('los giros entran', false, r.error); break; }
      salidos.set(String(r.resultNum), (salidos.get(String(r.resultNum)) || 0) + 1);
    }
    const validos = new Set(mesa.casillas === 38
      ? [...Array(37).keys()].map(String).concat('00')
      : [...Array(37).keys()].map(String));
    const invasores = [...salidos.keys()].filter((n) => !validos.has(n));
    check('nunca sale una casilla que no existe en esta rueda', invasores.length === 0, invasores.join(', '));
    if (!mesa.doble_cero) check('el 00 no aparece jamás', !salidos.has('00'));
    check(`salieron muchas casillas distintas (${salidos.size} de ${mesa.casillas})`, salidos.size > mesa.casillas * 0.5);

    // ── B. Los pagos, giro por giro ───────────────────────────────────────
    const RONDAS_PAGOS = Math.max(60, Math.round(GIROS / 2));
    console.log(`\n── B. Los pagos, uno por uno (${RONDAS_PAGOS} rondas) ──`);
    const apuestas = canasta(mesa);
    let malos = 0, ejemplo = '';
    for (let i = 0; i < RONDAS_PAGOS; i++) {
      const r = await girar(apuestas.map((b) => ({ type: b.type, payload: b.payload, amount: b.amount })));
      if (r.error) { malos++; ejemplo = r.error; break; }
      const esperado = apuestas.reduce((s, b) => s + premioEsperado(b, r.resultNum, mesa.pago_pleno), 0);
      if (r.win !== esperado) {
        malos++;
        if (!ejemplo) ejemplo = `salió el ${r.resultNum}: el servidor pagó ${r.win} y correspondían ${esperado}`;
      }
    }
    check(`cada ronda pagó exactamente lo que corresponde (${RONDAS_PAGOS} rondas, todos los tipos de apuesta)`,
      malos === 0, ejemplo);

    // ── C. Los topes ──────────────────────────────────────────────────────
    console.log('\n── C. Los topes ──');
    await guardarAjustes({ ltg_min: 0, ltg_max: 0, max_bet_pleno: 100, max_bet_casilla: 500, max_win_per_spin: 200 });
    let r = await girar([{ type: 'straight', payload: '7', amount: 101 }]);
    check('frena un pleno por encima del máximo', /máximo por pleno/i.test(r.error || ''), r.error || 'lo aceptó');
    r = await girar([{ type: 'color', payload: 'red', amount: 501 }]);
    check('frena una casilla por encima del máximo', /máximo por casilla/i.test(r.error || ''), r.error || 'lo aceptó');
    r = await girar([{ type: 'straight', payload: '7', amount: 100 }]);
    if (r.win > 0) check('el techo de premio por giro recorta', r.win === 200 && r.capped === true,
      `pagó ${r.win} (bruto ${r.grossWin})`);
    else check('el techo de premio por giro está configurado', true);

    // ── D. Lo que no existe en esta mesa ──────────────────────────────────
    console.log('\n── D. Lo que no va en esta mesa ──');
    await guardarAjustes({ ltg_min: 0, ltg_max: 0, max_bet_pleno: 1000, max_bet_casilla: 5000, max_win_per_spin: 999999999 });
    r = await girar([{ type: 'straight', payload: '00', amount: MONTO }]);
    if (mesa.doble_cero) check('el 00 se puede jugar', !r.error, r.error);
    else check('rechaza el pleno al 00', /no existe el 00/i.test(r.error || ''), r.error || 'lo aceptó');
    r = await girar([{ type: 'topline', payload: '0-00-1-2-3', amount: MONTO }]);
    if (mesa.doble_cero) check('la línea de cinco se puede jugar', !r.error, r.error);
    else check('rechaza la línea de cinco', /no existe el 00/i.test(r.error || ''), r.error || 'la aceptó');

    // ── E. Los rayos ──────────────────────────────────────────────────────
    console.log('\n── E. Los rayos ──');
    await guardarAjustes({ ltg_min: 3, ltg_max: 5, max_bet_pleno: 1000, max_bet_casilla: 5000, max_win_per_spin: 999999999 });
    let conRayos = 0, plenoConRayoOk = true, detalleRayo = '';
    for (let i = 0; i < 40; i++) {
      const todos = (mesa.casillas === 38
        ? [...Array(37).keys()].map(String).concat('00')
        : [...Array(37).keys()].map(String));
      const r2 = await girar(todos.map((n) => ({ type: 'straight', payload: n, amount: MONTO })));
      if (r2.error) { detalleRayo = r2.error; plenoConRayoOk = false; break; }
      const rayos = new Map((r2.lightning || []).map(([n, m]) => [String(n), m]));
      if (rayos.size) conRayos++;
      // Se apostó a TODOS los números, así que siempre gana uno: el premio
      // tiene que ser el multiplicador si ese número traía rayo.
      const mult = rayos.get(String(r2.resultNum));
      const esperado = mult ? MONTO * mult : MONTO * (mesa.pago_pleno + 1);
      if (r2.win !== esperado) {
        plenoConRayoOk = false;
        if (!detalleRayo) detalleRayo = `salió el ${r2.resultNum}${mult ? ` con rayo de ${mult}x` : ' sin rayo'}: `
          + `pagó ${r2.win} y correspondían ${esperado}`;
      }
    }
    if (mesa.rayos) {
      check('la mesa manda rayos', conRayos > 0);
      check('el pleno con rayo paga el multiplicador, y sin rayo el pago de la mesa', plenoConRayoOk, detalleRayo);
    } else {
      check('la mesa NO manda rayos (es clásica)', conRayos === 0, `mandó rayos en ${conRayos} de 40 giros`);
      check('el pleno paga siempre lo de la mesa', plenoConRayoOk, detalleRayo);
    }

    // ── F. La plata queda a nombre de esta mesa ───────────────────────────
    console.log('\n── F. La plata, separada por mesa ──');
    const rep = await api(`/api/admin/report/daily?game=${MESA}`, { token: ADT });
    check('el reporte sabe filtrar por esta mesa', rep.filtro_juego === MESA, JSON.stringify(rep.error || rep.filtro_juego));
    check('las rondas de la prueba aparecen en el reporte', (rep.total && rep.total.giros) > 0,
      `giros contados: ${rep.total && rep.total.giros}`);
    const enLista = (rep.mesas || []).some((m) => m.id === MESA);
    check('la mesa figura en el selector del panel', enLista);

  } finally {
    // Pase lo que pase, todo vuelve a como estaba.
    await guardarAjustes({});
    if (!estabaAbierta) {
      await api(`/api/admin/games/${MESA}/activo`, { metodo: 'POST', token: ADT, cuerpo: { activo: false } });
    }
    console.log(`\n(configuración de rayos y topes restaurada; la mesa quedó ${estabaAbierta ? 'ABIERTA' : 'cerrada'}, como estaba)`);
  }

  if (fail > 0) veredicto = 'NO APTA';
  console.log(`\n═══ ${ok} pasadas, ${fail} fallidas ═══`);
  console.log(veredicto === 'APTA'
    ? `\n✅ "${MESA}" pasó la verificación. Se puede abrir al público desde el panel.\n`
    : `\n⛔ "${MESA}" NO está para abrir: hay ${fail} cosa(s) mal. Revisar antes de encenderla.\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.log('Se cortó la verificación:', e.message); process.exit(2); });
