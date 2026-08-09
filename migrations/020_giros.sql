-- ════════════════════════════════════════════════════════════════════════
--  LOS GIROS (08/08/2026)
--
--  Hasta hoy el número que salía no se guardaba en ninguna parte: sólo
--  quedaba rastro cuando el jugador GANABA, y metido en el texto de la fila
--  de 'win' ("Ganancia ronda (salió 22)"). Si perdía, el número no existía en
--  ningún lado, y el multiplicador del rayo no se guardaba nunca.
--
--  La pizarra del salón muestra los últimos números de cada mesa, así que se
--  anota TODO giro, gane o pierda. Si sólo se guardaran los ganadores, la
--  pizarra mostraría una ruleta que sale premiada siempre — mentira, y además
--  mala para el negocio.
--
--  'numero' es TEXT y no INTEGER porque el doble cero no es un número: en la
--  rueda americana la casilla se llama '00'.
--
--  Ver docs/superpowers/specs/2026-08-08-entrada-y-salon-design.md
-- ════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS giros (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  game_id    TEXT    NOT NULL,
  user_id    INTEGER NOT NULL,
  numero     TEXT    NOT NULL,
  rayo_mult  INTEGER,
  premio     INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- La pizarra siempre pregunta lo mismo: los últimos de esta mesa.
CREATE INDEX IF NOT EXISTS idx_giros_mesa ON giros (game_id, id DESC);
