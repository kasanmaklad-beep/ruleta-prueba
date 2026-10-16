# SPEC — Fiesta Animal: el salón de ruletas en fiestaanimal.com

**Dueño del proyecto:** Gasen · **Fecha:** 2026-10-01
**Este archivo manda.** Si algo del código contradice esto, gana esto. Si algo no está
definido aquí, se resuelve de la forma más simple y se anota en TAREAS-FIESTAANIMAL.md.

## 1. Qué se construye

Una segunda instancia de este mismo salón (el de mycrosis.com) para la marca
**Fiesta Animal**, con cuatro mesas de ruleta idénticas a Catatumbo:

| id (no se cambia nunca) | Nombre en el salón      | Rueda     | Animales | Rayos | Pleno |
|-------------------------|-------------------------|-----------|----------|-------|-------|
| `catatumbo_activo`      | Catatumbo Activo        | americana | sí       | sí    | 29    |
| `catatumbo_granjita`    | Catatumbo Granjita      | americana | sí       | sí    | 29    |
| `catatumbo_guacharo`    | Catatumbo El Guácharo   | americana | sí       | sí    | 29    |
| `catatumbo_fiesta`      | Catatumbo Fiesta        | americana | sí       | sí    | 29    |

Las cuatro son hoy la misma mesa con distinto nombre, ícono y color. El diseño
distinto por mesa viene después (Fase 2) y NO bloquea la Fase 1.

## 2. Dónde vive

- **Dominio del juego:** `juego.fiestaanimal.com` (la landing actual en
  `fiestaanimal.com` sigue igual; vive en otro repo, `fiestaanimal-portal`,
  Cloudflare Pages). Misma cuenta de Cloudflare (kasanmaklad@gmail.com), así que
  el custom domain se declara en wrangler y Cloudflare crea el DNS solo.
- **Worker:** `fiestaanimal-juego`. **Base D1:** `fiestaanimal-db` (nueva, vacía).
- **Entorno de wrangler:** `fiestaanimal` → se despliega con
  `npx wrangler deploy --env fiestaanimal`.
- **Regla de oro:** el deploy de Fiesta Animal NO toca mycrosis.com, ni el Worker
  `ruleta-git`, ni la base `ruleta-db`. Son dos negocios con plata separada.

## 3. Un solo código, dos marcas

No se hace fork ni copia del repo. El mismo código sirve a mycrosis y a Fiesta
Animal. Todo lo que hoy dice "Catatumbo", "mycrosis" o lleva el dorado de casa
fijo en el código pasa a una **ficha de marca** que el Worker expone en
`GET /api/marca` y que el frontend lee al arrancar:

```json
{
  "nombre": "Fiesta Animal",
  "lema": "Juega. Gana. Vive la Fiesta Animal.",
  "colorPrimario": "#f59e0b",
  "colorSecundario": "#f97316",
  "colorAcento": "#10b981",
  "logo": "huella"
}
```

La ficha sale de variables de entorno del Worker (`MARCA_NOMBRE`, etc.), una por
entorno en `wrangler.jsonc`. Mycrosis sigue viéndose exactamente igual que hoy:
sus valores por defecto son los actuales.

Paleta Fiesta Animal (la de la landing, Tailwind): fondo `zinc-950`, dorado
`amber-400/500`, naranja `orange-500`, verde `emerald-500`. Logo: huella dorada
(copiar el SVG de `fiestaanimal-portal/src/components/PawLogo.jsx`).

## 4. Qué NO cambia

- El motor de sorteo del servidor, los pagos, topes, rayos, la billetera, los
  roles (dueño/socio/jugador), la taquilla, los reportes, el blackjack.
- La batería `pruebas/verificar-mesa.mjs` es la verdad: si no pasa, no está listo.

## 5. Fase 2 — diseño por mesa (se hace después de cerrar Fase 1)

Cada fila de `games` gana una columna `tema` (JSON) con: paleta de la rueda y
el paño, fondo, y opcionalmente el **set de animalitos** (nombre por número),
porque Granjita y El Guácharo no usan los mismos animales que Lotto Activo.
Sin `tema`, la mesa se ve como hoy. El dueño edita el tema desde `/admin`.

## 6. Definición de terminado (Fase 1)

1. `https://juego.fiestaanimal.com` abre, muestra la marca Fiesta Animal y el
   salón con las 4 mesas encendidas.
2. `node pruebas/verificar-mesa.mjs <id> --api=...` pasa para las 4 mesas.
3. mycrosis.com sigue funcionando sin ningún cambio visible (se abre y se juega
   una ronda en la cuenta `prueba`).
4. En la landing fiestaanimal.com, "Jugar Ahora" lleva a
   `https://juego.fiestaanimal.com`, "Admin" a `/admin` y "Reportes" a `/admin`
   (PR abierto en `fiestaanimal-portal`, rama `feat/enlaces-juego`; main está
   protegido, no se mergea solo).
5. `git log` limpio: un commit por tarea, en español, como los de este repo.

## 7. Lo que solo Gasen puede hacer (queda anotado, no se intenta automatizar)

- Registrarse como `admin` en juego.fiestaanimal.com la primera vez.
- Aprobar y mergear el PR de la landing.
- Decidir los animalitos de Granjita y Guácharo (Fase 2).
