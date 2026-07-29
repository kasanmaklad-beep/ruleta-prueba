# El Blackjack — estructura y ruta de trabajo

**Fecha:** 28/07/2026 · **Estado:** propuesta, pendiente de aprobación del dueño
**Se apoya en:** `ESTRUCTURA-SALON.md` (el salón ya existe; el blackjack entra como una mesa más)

---

## 1. La idea en una imagen

El salón VOLTIO ya está construido y en producción. Hoy todas sus mesas son
ruletas. Lo que se agrega es **un segundo tipo de mesa**:

```
                    ENTRADA (login único)
                          │
                     EL SALÓN  (/salon)
                          │
        ┌─────────────────┴──────────────────┐
        │                                    │
   MESAS DE RULETA                    MESAS DE BLACKJACK
   /juego?mesa=<id>                   /mesa21?mesa=<id>
        │                                    │
   ├── Catatumbo        ← abierta       └── Blackjack Estándar  ← nueva
   ├── Americana Clásica                     (6 mazos, natural 3:2)
   ├── Europea Clásica
   └── Europea con Animales
```

**Una sola billetera, una sola caja, un solo panel.** El jugador recarga por su
taquillero como siempre, y ese mismo saldo le sirve en la ruleta y en el
blackjack. El cierre diario le dice al dueño cuánto dejó cada mesa, sin
distinguir de qué tipo es.

## 2. Qué se conserva y qué cambia

**Se conserva tal cual (no se toca):**
- Las cuentas, los roles, los códigos de referido
- La billetera: recargas, retiros, el circuito de fichas con los socios
- El panel del dueño y la taquilla del socio
- El libro de movimientos (`transactions`) y los reportes por mesa
- **La ruleta entera.** El blackjack no toca `gameSpin` ni la rueda ni el paño.

**Lo que cambia:**
- La ficha de mesa (tabla `games`) gana una columna **`tipo`**: `'ruleta'` o
  `'blackjack'`. Todo lo que hoy existe queda como `'ruleta'`.
- El salón, al dibujar la tarjeta, manda a `/juego` o a `/mesa21` según el tipo.
- Aparece una pantalla 2D nueva (cartas, crupier), separada de la ruleta.
- Aparece un motor nuevo en el servidor: `worker/blackjack.js`.

## 3. La mesa de blackjack como ficha

**No se crea una tabla `blackjack_tables` aparte.** Sería un catálogo paralelo
al que el dueño ya maneja desde la pestaña MESAS del panel, y obligaría a
duplicar el panel, el salón y los reportes. La tabla `games` se extiende:

```sql
-- migración 012
ALTER TABLE games ADD COLUMN tipo TEXT NOT NULL DEFAULT 'ruleta';
ALTER TABLE games ADD COLUMN mazos INTEGER;          -- cuántos mazos de 52 por ronda
ALTER TABLE games ADD COLUMN pago_natural REAL;      -- 1.5 = 3:2 · 1.2 = 6:5
ALTER TABLE games ADD COLUMN apuesta_min INTEGER;    -- ficha más chica de la mesa
ALTER TABLE games ADD COLUMN apuesta_max INTEGER;    -- ficha más grande
```

Las columnas de ruleta (`rueda`, `animales`, `rayos`, `pago_pleno`) quedan
vacías en una mesa de blackjack, y al revés. `validarMesa()` en `lib.js` pasa a
validar según el tipo: hoy exige "sin rayos, el pleno paga 35"; sumará "una
mesa de blackjack lleva entre 1 y 8 mazos y paga 1.5 o 1.2 el natural".

La mesa que se siembra para arrancar:

| Campo | Valor |
|---|---|
| id | `blackjack` |
| label | Blackjack Estándar |
| tipo | `blackjack` |
| mazos | 6 |
| pago_natural | 1.5 (3:2) |
| apuesta_min / max | los que decida el dueño |
| activo | 0 — se enciende recién al final, verificada |

Y dos tablas nuevas, solo para el estado de las manos:

```sql
CREATE TABLE bj_rondas (
  id           TEXT PRIMARY KEY,
  user_id      INTEGER NOT NULL,
  game_id      TEXT NOT NULL,          -- la mesa, para el reporte
  estado       TEXT NOT NULL,          -- 'jugando' | 'cerrada'
  crupier      TEXT NOT NULL,          -- JSON de las cartas del crupier
  repartidas   TEXT NOT NULL,          -- JSON de todo lo ya salido del mazo
  mano_activa  INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  cerrada_at   TEXT
);

CREATE TABLE bj_manos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ronda_id   TEXT NOT NULL REFERENCES bj_rondas(id),
  indice     INTEGER NOT NULL,         -- 0, o 1 si hubo división
  cartas     TEXT NOT NULL,            -- JSON
  apuesta    INTEGER NOT NULL,
  estado     TEXT NOT NULL,            -- 'jugando' | 'plantada' | 'pasada' | 'doblada'
  resultado  TEXT,                     -- 'gana' | 'pierde' | 'empate' | 'natural'
  pago       INTEGER
);
```

**La plata NO vive acá.** Cada apuesta y cada premio se anotan en
`transactions` con `game_id = 'blackjack'`, exactamente como hace la ruleta.
Así el cierre diario, el reporte por mesa, el reporte por jugador y las alertas
funcionan el primer día sin tocar `reports.js`. `bj_rondas` y `bj_manos` son el
detalle para auditar una mano puntual, no la contabilidad.

## 4. Avisos importantes del negocio (leer antes de pedir el blackjack)

Los mismos avisos que se escribieron para la ruleta europea, pero más fuertes.

**1. El blackjack le deja a la casa una décima parte de lo que le deja la ruleta.**

| Mesa | Se queda la casa |
|---|---|
| Catatumbo / Americana | 5,26% de lo apostado |
| Europea | 2,70% |
| **Blackjack 6 mazos, natural 3:2, completo** | **~0,5%** |
| Blackjack con natural 6:5 | ~1,9% |

No es un error de diseño ni algo que se pueda ajustar: es la matemática del
juego, igual en todos los casinos del mundo. Significa que **la mesa de
blackjack necesita muchísimo más volumen apostado para dejar lo mismo**, y que
puede pasar días perdiendo sin que nada esté roto. En un casino real el
blackjack no es la mesa que da la ganancia: es la que trae la gente que después
juega otras cosas. Si se la pide esperando que rinda como Catatumbo, va a
decepcionar.

**2. El MVP deja más ganancia que la versión terminada.** Sin dividir, la
ventaja de la casa queda alrededor del **1,1%**; cuando se agregue dividir baja
a ~0,5%. O sea: el número va a EMPEORAR cuando el juego se complete. Conviene
saberlo de antemano para no leerlo como que "algo se rompió".

**3. La cantidad de mazos casi no mueve la aguja; el pago del natural sí.**
Como se baraja de cero en cada ronda, los mazos son una decisión de sensación,
no de plata. Pasar el natural de 3:2 a 6:5 le saca al jugador casi un punto y
medio — es la única perilla grande que tiene esta mesa. **Advertencia:** el 6:5
es el cambio que los jugadores que conocen el juego detectan al instante y por
el que se van. Se recomienda arrancar en 3:2.

**4. Doblar multiplica la exposición.** Una apuesta de 500 que se dobla expone
1.000; con división y doble en las dos manos, 2.000. El tope de la mesa hay que
ponerlo sobre **lo máximo que puede llegar a comprometerse la ronda**, no sobre
la apuesta inicial. En el MVP (sin dividir) el techo es 2x la apuesta.

## 5. Las reglas de la v1

- Mazo estándar de 52 cartas, **barajado de cero en cada ronda** — esto anula el
  conteo de cartas, que es la única forma real de dar vuelta la ventaja.
- El crupier se planta en 17 o más, sin distinguir el 17 blando.
- Natural (21 con las dos primeras cartas, sin haber dividido) paga 3:2.
- Acciones: **pedir**, **plantarse**, **doblar** (solo con 2 cartas).
- **Dividir** llega en la Etapa B4. Un solo par en las dos cartas iniciales, sin
  volver a dividir. Ases divididos: una carta por mano y se planta solo.
- **Se divide POR VALOR, no por rango** (decidido el 28/07/2026). O sea: 10 con
  K se puede dividir, igual que J con Q o K con K — alcanza con que las dos
  cartas valgan lo mismo. Es lo que hace la mayoría de los casinos, y es lo que
  le conviene a la casa: dividir un 20 es la peor jugada del blackjack (el 20
  gana solo siete de cada diez veces, y partirlo deja dos manos que arrancan en
  10). Prohibirlo sería cuidarle la plata al jugador y encima tener que
  explicar por qué esta mesa no deja hacer algo que en cualquier otra sí.
- Empate: se devuelve la apuesta.
- **Sin seguro y sin rendirse.** El seguro es una apuesta que le saca al jugador
  el 7% cada vez que la toma; suma código y mala fama, y no la vale.
- **Tres puestos** (decidido el 28/07/2026, ya construido). Un mismo jugador
  puede poner fichas en uno, dos o tres círculos y jugarlos en orden, de
  izquierda a derecha, contra el mismo crupier. Cada puesto lleva su apuesta,
  y **el mínimo y el máximo son por puesto**, no por ronda: el riesgo de la
  casa lo marca cuánto puede cobrar una mano. Cuántos círculos abre cada mesa
  se guarda en su ficha (`games.puestos`).

  **La trampa de esta función, para que no vuelva:** un 21 servido tiene que
  seguir pagando 3 a 2 aunque haya otros puestos en juego. El motor sabe si
  una mano es una división mirando cuántas manos tiene ESE PUESTO, no cuántas
  tiene la ronda. Si se contara por ronda, apostar en dos círculos le anularía
  los naturales de los dos —3 a 2 pasaría a 1 a 1— sin que nadie lo note. La
  batería lo comprueba en cada 21 servido.

## 6. Lo único genuinamente nuevo por dentro: la ronda que queda abierta

La ruleta resuelve todo en una sola llamada: entra la apuesta, sale el número,
se paga. El blackjack deja la ronda abierta entre una llamada y la siguiente, y
ahí aparecen tres problemas que la ruleta nunca tuvo. **Este es el trabajo real
de esta obra; el resto es escribir reglas conocidas.**

**a. Una ronda por jugador a la vez.** Si puede abrir varias, abre cinco, ve las
cartas y sigue solo la que le conviene. `/api/bj/apostar` rechaza si el jugador
ya tiene una ronda `jugando`.

**b. Dos llamadas al mismo tiempo.** Dos `/pedir` disparados juntos (doble clic,
conexión mala) no pueden repartir dos cartas; `/doblar` mandado dos veces no
puede descontar dos veces. Se resuelve con el mismo truco que ya usa el saldo en
`gameSpin`: el `UPDATE` lleva la condición adentro (`WHERE estado = 'jugando'`)
y se mira `changes` — si volvió 0, la jugada ya estaba hecha y se responde con
el estado actual en vez de repetirla.

**c. La ronda abandonada.** El jugador ve una mano fea y cierra el navegador. La
plata no corre riesgo (la apuesta ya se descontó), pero la ronda queda abierta
para siempre y le traba la mesa. Reglas: `GET /api/bj/ronda` devuelve la ronda
abierta para poder retomarla al recargar la página, y una ronda de más de 12
horas se cierra sola plantando la mano — el crupier juega y se paga lo que
corresponda.

Y una regla de dinero: **la carta tapada del crupier nunca sale del servidor.**
Mientras la ronda esté viva, esa carta viaja como `{ tapada: true }`. Es la
misma disciplina que hizo que la ruleta sortee en el servidor.

## 7. Los endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| POST | `/api/bj/apostar` | Valida mesa, límites y saldo; descuenta; baraja; reparte 2+2. Devuelve la mano del jugador y **una sola** carta del crupier. |
| POST | `/api/bj/pedir` | Una carta a la mano activa. |
| POST | `/api/bj/plantarse` | Cierra la mano; pasa a la siguiente o al crupier. |
| POST | `/api/bj/doblar` | Descuenta la segunda apuesta, una carta, cierra la mano. |
| POST | `/api/bj/dividir` | (Etapa B4) |
| GET | `/api/bj/ronda` | La ronda abierta del jugador, para retomarla. |

Todas piden sesión (`requireAuth`) y todas comprueban que la ronda es **de quien
la pide**. Se suma un freno de repetición: no más de N llamadas por minuto por
jugador — hoy la ruleta no lo tiene, y acá hace más falta porque son seis rutas.

## 8. La ruta de trabajo, por etapas

Igual que el salón: cada etapa termina en algo que se puede probar, y no se
arranca una sin cerrar la anterior.

### Etapa B1 — El motor, sin pantalla
`worker/blackjack.js`: baraja con `crypto.getRandomValues()`, reparte, juega el
crupier, decide y paga contra `transactions`. Migración 012 escrita. Una sola
línea de ruteo nueva en `index.js`.
- **Prueba de cierre:** `pruebas/verificar-blackjack.mjs` juega miles de manos
  contra el servidor local y comprueba, mano por mano, que el resultado y el
  pago son los que corresponden; que la carta tapada nunca aparece antes de
  tiempo; que dos llamadas simultáneas no reparten de más; y que la ventaja
  medida cae donde tiene que caer.

### Etapa B2 — La mesa en el catálogo y en el panel
`games.tipo` y las columnas nuevas; `validarMesa()` valida por tipo; la pestaña
MESAS del panel muestra el formulario que corresponde a cada tipo; el salón
dibuja la tarjeta y manda a la pantalla correcta.
- **Prueba de cierre:** el dueño ve la mesa de blackjack en su panel, la
  enciende y la apaga, y aparece y desaparece del salón del celular.

### Etapa B3 — La pantalla
`src/blackjack.jsx`: cartas, reparto animado, crupier, saldo en la cabecera y
botón SALÓN, como el resto del salón. **La pantalla no baraja, no calcula y no
decide nada** — solo dibuja lo que el servidor le manda.

Decisiones de aspecto que ya salieron de mirar la maqueta y que la pantalla
tiene que heredar:
- **Las dos cuentas van grandes.** El total del crupier y el de la mano son lo
  único que el jugador mira antes de cada decisión, muchas veces con el
  teléfono a distancia de brazo. Van en 22px con su propio aro, y son lo que
  más pesa después de las cartas. Las aclaraciones ("blando", el "+ ?" del
  crupier con la carta tapada) van chicas y al lado, para que no compitan.
- **Los avisos de error viven fuera de la mesa.** Si están adentro, un error
  al entrar se escribe en una parte de la página que todavía no se muestra y
  el jugador se queda mirando una pantalla muda.
- **El sonido se fabrica, no se descarga.** Tres ruidos con Web Audio, ninguno
  de más de un cuarto de segundo: el golpe de la ficha contra el paño, el roce
  de la carta al deslizarse, y el cierre de la mano. Sin un solo archivo. Y
  botón de silencio, que nadie tiene por qué aguantarse el ruido de una mesa.
- **La marca del paño va en la banda del arco**, hundida en el fieltro (como
  serigrafiada), no en el centro: el centro se lo comen las cartas y la marca
  se lee cortada.
- **La voz del crupier queda pedida para más adelante** (dueño, 28/07): que
  cante la mano — "quince", "el crupier se planta en dieciocho", "blackjack".
  No hay que inventar nada: la ruleta ya lo hace con Web Speech API y voz en
  español (Paulina es-MX), en `src/audio.jsx`. Se copia el mecanismo y se le
  cambian las frases. Va después de que la pantalla funcione, no antes.
- **Prueba de cierre:** jugar una mano completa desde el celular, recargar la
  página en medio de la mano y que siga donde estaba.

### Etapa B4 — Dividir
Segunda mano, ases con una sola carta, sin volver a dividir. **Por valor:** dos
cartas que valgan lo mismo, aunque no sean la misma carta (ver sección 5).

Ojo con dos cosas al programarla:
- Una mano dividida **nunca es un natural**: 21 con dos cartas después de
  dividir paga 1 a 1, no 3 a 2. El motor ya lo contempla (`esNatural` recibe si
  la ronda está dividida), pero es el error clásico de esta etapa.
- Doblar sobre una mano dividida lleva la exposición de la ronda a cuatro veces
  la apuesta. El máximo de la mesa hay que leerlo sobre eso, no sobre la
  apuesta inicial.
- **Prueba de cierre:** la batería, ampliada con las manos divididas — que el
  pago de cada una de las dos manos se verifique por separado, que el 21 de una
  mano dividida NO pague 3 a 2, y que los ases divididos reciban exactamente
  una carta.

### Etapa B5 — Abrir la mesa
La batería completa, después unos días con la cuenta `prueba` en producción, y
recién ahí abierta para todos. Igual que se hace con cada ruleta.

## 9. Qué se puede adelantar mientras siguen las ruletas

Las tres mesas de ruleta que faltan **se abren desde el panel, sin publicar
código**. Por eso el blackjack puede avanzar en paralelo sin estorbar, siempre
que se respete este orden:

**Se puede hacer ya, en la rama `feat/blackjack`, sin tocar nada de lo que está
en producción:**
- **Etapa B1 entera.** `worker/blackjack.js` es un archivo nuevo; el único punto
  de contacto con lo existente son las líneas de ruteo en `index.js`.
- La **batería de verificación** (`pruebas/verificar-blackjack.mjs`), archivo nuevo.
- La **maqueta de la mesa**, para mirarla en el celular y decidir el aspecto
  antes de programar la pantalla — como se hizo con
  `maquetas/mesas-etapa-3b.html`. **Hecha:** `public/maqueta-blackjack.html`,
  se abre en el servidor local en `/maqueta-blackjack.html` y juega contra el
  motor de verdad.
  ⚠ Está en `public/` y no en `maquetas/` por una sola razón: ahí comparte
  origen con la API y el navegador la deja llamarla. Pero todo lo que está en
  `public/` se publica. **Sacarla de `public/` antes de cualquier `npm run
  deploy`,** y a más tardar cuando la Etapa B3 haga la pantalla de verdad, que
  es la que la reemplaza.
- Escribir la **migración 012** (correrla en producción es harina de otro costal).

**Conviene esperar a que las tres ruletas estén abiertas:**
- La **Etapa B2**, porque toca `lib.js`, `games.js`, `admin.jsx` y `salon.jsx`,
  que son justo los archivos de la Etapa 5 de la ruleta. No es que se rompa: es
  que si algo falla no se va a saber cuál de las dos obras lo rompió.
- Cualquier publicación a producción.

**Decisiones que el dueño puede ir tomando mientras juega la ruleta**, sin
esperar a nadie: el pago del natural (3:2 recomendado), la apuesta mínima y
máxima de la mesa, y el nombre y el aspecto de la tarjeta en el salón.

## 10. Decisiones abiertas

- **¿Va o no va?** Después de leer la sección 4, con el número de la ganancia
  sobre la mesa. Es la decisión que manda.
- El pago del natural: 3:2 (recomendado) o 6:5.
- Los límites de la mesa.
- Si el blackjack en algún momento lleva su propia moneda (Etapa 6 del salón,
  las mesas en dólares) — no cambia nada de este documento.
