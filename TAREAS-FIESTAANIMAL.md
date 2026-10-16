# TAREAS — Fiesta Animal

Reglas para quien ejecuta (Claude Code en loop):
- Tomar SIEMPRE la primera tarea `[ ]`. Una tarea por vuelta. Terminar = marcarla `[x]`
  y hacer commit. Si una tarea se traba, anotar debajo de ella `BLOQUEADA: motivo`
  y seguir con la siguiente que no dependa de ella.
- Nunca tocar `ruleta-db` ni desplegar a `ruleta-git` (mycrosis) salvo en la tarea 12.
- Antes de marcar una tarea de código: `npm run build` sin errores.
- Cuando TODAS las tareas de Fase 1 estén `[x]`, escribir al final del archivo la línea
  `TODO LISTO FASE 1` y detenerse. Fase 2 solo arranca si Gasen la desbloquea
  (borrando la palabra PAUSA de su título).

## Fase 1 — Fiesta Animal en producción

- [x] 1. Leer SPEC-FIESTAANIMAL.md, ESTRUCTURA-SALON.md, DEPLOY.md y `wrangler.jsonc`.
      Hacer un inventario en `docs/fiestaanimal/inventario-marca.md` de cada sitio del
      código donde "Catatumbo", "mycrosis", el dorado de casa (#ffd84a / #b88a28) o el
      logo están fijos (archivo + línea). Commit.
      HECHO 16/10/2026 → `docs/fiestaanimal/inventario-marca.md`.
      LO QUE CAMBIA DEL PLAN: el nombre son 24 sitios (10 los ve el jugador) y es
      barato; el dorado son 145 apariciones en 13 archivos y NO es barato. Pero
      `src/ui.jsx` ya tiene PALETAS (variables CSS que heredan), así que la vía es
      alimentar esa paleta desde la ficha, no pintar 145 líneas. Por eso la tarea 3
      conviene partirla en 3a (nombre y título) y 3b (color por la paleta), y dejar
      el cilindro y el paño para la Fase 2, que ya prevé un tema por mesa.
- [x] 2. Crear la ficha de marca en el Worker: variables de entorno con valores por
      defecto = mycrosis tal como está hoy, y endpoint `GET /api/marca`. Commit.
      HECHO 16/10/2026 → `worker/marca.js`, ruta en `worker/index.js`, prueba en
      `pruebas/verificar-marca.mjs` (12 comprobaciones).
      DECISIÓN: la ficha lleva SIETE campos y no los seis de la SPEC. Se agregó
      `subtitulo` porque en pantalla son dos textos distintos —el lema va en el pie
      del salón y el subtítulo debajo del nombre en la entrada— y con uno solo
      mycrosis dejaría de verse igual, que es la regla que no se negocia.
      DECISIÓN: no se tocó `wrangler.jsonc`. Los valores por defecto del código YA
      son mycrosis, así que su entorno no declara ninguna variable y no hay forma de
      romperlo tocando configuración. Las variables se declaran sólo en el entorno
      `fiestaanimal` (tarea 4).
- [x] 3a. EL NOMBRE. Frontend lee `/api/marca` al arrancar y usa el nombre en: título de
      la pestaña, manifest del teléfono, entrada, cabecera y pie del salón, grabado del
      paño del 21 y las dos frases de las condiciones (con su traducción al inglés).
      HECHO 16/10/2026 → `src/marca.jsx`, `/api/manifest` en `worker/marca.js`.
      Probado con las variables de Fiesta Animal puestas de verdad en `.dev.vars`:
      cambia todo y vuelve a mycrosis al sacarlas.
      ARREGLADO EN EL CAMINO: el título de la entrada estaba calculado para "VOLTIO"
      (seis letras) y "Fiesta Animal" se partía en dos renglones; ahora el tamaño y el
      espaciado bajan con el largo, como el nombre grabado en el cono del cilindro.
      DECISIÓN: `/manifest.json` NO se puede generar desde el Worker — Cloudflare sirve
      los archivos de `public/` sin ejecutarlo. El manifest vive en `/api/manifest`, que
      es lo único que siempre pasa por el Worker.
      ÚNICO CAMBIO VISIBLE EN MYCROSIS: el título de la pestaña decía "Voltio — Salón de
      Juegos" fijo y ahora dice "VOLTIO — …" (mayúsculas, como en toda la pantalla) y se
      traduce al idioma del jugador. Se aceptó en vez de agregar un campo más a la ficha
      sólo para la capitalización del título.

- [ ] 3b. EL COLOR, por la paleta de `src/ui.jsx` (ver `docs/fiestaanimal/inventario-marca.md`):
      alimentar `PALETAS` desde la ficha, después entrada y salón. El cilindro y el paño
      NO entran acá: van en la Fase 2, que ya prevé un tema por mesa.
- [ ] 4. Agregar entorno `fiestaanimal` en `wrangler.jsonc`: nombre `fiestaanimal-juego`,
      custom domain `juego.fiestaanimal.com`, D1 `fiestaanimal-db` (crearla con
      `npx wrangler d1 create fiestaanimal-db` y pegar el id), los mismos crons, y las
      variables de marca de Fiesta Animal. Verificar que el entorno por defecto sigue
      apuntando a `ruleta-git` + `ruleta-db` + mycrosis.com. Commit.
- [ ] 5. Semilla `migrations/semillas/fiestaanimal.sql`: deja en `games` SOLO las 4 mesas
      de la SPEC encendidas (`activo=1`), con ícono, color y dos líneas de venta cada una,
      y apaga/omite las de mycrosis. Script `npm run db:fiestaanimal:init` que aplica
      todas las migraciones en orden + la semilla a `fiestaanimal-db` (--remote) y lo
      mismo con --local. Commit.
- [ ] 6. Correr la base local de fiestaanimal y `npm run dev:worker` con el entorno
      fiestaanimal. Pasar `node pruebas/verificar-mesa.mjs <id> --api=http://localhost:8787`
      para las 4 mesas. Guardar la salida en `docs/fiestaanimal/pruebas-local.md`. Commit.
- [ ] 7. Secret: `openssl rand -base64 32 | npx wrangler secret put JWT_SECRET --env fiestaanimal`.
      Deploy: `npx wrangler deploy --env fiestaanimal`. Aplicar `db:fiestaanimal:init`
      remoto. Anotar la URL resultante en `docs/fiestaanimal/deploy.md`. Commit.
- [ ] 8. Verificar en producción: `curl https://juego.fiestaanimal.com/api/marca` devuelve
      Fiesta Animal; el salón lista las 4 mesas; correr `verificar-mesa` contra
      `https://juego.fiestaanimal.com` para las 4. Anotar en `docs/fiestaanimal/pruebas-prod.md`.
- [ ] 9. Logo huella + paleta Fiesta Animal aplicados en entrada y salón (copiar el SVG de
      `~/Fiesta animal web/fiestaanimal-portal/src/components/PawLogo.jsx`). Deploy de nuevo.
      Commit.
- [ ] 10. Actualizar `DEPLOY.md` y `MANUAL-OPERACION.md` con la sección "Fiesta Animal":
      cómo desplegar cada entorno, cómo cargar el admin, cómo ver la base. Commit.
- [ ] 11. Landing: en `~/Fiesta animal web/fiestaanimal-portal`, rama `feat/enlaces-juego`,
      las tarjetas Jugar Ahora / Admin / Reportes apuntan a juego.fiestaanimal.com
      (`href` reales en AccessCard). `npm run build` sin warnings. Push de la rama y abrir
      PR con `gh pr create`. NO mergear.
- [ ] 12. Comprobar que mycrosis.com sigue igual: abrir, `/api/marca` devuelve los valores
      de siempre, una ronda con la cuenta `prueba`. Si algo cambió, arreglarlo antes de cerrar.
- [ ] 13. Escribir `docs/fiestaanimal/RESUMEN-PARA-GASEN.md`: qué quedó hecho, URLs, qué le
      toca a él (registrar admin, mergear PR), y qué quedó BLOQUEADO si hubo algo.

## Fase 2 (PAUSA) — diseño propio por mesa

- [ ] 14. Migración `021_tema_por_mesa.sql`: columna `tema` TEXT (JSON) en `games`.
- [ ] 15. Rueda y paño leen `tema` (paleta, fondo); sin tema se ven como hoy.
- [ ] 16. Set de animalitos por mesa dentro de `tema` (nombre por número); el cantito de
      audio usa el nombre de la mesa.
- [ ] 17. Editor de tema en `/admin` (colores + lista de animalitos).
- [ ] 18. Temas iniciales distintos para las 4 mesas y `verificar-mesa` para las 4.
