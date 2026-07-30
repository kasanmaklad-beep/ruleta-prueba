-- Etapa 4 del Salón: las mesas dejan de vivir en el código y pasan a la base,
-- para que el dueño pueda crearlas, encenderlas y apagarlas desde el panel.
-- Ver ESTRUCTURA-SALON.md.
--
-- El `id` es lo que queda escrito en cada movimiento (transactions.game_id):
-- una vez que una mesa jugó, su id NO se cambia ni se borra, porque partiría
-- el historial en dos. Para sacar una mesa de circulación se la apaga.
--
-- La presentación (ícono, color y las dos líneas de venta) también vive acá,
-- suelta en columnas: así el salón puede cambiar de aspecto sin tocar la base.

CREATE TABLE IF NOT EXISTS games (
  id           TEXT PRIMARY KEY,
  label        TEXT    NOT NULL,
  rueda        TEXT    NOT NULL,               -- 'americana' (0 y 00) | 'europea'
  animales     INTEGER NOT NULL DEFAULT 0,     -- 1 = las casillas llevan animalitos
  rayos        INTEGER NOT NULL DEFAULT 0,     -- 1 = Lightning, multiplicadores en el pleno
  -- OJO: sin rayos el pleno DEBE pagar 35. Los 29 existen solo porque los
  -- multiplicadores compensan; sin ellos la casa se quedaría con el 21% del
  -- pleno. El servidor lo valida, esto es el recordatorio.
  pago_pleno   INTEGER NOT NULL DEFAULT 35,
  activo       INTEGER NOT NULL DEFAULT 0,     -- 0 cerrada · 1 abierta · 2 en pruebas (sólo el dueño y las cuentas `prueba`)
  orden        INTEGER NOT NULL DEFAULT 100,   -- en qué orden se muestran en el salón
  icono        TEXT,
  color        TEXT,                           -- acento de la tarjeta (#rrggbb)
  detalle1     TEXT,                           -- las dos líneas de venta del salón
  detalle2     TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Las cuatro mesas que hasta hoy vivían en worker/lib.js, tal cual estaban:
-- Catatumbo encendida y las otras tres esperando su verificación (Etapa 5).
INSERT OR IGNORE INTO games
  (id, label, rueda, animales, rayos, pago_pleno, activo, orden, icono, color, detalle1, detalle2)
VALUES
  ('catatumbo', 'Catatumbo', 'americana', 1, 1, 29, 1, 10, '🐆⚡', '#ffd84a',
   'Ruleta americana 0/00 · 38 animales', 'Rayos con premios hasta 500x'),
  ('americana', 'Americana Clásica', 'americana', 0, 0, 35, 0, 20, '🎩', '#4fd1a5',
   'Ruleta americana de toda la vida', 'Sin animales · el pleno paga 35 a 1'),
  ('europea', 'Europea Clásica', 'europea', 0, 0, 35, 0, 30, '🎡', '#a78bfa',
   'Ruleta europea de un solo cero', 'La favorita de los jugadores finos'),
  ('europea_animales', 'Europea Catatumbo', 'europea', 1, 1, 29, 0, 40, '🐆🎡', '#ffd84a',
   'Europea de un solo cero · con animales', 'Rayos con premios hasta 500x');

CREATE INDEX IF NOT EXISTS idx_games_orden ON games(activo DESC, orden);
