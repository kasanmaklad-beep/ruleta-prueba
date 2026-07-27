# El Salón de Juegos — estructura y ruta de trabajo

**Fecha:** 27/07/2026 · **Estado:** aprobado por el dueño, pendiente de arrancar
**Decisiones ya tomadas:** saldo único para todos los juegos · un solo panel para dueño y socios

---

## 1. La idea en una imagen

Hoy el negocio es **una sola mesa** (Ruleta Catatumbo). Lo que se va a construir
es **el salón que contiene las mesas**:

```
                    ENTRADA (login único)
                          │
        ┌─────────────────┼─────────────────────┐
        │                 │                     │
     JUGADOR           SOCIO                  DUEÑO
        │                 │                     │
   EL SALÓN          /taquilla               /admin
   (elige mesa)     (igual que hoy)       (igual que hoy,
        │                                  + filtro por juego)
        ├── Catatumbo (americana + animales + rayos)   ← ya existe
        ├── Americana clásica (sin animales)           ← futura
        ├── Americana con animales (sin rayos)         ← futura
        ├── Europea clásica                            ← futura
        ├── Europea con animales                       ← futura
        └── ... las que se quieran agregar
```

**Como un casino real:** una sola entrada, una sola caja (la billetera con el
saldo en Bs sirve en todas las mesas), varias salas de juego, y una sola
oficina administrativa desde donde se ve todo.

## 2. Qué se conserva y qué cambia

**Se conserva tal cual (no se toca):**
- Las cuentas, los roles (dueño/socio/jugador), los códigos de referido
- La billetera: recargas, retiros, el circuito de fichas con los socios
- El panel del dueño y la taquilla del socio
- El motor de sorteo en el servidor (RNG criptográfico, topes, techo de premio)

**Lo que cambia:**
- Aparece **el salón**: la pantalla donde el jugador elige a qué mesa entrar.
  Al entrar hoy un jugador cae directo a la ruleta; pasará a caer al salón
  (mientras haya una sola mesa, el salón puede saltarse solo).
- Cada giro queda registrado con **en qué juego se hizo**, para que los
  reportes puedan decir "Catatumbo dejó tanto, la europea tanto".
- La ruleta se vuelve **configurable por mesa**: rueda americana (0 y 00, 38
  números) o europea (solo 0, 37 números), con o sin animales, con o sin
  rayos, y topes propios por mesa si se quiere.

## 3. El catálogo de mesas

Cada mesa es una ficha de configuración, no un programa aparte. Ejemplo:

| Mesa | Rueda | Animales | Rayos | Estado |
|------|-------|----------|-------|--------|
| Catatumbo | Americana (0/00) | Sí | Sí | **Ya existe** |
| Americana clásica | Americana (0/00) | No | No | futura |
| Europea Catatumbo | Europea (solo 0) | Sí | Sí | futura |
| Europea clásica | Europea (solo 0) | No | No | futura |

Agregar una mesa nueva = crear su ficha en el panel del dueño (nombre, tipo de
rueda, animales sí/no, rayos sí/no) y encenderla. Sin publicar código nuevo
cada vez, una vez que la base esté hecha.

El dueño podrá **encender y apagar mesas** desde el panel (una mesa apagada no
aparece en el salón, pero sus números siguen en los reportes).

**Moneda por mesa (visión a futuro, aprobada de palabra el 27/07):** la ficha
de cada mesa llevará también su **moneda** (Bs o USD). La billetera pasa a
tener dos bolsillos, cada uno con su circuito de recarga y retiro. Regla de
oro: **el sistema nunca convierte entre bolsillos** — quien juega en dólares
recarga en dólares. Convertir adentro traería de vuelta el problema de la
casa de cambio y sumaría el riesgo de la tasa. Se construye recién cuando el
salón en Bs esté rodando (sería una Etapa 6).

## 4. Avisos importantes del negocio (leer antes de pedir la europea)

1. **La ruleta europea le deja MENOS ganancia a la casa.** Con un solo cero, la
   ventaja de la casa en la mesa baja de 5,3% a **2,7%** — es matemática de la
   rueda, no se puede cambiar sin cambiar los pagos. La europea es más
   atractiva para el jugador justamente por eso. Decisión de negocio: ¿qué
   mesas convienen y cuáles solo canibalizarían a Catatumbo?
2. **Los rayos se recalculan por rueda.** La cuenta que hoy ajusta la ganancia
   del pleno está hecha para 38 números; para la europea (37) se rehace. El
   cuadro de "poné vos el porcentaje" funcionará igual en las dos.
3. **Los animales están atados a los números.** En la europea no existe el 00,
   así que la Ballena (00) se queda afuera en esas mesas. Nada grave, solo
   para que no sorprenda.

## 5. La ruta de trabajo, por etapas

Cada etapa termina en algo **que se puede probar desde el celular**, igual que
se vino haciendo. No se arranca una etapa sin cerrar la anterior.

### Etapa 1 — El salón con una sola mesa
La pantalla del salón: el jugador entra y ve las mesas disponibles (por ahora,
solo Catatumbo) con su tarjeta bonita y el botón de entrar. Dueño y socio
siguen cayendo en sus paneles. Todo lo demás queda igual.
- **Prueba de cierre:** entrar como jugador desde el celular, ver el salón,
  entrar a Catatumbo, jugar normal.

### Etapa 2 — Cada giro sabe de qué mesa vino
Por dentro: los giros y movimientos guardan el juego al que pertenecen, y los
reportes del panel ganan el filtro "por juego". Con una sola mesa el filtro
mostrará todo igual — es el cimiento para lo que viene.
- **Prueba de cierre:** jugar unas rondas y ver en el panel que el reporte
  dice "Catatumbo" en cada movimiento.

### Etapa 3 — La ruleta se vuelve configurable
El mismo juego aprende a armarse según la ficha de la mesa: rueda americana o
europea, con o sin animales, con o sin rayos. Catatumbo queda como una ficha
más (la primera). Acá se rehace la cuenta de los rayos para la rueda de 37.
- **Prueba de cierre:** una mesa de prueba europea sin animales, jugable en
  local, con los pagos correctos (verificados con giros masivos como se hizo
  con los rayos).

### Etapa 4 — El catálogo en manos del dueño
En el panel: crear/editar mesas, encenderlas y apagarlas, topes y rayos por
mesa. El salón muestra las mesas encendidas.
- **Prueba de cierre:** el dueño crea la "Americana clásica" desde el panel
  sin tocar código, y aparece en el salón del celular.

### Etapa 5 — Las mesas nuevas, de a una
Se encienden las variantes decididas (americana sin animales, europea con y
sin, etc.), cada una probada antes de encenderla en producción: pagos, topes,
rayos si lleva, y el reporte separando bien la plata de cada mesa.
- **Prueba de cierre:** por cada mesa, la batería de giros de verificación y
  unos días de prueba con la cuenta `prueba`.

### Publicación
Igual que la vez pasada: respaldo primero, ensayo de las migraciones sobre la
copia, y recién después producción. El salón puede salir a producción desde la
Etapa 1 — los jugadores verían el salón con su única mesa, y las mesas nuevas
van apareciendo cuando estén listas.

## 6. Decisiones que quedan abiertas (se deciden sobre la marcha)

- **Nombre del salón** (lo que ve el jugador arriba de las mesas): ¿"Catatumbo
  Casino"? ¿"Salón Catatumbo"? Lo elige el dueño en la Etapa 1.
- **Qué mesa se construye primero después de Catatumbo** (sugerencia: la
  americana clásica — es la misma rueda que ya está probada, solo sin
  animales; la europea trae rueda nueva y cuenta nueva de rayos).
- **Topes por mesa o topes globales** al principio (se puede arrancar con los
  globales de hoy y separarlos por mesa en la Etapa 4).
