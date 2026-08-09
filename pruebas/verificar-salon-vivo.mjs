// ════════════════════════════════════════════════════════════════════════
//  LA VITRINA DEL SALÓN
//
//    node pruebas/verificar-salon-vivo.mjs --usuario=… --clave=… [--api=…]
//
//  Cinco chequeos, y los dos últimos son los que cuidan algo de verdad:
//
//   1. Sin sesión responde 401. No se le cuenta a un desconocido quién está
//      jugando.
//   2. Con sesión devuelve una fila por cada mesa abierta, con los campos
//      completos.
//   3. Después de girar, la mesa donde se giró aparece con el número que
//      acaba de salir A LA CABEZA de la tira, y con al menos 1 jugando.
//   4. TODO GIRO QUEDA ANOTADO, gane o pierda. Se gira varias veces con la
//      apuesta más chica —la mayoría van a perder— y la cuenta de números
//      tiene que subir igual. Si sólo se anotaran los ganadores, la vitrina
//      mostraría una ruleta que sale premiada siempre.
//   5. Nunca manda más de cinco números por mesa.
//
//  No toca la base directamente: mira lo mismo que va a ver el jugador.
// ════════════════════════════════════════════════════════════════════════
const args = process.argv.slice(2);
const opt = (n, def) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : def;
};
const API = opt('api', 'http://127.0.0.1:8787');
const USUARIO = opt('usuario', 'prueba3');
const CLAVE = opt('clave', '');
const MESA = opt('mesa', 'americana');
const VUELTAS = Number(opt('vueltas', '6'));

if (!CLAVE) {
  console.error('Falta --clave=  (la escribe el dueño, no queda guardada en ningún lado)');
  process.exit(1);
}

let fallos = 0;
const ok = (b, msg) => { console.log((b ? '✓ ' : '✗ ') + msg); if (!b) fallos++; };

const pedir = async (path, opts = {}, token) => {
  const res = await fetch(API + path, {
    method: opts.method || 'GET',
    headers: Object.assign(
      { 'Content-Type': 'application/json' },
      token ? { Authorization: 'Bearer ' + token } : {}
    ),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
};

// ── 1. Sin sesión ────────────────────────────────────────────────────────
const anon = await pedir('/api/salon/vivo');
ok(anon.status === 401, 'sin sesión responde 401');

// ── 2. La forma ──────────────────────────────────────────────────────────
const ses = await pedir('/api/auth/login', {
  method: 'POST', body: { username: USUARIO, password: CLAVE },
});
if (ses.status !== 200 || !ses.data || !ses.data.token) {
  console.error('✗ no se pudo entrar:', ses.data && ses.data.error);
  process.exit(1);
}
const tk = ses.data.token;

const cat = await pedir('/api/games', {}, tk);
const abiertas = (cat.data.mesas || []).filter((m) => m.activo || m.en_pruebas);

const antes = await pedir('/api/salon/vivo', {}, tk);
ok(antes.status === 200, 'con sesión responde 200');
ok(Array.isArray(antes.data.mesas), 'devuelve mesas');
ok(antes.data.mesas.length === abiertas.length,
   `una fila por mesa abierta (${antes.data.mesas.length} de ${abiertas.length})`);
ok(antes.data.mesas.every((m) =>
     typeof m.id === 'string' && typeof m.jugando === 'number' && Array.isArray(m.ultimos)),
   'todas traen id, jugando y ultimos');

const cuantosAntes = (antes.data.mesas.find((m) => m.id === MESA) || { ultimos: [] }).ultimos.length;

// ── 3 y 4. Girar ─────────────────────────────────────────────────────────
let ganados = 0;
let ultimoNumero = null;
for (let i = 0; i < VUELTAS; i++) {
  const g = await pedir('/api/game/spin', {
    method: 'POST', body: { game: MESA, bets: [{ type: 'red', amount: 1 }] },
  }, tk);
  if (g.status !== 200) {
    console.error(`✗ el giro ${i + 1} falló:`, g.data && g.data.error);
    process.exit(1);
  }
  if (g.data.win > 0) ganados++;
  ultimoNumero = String(g.data.resultNum);
  console.log(`   giro ${i + 1}/${VUELTAS}: salió ${ultimoNumero}, pagó ${g.data.win}`);
}

const despues = await pedir('/api/salon/vivo', {}, tk);
const m = despues.data.mesas.find((x) => x.id === MESA);
ok(!!m, `la mesa ${MESA} está en la vitrina`);
ok(!!m && m.ultimos[0] === ultimoNumero,
   `el número recién salido (${ultimoNumero}) va a la cabeza de la tira`);
ok(!!m && m.jugando >= 1, 'la mesa cuenta al menos un jugador');
ok(!!m && m.ultimos.length <= 5, 'no manda más de cinco números');

// El que de verdad importa: se anotaron TODOS, no sólo los premiados.
const crecio = !!m && (m.ultimos.length > cuantosAntes || m.ultimos.length === 5);
if (ganados === VUELTAS) {
  console.log('⚠ ganaste todas: no se pudo distinguir "todo giro" de "sólo los ganadores". Repetilo.');
} else {
  ok(crecio, `${VUELTAS} giros, ${ganados} ganados, y la vitrina tiene números igual`);
}

console.log(fallos === 0 ? '\nTODO BIEN' : `\n${fallos} FALLARON`);
process.exit(fallos === 0 ? 0 : 1);
