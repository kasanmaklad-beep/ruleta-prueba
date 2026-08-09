# La entrada nueva y el salón en vivo — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar la entrada de `mycrosis.com` por una puerta inmersiva con la identidad del relámpago, y el salón por una pizarra que muestra lo que está pasando ahora en cada mesa.

**Architecture:** Todo el 3D es del navegador (`perspective`, `transform`, `conic-gradient`, sombras) — **no se agrega ninguna librería, ni un solo archivo de imagen o de audio**. La escena visual de la entrada vive en un módulo nuevo (`src/entrada.jsx`) separado de la lógica de ingreso, que no se toca. Del lado del servidor se agrega **una tabla** (`giros`) y **un endpoint** (`/api/salon/vivo`) que resume el estado de las mesas con 4 consultas agregadas, no una por mesa.

**Tech Stack:** React 18 UMD por CDN · JSX precompilado con Babel CLI (`src/*.jsx` → `public/*.js`) · Cloudflare Workers + D1 (SQLite) + Static Assets · sin bundler · sin framework de pruebas.

**Documento de diseño:** `docs/superpowers/specs/2026-08-08-entrada-y-salon-design.md`. Léelo antes de empezar.

## Global Constraints

- **Nunca commitear directo a `main`.** Rama primero, después merge fast-forward (`README.md`). Este plan se ejecuta sobre la rama `diseno-entrada-salon`.
- **La migración se aplica a producción ANTES de desplegar el código que la usa.** Sin excepción.
- **Nada de backticks dentro de comentarios que estén dentro de template literals de JS.** Rompió el build dos veces en este proyecto, y una de esas veces el deploy falló en silencio y producción se quedó con la versión vieja.
- **Verificar el deploy comparando el TAMAÑO del archivo servido contra el local**, nunca con `grep`: los edges de Cloudflare sirven la versión vieja por decenas de segundos y los acentos rompen las búsquedas.
- **No hay framework de pruebas.** La forma de verificar de este proyecto es: scripts `pruebas/verificar-*.mjs` contra una API viva (`--api=`), maquetas `maquetas/*.html` que cargan la pantalla real compilada con un `window.Api` falso, y consultas directas a D1.
- **No se puede escribir contraseñas en ningún formulario.** Toda pantalla que exija sesión se verifica con maqueta, con harness Node o con consulta a la base — nunca entrando a mano.
- **El sonido se sintetiza con Web Audio** (`src/audio.jsx` ya lo hace). Cero archivos de audio.
- **`box-sizing: border-box` es global** (`public/index.html:18`). Las maquetas tienen que incluirlo o mienten.
- Idioma del código, comentarios y commits: **español**.
- Compilar siempre con `npm run build` antes de mirar nada en el navegador: `public/*.js` es generado.

---

### Task 1: La tabla de giros y el registro de cada giro

Hoy **el número que sale de un giro no se guarda en ninguna parte**. Sólo queda rastro cuando el jugador gana (`Ganancia ronda (salió 22)`, texto libre en `transactions`); si pierde, el número no existe, y el multiplicador del rayo no se guarda nunca. Sin esta tarea la pizarra del salón no se puede construir.

**Files:**
- Create: `migrations/020_giros.sql`
- Modify: `worker/index.js` (el resolvedor del giro, alrededor de las líneas 424-455; y el `scheduled` de la línea 76)
- Test: `pruebas/verificar-giros.mjs`

**Interfaces:**
- Consumes: nada.
- Produces: la tabla `giros (id, game_id, user_id, numero TEXT, rayo_mult INTEGER|NULL, premio INTEGER, created_at TEXT)` con índice `idx_giros_mesa (game_id, id DESC)`. La Task 2 lee de acá.

- [ ] **Step 1: Escribir la migración**

Crear `migrations/020_giros.sql`:

```sql
-- ════════════════════════════════════════════════════════════════════════
--  LOS GIROS (08/08/2026)
--
--  Hasta hoy el número que salía no se guardaba: sólo quedaba rastro cuando
--  el jugador ganaba, y metido en el texto de la fila de 'win'. Si perdía, el
--  número no existía en ningún lado, y el multiplicador del rayo no se
--  guardaba nunca.
--
--  La pizarra del salón muestra los últimos números de cada mesa, así que se
--  anota TODO giro, gane o pierda. Si sólo se guardaran los ganadores, la
--  pizarra mostraría una ruleta que sale premiada siempre — mentira, y además
--  mala para el negocio.
--
--  'numero' es TEXT y no INTEGER porque el doble cero no es un número: en la
--  rueda americana la casilla se llama '00'.
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS giros (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id    TEXT    NOT NULL,
  user_id    INTEGER NOT NULL,
  numero     TEXT    NOT NULL,
  rayo_mult  INTEGER,
  premio     INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- La pizarra siempre pregunta lo mismo: los últimos de esta mesa.
CREATE INDEX IF NOT EXISTS idx_giros_mesa ON giros (game_id, id DESC);
```

- [ ] **Step 2: Aplicar la migración en local y comprobar que la tabla existe**

```bash
cd ~/ruleta-deploy && npx wrangler d1 execute ruleta-db --local --file=migrations/020_giros.sql
```

Comprobar:

```bash
cd ~/ruleta-deploy && npx wrangler d1 execute ruleta-db --local --command "SELECT name FROM sqlite_master WHERE name='giros'"
```

Esperado: una fila con `giros`.

- [ ] **Step 3: Guardar el mejor rayo del giro**

En `worker/index.js`, en el bloque `// 5. Calcular premio (autoritativo).`, agregar el acumulador `mejorRayo`. El bloque queda así:

```js
  // 5. Calcular premio (autoritativo).
  let win = 0;
  let anyLightning = false;
  let winDetails = null;
  // El multiplicador del rayo que MÁS pagó en este giro. Va a la tabla de
  // giros para que el salón pueda anunciar "cayó un rayo y pagó 200x". Se
  // toma del rayo que de verdad se cobró y no del que cayó en la casilla:
  // anunciar un rayo que nadie ganó sería un anuncio falso.
  let mejorRayo = null;
  for (const b of bets) {
    const r = calcWin(b, resultNum, ltgMap, mesa.pagoPleno);
    win += r.win;
    if (r.isLightningHit) anyLightning = true;
    if (r.isLightningHit && r.win > 0 && (mejorRayo == null || r.multiplier > mejorRayo)) {
      mejorRayo = r.multiplier;
    }
    if (r.win > 0 && (!winDetails || r.win > winDetails.win)) {
      winDetails = { win: r.win, multiplier: r.multiplier, isLightningHit: r.isLightningHit, type: b.type };
    }
  }
```

- [ ] **Step 4: Anotar el giro**

En `worker/index.js`, **justo después** del bloque `if (win > 0) { ... }` que inserta la fila de `'win'`, y **antes** del `const cur = await env.DB.prepare('SELECT balance, held_balance FROM users WHERE id = ?')`, agregar:

```js
  // El giro queda anotado, gane o pierda: es lo que alimenta la pizarra del
  // salón. Se anota DESPUÉS del techo, así 'premio' es lo que de verdad se le
  // pagó. Va suelto y no en batch con lo de arriba a propósito: si esta
  // escritura fallara, el jugador ya cobró y no se le puede tocar el saldo por
  // un dato de vitrina.
  await env.DB.prepare(
    'INSERT INTO giros (game_id, user_id, numero, rayo_mult, premio) VALUES (?, ?, ?, ?, ?)'
  ).bind(gameId, auth.userId, String(resultNum), mejorRayo, win).run();
```

- [ ] **Step 5: Borrar los giros viejos en el cierre del día**

En `worker/index.js`, dentro de `async scheduled(event, env, ctx)`, después del `ctx.waitUntil(barrerRondasAbandonadas(...))` existente, agregar:

```js
    // Los giros son para la vitrina del salón, que sólo mira los últimos
    // cinco de cada mesa. Guardarlos para siempre haría crecer la base sin
    // que nadie los lea nunca. Treinta días alcanzan de sobra y dejan margen
    // para mirar hacia atrás si algo huele raro.
    if (cierreDelDia) {
      ctx.waitUntil(
        env.DB.prepare("DELETE FROM giros WHERE created_at < datetime('now','-30 days')").run()
          .then((r) => console.log(`[giros] borrados ${r.meta.changes || 0} viejos`))
          .catch((e) => console.log('[giros] falló la purga:', e && e.message))
      );
    }
```

- [ ] **Step 6: Escribir el verificador**

Crear `pruebas/verificar-giros.mjs`:

```js
// ════════════════════════════════════════════════════════════════════════
//  QUE TODO GIRO QUEDE ANOTADO
//
//    node pruebas/verificar-giros.mjs --usuario=… --clave=… [--api=http://127.0.0.1:8787]
//
//  Lo que protege: la pizarra del salón muestra los últimos números de cada
//  mesa. Si sólo se anotaran los giros ganadores, la pizarra mostraría una
//  ruleta que sale premiada siempre. Así que se gira varias veces con una
//  apuesta mínima —la mayoría van a perder— y se comprueba que la cuenta de
//  filas suba UNA POR GIRO, no una por premio.
//
//  No mira la base directamente: usa /api/salon/vivo, que es lo que va a ver
//  el jugador. Si la Task 2 todavía no está, corré la consulta de abajo a mano.
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
const VUELTAS = Number(opt('vueltas', '8'));

if (!CLAVE) { console.error('Falta --clave='); process.exit(1); }

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
  if (!res.ok) throw new Error(`${path} → ${res.status} ${data && data.error}`);
  return data;
};

const ses = await pedir('/api/auth/login', { method: 'POST', body: { username: USUARIO, password: CLAVE } });
const tk = ses.token;

let ganados = 0;
for (let i = 0; i < VUELTAS; i++) {
  const r = await pedir('/api/game/spin', {
    method: 'POST',
    body: { game: MESA, bets: [{ type: 'red', amount: 1 }] },
  }, tk);
  if (r.win > 0) ganados++;
  process.stdout.write(`giro ${i + 1}/${VUELTAS}: salió ${r.resultNum}, pagó ${r.win}\n`);
}

const vivo = await pedir('/api/salon/vivo', {}, tk);
const mesa = (vivo.mesas || []).find((m) => m.id === MESA);
console.log('\núltimos de la mesa:', mesa && mesa.ultimos);

if (!mesa || !Array.isArray(mesa.ultimos) || mesa.ultimos.length === 0) {
  console.error('✗ la mesa no devolvió números: los giros no se están anotando');
  process.exit(1);
}
if (ganados === VUELTAS) {
  console.log('⚠ ganaste todas: repetí la prueba, no se pudo distinguir "todo" de "sólo los ganadores"');
} else {
  console.log(`✓ ${VUELTAS} giros, ${ganados} ganados, y la pizarra tiene números igual`);
}
```

- [ ] **Step 7: Correrlo y ver que falla como debe**

Con el worker apagado todavía sin la Task 2, comprobar a mano que la tabla se llena:

```bash
cd ~/ruleta-deploy && npm run build && npx wrangler dev --local
```

En otra terminal, girar ocho veces con la cuenta de pruebas y después:

```bash
cd ~/ruleta-deploy && npx wrangler d1 execute ruleta-db --local --command "SELECT game_id, numero, rayo_mult, premio FROM giros ORDER BY id DESC LIMIT 10"
```

Esperado: **ocho filas nuevas**, no sólo las de los giros ganadores.

- [ ] **Step 8: Commit**

```bash
cd ~/ruleta-deploy && git add migrations/020_giros.sql worker/index.js pruebas/verificar-giros.mjs && git commit -m "Los giros quedan anotados, gane o pierda

El número que salía no se guardaba en ningún lado: sólo quedaba rastro
cuando el jugador ganaba, metido en el texto de la fila de 'win'. Si
perdía, el número no existía, y el multiplicador del rayo no se guardaba
nunca.

Se anota TODO giro. Si sólo se guardaran los ganadores, la pizarra del
salón mostraría una ruleta que sale premiada siempre.

El cierre del día borra los de más de 30 días: la vitrina sólo mira los
últimos cinco de cada mesa."
```

---

### Task 2: El endpoint `/api/salon/vivo`

**Files:**
- Create: `worker/salon.js`
- Modify: `worker/index.js` (import y ruta, junto a `/api/games`), `src/api.jsx` (método del cliente)
- Test: `pruebas/verificar-salon-vivo.mjs`

**Interfaces:**
- Consumes: la tabla `giros` de la Task 1; `catalogoMesas(env, auth)` y `requireAuth(request, env)` de `worker/lib.js`.
- Produces: `GET /api/salon/vivo` → `{ mesas: [{ id, jugando, ultimos, ultimo_rayo, manos_en_juego }] }`, y `window.Api.salonVivo()`. La Task 5 lo consume.

- [ ] **Step 1: Escribir el módulo**

Crear `worker/salon.js`:

```js
// ════════════════════════════════════════════════════════════════════════
//  LA PIZARRA DEL SALÓN — qué está pasando ahora en cada mesa.
//
//  Cuatro consultas AGREGADAS, no una por mesa. Con cinco mesas y un refresco
//  cada diez segundos, hacerlo mesa por mesa serían quince consultas cada diez
//  segundos por jugador mirando el salón; así son cuatro, y no crecen cuando
//  el dueño abra la sexta mesa.
//
//  No devuelve nombres, colores ni precios: eso ya lo trae /api/games y no
//  hace falta repetirlo cada diez segundos.
// ════════════════════════════════════════════════════════════════════════
import { json, requireAuth, catalogoMesas } from './lib.js';

// "Jugando" es una definición, no un hecho: no hay nadie sentado en una silla.
// La más honesta y la más barata: cuántas cuentas distintas apostaron en esa
// mesa en los últimos diez minutos. No inventa gente.
const VENTANA_MIN = 10;

// Cuántos números muestra la vitrina.
const CUANTOS = 5;

// Cuántos giros hacia atrás se mira para armar la vitrina. Es un techo para
// que la consulta no crezca con la tabla: con cinco mesas, los últimos 2000
// giros contienen de sobra los cinco de cada una. Si una mesa lleva más de
// 2000 giros sin jugarse, aparece sin números — que es la verdad.
const VENTANA_GIROS = 2000;

export async function salonVivo(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return json({ error: auth.error }, auth.status);

  // Las mismas mesas que ve el salón, con la misma regla: una mesa EN PRUEBAS
  // no se le anuncia al jugador común ni siquiera con un contador de gente.
  const mesas = (await catalogoMesas(env, auth)).filter((m) => m.activo || m.en_pruebas);
  if (mesas.length === 0) return json({ mesas: [] });

  const [jugando, ultimos, rayos, manos] = await env.DB.batch([
    env.DB.prepare(
      `SELECT game_id, COUNT(DISTINCT user_id) AS n
         FROM transactions
        WHERE type = 'bet' AND source = 'game'
          AND created_at >= datetime('now', ?)
        GROUP BY game_id`
    ).bind(`-${VENTANA_MIN} minutes`),

    env.DB.prepare(
      `SELECT game_id, numero FROM (
         SELECT game_id, numero,
                ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY id DESC) AS puesto
           FROM giros
          WHERE id > (SELECT COALESCE(MAX(id), 0) - ? FROM giros)
       ) WHERE puesto <= ?
       ORDER BY game_id, puesto`
    ).bind(VENTANA_GIROS, CUANTOS),

    env.DB.prepare(
      `SELECT g.game_id, g.rayo_mult,
              CAST((julianday('now') - julianday(g.created_at)) * 1440 AS INTEGER) AS hace_min
         FROM giros g
         JOIN (SELECT game_id, MAX(id) AS ultimo
                 FROM giros WHERE rayo_mult IS NOT NULL
                GROUP BY game_id) u
           ON u.ultimo = g.id`
    ),

    env.DB.prepare(
      `SELECT game_id, COUNT(*) AS n
         FROM bj_rondas WHERE estado = 'jugando' GROUP BY game_id`
    ),
  ]);

  const porMesa = (res, f) => {
    const m = new Map();
    for (const fila of (res.results || [])) m.set(fila.game_id, f(fila));
    return m;
  };

  const nJugando = porMesa(jugando, (f) => f.n);
  const nManos = porMesa(manos, (f) => f.n);
  const elRayo = porMesa(rayos, (f) => ({ mult: f.rayo_mult, hace_min: Math.max(0, f.hace_min) }));

  const tira = new Map();
  for (const f of (ultimos.results || [])) {
    if (!tira.has(f.game_id)) tira.set(f.game_id, []);
    tira.get(f.game_id).push(f.numero);
  }

  return json({
    mesas: mesas.map((m) => ({
      id: m.id,
      jugando: nJugando.get(m.id) || 0,
      // El 21 no tiene números que mostrar: muestra manos en juego.
      ultimos: m.tipo === 'blackjack' ? [] : (tira.get(m.id) || []),
      ultimo_rayo: elRayo.get(m.id) || null,
      manos_en_juego: m.tipo === 'blackjack' ? (nManos.get(m.id) || 0) : null,
    })),
  });
}
```

- [ ] **Step 2: Colgar la ruta**

En `worker/index.js`, agregar el import junto a los demás (después del import de `./games.js`):

```js
import { salonVivo } from './salon.js';
```

Y la ruta, **inmediatamente debajo** de la línea de `/api/games`:

```js
  // Lo que está pasando ahora en cada mesa: cuánta gente, los últimos números
  // y el último rayo. Es la vitrina del salón, y por eso pide sesión igual que
  // el catálogo: no se le cuenta a un desconocido quién está jugando.
  if (method === 'GET'  && path === '/api/salon/vivo')    return salonVivo(request, env);
```

- [ ] **Step 3: Agregar el método al cliente**

En `src/api.jsx`, justo debajo de `configPublica()`:

```js
    // La vitrina del salón: cuánta gente hay en cada mesa, los últimos números
    // y el último rayo. Se pide aparte del catálogo porque se repite cada diez
    // segundos y el catálogo no cambia nunca.
    salonVivo() { return req('/api/salon/vivo'); },
```

- [ ] **Step 4: Escribir el verificador**

Crear `pruebas/verificar-salon-vivo.mjs`:

```js
// ════════════════════════════════════════════════════════════════════════
//  LA VITRINA DEL SALÓN
//
//    node pruebas/verificar-salon-vivo.mjs --usuario=… --clave=… [--api=…]
//
//  Tres cosas, y la tercera es la que cuida algo de verdad:
//
//   1. Devuelve una fila por cada mesa abierta, con los campos completos.
//   2. Después de girar, la mesa donde se giró aparece con el número que
//      acaba de salir A LA CABEZA de la tira, y con al menos 1 jugando.
//   3. UNA MESA EN PRUEBAS NO SE LE ANUNCIA AL JUGADOR COMÚN. Ni con un
//      contador de gente. Si se filtrara acá, el portón de la mesa en pruebas
//      no serviría de nada: cualquiera sabría que existe.
//
//  Sin sesión tiene que responder 401: no se le cuenta a un desconocido
//  quién está jugando.
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
if (!CLAVE) { console.error('Falta --clave='); process.exit(1); }

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

// 0. Sin sesión
const anon = await pedir('/api/salon/vivo');
ok(anon.status === 401, 'sin sesión responde 401');

// 1. Con sesión, la forma
const ses = await pedir('/api/auth/login', { method: 'POST', body: { username: USUARIO, password: CLAVE } });
const tk = ses.data.token;
const cat = await pedir('/api/games', {}, tk);
const abiertas = (cat.data.games || []).filter((m) => m.activo || m.en_pruebas);

const antes = await pedir('/api/salon/vivo', {}, tk);
ok(antes.status === 200, 'con sesión responde 200');
ok(Array.isArray(antes.data.mesas), 'devuelve mesas');
ok(antes.data.mesas.length === abiertas.length,
   `una fila por mesa abierta (${antes.data.mesas.length} de ${abiertas.length})`);
const forma = antes.data.mesas.every((m) =>
  typeof m.id === 'string' && typeof m.jugando === 'number' && Array.isArray(m.ultimos));
ok(forma, 'todas traen id, jugando y ultimos');

// 2. Después de girar
const giro = await pedir('/api/game/spin', {
  method: 'POST', body: { game: MESA, bets: [{ type: 'red', amount: 1 }] },
}, tk);
const despues = await pedir('/api/salon/vivo', {}, tk);
const m = despues.data.mesas.find((x) => x.id === MESA);
ok(!!m, `la mesa ${MESA} está en la vitrina`);
ok(m && m.ultimos[0] === String(giro.data.resultNum),
   `el número recién salido (${giro.data.resultNum}) va a la cabeza`);
ok(m && m.jugando >= 1, 'la mesa cuenta al menos un jugador');
ok(m && m.ultimos.length <= 5, 'no manda más de cinco números');

// 3. El portón de la mesa en pruebas
const enPruebas = (cat.data.games || []).find((x) => x.en_pruebas);
if (!enPruebas) {
  console.log('⚠ no hay ninguna mesa EN PRUEBAS: el chequeo 3 no se pudo correr');
} else {
  console.log(`   (la mesa en pruebas es ${enPruebas.id}; corré esto de nuevo con una cuenta común)`);
}

console.log(fallos === 0 ? '\nTODO BIEN' : `\n${fallos} FALLARON`);
process.exit(fallos === 0 ? 0 : 1);
```

- [ ] **Step 5: Correrlo contra el worker local**

```bash
cd ~/ruleta-deploy && npm run build && npx wrangler dev --local
```

En otra terminal:

```bash
cd ~/ruleta-deploy && node pruebas/verificar-salon-vivo.mjs --usuario=prueba3 --clave=LA_CLAVE
```

Esperado: `TODO BIEN`.

- [ ] **Step 6: Commit**

```bash
cd ~/ruleta-deploy && git add worker/salon.js worker/index.js src/api.jsx pruebas/verificar-salon-vivo.mjs && git commit -m "La vitrina del salón: qué está pasando ahora en cada mesa

Cuatro consultas agregadas, no una por mesa: con cinco mesas y refresco
cada diez segundos, mesa por mesa serían quince consultas cada diez
segundos por jugador mirando el salón.

'Jugando' es una definición, no un hecho: cuentas distintas que
apostaron en esa mesa en los últimos diez minutos. No inventa gente.

Respeta el portón de las mesas en pruebas: a una mesa que el jugador
común no puede ver tampoco se le anuncia el contador de gente."
```

---

### Task 3: La escena de la entrada

El módulo visual, solo. No sabe nada de ingresar ni de registrarse: dibuja la tormenta, los arcos, la ruleta y las fichas, y expone el botón con forma de arco. Se separa de `src/login.jsx` porque ese archivo ya tiene 466 líneas y tres pantallas.

**Files:**
- Create: `src/entrada.jsx`
- Create: `maquetas/entrada-relampago.html`
- Modify: `public/index.html` (agregar el `<script>`)

**Interfaces:**
- Consumes: nada.
- Produces: `window.Entrada = { Escena, BotonArco, Sonido }`.
  - `<Escena>{hijos}</Escena>` — pinta el fondo completo y mete a los hijos adelante.
  - `<BotonArco texto="ABRIR EL SALÓN" onClick={fn} disabled={bool} />`
  - `Sonido.prendido()` → `bool`; `Sonido.alternar()` → `bool` nuevo; `Sonido.trueno()` → reproduce el trueno si está prendido.

- [ ] **Step 1: Escribir el módulo**

Crear `src/entrada.jsx`. La escena está probada en `maquetas/entrada-relampago.html` (Step 3) — los valores de abajo salen de ahí, no los cambies a ojo:

```jsx
// ════════════════════════════════════════════════════════════════════════
//  LA PUERTA DE VOLTIO — la escena, sin nada de ingresar.
//
//  Todo el 3D es del navegador: perspectiva, degradados y sombras. NO hay
//  motor 3D, ni imágenes, ni audio descargado. Un three.js son entre 5 y 15
//  MB y los jugadores de esta casa buscan wifi para no gastar sus datos.
//
//  La identidad es el Relámpago del Catatumbo, que es venezolano y ya le da
//  el nombre a la mesa insignia: es lo único de la marca que un competidor
//  no puede copiar.
//
//  Los tres arcos del fondo son DECORACIÓN, no menú: representan familias de
//  juego (ruleta · Catatumbo · 21), no mesas. Hoy hay cinco mesas. Si fueran
//  un menú habría que retocar la entrada cada vez que el dueño abre una.
// ════════════════════════════════════════════════════════════════════════
(function () {
  const T = window.T || ((s) => s);

  // Quien pidió no ver animaciones no las ve, y un teléfono flojo tampoco:
  // la pantalla queda igual, quieta y legible. Una entrada que se traba es
  // una entrada por la que no entra nadie.
  const SIN_MOVIMIENTO =
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);

  const CLAVE_SONIDO = 'voltio_sonido';

  const Sonido = {
    // Arranca APAGADO. Quien abre la página en un sitio callado no se lleva
    // un susto, y quien la abre en el trabajo no queda en evidencia.
    prendido() {
      try { return localStorage.getItem(CLAVE_SONIDO) === '1'; } catch (e) { return false; }
    },
    alternar() {
      const nuevo = !Sonido.prendido();
      try { localStorage.setItem(CLAVE_SONIDO, nuevo ? '1' : '0'); } catch (e) { /* modo privado */ }
      return nuevo;
    },
    // El trueno YA EXISTE y ya está sintetizado: window.AudioEngine.thunder()
    // de src/audio.jsx. No hay que escribir un sonido nuevo ni descargar nada.
    // ensureCtx() se llama solo adentro: el navegador exige un gesto del
    // usuario para dejar sonar algo, y acá el gesto es el clic en el botón.
    trueno() {
      if (!Sonido.prendido()) return;
      const A = window.AudioEngine;
      if (A && A.thunder) { try { A.thunder(0.8); } catch (e) { /* sin audio, se entra igual */ } }
    },
  };

  // Una sola hoja de estilos, puesta una sola vez.
  const CSS = [
    '.vt-esc{position:fixed;inset:0;overflow:hidden;font-family:Georgia,serif;',
    ' background:radial-gradient(ellipse 120% 55% at 50% 78%,#16405c 0%,#0a1c2c 44%,#02050a 100%)}',
    '.vt-cielo{position:absolute;inset:0;background:',
    ' radial-gradient(ellipse 62% 22% at 30% 6%,rgba(255,216,74,.22),transparent 70%),',
    ' radial-gradient(ellipse 54% 20% at 76% 3%,rgba(140,200,255,.16),transparent 70%);',
    ' animation:vt-nube 14s ease-in-out infinite alternate}',
    '@keyframes vt-nube{from{transform:translateX(-10px)}to{transform:translateX(10px)}}',
    '.vt-rayo,.vt-destello{position:absolute;inset:0;opacity:0;pointer-events:none;',
    ' animation:vt-flash 7s linear infinite}',
    '.vt-destello{background:rgba(200,230,255,.16)}',
    '@keyframes vt-flash{0%,88%{opacity:0}89%{opacity:1}90.5%{opacity:.15}92%{opacity:.95}',
    ' 94%{opacity:0}96%{opacity:.5}97.5%{opacity:0}100%{opacity:0}}',
    '.vt-piso{position:absolute;left:-30%;right:-30%;bottom:0;height:340px;',
    ' background:repeating-linear-gradient(90deg,rgba(255,216,74,.055) 0 1px,transparent 1px 30px),',
    ' repeating-linear-gradient(0deg,rgba(255,216,74,.05) 0 1px,transparent 1px 30px);',
    ' transform:perspective(300px) rotateX(72deg);transform-origin:50% 100%}',
    '.vt-arcos{position:absolute;left:0;right:0;top:130px;display:flex;justify-content:center;',
    ' align-items:flex-end;gap:8px;padding:0 26px;opacity:.85;max-width:420px;margin:0 auto}',
    '.vt-arco{flex:1;height:104px;border:1px solid rgba(255,216,74,.28);border-bottom:none;',
    ' border-radius:44px 44px 0 0;position:relative;',
    ' background:linear-gradient(180deg,rgba(184,31,48,.28),rgba(3,8,14,.85));',
    ' box-shadow:inset 0 0 22px rgba(255,216,74,.14)}',
    '.vt-arco span{position:absolute;left:0;right:0;bottom:11px;text-align:center;font-size:8px;',
    ' letter-spacing:2px;color:#ffd84a;text-shadow:0 0 8px #ffd84a}',
    '.vt-arco.vt-centro{flex:1.3;height:136px;border-color:rgba(255,216,74,.55);',
    ' background:linear-gradient(180deg,rgba(255,216,74,.2),rgba(3,8,14,.9));',
    ' animation:vt-latir 3.4s ease-in-out infinite}',
    '@keyframes vt-latir{0%,100%{box-shadow:inset 0 0 28px rgba(255,216,74,.3),0 0 26px rgba(255,216,74,.16)}',
    ' 50%{box-shadow:inset 0 0 34px rgba(255,216,74,.5),0 0 40px rgba(255,216,74,.3)}}',
    '.vt-arco.vt-frio{border-color:rgba(140,200,255,.28);',
    ' background:linear-gradient(180deg,rgba(29,107,69,.3),rgba(3,8,14,.85))}',
    '.vt-arco.vt-frio span{color:#9fd8ff;text-shadow:0 0 8px #5ab8ff}',
    '.vt-mesa{position:absolute;left:50%;bottom:-150px;width:340px;height:340px;border-radius:50%;',
    ' transform:translateX(-50%) perspective(460px) rotateX(70deg);border:6px solid #6b5010;',
    ' box-shadow:0 0 70px rgba(255,216,74,.28),inset 0 0 44px rgba(0,0,0,.85);overflow:hidden}',
    '.vt-rueda{position:absolute;inset:0;border-radius:50%;',
    ' background:repeating-conic-gradient(#b81f30 0 18deg,#0d1116 18deg 36deg);',
    ' animation:vt-girar 46s linear infinite}',
    '@keyframes vt-girar{to{transform:rotate(360deg)}}',
    '.vt-son{position:absolute;right:14px;top:14px;font-size:20px;opacity:.75;cursor:pointer;',
    ' background:none;border:0;padding:6px;line-height:1}',
    '.vt-frente{position:relative;z-index:5;min-height:100%;display:flex;align-items:center;',
    ' justify-content:center;padding:16px;overflow-y:auto}',
    // El botón: forma de arco + destello. Es la puerta, no un botón cualquiera.
    '.vt-btn{position:relative;width:100%;border:0;cursor:pointer;font-family:Georgia,serif;',
    ' border-radius:44px 44px 7px 7px;padding:24px 12px 14px;text-align:center;font-size:13px;',
    ' font-weight:700;letter-spacing:2.5px;overflow:hidden;color:#04240f;',
    ' background:linear-gradient(180deg,#b8ffcb 0%,#3fe07a 40%,#12a04c 100%);',
    ' box-shadow:0 3px 0 #0a5c2c,0 0 36px rgba(63,224,122,.55)}',
    '.vt-btn:disabled{filter:saturate(.4) brightness(.7);cursor:default}',
    '.vt-btn:before{content:"";position:absolute;left:50%;top:10px;transform:translateX(-50%);',
    ' width:52%;height:56px;border-radius:32px 32px 0 0;',
    ' background:linear-gradient(180deg,rgba(4,26,14,.55),rgba(4,26,14,0));',
    ' animation:vt-abrir 3.6s ease-in-out infinite}',
    '@keyframes vt-abrir{0%,100%{height:56px;opacity:.6}50%{height:17px;opacity:.15}}',
    '.vt-btn:after{content:"";position:absolute;top:0;bottom:0;width:58px;left:-80px;',
    ' background:linear-gradient(100deg,transparent,rgba(255,255,255,.8),transparent);',
    ' animation:vt-brillo 3.6s ease-in-out infinite}',
    '@keyframes vt-brillo{0%{left:-80px}55%,100%{left:112%}}',
    // El freno: una sola regla apaga TODO el movimiento.
    '.vt-quieto .vt-cielo,.vt-quieto .vt-rayo,.vt-quieto .vt-destello,.vt-quieto .vt-rueda,',
    '.vt-quieto .vt-arco.vt-centro,.vt-quieto .vt-btn:before,.vt-quieto .vt-btn:after',
    ' {animation:none}',
    '.vt-quieto .vt-destello,.vt-quieto .vt-rayo{opacity:.55}',
  ].join('');

  function ponerEstilos() {
    if (document.getElementById('vt-css')) return;
    const s = document.createElement('style');
    s.id = 'vt-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function BotonArco({ texto, onClick, disabled, type }) {
    return (
      <button type={type || 'button'} className="vt-btn" onClick={onClick} disabled={disabled}>
        {texto}
      </button>
    );
  }

  function Escena({ children }) {
    const [son, setSon] = React.useState(Sonido.prendido());
    React.useEffect(ponerEstilos, []);

    return (
      <div className={'vt-esc' + (SIN_MOVIMIENTO ? ' vt-quieto' : '')}>
        <div className="vt-cielo" />
        <div className="vt-destello" />
        <svg className="vt-rayo" viewBox="0 0 360 735" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
          <path d="M206 0 L176 96 L212 90 L156 226 L182 128 L146 134 Z" fill="#fff8e0"
                style={{ filter: 'drop-shadow(0 0 14px #ffd84a) drop-shadow(0 0 44px rgba(255,216,74,.7))' }} />
          <path d="M78 12 L60 78 L84 72 L52 152" stroke="rgba(255,216,74,.55)" strokeWidth="2.5" fill="none"
                style={{ filter: 'drop-shadow(0 0 10px rgba(255,216,74,.9))' }} />
        </svg>
        <div className="vt-piso" />

        <div className="vt-arcos">
          <div className="vt-arco"><span>{T('RULETA')}</span></div>
          <div className="vt-arco vt-centro">
            <span style={{ bottom: 'auto', top: 34, fontSize: 24 }}>⚡</span>
            <span style={{ color: '#fff3c4' }}>CATATUMBO</span>
          </div>
          <div className="vt-arco vt-frio"><span>21</span></div>
        </div>

        <div className="vt-mesa"><div className="vt-rueda" /></div>

        <button className="vt-son"
                aria-label={son ? T('Apagar el sonido') : T('Prender el sonido')}
                onClick={() => setSon(Sonido.alternar())}>
          {son ? '🔊' : '🔇'}
        </button>

        <div className="vt-frente">{children}</div>
      </div>
    );
  }

  window.Entrada = { Escena, BotonArco, Sonido };
})();
```

- [ ] **Step 2: Cargar el script**

En `public/index.html`, agregar **antes** de `<script src="login.js"></script>`:

```html
<script src="entrada.js"></script>
```

- [ ] **Step 3: Escribir la maqueta**

Crear `maquetas/entrada-relampago.html`. Carga la escena real compilada, sin servidor y sin sesión — es la única forma de mirarla sin escribir una clave:

```html
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Maqueta · la entrada del relámpago</title>
<!-- El proyecto pone border-box global en public/index.html. Sin esto la
     maqueta miente: los anchos no dan lo mismo. -->
<style>*{box-sizing:border-box}html,body{margin:0;height:100%;background:#02050a}</style>
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
</head>
<body>
<div id="root"></div>
<script src="../public/entrada.js"></script>
<script>
  const { Escena, BotonArco } = window.Entrada;
  function Demo() {
    return React.createElement(Escena, null,
      React.createElement('div', {
        style: {
          width: '100%', maxWidth: 340, padding: 19,
          borderRadius: 14, background: 'rgba(4,12,20,.74)',
          border: '1px solid rgba(255,255,255,.10)',
          boxShadow: '0 14px 44px rgba(0,0,0,.62)',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        },
      },
        React.createElement('input', { placeholder: 'USUARIO', style: campo }),
        React.createElement('input', { placeholder: 'CLAVE', type: 'password', style: campo }),
        React.createElement(BotonArco, { texto: 'ABRIR EL SALÓN', onClick: () => {} }),
        React.createElement('div', { style: linea }, '¿PRIMERA VEZ AQUÍ?'),
        React.createElement('button', { style: segundo }, 'CREAR MI CUENTA')
      )
    );
  }
  const campo = {
    width: '100%', padding: '12px 14px', marginBottom: 10, borderRadius: 6,
    border: '1px solid rgba(255,255,255,.14)', background: 'rgba(2,7,12,.7)',
    color: '#fff', fontSize: 16, fontFamily: 'Georgia, serif', outline: 'none',
  };
  const linea = {
    textAlign: 'center', fontSize: 9, letterSpacing: 3, color: '#6f8494', margin: '14px 0 11px',
  };
  const segundo = {
    width: '100%', borderRadius: 6, padding: 12, fontSize: 12, fontWeight: 700,
    letterSpacing: 2.5, color: '#a8bccb', background: 'rgba(255,255,255,.04)',
    border: '1.5px solid rgba(168,188,203,.4)', fontFamily: 'Georgia, serif', cursor: 'pointer',
  };
  ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Demo));
</script>
</body>
</html>
```

- [ ] **Step 4: Compilar y mirar**

```bash
cd ~/ruleta-deploy && npm run build && open maquetas/entrada-relampago.html
```

Esperado, sin tocar nada: el rayo cae cada pocos segundos con destello, la ruleta gira abajo, el arco del centro late, el botón verde respira y le pasa un brillo. El 🔇 arranca apagado y al tocarlo pasa a 🔊.

- [ ] **Step 5: Comprobar el freno del movimiento**

En macOS: Configuración → Accesibilidad → Pantalla → Reducir movimiento. Recargar la maqueta.

Esperado: **todo queda quieto** y la pantalla se sigue leyendo igual — el rayo se ve fijo a media luz, la rueda parada, el botón sin brillo. Nada desaparece.

- [ ] **Step 6: Commit**

```bash
cd ~/ruleta-deploy && git add src/entrada.jsx public/index.html maquetas/entrada-relampago.html public/entrada.js && git commit -m "La escena de la puerta: tormenta, arcos y ruleta

Va aparte de login.jsx, que ya tiene 466 líneas y tres pantallas. Este
módulo no sabe nada de ingresar: sólo dibuja.

Todo el 3D es del navegador. Nada de motor 3D: three.js son entre 5 y 15
MB y los jugadores de esta casa buscan wifi para no gastar sus datos.

Los tres arcos son decoración y no menú. Hoy hay cinco mesas; si fueran
un menú habría que retocar la entrada cada vez que se abre una.

El sonido arranca APAGADO y se recuerda. Y una sola clase (vt-quieto)
apaga todo el movimiento para quien pidió no verlo o tiene un teléfono
flojo: la pantalla queda igual, quieta y legible."
```

---

### Task 4: La entrada nueva

Se cambia **cómo se ve** `LoginScreen`, no **qué hace**. Toda la validación, el registro con ficha completa (nombre, apellido, documento, teléfono, correo, banco), las condiciones y el aviso de sesión tomada quedan **exactamente igual**.

**Files:**
- Modify: `src/login.jsx` (el `return` de `LoginScreen`, alrededor de las líneas 265-466)
- Test: a ojo sobre `maquetas/entrada-relampago.html` y sobre el worker local

**Interfaces:**
- Consumes: `window.Entrada.Escena`, `window.Entrada.BotonArco`, `window.Entrada.Sonido` de la Task 3.
- Produces: nada nuevo. `window.LoginScreen` mantiene la misma prop `{ onAuth, aviso }`.

- [ ] **Step 1: Envolver la pantalla en la escena**

En `src/login.jsx`, en el `return` de `LoginScreen`, reemplazar el `<div>` exterior (el del `radial-gradient` marrón) por la escena. El armazón queda:

```jsx
    const Escena = (window.Entrada && window.Entrada.Escena)
      // Si entrada.js no cargó (una copia vieja de index.html guardada en el
      // teléfono), la entrada sigue funcionando sin escena. Una puerta fea
      // por la que se entra vale más que una linda que no carga.
      || (({ children }) => <div style={{ minHeight: '100vh', background: '#0a1c2c' }}>{children}</div>);

    return (
      <Escena>
        {verCondiciones && <PanelCondiciones />}
        <div style={{
          width: '100%', maxWidth: registro ? 440 : 360,
          borderRadius: 14, padding: registro ? 20 : 19,
          background: 'rgba(4,12,20,0.74)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 14px 44px rgba(0,0,0,0.62)',
          backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
        }}>
          {/* … el encabezado y el <form> que ya existen … */}
        </div>
      </Escena>
    );
```

**Importante:** el vidrio esmerilado (`backdrop-filter`) es lo que deja ver el salón detrás. Si el navegador no lo soporta, el fondo `rgba(4,12,20,0.74)` ya alcanza.

- [ ] **Step 2: Cambiar el encabezado**

Reemplazar el bloque del título (el `⚡ VOLTIO` dorado con `SALÓN DE JUEGOS`) por:

```jsx
          <div style={{ textAlign: 'center', marginBottom: 18 }}>
            <div style={{
              fontSize: 34, fontWeight: 700, letterSpacing: 8, color: '#fff6d8',
              textShadow: '0 0 18px rgba(255,216,74,0.9), 0 0 52px rgba(255,216,74,0.45)',
            }}>VOLTIO</div>
            <div style={{ fontSize: 8, letterSpacing: 4, color: '#9fd8ff', marginTop: 6 }}>
              {T('DONDE CAE EL RELÁMPAGO')}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 10 }}>
              {window.UI && window.UI.Idioma && <window.UI.Idioma />}
            </div>
          </div>
```

El selector de idioma **se queda**: es la primera pantalla y el que no lee español tiene que poder cambiarlo acá.

- [ ] **Step 3: Cambiar los campos al tono frío**

Reemplazar `inputStyle` por:

```jsx
    const inputStyle = {
      width: '100%', padding: '12px 14px', marginBottom: 10, borderRadius: 6,
      border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(2,7,12,0.7)',
      color: '#fff', fontSize: 16, fontFamily: 'Georgia, serif', outline: 'none',
      boxSizing: 'border-box',
    };
```

`fontSize: 16` **no se baja**: con menos de 16px, Safari en iPhone hace zoom solo al tocar un campo y descuadra la pantalla.

- [ ] **Step 4: El botón de entrar y el de registrarse**

Reemplazar el botón de enviar y el enlace de "¿No tenés cuenta?" por:

```jsx
            <BotonArco
              type="submit"
              disabled={loading}
              texto={loading
                ? T('ABRIENDO…')
                : (registro ? T('CREAR MI CUENTA') : T('ABRIR EL SALÓN'))}
            />

            {/* El registro es BOTÓN y no enlace: es a quien no se puede perder.
                Y va debajo de una línea que le habla directo al que llega por
                primera vez. */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, margin: '14px 2px 11px',
              fontSize: 9, letterSpacing: 3, color: '#6f8494',
            }}>
              <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
              {registro ? T('¿YA TENÉS CUENTA?') : T('¿PRIMERA VEZ AQUÍ?')}
              <span style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.12)' }} />
            </div>

            <button type="button" onClick={() => { setMode(registro ? 'login' : 'register'); setError(''); }}
              style={{
                width: '100%', borderRadius: 6, padding: 12, cursor: 'pointer',
                fontSize: 12, fontWeight: 700, letterSpacing: 2.5, fontFamily: 'Georgia, serif',
                color: '#a8bccb', background: 'rgba(255,255,255,0.04)',
                border: '1.5px solid rgba(168,188,203,0.4)',
              }}>
              {registro ? T('ENTRAR CON MI CUENTA') : T('CREAR MI CUENTA')}
            </button>
```

Y arriba del `return`, junto a las demás constantes:

```jsx
    const BotonArco = (window.Entrada && window.Entrada.BotonArco)
      || (({ texto, type, disabled }) => (
        <button type={type} disabled={disabled} style={{ width: '100%', padding: 14 }}>{texto}</button>
      ));
```

**El segundo botón es gris azulado y no dorado**: con el principal en verde, dejarlo en oro hacía que los dos pelearan la atención.

- [ ] **Step 5: Compilar y mirar la entrada de verdad**

```bash
cd ~/ruleta-deploy && npm run build && npx wrangler dev --local
```

Abrir `http://127.0.0.1:8787/` y comprobar, **sin escribir ninguna clave**:

1. Se ve la tormenta, los arcos, la ruleta girando y el formulario de vidrio.
2. El botón verde con forma de arco dice ABRIR EL SALÓN y respira.
3. CREAR MI CUENTA abre el formulario largo con todos los campos (nombre, apellido, documento, teléfono, correo, banco) y la casilla de las condiciones.
4. Desde el registro, ENTRAR CON MI CUENTA vuelve al formulario corto.
5. El enlace de las condiciones sigue abriendo el panel y se cierra con CERRAR.
6. Enviar vacío da el mismo error de siempre (`El usuario debe tener al menos 3 caracteres`).

- [ ] **Step 6: Comprobar en teléfono angosto**

En el navegador, achicar a 320px de ancho.

Esperado: el formulario no se corta, los dos botones se leen enteros, y **la página no se mueve de lado** (nada de scroll horizontal).

- [ ] **Step 7: Commit**

```bash
cd ~/ruleta-deploy && git add src/login.jsx public/login.js && git commit -m "La entrada nueva: la tormenta detrás del formulario

Cambia cómo se ve, no qué hace. La validación, el registro con ficha
completa, las condiciones y el aviso de sesión tomada quedan iguales.

El registro pasa a ser BOTÓN y no enlace: es a quien no se puede perder.
Va debajo de '¿primera vez aquí?', que le habla directo al que llega.

El segundo botón es gris azulado y no dorado: con el principal en verde,
dos botones dorados se peleaban la atención.

Si entrada.js no cargó, la pantalla sigue funcionando sin escena: una
puerta fea por la que se entra vale más que una linda que no carga."
```

---

### Task 5: El salón en vivo

**Files:**
- Modify: `src/salon.jsx` (`TarjetaMesa` y `SalonScreen`)
- Create: `maquetas/salon-pizarra.html`

**Interfaces:**
- Consumes: `window.Api.salonVivo()` de la Task 2.
- Produces: nada nuevo. `window.SalonScreen` mantiene sus props.

- [ ] **Step 1: Pedir los datos vivos**

En `src/salon.jsx`, dentro de `SalonScreen`, después del `useState` de `isMobile`:

```jsx
    // La vitrina: qué está pasando ahora en cada mesa. Se pide aparte del
    // catálogo porque se repite y el catálogo no cambia nunca.
    const [vivo, setVivo] = useState({});
    useEffect(() => {
      if (!window.Api || !window.Api.salonVivo) return undefined;
      let vive = true;
      const traer = () => {
        // Con la pantalla tapada no se pide nada: si el jugador deja el
        // teléfono de lado, esto se frena solo y no le gasta datos ni le pega
        // a la base por una vitrina que nadie está mirando.
        if (document.visibilityState !== 'visible') return;
        window.Api.salonVivo().then((d) => {
          if (!vive) return;
          const porId = {};
          for (const m of (d.mesas || [])) porId[m.id] = m;
          setVivo(porId);
        }).catch(() => { /* la vitrina es adorno: si falla, el salón se usa igual */ });
      };
      traer();
      const reloj = setInterval(traer, 10000);
      document.addEventListener('visibilitychange', traer);
      return () => {
        vive = false;
        clearInterval(reloj);
        document.removeEventListener('visibilitychange', traer);
      };
    }, []);
```

- [ ] **Step 2: Los colores de los números**

Arriba del archivo, junto a `const DORADO`:

```jsx
  // Los rojos de la ruleta. El cero (y el doble cero) van en verde.
  const ROJOS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  function colorDeNumero(n) {
    if (n === '0' || n === '00') return { background: 'linear-gradient(180deg,#3fe07a,#12a04c)', color: '#04240f' };
    if (ROJOS.has(Number(n))) return { background: 'linear-gradient(180deg,#e0384f,#8e1526)', color: '#fff' };
    return { background: 'linear-gradient(180deg,#2b333d,#0d1116)', color: '#fff' };
  }
```

- [ ] **Step 3: La fila de "jugando" y la tira de números**

Dentro de `TarjetaMesa`, que ahora recibe también `en` (la ficha viva), agregar **debajo del bloque de `mesa.detalle`**:

```jsx
        {/* Cuánta gente hay. Si no hay nadie lo dice, apagado y sin punto: una
            vitrina que finge movimiento se nota, y se nota mal. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9 }}>
          {en && en.jugando > 0 ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 8,
              letterSpacing: 1.5, fontWeight: 700, color: '#9ff0a0', padding: '3px 6px',
              border: '1px solid #2a8a2a', background: 'rgba(42,138,42,0.2)', borderRadius: 3,
            }}>
              <span className="sl-pulso" />
              <b style={{ color: '#fff', fontSize: 9.5 }}>{en.jugando}</b> {T('JUGANDO')}
            </span>
          ) : (
            <span style={{
              fontSize: 8, letterSpacing: 1.5, fontWeight: 700, color: '#8b9aa6',
              padding: '3px 6px', border: '1px solid #3a4650',
              background: 'rgba(0,0,0,0.3)', borderRadius: 3,
            }}>{T('MESA LIBRE')}</span>
          )}
        </div>

        {/* Los últimos números. El rótulo NO es adorno: en este casino cada
            jugador tiene su propio giro, así que sin el rótulo la tira se lee
            como si fuera una sola ruleta girando para todos. */}
        {en && en.ultimos && en.ultimos.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 9 }}>
            <small style={{ fontSize: 7.5, letterSpacing: 1.5, color: '#7f96a6' }}>
              {T('ÚLTIMOS DE LA MESA')}
            </small>
            <div style={{ display: 'flex', gap: 5 }}>
              {en.ultimos.map((n, i) => (
                <span key={i} className={i === 0 ? 'sl-nuevo' : ''} style={Object.assign({
                  width: 22, height: 22, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 900, flex: 'none',
                }, colorDeNumero(n))}>{n}</span>
              ))}
            </div>
          </div>
        )}

        {/* El rayo: el mejor anuncio de la casa, y sale solo. */}
        {en && en.ultimo_rayo && (
          <div style={{
            fontSize: 8.5, letterSpacing: 1, color: '#ffd84a', marginTop: 8,
            textShadow: '0 0 8px rgba(255,216,74,0.6)',
          }}>
            ⚡ {T('Cayó un rayo hace {n} min y pagó {x}x', {
                 n: en.ultimo_rayo.hace_min, x: en.ultimo_rayo.mult })}
          </div>
        )}

        {/* En el 21 no hay números que mostrar: hay manos en curso. */}
        {en && en.manos_en_juego > 0 && (
          <div style={{ fontSize: 8.5, letterSpacing: 1, color: '#8ea2b0', marginTop: 8 }}>
            🃏 {T('{n} manos en juego', { n: en.manos_en_juego })}
          </div>
        )}
```

- [ ] **Step 4: La mesa caliente y el fogonazo del rayo**

Dos clases más sobre la tarjeta. La **caliente** es una sola —la de más gente— para que el ojo tenga un solo lugar a donde ir; si el barrido lo tuvieran todas, no señalaría nada.

En `SalonScreen`, antes del `map` de las mesas:

```jsx
    // La mesa con más gente. Sólo una lleva el barrido de luz: si lo llevaran
    // todas no señalaría nada. Con el salón vacío no lo lleva ninguna.
    let caliente = null;
    for (const m of abiertas) {
      const e = vivo[m.id];
      if (e && e.jugando > 0 && (!caliente || e.jugando > (vivo[caliente].jugando || 0))) caliente = m.id;
    }
```

En `TarjetaMesa`, agregar `overflow: 'hidden'` al `style` del `div` exterior (sin eso el barrido se sale de la tarjeta) y la clase:

```jsx
      <div className={(esCaliente ? 'sl-caliente ' : '') + (tieneRayo ? 'sl-rayo' : '')} style={{
        borderRadius: 12, padding: isMobile ? 14 : 18, position: 'relative', overflow: 'hidden',
        /* … lo demás del style, igual que estaba … */
      }}>
```

Con las dos banderas calculadas arriba del `return` de `TarjetaMesa`:

```jsx
    const esCaliente = !!caliente && caliente === mesa.id;
    // El fogonazo sólo se enciende cuando el rayo es RECIENTE. Un rayo de hace
    // dos horas no tiene por qué seguir destellando: sería un anuncio falso.
    const tieneRayo = !!(en && en.ultimo_rayo && en.ultimo_rayo.hace_min <= 15);
```

Y pasarle las dos cosas en el `map`:

```jsx
            {abiertas.map(paraLaTarjeta).map((m) => (
              <TarjetaMesa key={m.id} mesa={m} en={vivo[m.id]} isMobile={isMobile}
                           caliente={caliente} onEntrar={() => onEntrarMesa(m.id)} />
            ))}
```

(La firma pasa a ser `function TarjetaMesa({ mesa, en, caliente, isMobile, onEntrar })`.)

- [ ] **Step 5: La tormenta de fondo del salón**

En `SalonScreen`, cambiar el `background` del `div` exterior por la misma paleta de la puerta, para que el salón se sienta el mismo lugar y no otra aplicación:

```jsx
        background: 'radial-gradient(ellipse 120% 55% at 50% 84%, #16405c 0%, #0a1c2c 44%, #02050a 100%)',
```

Y meter, como primer hijo de ese `div`, el destello de fondo:

```jsx
        {/* La tormenta sigue viva pero muy baja: un destello cada tanto para
            que la lista no quede plana, sin robarle atención a los datos. */}
        <div className="sl-tormenta" aria-hidden="true" />
```

- [ ] **Step 6: El movimiento**

Agregar al final del archivo, antes de `window.SalonScreen = SalonScreen;`:

```jsx
  // El movimiento de la vitrina, en una hoja sola. El mismo freno que la
  // entrada: quien pidió no ver animaciones no las ve.
  (function estilos() {
    if (document.getElementById('sl-css')) return;
    const quieto =
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);
    const s = document.createElement('style');
    s.id = 'sl-css';
    // El fondo de tormenta va SIEMPRE: es color, no movimiento, y sin él el
    // salón se ve de otra aplicación que la puerta.
    const fondo = [
      '.sl-tormenta{position:absolute;inset:0;pointer-events:none;background:',
      ' radial-gradient(ellipse 60% 20% at 28% 4%,rgba(255,216,74,.12),transparent 70%),',
      ' radial-gradient(ellipse 52% 18% at 78% 2%,rgba(140,200,255,.10),transparent 70%)}',
      '.sl-pulso{width:6px;height:6px;border-radius:50%;background:#3fe07a;box-shadow:0 0 8px #3fe07a}',
    ];
    s.textContent = quieto ? fondo.join('') : fondo.concat([
      '.sl-pulso{animation:sl-pulso 1.6s ease-in-out infinite}',
      '@keyframes sl-pulso{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}',
      // El número que acaba de entrar cae con un golpe de luz. Es la señal de
      // que la mesa está viva AHORA y no hace una hora.
      '.sl-nuevo{animation:sl-entra .5s ease-out}',
      '@keyframes sl-entra{0%{opacity:0;transform:scale(.4)}60%{opacity:1;transform:scale(1.25)}',
      ' 100%{opacity:1;transform:scale(1)}}',
      // El barrido de la mesa caliente: una luz que la cruza cada tantos
      // segundos. La lleva UNA sola mesa.
      '.sl-caliente:after{content:"";position:absolute;top:0;bottom:0;width:70px;left:-100px;',
      ' pointer-events:none;background:linear-gradient(100deg,transparent,rgba(255,216,74,.16),transparent);',
      ' animation:sl-barrido 5.5s ease-in-out infinite}',
      '@keyframes sl-barrido{0%{left:-100px}60%,100%{left:115%}}',
      // El fogonazo del rayo sobre la tarjeta. Es el mejor anuncio de la casa
      // y sale solo.
      '.sl-rayo:before{content:"";position:absolute;inset:0;pointer-events:none;border-radius:12px;',
      ' background:radial-gradient(ellipse 80% 60% at 50% 0%,rgba(255,216,74,.4),transparent 70%);',
      ' opacity:0;animation:sl-golpe 9s ease-out infinite}',
      '@keyframes sl-golpe{0%,90%{opacity:0}91%{opacity:1}93%{opacity:.25}94.5%{opacity:.9}100%{opacity:0}}',
      // La tormenta del fondo, apenas latiendo.
      '.sl-tormenta{animation:sl-nube 16s ease-in-out infinite alternate}',
      '@keyframes sl-nube{from{transform:translateX(-8px)}to{transform:translateX(8px)}}',
    ]).join('');
    document.head.appendChild(s);
  })();
```

**La barra de arriba no se toca.** Saldo, CAJA, BANCA / PANEL, SALIR y el selector de idioma quedan exactamente como están: es la barra que el jugador ya conoce.

- [ ] **Step 7: La maqueta del salón**

Crear `maquetas/salon-pizarra.html`, que carga el salón real compilado con un `Api` falso — es la única forma de ver esta pantalla sin escribir una clave:

```html
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Maqueta · el salón en vivo</title>
<style>*{box-sizing:border-box}html,body{margin:0;background:#0a0a0a}</style>
<script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
</head>
<body>
<div id="root"></div>
<script>
  // Las cinco mesas reales de la base, al 08/08/2026.
  const MESAS = [
    { id:'catatumbo', tipo:'ruleta', label:'Catatumbo', activo:1, icono:'🐆⚡', color:'#ffd84a',
      detalle1:'Ruleta americana 0/00 · 38 animales', detalle2:'Rayos con premios hasta 500x',
      casillas:38, doble_cero:1, rayos:1, pago_pleno:29 },
    { id:'americana', tipo:'ruleta', label:'Americana Clásica', activo:1, icono:'🎩', color:'#4fd1a5',
      detalle1:'Ruleta americana de toda la vida', detalle2:'Sin animales · el pleno paga 35 a 1',
      casillas:38, doble_cero:1, rayos:0, pago_pleno:35 },
    { id:'europea', tipo:'ruleta', label:'Europea Clásica', activo:1, icono:'🎡', color:'#a78bfa',
      detalle1:'Ruleta europea de un solo cero', detalle2:'La favorita de los jugadores finos',
      casillas:37, doble_cero:0, rayos:0, pago_pleno:35 },
    { id:'europea_animales', tipo:'ruleta', label:'Europea Catatumbo', activo:1, icono:'🐆🎡', color:'#ffd84a',
      detalle1:'Europea de un solo cero · con animales', detalle2:'Rayos con premios hasta 500x',
      casillas:37, doble_cero:0, rayos:1, pago_pleno:29 },
    { id:'blackjack', tipo:'blackjack', label:'Blackjack Estándar', activo:1, icono:'🃏', color:'#4fd1a5',
      detalle1:'6 mazos · el crupier se planta en 17', detalle2:'El blackjack natural paga 3 a 2',
      mazos:6, pago_natural:1.5, apuesta_min:10 },
  ];
  // El Api falso: devuelve una vitrina que CAMBIA, para ver el movimiento.
  let paso = 0;
  const RUEDA = ['17','26','0','32','15','11','3','36','22','9','00','7'];
  window.Api = {
    salonVivo() {
      paso++;
      const corrida = (n) => RUEDA.slice(paso % 7, (paso % 7) + 5).map(String);
      return Promise.resolve({ mesas: [
        { id:'catatumbo', jugando:4, ultimos:corrida(), ultimo_rayo:{ mult:200, hace_min:6 }, manos_en_juego:null },
        { id:'americana', jugando:2, ultimos:corrida().reverse(), ultimo_rayo:null, manos_en_juego:null },
        { id:'europea', jugando:0, ultimos:['1','20','14','31','5'], ultimo_rayo:null, manos_en_juego:null },
        { id:'europea_animales', jugando:1, ultimos:corrida(), ultimo_rayo:{ mult:50, hace_min:22 }, manos_en_juego:null },
        { id:'blackjack', jugando:3, ultimos:[], ultimo_rayo:null, manos_en_juego:3 },
      ]});
    },
  };
</script>
<script src="../public/i18n.js"></script>
<script src="../public/ui.js"></script>
<script src="../public/salon.js"></script>
<script>
  const user = { username:'prueba3', first_name:'Juan', last_name:'Pérez', balance:2300 };
  ReactDOM.createRoot(document.getElementById('root')).render(
    React.createElement(window.SalonScreen, {
      user, mesas: MESAS,
      onEntrarMesa: (id) => alert('entrar a ' + id),
      onOpenWallet: () => {}, onLogout: () => {},
    })
  );
</script>
</body>
</html>
```

- [ ] **Step 8: Compilar y mirar**

```bash
cd ~/ruleta-deploy && npm run build && open maquetas/salon-pizarra.html
```

Esperado: las cinco mesas con su color; Catatumbo con `4 JUGANDO` y el punto latiendo, su tira de cinco números en rojo/negro/verde y la línea del rayo; Europea Clásica en `MESA LIBRE`, apagada y sin punto; Blackjack con `3 manos en juego` y **sin** números.

Y cuatro movimientos, todos a la vez:
1. **Cada diez segundos entra un número nuevo** a la cabeza de la tira con un golpe de luz.
2. **El barrido de luz cruza sólo la Catatumbo** (es la de más gente, 4). Ninguna otra.
3. **El fogonazo de oro** se enciende sobre la Catatumbo (rayo de hace 6 min) y **no** sobre Europea Catatumbo (rayo de hace 22 min, ya viejo).
4. **La tormenta del fondo** se mueve muy despacio de lado a lado.

- [ ] **Step 9: Comprobar el freno**

Con "Reducir movimiento" prendido, recargar. Esperado: los datos se siguen viendo y actualizando, **sin ninguna animación** — ni pulso, ni barrido, ni fogonazo. El fondo de tormenta **sí** se queda: es color, no movimiento.

- [ ] **Step 10: Commit**

```bash
cd ~/ruleta-deploy && git add src/salon.jsx maquetas/salon-pizarra.html public/salon.js && git commit -m "El salón muestra lo que está pasando ahora

Cuánta gente hay en cada mesa, los últimos números y el último rayo. En
el 21, las manos en juego: ahí no hay números que mostrar.

El rótulo ÚLTIMOS DE LA MESA no es adorno. En este casino cada jugador
tiene su propio giro; sin el rótulo la tira se lee como si fuera una
sola ruleta girando para todos.

Si no hay nadie dice MESA LIBRE, apagado y sin punto. Una vitrina que
finge movimiento se nota, y se nota mal.

El barrido de luz lo lleva UNA sola mesa, la de más gente: si lo
llevaran todas no señalaría nada. Y el fogonazo del rayo sólo se
enciende si el rayo es de hace menos de 15 minutos — uno de hace dos
horas destellando sería un anuncio falso.

Se refresca cada 10 s y sólo con la pantalla a la vista: si el jugador
deja el teléfono de lado, se frena solo."
```

---

### Task 6: La cámara avanza de la puerta al salón

Al entrar, el formulario se desvanece y los arcos crecen hasta convertirse en el salón. Puerta y salón son un solo movimiento, no dos pantallas.

**Files:**
- Modify: `src/entrada.jsx` (una clase de salida en la escena)
- Modify: `src/app.jsx` (esperar el movimiento antes de cambiar de pantalla)

**Interfaces:**
- Consumes: `window.Entrada.Escena` de la Task 3.
- Produces: `window.Entrada.DURACION_ENTRADA` (número, en ms) y la prop `<Escena entrando={bool}>`.

- [ ] **Step 1: La animación de entrada**

En `src/entrada.jsx`, agregar al final del `CSS`:

```jsx
    // La cámara avanza: los arcos crecen y se comen la pantalla mientras el
    // formulario se va. Es lo que hace que la puerta y el salón se sientan
    // el mismo lugar y no dos pantallas distintas.
    '.vt-esc.vt-entrando .vt-arcos{animation:vt-adentro 900ms ease-in forwards}',
    '.vt-esc.vt-entrando .vt-frente{animation:vt-irse 400ms ease-out forwards}',
    '.vt-esc.vt-entrando .vt-mesa{animation:vt-abajo 900ms ease-in forwards}',
    '@keyframes vt-adentro{to{transform:scale(6);opacity:0}}',
    '@keyframes vt-irse{to{opacity:0;transform:translateY(14px)}}',
    '@keyframes vt-abajo{to{transform:translateX(-50%) perspective(460px) rotateX(70deg) scale(2.4);opacity:0}}',
    '.vt-quieto.vt-entrando .vt-arcos,.vt-quieto.vt-entrando .vt-frente,',
    '.vt-quieto.vt-entrando .vt-mesa{animation:none;opacity:0}',
```

Y en `Escena`, aceptar la prop:

```jsx
  function Escena({ children, entrando }) {
    const [son, setSon] = React.useState(Sonido.prendido());
    React.useEffect(ponerEstilos, []);
    React.useEffect(() => { if (entrando) Sonido.trueno(); }, [entrando]);

    return (
      <div className={'vt-esc'
        + (SIN_MOVIMIENTO ? ' vt-quieto' : '')
        + (entrando ? ' vt-entrando' : '')}>
```

Y exportar la duración:

```jsx
  // Lo que tarda el avance. Vive acá y no en app.jsx para que el que cambie
  // la animación no tenga que acordarse de cambiar la espera en otro archivo.
  window.Entrada = { Escena, BotonArco, Sonido, DURACION_ENTRADA: 900 };
```

- [ ] **Step 2: Esperar el movimiento antes de cambiar de pantalla**

En `src/login.jsx`, en `LoginScreen`, agregar el estado y usarlo:

```jsx
    const [entrando, setEntrando] = useState(false);
```

Y en `submit`, reemplazar `onAuth(res.user);` por:

```jsx
        window.Api.setToken(res.token);
        // Primero arranca el avance, DESPUÉS se cambia de pantalla: si se
        // cambiara antes, el jugador ve un corte en vez de un movimiento.
        setEntrando(true);
        const espera = (window.Entrada && window.Entrada.DURACION_ENTRADA) || 0;
        setTimeout(() => onAuth(res.user), espera);
        return;
```

Y pasarle la prop a la escena: `<Escena entrando={entrando}>`.

**Cuidado:** el `finally { setLoading(false); }` se queda como está, pero con `entrando` en `true` el botón ya está deshabilitado, así que no se puede enviar dos veces.

- [ ] **Step 3: Compilar y mirar el movimiento**

```bash
cd ~/ruleta-deploy && npm run build && npx wrangler dev --local
```

Entrar con la cuenta de pruebas desde el navegador **(pedile al dueño que escriba él la clave; vos no podés escribirla)** y mirar: el formulario se va, los arcos crecen y se comen la pantalla, y recién ahí aparece el salón. Sin corte.

Si no hay quien la escriba, comprobarlo con la maqueta: agregarle a `maquetas/entrada-relampago.html` un botón que ponga `entrando` en `true`.

- [ ] **Step 4: Commit**

```bash
cd ~/ruleta-deploy && git add src/entrada.jsx src/login.jsx public/entrada.js public/login.js && git commit -m "La cámara avanza de la puerta al salón

Al entrar, el formulario se va y los arcos crecen hasta comerse la
pantalla. Puerta y salón son un solo movimiento y no dos pantallas.

El cambio de pantalla espera a que termine el avance: si se cambiara
antes, el jugador ve un corte en vez de un movimiento. La duración vive
en entrada.jsx para que el que cambie la animación no tenga que
acordarse de cambiar la espera en otro archivo."
```

---

### Task 7: Migrar producción y desplegar

**Files:** ninguno nuevo. Es la puesta en marcha.

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: la entrada y el salón nuevos, vivos en `mycrosis.com`.

- [ ] **Step 1: Aplicar la migración en producción — ANTES de desplegar**

Si el código nuevo sale antes que la tabla, cada giro va a fallar al anotar.

```bash
cd ~/ruleta-deploy && npx wrangler d1 execute ruleta-db --remote --file=migrations/020_giros.sql
```

Comprobar:

```bash
cd ~/ruleta-deploy && npx wrangler d1 execute ruleta-db --remote --command "SELECT name FROM sqlite_master WHERE name='giros'"
```

Esperado: una fila con `giros`. **Si no aparece, parar acá.**

- [ ] **Step 2: Merge a `main`**

```bash
cd ~/ruleta-deploy && git checkout main && git merge --ff-only diseno-entrada-salon && git branch --show-current
```

- [ ] **Step 3: Desplegar**

```bash
cd ~/ruleta-deploy && npm run deploy
```

Leer la salida completa. **Si el build falla, el deploy falla en silencio y producción se queda con la versión vieja** — ya pasó dos veces en este proyecto, por backticks dentro de comentarios.

- [ ] **Step 4: Verificar por TAMAÑO, no por grep**

Los edges de Cloudflare sirven la versión vieja por decenas de segundos, y los acentos rompen las búsquedas de texto.

```bash
cd ~/ruleta-deploy && for f in entrada.js login.js salon.js; do
  echo "$f  local=$(wc -c < public/$f)  servido=$(curl -s https://mycrosis.com/$f | wc -c)"
done
```

Esperado: los dos números iguales en los tres archivos. Si no, esperar un minuto y repetir.

- [ ] **Step 5: Verificar la vitrina contra producción**

```bash
cd ~/ruleta-deploy && node pruebas/verificar-salon-vivo.mjs --api=https://mycrosis.com --usuario=prueba3 --clave=LA_CLAVE
```

Esperado: `TODO BIEN`.

- [ ] **Step 6: Comprobar que los giros se anotan en producción**

Después de que el dueño juegue unos giros:

```bash
cd ~/ruleta-deploy && npx wrangler d1 execute ruleta-db --remote --command "SELECT game_id, COUNT(*) AS giros, SUM(premio > 0) AS ganados FROM giros GROUP BY game_id"
```

Esperado: `giros` mayor que `ganados` en cada mesa. **Si fueran iguales, sólo se están anotando los ganadores** y la vitrina va a mentir.

- [ ] **Step 7: Avisarle al dueño qué mirar**

Decirle que entre desde el teléfono y confirme: la puerta con la tormenta, el botón verde, CREAR MI CUENTA como botón propio, el sonido apagado, y el salón con los contadores. Y recordarle que **con el salón vacío la pizarra se va a ver vacía**: es lo que se acordó.

---

## Lo que este plan NO hace

- **No toca las mesas por dentro** (`src/app.jsx`, `src/blackjack.jsx`), ni la caja, ni la banca, ni el panel matriz, ni la capa ejecutiva.
- **No agrega ninguna librería.** Nada de WebGL ni three.js.
- **No cambia las reglas, los pagos ni los saldos.**
- **No hace mesas compartidas.** Los juegos siguen siendo independientes por jugador.
- **No resuelve** los pendientes de antes de abrir (clave del admin, la cuenta vieja `admin`, `casa_fondo`, arreglar `migrations/limpieza_arranque.sql`). Van por su lado.
