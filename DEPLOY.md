# Despliegue — Ruleta Catatumbo (Worker + D1)

El juego se sirve desde `public/`; el Worker (`worker/`) atiende `/api/*` y las
rutas de la SPA (`/admin`, `/taquilla`, `/billetera`).

## Arquitectura

```
Navegador ──► Worker (worker/index.js)
                ├── /api/*                              → API → D1 (ruleta-db)
                ├── /admin · /taquilla · /billetera      → index.html (SPA)
                └── resto                                → assets estáticos de ./public
```

Módulos del Worker:

| Archivo | Qué hace |
|---|---|
| `worker/index.js` | Ruteo + lógica del juego (`/api/game/spin`) con topes de apuesta y premio |
| `worker/lib.js` | Utilidades compartidas: auth, validación, cripto, JWT, configuración |
| `worker/accounts.js` | Registro, ingreso, perfil, roles, bloqueo, ajustes, configuración |
| `worker/cashiers.js` | Taquilleros y cupo prepago |
| `worker/payments.js` | Recargas (topups) y retiros (withdrawals) |
| `worker/reports.js` | Tablero, cierre diario, reporte por taquillero y alertas |

- **Auth:** usuario + contraseña, hash PBKDF2 (WebCrypto), JWT HMAC-SHA256, 24h.
- **Roles:** `player` · `cashier` · `admin`, en la columna `users.role`. Se re-valida
  contra la base en cada request (el token no es la autoridad).
- **Saldo autoritativo:** vive en D1. El giro completo lo resuelve el servidor.
- **Saldo disponible** = `balance − held_balance`. Lo congelado por un retiro
  pendiente no se puede jugar.

## Requisitos previos (una sola vez)

```bash
cd ~/ruleta-deploy && npm install && npx wrangler login
```

## Migraciones

Se aplican **en orden** y son acumulativas. La 002 solo agrega columnas y tablas
nuevas: no borra ni modifica datos existentes.

```bash
npx wrangler d1 execute ruleta-db --remote --file=./migrations/001_init.sql
npx wrangler d1 execute ruleta-db --remote --file=./migrations/002_admin_system.sql
```

Para la base local de desarrollo, lo mismo con `--local`.

> **Importante:** la 002 tiene que aplicarse **antes** de desplegar el código nuevo.
> Si el código sale primero, la API falla porque busca columnas que todavía no existen.

## Secret JWT (una sola vez)

```bash
openssl rand -base64 32 | npx wrangler secret put JWT_SECRET
```

En local se lee de `.dev.vars` (gitignored).

## Desplegar

```bash
npm run deploy
```

Producción: https://ruleta-git.kasanmaklad.workers.dev

Para probar sin tocar producción:

```bash
npx wrangler versions upload
```

Devuelve una URL de preview con el código nuevo, contra la misma base de datos.

## Desarrollo local

```bash
npm run dev:worker    # build + wrangler dev en localhost:8787 (D1 local)
```

## Endpoints

### Cuenta
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/api/auth/register` | — | Crea jugador (requiere teléfono) |
| POST | `/api/auth/login` | — | Devuelve token |
| GET | `/api/me` | cualquiera | Usuario actual + límites vigentes |
| PUT | `/api/me` | cualquiera | Teléfono, cédula y datos de cobro |
| POST | `/api/me/password` | cualquiera | Cambio de contraseña propia |

### Juego
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| POST | `/api/game/spin` | jugador | Valida, aplica topes, sortea y acredita |

### Billetera
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/wallet/info` | jugador | Datos de las cuentas, límites y avance de juego |
| GET | `/api/wallet/history` | jugador | Movimientos, recargas y retiros propios |
| POST | `/api/wallet/topup` | jugador | Informa una transferencia hecha |
| POST | `/api/wallet/withdraw` | jugador | Pide un retiro (congela el saldo) |

### Taquilla
| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/cashier/summary` | taquillero | Cupo, cargas del día, sus jugadores |
| POST | `/api/cashier/load` | taquillero | Carga saldo descontando del cupo |

### Panel del dueño
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/admin/summary` | Tablero: pendientes y día de hoy |
| GET | `/api/admin/users` | Lista con filtros `search` y `role` |
| POST | `/api/admin/users/:id/role` | Cambia rol y comisión |
| POST | `/api/admin/users/:id/status` | Bloquea o activa |
| POST | `/api/admin/users/:id/password` | Reset de contraseña |
| GET | `/api/admin/transactions` | Movimientos (filtros `type`, `user_id`, `limit`) |
| POST | `/api/admin/deposit` | Carga manual (cuenta como recarga) |
| POST | `/api/admin/adjust` | Ajuste +/− con motivo (no cuenta como recarga) |
| GET·PUT | `/api/admin/settings` | Configuración del negocio |
| GET | `/api/admin/cashiers` | Taquilleros con cupo y totales |
| POST | `/api/admin/cashiers/credit` | Vende cupo |
| POST | `/api/admin/cashiers/adjust` | Ajusta cupo con motivo |
| GET | `/api/admin/credit-ledger` | Movimientos de cupo |
| GET | `/api/admin/topups` | Cola de recargas (`status`) |
| POST | `/api/admin/topups/:id/approve` | Aprueba (permite corregir el monto) |
| POST | `/api/admin/topups/:id/reject` | Rechaza con motivo |
| GET | `/api/admin/withdrawals` | Cola de retiros (`status`) |
| POST | `/api/admin/withdrawals/:id/pay` | Marca pagado (`paid_by`: owner/cashier) |
| POST | `/api/admin/withdrawals/:id/reject` | Rechaza y descongela el saldo |
| GET | `/api/admin/report/daily` | Cierre diario (`from`, `to`) |
| GET | `/api/admin/report/cashiers` | Reporte por taquillero |
| GET | `/api/admin/report/player/:id` | Historial completo de un jugador |
| GET | `/api/admin/report/alerts` | Alertas |

## Configuración del negocio

Vive en la tabla `settings` y se edita desde `/admin` → Configuración. Se aplica
al instante, sin volver a desplegar.

| Clave | Qué controla |
|---|---|
| `rate_usd` | Bolívares por dólar (Zelle / Binance) |
| `max_bet_per_spin` | Apuesta máxima total por giro |
| `max_win_per_spin` | **Techo de premio por giro** — la protección contra el 500x |
| `min_topup` / `min_withdrawal` | Mínimos de recarga y retiro |
| `wager_pct_required` | % de lo recargado que hay que jugar para poder retirar |
| `registration_open` | 1 = registro abierto, 0 = solo el taquillero crea cuentas |
| `bank_*` | Datos de cobro que ve el jugador por cada método |

## Notas

- La primera cuenta llamada `admin` queda como administrador al registrarse.
- El README dice que un `git push origin main` dispara deploy automático:
  **confirmar antes de pushear a main.**
- Consistencia del dinero: las operaciones que mueven saldo usan `UPDATE`
  con guardia (`WHERE ... >= ?`) y `batch()` de D1, con reversión si algo falla.
