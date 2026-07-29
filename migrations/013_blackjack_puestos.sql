-- El blackjack pasa a tener TRES puestos: un mismo jugador puede apostar en
-- más de un círculo y jugarlos uno detrás del otro contra el mismo crupier.
-- Decisión del dueño, 28/07/2026. Ver ESTRUCTURA-BLACKJACK.md.
--
-- Aplicar con:
--   npx wrangler d1 execute ruleta-db --local  --file=./migrations/013_blackjack_puestos.sql
--   npx wrangler d1 execute ruleta-db --remote --file=./migrations/013_blackjack_puestos.sql
--
-- Aditiva: una columna con valor por defecto. Las manos que ya existen quedan
-- en el puesto del medio, que es donde se jugaba cuando había uno solo.

-- En qué círculo del paño se jugó esta mano (0 izquierda, 1 medio, 2 derecha).
-- `indice` sigue siendo el ORDEN DE JUEGO dentro de la ronda, que no es lo
-- mismo: cuando llegue dividir (Etapa B4), un puesto va a tener dos manos con
-- el mismo `puesto` y distinto `indice`. Separarlos ahora evita tener que
-- rehacer la tabla después.
ALTER TABLE bj_manos ADD COLUMN puesto INTEGER NOT NULL DEFAULT 1;

-- Cuántos puestos deja jugar la mesa. El dueño lo maneja por mesa: una mesa
-- puede abrir los tres y otra quedarse en uno.
ALTER TABLE games ADD COLUMN puestos INTEGER;
UPDATE games SET puestos = 3 WHERE tipo = 'blackjack';

CREATE INDEX IF NOT EXISTS idx_bj_manos_puesto ON bj_manos(ronda_id, puesto);
