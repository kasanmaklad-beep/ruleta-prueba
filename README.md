# Ruleta Catatumbo

> Ruleta Americana Lightning (con 0 y 00) con multiplicadores hasta **500x** sobre números aleatorios cada ronda. App **100% estática** — sin backend, sin base de datos. Cada usuario juega su propia partida en su navegador.

🌐 **Producción:** https://ruleta-git.kasanmaklad.workers.dev

---

## 🛠 Stack técnico

| Capa | Tecnología |
|---|---|
| UI | **React 18** (sin Next.js / Vue / Angular) |
| Sintaxis | JSX precompilado a JS plano con **Babel CLI** |
| Gráficos | **SVG nativo** (rueda, paño, marcadores) — sin imágenes externas |
| Animaciones | CSS `@keyframes` (en `public/index.html`) |
| Audio | **Web Audio API** — sonidos generados en runtime |
| Hosting | **Cloudflare Pages** (Workers + Static Assets) |
| CI/CD | **GitHub** → push a `main` → deploy automático |
| Build tool | Babel CLI (sin Webpack, Vite, ni esbuild) |

**No usa:** TypeScript, Tailwind, jQuery, ni ningún framework alrededor de React. Es React puro con `style={{...}}` inline.

---

## 📁 Estructura del proyecto

```
ruleta-prueba/
├── src/                    # Código fuente (lo que editas)
│   ├── app.jsx            # App principal: layout, fichas, lógica de juego, header, mensaje, celebración
│   ├── wheel.jsx          # Rueda 3D + física de la bola + marcador del número ganador
│   ├── table.jsx          # Paño de apuestas (SVG con celdas, hotspots, chips, marcador 3D)
│   ├── audio.jsx          # Generador de sonidos (truenos, fichas, ganar/perder)
│   └── tweaks-panel.jsx   # Panel de configuración (theme, volumen, etc.)
├── public/
│   ├── index.html         # Shell HTML con todos los CSS keyframes (commiteado)
│   └── *.js               # Generados por `npm run build` — gitignored
├── package.json           # Scripts npm + dev dependencies
├── wrangler.jsonc         # Config de Cloudflare (apunta a public/ como assets)
├── .gitignore
└── README.md              # Este archivo
```

---

## 🚀 Setup en 1 minuto

```bash
git clone https://github.com/kasanmaklad-beep/ruleta-prueba.git
cd ruleta-prueba
npm install
npm run dev      # compila + sirve en http://localhost:8766
```

**Requisitos:** Node 18+ y npm.

### Scripts disponibles

```bash
npm run build    # Compila src/*.jsx → public/*.js
npm run dev      # Build + sirve public/ en localhost:8766
```

---

## ☁️ Deploy a producción

**Automático** en cada `git push origin main`. Cloudflare Pages:

1. Detecta el push (~5 segundos)
2. Ejecuta `npm install` y `npm run build`
3. Publica el contenido de `public/` en `https://ruleta-git.kasanmaklad.workers.dev`
4. Tarda ~1 minuto end-to-end

**Configuración del proyecto en Cloudflare:**
- Build command: `npm run build`
- Deploy command: `npx wrangler deploy` (lee `wrangler.jsonc`)
- Output: `public/`
- Framework preset: None

Ver progreso: Cloudflare Dashboard → Workers & Pages → `ruleta-git` → Deployments.

---

## 🤝 Cómo contribuir

### Si tienes acceso de escritura al repo

```bash
git checkout -b feat/mi-cambio        # Branch nuevo (no trabajes en main directo)
# … edita src/*.jsx …
npm run dev                            # Prueba local
git add .
git commit -m "feat: descripción clara"
git push -u origin feat/mi-cambio
# Crea Pull Request hacia main en GitHub
```

Cloudflare hace **preview automático** de cada PR — comenta el link de preview en el PR para que el equipo lo vea sin mergear.

### Si no tienes acceso

Pide al owner (`@kasanmaklad-beep`) que te invite como colaborador, o haz fork público y manda PR.

---

## 🧠 Decisiones de diseño importantes

- **Estado del juego es 100% client-side.** El balance, las apuestas y el historial viven en `useState` del componente raíz. Si recargas la página, se pierde todo. No hay persistencia.
- **Cada jugador es independiente.** No hay multiplayer ni rondas sincronizadas. Si querés multiplayer, hay que agregar backend con WebSockets.
- **La rueda y el paño son SVG dibujados por código.** Para reemplazar el visual con imágenes (PNG/SVG diseñado en Figma), hay que cambiar los componentes en `src/wheel.jsx` y `src/table.jsx`.
- **El layout móvil rota el paño 90°** con CSS `transform: rotate(90deg)` y escala no-uniforme para llenar la pantalla. Todos los textos SVG se contra-rotan con `rotate(-90)` para quedar legibles.
- **Lightning round:** entre `betting` y `spinning` hay una fase `lightning` que selecciona 1-5 números aleatorios y les pone multiplicadores de 50x a 500x. Si la bola cae ahí + el jugador apostó al pleno, gana payout × multiplicador.

---

## 🎨 Si vas a mejorar los gráficos

- **No hay imágenes que reemplazar** — todo es SVG en código JSX.
- Las **fichas** están dibujadas en `src/app.jsx` → componente `Chip`.
- La **rueda** (38 casillas, hub, deflectores) está en `src/wheel.jsx`.
- El **paño** (números, dozens, columnas, outer bets) está en `src/table.jsx`.
- Si querés meter PNG/JPG, ponelos en `public/` y referencialos como `<img src="/foo.png" />` desde JSX.

---

## 📞 Contacto

- Owner: **@kasanmaklad-beep** (GitHub)
- Email: kasanmaklad@gmail.com

---

## 📜 Licencia

Privado / propietario. Todos los derechos reservados.
