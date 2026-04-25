# Ruleta Prueba

Ruleta Americana Lightning con multiplicadores hasta 500x. App estática (React + JSX precompilado) — sin backend.

## Estructura

```
src/             # Código fuente JSX (lo que editas)
  app.jsx
  wheel.jsx
  table.jsx
  audio.jsx
  tweaks-panel.jsx
public/          # Output desplegado en Cloudflare Pages
  index.html     # (commiteado)
  *.js           # (generados por `npm run build`, gitignored)
```

## Desarrollo local

```bash
npm install
npm run dev      # compila + abre en http://localhost:8766
```

## Deploy

Push a `main` → Cloudflare Pages compila y publica automáticamente en
https://ruleta-prueba.pages.dev

Build command: `npm run build`
Build output: `public`

## Editar y publicar

1. Modificas archivos en `src/*.jsx`
2. `git add . && git commit -m "..." && git push`
3. Cloudflare detecta el push, compila, y en ~1 min está online
