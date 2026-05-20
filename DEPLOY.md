# Despliegue — Usuarios, Saldos y Admin (D1 + Worker)

Esta función agrega backend (Cloudflare Worker + D1) al juego estático existente.
El juego sigue sirviéndose desde `public/`; el Worker (`worker/index.js`) atiende `/api/*`.

## Arquitectura

```
Navegador ──► Worker (worker/index.js)
                ├── /api/*          → API (auth JWT, saldo, admin) → D1 (ruleta-db)
                └── resto / /admin  → assets estáticos de ./public (juego React)
```

- **Auth:** usuario + contraseña, hash PBKDF2 (WebCrypto), JWT HMAC-SHA256 con expiración 24h.
- **Saldo autoritativo:** el balance vive en D1. El front lo lee de `/api/me` y sincroniza
  cada apuesta (`/api/game/bet`) y ganancia (`/api/game/win`).
- **Admin:** el primer usuario llamado `admin` se marca `is_admin=1` al registrarse.
  Las rutas `/api/admin/*` exigen `is_admin=1` (re-validado contra la DB).

## Requisitos previos (una sola vez)

```bash
cd ~/ruleta-deploy
npm install            # ya incluye wrangler en devDependencies
npx wrangler login     # abre el navegador para autorizar tu cuenta de Cloudflare
```

## 1. Crear la base de datos D1

```bash
npx wrangler d1 create ruleta-db
```

Copiá el `database_id` que imprime y pegalo en `wrangler.jsonc` reemplazando
`REEMPLAZAR_CON_ID_DE_D1`.

## 2. Aplicar el schema

```bash
# Producción (remoto):
npx wrangler d1 execute ruleta-db --remote --file=./migrations/001_init.sql

# (Local, para 'npm run dev:worker'):
npx wrangler d1 execute ruleta-db --local --file=./migrations/001_init.sql
```

## 3. Configurar el secret JWT (producción)

```bash
# Generá un secreto fuerte y guardalo en Cloudflare (NO va en el repo):
openssl rand -base64 32 | npx wrangler secret put JWT_SECRET
```

> Para desarrollo local, el secret se lee de `.dev.vars` (ya creado, gitignored).

## 4. Desplegar

```bash
npm run deploy        # = npm run build && wrangler deploy
```

Producción: https://ruleta-git.kasanmaklad.workers.dev

## 5. Crear el administrador

Entrá a la web, tocá **Registrate** y creá el usuario con nombre exacto `admin`
(la contraseña que quieras). Ese primer `admin` queda como administrador.
Luego entrá a `/admin` para cargar saldo a los jugadores.

---

## Desarrollo local (full-stack)

```bash
npm run dev:worker    # build + wrangler dev (Worker + D1 local + assets) en localhost:8787
```

El `npm run dev` original (python http.server) sigue existiendo, pero **no** levanta la API.

## Endpoints

| Método | Ruta | Auth | Descripción |
|---|---|---|---|
| POST | `/api/auth/register` | — | Crea usuario (balance 0) y devuelve token |
| POST | `/api/auth/login` | — | Devuelve token |
| GET | `/api/me` | jugador | Usuario actual (incl. balance) |
| POST | `/api/game/bet` | jugador | Descuenta apuesta (atómico, valida saldo) |
| POST | `/api/game/win` | jugador | Acredita ganancia |
| GET | `/api/admin/users` | admin | Lista de usuarios |
| GET | `/api/admin/transactions` | admin | Últimas 50 transacciones |
| POST | `/api/admin/deposit` | admin | Carga saldo a un usuario por username |

## Notas

- `database_id` en `wrangler.jsonc` debe quedar con el id real antes de desplegar.
- Si cambiás `is_admin` de un usuario directamente en la DB, surte efecto al re-loguear
  (el flag viaja en el JWT, pero `/api/admin/*` igual lo re-valida contra la DB).
- Reset/seed manual de saldo: `npx wrangler d1 execute ruleta-db --remote --command "UPDATE users SET balance=0"`
