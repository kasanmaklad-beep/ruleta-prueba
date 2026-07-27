-- Etapa 2 del Salón: cada movimiento de juego recuerda de qué mesa vino.
-- Con una sola mesa esto no cambia ningún número; es el cimiento para que
-- los reportes puedan decir "Catatumbo dejó tanto, la europea tanto".
-- Ver ESTRUCTURA-SALON.md.

ALTER TABLE transactions ADD COLUMN game_id TEXT;

-- Todo lo jugado hasta hoy fue en Catatumbo: era la única mesa.
-- Las recargas y retiros NO llevan mesa (son de la billetera, no de una mesa).
UPDATE transactions SET game_id = 'catatumbo'
 WHERE game_id IS NULL AND type IN ('bet', 'win');

CREATE INDEX IF NOT EXISTS idx_tx_game ON transactions(game_id, created_at DESC);
