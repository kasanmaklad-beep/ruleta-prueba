# Inventario de marca — qué hay que despegar del código

**Tarea 1 de `TAREAS-FIESTAANIMAL.md`.** Fecha: 16/10/2026.

Esto es el relevamiento previo a construir la ficha de marca (`/api/marca`).
Responde una sola pregunta: **dónde está hoy la marca pegada al código**, para
saber qué toca la tarea 2 y qué toca la 3, y cuánto cuesta cada una.

---

## Resumen, antes del detalle

| Qué | Cuánto | Dificultad |
|---|---|---|
| El **nombre** (VOLTIO / mycrosis) | ~24 sitios reales | Baja — están concentrados |
| El **dorado de casa** | **145 apariciones** en 13 archivos | **Alta — y el SPEC la subestima** |
| La **mesa insignia** (Catatumbo) | En textos de venta y en la base | Baja — casi todo sale de `games` |

**Lo más importante de este inventario:** la tarea 3 dice "el frontend usa la
ficha de marca en el título, la entrada, el salón, el juego, el panel y la
banca". Eso suena a un rato de trabajo. Para el **nombre** lo es. Para el
**color no**: el dorado está escrito a mano en 145 lugares.

**Pero hay una salida barata, y ya existe en el código.**

---

## La salida barata: la paleta ya está hecha

`src/ui.jsx` (líneas 19-75) tiene **PALETAS**, cuatro juegos de variables CSS
(`--acento`, `--borde`, `--linea`, `--fondo-pagina`, `--fondo-tarjeta`,
`--boton-acento`, …) que se aplican con `style={{ ...UI.paleta('dueno') }}` en
la raíz de cada panel, y de ahí para abajo **hereda todo**.

Una de las cuatro, `jugador`, **es el dorado de la casa**:

```
'--acento': '#d4a94a',  '--borde': '#8b6a20',
'--fondo-pagina': 'radial-gradient(... #2a1a08 ... )'
```

O sea: **la pieza para cambiar de marca sin tocar 145 líneas ya está
construida.** El trabajo no es inventarla, es *mudarse a ella*.

Eso parte el problema del color en dos, y conviene no mezclarlos:

1. **Lo que ya usa la paleta** — paneles de dueño, banca y ejecutivo. Cambian
   solos con sólo alimentar `PALETAS` desde la ficha de marca.
2. **Lo que tiene el color escrito al lado** — las 145 apariciones. Ésas hay
   que ir mudándolas, y no hace falta hacerlas todas para abrir: ver el orden
   sugerido abajo.

---

## El nombre (VOLTIO / mycrosis)

Fuera de comentarios son **24 apariciones**, y sólo **10 las ve el jugador**:

| Archivo:línea | Qué es | ¿Lo ve el jugador? |
|---|---|---|
| `public/index.html:5` | Título de la pestaña | **Sí** |
| `public/index.html:14` | Nombre del ícono en iPhone | **Sí** |
| `public/manifest.json:2,3,4` | Nombre de la aplicación instalada | **Sí** |
| `src/login.jsx:316` | El VOLTIO grande de la entrada | **Sí** |
| `src/salon.jsx:303` | ⚡ VOLTIO de la barra del salón | **Sí** |
| `src/salon.jsx:375` | "VOLTIO · JUGÁ CON ENERGÍA" (pie) | **Sí** |
| `src/blackjack.jsx:782` | VOLTIO grabado en el paño del 21 | **Sí** |
| `src/login.jsx:26` · `src/condiciones.jsx:51,74` | "CONDICIONES DE VOLTIO" | **Sí** |
| `src/admin.jsx:1777` | Texto de ayuda del panel | No (sólo el dueño) |
| `src/i18n.jsx:106,118,120,131,133,173` | Las mismas frases, en inglés | **Sí** |

**No se tocan** (son identificadores internos, no marca):
`voltio:sesion-tomada` (`api.jsx:56`, `app.jsx:1974-1975`),
`voltio_sonido` (`entrada.jsx:28`), `voltio_idioma` (`i18n.jsx:291`).
Cambiarlos no se ve en pantalla y **rompería la sesión guardada** de quien ya
tiene la página abierta.

> **Ojo con el diccionario.** Seis de las frases viven en `src/i18n.jsx` y la
> clave de cada una **es la frase en español**. Si se cambia "VOLTIO" en el
> código y no en la clave, la traducción al inglés deja de encontrarse y esa
> frase sale en español. Las dos puntas se tocan juntas o no se toca ninguna.

---

## El dorado de casa

`#ffd84a` (el dorado vivo), `#b88a28`, `#d4a94a`, `#8b6a20` (los apagados):

| Archivo | Apariciones | Qué es |
|---|---|---|
| `src/app.jsx` | 43 | La mesa de ruleta entera |
| `src/admin.jsx` | 29 | Panel del dueño |
| `src/wheel.jsx` | 18 | El cilindro |
| `src/login.jsx` | 12 | La entrada |
| `src/cashier.jsx` · `src/salon.jsx` | 9 c/u | Banca y salón |
| `src/ui.jsx` | 8 | **La paleta — acá se cambia una vez y baja a muchos** |
| `src/table.jsx` · `src/wallet.jsx` | 6 c/u | Paño y billetera |
| `src/blackjack.jsx` | 3 | Mesa de 21 |
| `src/entrada.jsx` · `public/index.html` | 2 c/u | Puerta y estilos globales |

### Orden sugerido, de más barato a más caro

1. **`src/ui.jsx`** — alimentar `PALETAS.jugador` desde la ficha de marca. Una
   sola edición y cambian de golpe los paneles que ya heredan.
2. **Entrada y salón** (`login.jsx`, `entrada.jsx`, `salon.jsx`) — son **lo
   primero que ve el jugador**. Con esto solo, Fiesta Animal ya *se siente*
   Fiesta Animal.
3. **El cilindro y el paño** (`wheel.jsx`, `table.jsx`, `app.jsx`) — lo más
   caro y lo menos urgente: **la Fase 2 del SPEC ya prevé un tema por mesa**, y
   ahí es donde esto se resuelve bien. Hacerlo ahora es trabajo que se tira.

---

## La mesa insignia (Catatumbo)

Casi todo sale de la tabla `games` (nombre, ícono, color, las dos líneas de
venta), así que **la semilla de la tarea 5 lo resuelve sin tocar código**.
Quedan sueltos: la descripción de `public/manifest.json:4` ("Mesa insignia:
Ruleta Catatumbo…") y los tres arcos decorativos de la entrada
(`src/entrada.jsx`), donde el del centro dice CATATUMBO.

---

## Lo que este inventario cambia del plan

1. **La tarea 3 no es una tarea, son dos.** El nombre es barato; el color no.
   Conviene partirla: *3a — el nombre y el título* (termina rápido y se nota),
   *3b — el color, por la paleta*, en el orden de arriba.
2. **El cilindro y el paño no deberían entrar en la Fase 1.** La Fase 2 ya
   prevé un tema por mesa; pintarlos ahora a mano es trabajo para tirar.
3. **El diccionario se toca junto con el código**, o se rompe el inglés.
4. Los tres identificadores internos (`voltio:sesion-tomada`, `voltio_sonido`,
   `voltio_idioma`) **no se tocan**.

Nada de esto frena las tareas 2, 4 y 5: la ficha de marca, el entorno de
wrangler y la semilla salen igual.
