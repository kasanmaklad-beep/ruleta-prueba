# La entrada nueva de mycrosis y el salón en vivo

**Fecha:** 08/08/2026
**Decidido con:** el dueño, en la sesión del 08/08/2026
**Estado:** diseño aprobado, sin construir

---

## Por qué

La página que recibe hoy al jugador en `mycrosis.com` es una tarjeta oscura con
el título ⚡ VOLTIO y dos campos. Funciona, pero no dice nada: no se parece a un
casino, no se distingue de nadie y no da ninguna razón para entrar. Lo mismo el
salón: una lista de tarjetas correcta y muerta.

El objetivo no es "que se vea lindo" sino **que la primera pantalla venda** y que
el salón **muestre que adentro está pasando algo**.

---

## Alcance

**Se toca**
- `src/login.jsx` — la entrada (ingreso y registro).
- `src/salon.jsx` — el salón.
- `worker/` — un endpoint nuevo con los datos vivos del salón.
- `migrations/` — una tabla nueva para los giros.
- `worker/index.js` — un insert más al resolver un giro.

**No se toca**
- Las mesas (`src/app.jsx`, `src/blackjack.jsx`) por dentro.
- La caja, la banca, el panel matriz ni la capa ejecutiva.
- El motor del juego, los pagos, los saldos.

---

## Parte 1 · La entrada

### La identidad: el relámpago

De tres direcciones (neón frío, fiesta dorada, relámpago), el dueño eligió **el
relámpago**, y la razón pesa más que el gusto: **el Relámpago del Catatumbo es
venezolano y ya le da el nombre a la mesa insignia**. Es la única de las tres que
un competidor no puede copiar.

### Las capas, de atrás hacia adelante

1. **La tormenta.** Fondo oscuro azul-verdoso, resplandor de nubes arriba, y un
   **rayo que cae solo cada tantos segundos** con un destello que ilumina toda la
   pantalla por un instante.
2. **El salón al fondo.** Tres arcos de neón, el del centro más grande y
   latiendo. Se ven **a través** del formulario, medio velados, como mirar
   adentro parado en la puerta.
3. **La ruleta.** Abajo, girando lento y sin parar, **cortada por el borde de la
   pantalla** para que se sienta grande y cerca. Encima flotan tres fichas y dos
   cartas.
4. **El formulario.** Vidrio esmerilado que deja ver el salón sin estorbar la
   lectura.

### Los tres arcos son decoración, no menú

Hoy hay **cinco mesas** y los arcos son tres. Los arcos representan **familias de
juego** (ruleta · Catatumbo · 21), no mesas concretas. Así la entrada no hay que
retocarla cada vez que el dueño abre una mesa nueva. **El menú de verdad es el
salón.**

### Los botones

| | |
|---|---|
| **ABRIR EL SALÓN** | **Verde paño**, con **forma de arco** —el mismo arco del salón que se ve al fondo— y **un destello que lo recorre** cada pocos segundos. Por dentro se abre y se cierra despacio, como una puerta respirando. |
| **CREAR MI CUENTA** | Botón propio, del mismo ancho, debajo de la línea `¿PRIMERA VEZ AQUÍ?`. **Gris azulado**, no dorado: con el principal en verde, dejarlo en oro hacía que los dos pelearan la atención. |

El registro es **botón**, no enlace: es a quien no se puede perder.

### Al tocar ABRIR EL SALÓN

El formulario se desvanece y **la cámara avanza hacia los arcos**, que crecen
hasta convertirse en el salón. La puerta y el salón son **un solo movimiento**,
no dos pantallas. Un trueno corto acompaña el avance.

### El sonido

- **Arranca apagado.** Quien abre la página en un sitio callado no se lleva un
  susto.
- El **🔊 de la esquina superior derecha** lo prende y lo apaga, y **la elección
  se recuerda**.
- La primera vez, el 🔊 late suave para que se note que existe.
- Todo el sonido se **sintetiza con Web Audio**, como ya hace `src/audio.jsx`:
  **cero archivos de audio descargados**.

---

## Parte 2 · El salón: la pizarra en vivo

De seis formas propuestas (pasillo, carrusel de puertas, vitrina, salón desde
arriba, panorámica, pizarra en vivo) el dueño eligió **la pizarra en vivo**, y
pidió movimiento.

La decisión de fondo: **lo que atrae no es la forma, es lo que está pasando.**

### Qué muestra cada mesa

La lista mantiene el orden y los datos que ya vienen de `games` (nombre, ícono,
color, `detalle1`, `detalle2`, apuesta mínima), y le agrega:

| Dato | Qué dice |
|---|---|
| **Jugando** | `● 4 JUGANDO` con el punto verde latiendo, o **`MESA LIBRE`** apagada y sin punto. |
| **Últimos de la mesa** | Los **5 últimos números**, en su color (rojo / negro / verde el cero). |
| **El último rayo** | `⚡ Cayó un rayo hace 6 min y pagó 200x`. Sólo en las mesas con rayos. |
| **Mano en juego** (21) | En blackjack no hay números: se ven las cartas de una mano en curso, con la tapada del crupier. |

### Qué se mueve

- **Entra el número nuevo.** La tira se corre a la derecha, el número nuevo cae
  adelante con un golpe de luz y el más viejo se apaga y sale.
- **Late el punto verde** de "JUGANDO".
- **Pasa una luz** por la mesa con más gente — **sólo por ésa**, para que el ojo
  vaya solo hacia donde hay movimiento.
- **El rayo golpea la tarjeta**: cuando cae uno, la tarjeta se enciende de oro
  por un instante.
- **La tormenta de fondo** sigue viva pero muy baja: un destello cada tanto para
  que la lista no quede plana, sin robarle atención a los datos.

### La barra de arriba no cambia

Se conservan tal cual: **saldo**, **CAJA**, **BANCA** / **PANEL** según el rol,
**SALIR** y el selector de idioma. Es la barra que el jugador ya conoce.

### El letrero importa

Los giros de este casino son **independientes**: cada jugador tiene el suyo, no
hay una rueda física compartida. Por eso la tira se rotula **"ÚLTIMOS DE LA
MESA"** — son los últimos giros de esa mesa juntando a todos los jugadores. Es
dato real y es exactamente lo que hace la pizarra de un casino de verdad, donde
los giros también son independientes entre sí. **El rótulo no es decoración: es
lo que evita que se lea como una sola ruleta girando para todos.**

### El precio, dicho de frente

**Un salón vacío se va a notar vacío.** Es el costo de esta pantalla y el dueño
lo aceptó, porque es el mismo mecanismo que hace que un salón lleno se note
lleno.

---

## Parte 3 · Los datos

### Lo que ya existe y alcanza

- **Cuántos jugando** — sale de `transactions`: cuentas distintas con una fila
  `type='bet'`, `source='game'` y ese `game_id` **en los últimos 10 minutos**.
  No hace falta nada nuevo. La definición es honesta: no inventa gente.
- **Mano en juego (21)** — `bj_rondas` con `estado='jugando'` y ese `game_id`.

### Lo que NO existe y hay que construir

**El número que sale de un giro no se guarda en ninguna parte.** Hoy:

- Cada giro escribe una fila `type='bet'` (siempre).
- **Sólo si el jugador gana** escribe `type='win'` con el número metido en texto
  libre: `Ganancia ronda (salió 22)`.
- Si el jugador **pierde**, el número **no queda registrado**.
- El **multiplicador del rayo** vive en memoria (`winDetails.multiplier`) y
  **nunca se guarda**.

O sea: la pizarra no se puede armar leyendo lo que hay. Hace falta:

**Migración `020_giros.sql`**

```sql
CREATE TABLE giros (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id    TEXT    NOT NULL,
  user_id    INTEGER NOT NULL,
  numero     TEXT    NOT NULL,          -- entero o '00'; TEXT porque el doble cero no es número
  rayo_mult  INTEGER,                   -- el multiplicador si el giro pegó un rayo; NULL si no
  premio     INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_giros_mesa ON giros (game_id, id DESC);
```

**Un `INSERT` más por giro**, en el mismo lugar donde hoy se resuelve la ronda
(`worker/index.js`, después de calcular `resultNum` y `win`).

**El costo, sin adornos:** hoy un giro escribe entre 2 y 4 filas. Ésta suma una
más — del orden de **un 25–30 % más de escrituras por giro**. En el plan gratuito
de D1 las escrituras son el límite que aprieta primero (≈8.000 giros/día), así
que **conviene tener el plan de $5/mes antes de encender esto**, que además ya
estaba recomendado para abrir al público.

**Se guarda de todos giros, gane o pierda.** Si sólo se guardaran los ganadores,
la pizarra mostraría una ruleta que sale premiada siempre — mentira y además
mala para el negocio.

**Crecimiento:** una fila por giro es diminuta, pero crece para siempre. Se borra
lo viejo con un `DELETE FROM giros WHERE created_at < date('now','-30 days')`
periódico. Treinta días alcanza de sobra: la pizarra sólo mira los últimos cinco.

### El endpoint

`GET /api/salon/vivo` — devuelve, por mesa abierta:

```json
{
  "mesas": [{
    "id": "catatumbo",
    "jugando": 4,
    "ultimos": ["17", "26", "0", "32", "15"],
    "ultimo_rayo": { "hace_min": 6, "mult": 200 },
    "manos_en_juego": null
  }]
}
```

- **No devuelve nombres, colores ni precios**: eso ya lo trae `/api/games` y no
  hace falta repetirlo cada 10 segundos.
- **Respeta las mismas reglas de visibilidad que el salón**: una mesa *en
  pruebas* sólo aparece para el dueño y las cuentas de prueba.
- Se refresca **cada 10 segundos y sólo con la pantalla a la vista**
  (`document.visibilityState`). Si el jugador deja el teléfono de lado, se frena
  solo y no gasta datos ni base.

---

## Rendimiento y peso

- **Nada de motor 3D ni imágenes nuevas.** Todo es degradado, sombra, `conic-gradient`
  y `transform` del navegador. La entrada no descarga un solo archivo extra.
- **Nada de audio descargado**: se sintetiza.
- **Teléfonos flojos y `prefers-reduced-motion`**: se apagan las animaciones y
  queda la misma pantalla, quieta y legible. Nunca se traba.
- El sitio hoy pesa 745 KB (606 KB propios + 139 KB de React por CDN). Esto no lo
  mueve de forma apreciable.

---

## Lo que NO se hace ahora

- **WebGL / three.js.** Un motor 3D son 5–15 MB. El dueño fue explícito: sus
  jugadores buscan wifi para no gastar datos. La técnica elegida es 3D del
  navegador (perspectiva, capas, neón) por debajo de 100 KB. Un día se le puede
  agregar una capa pesada opcional, sólo para teléfonos capaces.
- **Mesas compartidas.** Los juegos siguen siendo independientes por jugador.
- **Chat, ranking, jugadores visibles por nombre.**
- **Cambiar las mesas, sus reglas o sus pagos.**

---

## Riesgos

1. **El salón vacío se nota vacío.** Aceptado.
2. **La tira de números puede leerse como una rueda compartida.** Se mitiga con
   el rótulo "ÚLTIMOS DE LA MESA".
3. **Un insert más por giro** sube las escrituras justo donde está el límite del
   plan gratuito. Se mitiga con el plan de $5/mes.
4. **La entrada es la primera pantalla de todo el negocio.** Si falla, no entra
   nadie. Tiene que degradar bien: si el movimiento no arranca, los campos y los
   dos botones tienen que estar igual.

---

## Decisiones tomadas, para no rediscutirlas

| Decisión | Cuál |
|---|---|
| Identidad | El relámpago (tormenta + oro + rayo) |
| Detalle de juego | Las tres capas juntas: arcos al fondo, ruleta abajo, fichas y cartas |
| Registro | Botón propio, debajo, no enlace |
| Botón de entrar | Forma de arco + destello, **verde paño** |
| Sonido | **Apagado** al arrancar, con memoria |
| Forma del salón | La pizarra en vivo, con movimiento |
| Los números | "ÚLTIMOS DE LA MESA" (todos los jugadores) |
| Refresco | Cada 10 s, sólo con la pantalla a la vista |
