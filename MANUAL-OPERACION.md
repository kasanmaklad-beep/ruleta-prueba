# Cómo operar Ruleta Catatumbo

Guía en criollo para el día a día. No hace falta saber nada técnico.

---

## Las tres pantallas

| Pantalla | Quién entra | Para qué |
|---|---|---|
| **/admin** | Solo vos | Todo: aprobar plata, vender cupo, ver reportes, cambiar límites |
| **/taquilla** | Los taquilleros (y vos) | Cargarle saldo a los jugadores |
| **/billetera** | Cualquier jugador | Pedir recargas y retiros, ver sus movimientos |

Se entra por los botones **ADMIN**, **TAQUILLA** y **CAJA** que aparecen arriba a la
derecha del juego. Cada uno ve solo los suyos.

---

## Lo primero que tenés que hacer

1. **Cambiá tu contraseña.** Entrá a `/admin` → Jugadores → buscá `admin` → botón
   **CLAVE** → poné una contraseña nueva y larga. La de ahora es débil y el juego
   ya es público.
2. **Cargá tus datos de cobro.** `/admin` → Configuración → los cuatro campos de
   abajo (Pago Móvil, cuenta bancaria, Zelle, Binance). Eso es lo que va a ver el
   jugador cuando quiera recargar. Si están vacíos, no puede pagarte.
3. **Poné tus números.** En la misma pantalla: tasa del dólar, apuesta máxima,
   premio máximo, mínimos y el porcentaje de juego. Los que dejé puestos son un
   punto de partida, cambialos a tu realidad.

---

## El día a día

### Cuando alguien quiere recargar

Hay dos caminos y el jugador elige:

**Le paga a un taquillero.** El taquillero verifica en su banco y le carga desde
`/taquilla`. Vos no hacés nada: esa plata ya te la pagó el taquillero cuando te
compró el cupo.

**Te paga a vos.** El jugador entra a **CAJA → RECARGAR**, ve tus datos, transfiere
y carga el número de referencia. A vos te aparece en `/admin` → **RECARGAS**.
Buscá la referencia en tu banco:

- Si llegó → **APROBAR** (si el monto es otro, corregilo ahí mismo antes de aprobar).
- Si no llegó → **RECHAZAR** con el motivo. El jugador lo va a ver.

### Cuando alguien quiere retirar

El jugador lo pide desde **CAJA → RETIRAR**. En ese momento el sistema le congela
ese saldo: no lo puede seguir jugando mientras espera. A vos te aparece en
`/admin` → **RETIROS**, con el monto, a dónde mandarlo y su cédula.

1. Hacé la transferencia de verdad.
2. Volvé al panel y tocá **PAGAR**.
3. Elegí quién puso la plata:
   - **Vos** → sale de tu cuenta principal.
   - **Un taquillero** → el sistema le suma ese monto a su cupo, porque él puso la plata.
4. Confirmá.

Si algo no cuadra, **RECHAZAR** con el motivo: el saldo le vuelve solo al jugador.

> El sistema no deja retirar a quien no jugó lo suficiente. Con el 50% puesto, quien
> recargó 1.000 tiene que haber apostado 500. Eso evita que te usen de casa de cambio.

### Cuando un taquillero necesita más cupo

1. Te paga (por ejemplo 9.000).
2. Entrás a `/admin` → **TAQUILLEROS** → Vender cupo.
3. Elegís al taquillero, ponés el cupo que recibe (10.000) y lo que te pagó (9.000).
4. Confirmás. Esos 1.000 de diferencia son su comisión, ya cobrada.

Si dejás vacío "lo que te pagó", lo calcula solo con el porcentaje de ese taquillero.

### Para sumar un taquillero nuevo

Que se registre como jugador normal. Después: `/admin` → Jugadores → buscalo →
**ROL** → Taquillero → poné su comisión. Ahí le vendés cupo.

---

## Al cerrar el día

`/admin` → **REPORTES**. Los números que importan:

- **Caja** = lo que entró en recargas menos lo que saliste pagando en retiros.
  Es plata real moviéndose.
- **Ganancia del juego** = lo que se apostó menos lo que se pagó en premios.
  Es lo que la ruleta le ganó a los jugadores.

Son cosas distintas: podés tener una caja gorda porque todos recargaron, y aun así
haber perdido en el juego ese día.

Más abajo está el reporte por taquillero (cuánto compró, cuánto cargó, cuánto ganó
de comisión) y las **alertas**:

- Jugadores que te vienen ganando.
- Gente que recarga y retira sin casi jugar.
- Retiros que llevan más de un día esperando tu respuesta.

---

## Los dos candados de seguridad

**Apuesta máxima por giro.** Nadie puede poner más de eso en una sola tirada.

**Premio máximo por giro.** El más importante. Los números Lightning pagan hasta
500 veces lo apostado. Sin este techo, un solo pleno con suerte se lleva la caja del
día. Con el techo puesto, el premio se recorta ahí y al jugador se le avisa en
pantalla que tocó el máximo.

Ponelos en un número con el que puedas dormir tranquilo: si no podés pagar 100.000
de un saque, no dejes que el techo sea 100.000.

---

## Preguntas que van a aparecer

**"Cargué mal un monto, ¿cómo lo arreglo?"**
`/admin` → Jugadores → **CAMBIAR A AJUSTE**. Poné el usuario, un número negativo
para restar (o positivo para sumar) y el motivo. Queda registrado y no ensucia los
reportes de recargas.

**"Un jugador perdió su contraseña."**
Jugadores → buscalo → **CLAVE** → ponele una nueva y pasásela por WhatsApp.

**"Quiero que nadie más se registre solo."**
Configuración → poné `0` en "¿Registro abierto?". Desde ahí las cuentas las creás
vos o el taquillero.

**"Un jugador me está robando / hace cosas raras."**
Jugadores → **BLOQUEAR**. No va a poder entrar ni jugar, y su saldo queda intacto
hasta que decidas qué hacer.

**"¿Por qué el jugador no puede jugar todo su saldo?"**
Porque pidió un retiro y esa parte le quedó congelada. Aprobá o rechazá el retiro
y se destraba.

---

## Lo que el sistema NO hace todavía

- No avisa por WhatsApp ni Telegram: los pendientes se ven entrando al panel.
- No hay bonos ni promociones automáticas.
- No verifica solo las transferencias: siempre mirás vos el banco antes de aprobar.
