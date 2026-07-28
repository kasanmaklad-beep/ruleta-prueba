-- Etapa B1 del Blackjack: la mesa entra al catálogo que ya existe y aparecen
-- las dos tablas donde vive una mano mientras se juega.
-- Ver ESTRUCTURA-BLACKJACK.md.
--
-- Aplicar con:
--   npx wrangler d1 execute ruleta-db --local  --file=./migrations/012_blackjack.sql
--   npx wrangler d1 execute ruleta-db --remote --file=./migrations/012_blackjack.sql
--
-- Esta migración es ADITIVA: agrega columnas con valor por defecto y tablas
-- nuevas. No toca ni una fila de la ruleta, y el código viejo sigue andando
-- igual si se corre antes de publicar (las columnas nuevas las ignora).

-- ── La ficha de mesa aprende que hay dos tipos de mesa ────────────────────
-- Todo lo que existe hoy es ruleta; por eso el DEFAULT.
ALTER TABLE games ADD COLUMN tipo TEXT NOT NULL DEFAULT 'ruleta';

-- Columnas propias del blackjack. Quedan en NULL en las mesas de ruleta,
-- igual que rueda/animales/rayos quedan sin uso en las de blackjack.
ALTER TABLE games ADD COLUMN mazos        INTEGER;  -- cuántos mazos de 52 se mezclan por ronda
ALTER TABLE games ADD COLUMN pago_natural REAL;     -- 1.5 = 3:2 · 1.2 = 6:5
ALTER TABLE games ADD COLUMN apuesta_min  INTEGER;
ALTER TABLE games ADD COLUMN apuesta_max  INTEGER;

-- La mesa estándar, APAGADA. Se enciende recién en la Etapa B5, después de
-- que la batería de verificación diga que está apta.
--
-- `rueda` es NOT NULL en la tabla y acá no significa nada, así que va con el
-- nombre del juego: el catálogo de ruleta (armarFicha en worker/lib.js) sólo
-- arma fichas de ruedas que conoce, así que descarta esta fila sola y la mesa
-- no se cuela en el salón antes de tiempo.
INSERT OR IGNORE INTO games
  (id, label, tipo, rueda, animales, rayos, pago_pleno, activo, orden,
   mazos, pago_natural, apuesta_min, apuesta_max,
   icono, color, detalle1, detalle2)
VALUES
  ('blackjack', 'Blackjack Estándar', 'blackjack', 'blackjack', 0, 0, 35, 0, 50,
   6, 1.5, 10, 500,
   '🃏', '#4fd1a5',
   '6 mazos · el crupier se planta en 17', 'El blackjack natural paga 3 a 2');

-- ── La ronda: una mano de blackjack mientras se está jugando ──────────────
-- La PLATA NO VIVE ACÁ. Cada apuesta y cada pago se anotan en `transactions`
-- con game_id, igual que la ruleta, y de ahí salen los reportes. Estas dos
-- tablas son el detalle para auditar una mano puntual.
CREATE TABLE IF NOT EXISTS bj_rondas (
  id           TEXT    PRIMARY KEY,        -- id opaco, generado con crypto
  user_id      INTEGER NOT NULL,
  game_id      TEXT    NOT NULL,           -- la mesa, para el reporte
  mazos        INTEGER NOT NULL,           -- copia de la ficha al momento de repartir:
  pago_natural REAL    NOT NULL,           -- si el dueño cambia la mesa, la ronda en curso
                                           -- se sigue pagando con lo que se prometió
  estado       TEXT    NOT NULL,           -- 'jugando' | 'cerrada'
  crupier      TEXT    NOT NULL,           -- JSON: las cartas del crupier (la 2da va tapada)
  repartidas   TEXT    NOT NULL,           -- JSON: TODO lo que salió del mazo, para saber qué queda
  mano_activa  INTEGER NOT NULL DEFAULT 0,
  version      INTEGER NOT NULL DEFAULT 0, -- candado: dos clics no juegan dos veces
  created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  cerrada_at   TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Una sola ronda abierta por jugador. Si pudiera abrir varias, abriría cinco,
-- vería las cartas y seguiría sólo la que le conviene.
CREATE UNIQUE INDEX IF NOT EXISTS idx_bj_una_por_jugador
  ON bj_rondas(user_id) WHERE estado = 'jugando';

CREATE INDEX IF NOT EXISTS idx_bj_rondas_user ON bj_rondas(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bj_rondas_abiertas ON bj_rondas(estado, created_at);

CREATE TABLE IF NOT EXISTS bj_manos (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ronda_id  TEXT    NOT NULL REFERENCES bj_rondas(id),
  indice    INTEGER NOT NULL,   -- 0, o 1 si hubo división (Etapa B4)
  cartas    TEXT    NOT NULL,   -- JSON
  apuesta   INTEGER NOT NULL,   -- lo comprometido en ESTA mano (doblar lo duplica)
  estado    TEXT    NOT NULL,   -- 'jugando' | 'plantada' | 'pasada' | 'doblada'
  resultado TEXT,               -- 'gana' | 'pierde' | 'empate' | 'natural'
  pago      INTEGER             -- lo que se le devolvió al saldo (apuesta incluida)
);

CREATE INDEX IF NOT EXISTS idx_bj_manos_ronda ON bj_manos(ronda_id, indice);
