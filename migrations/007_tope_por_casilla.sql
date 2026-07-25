-- ════════════════════════════════════════════════════════════════════════
--  Migración 007 — El tope de apuesta pasa a ser POR CASILLA
--
--  Antes: max_bet_per_spin limitaba el TOTAL sobre la mesa. Eso frenaba
--  jugadas que no agregan riesgo: 500 al rojo y 500 al negro se cancelan
--  entre sí, y 500 en diez plenos expone MENOS que un solo pleno de 500
--  (los nueve que pierden pagan parte del que gana).
--
--  Ahora: max_bet_casilla limita cuánto se puede poner en CADA posición del
--  paño. El riesgo real lo da lo que puede cobrar una sola casilla, no la
--  suma de la mesa. El techo de premio por giro (max_win_per_spin) sigue
--  siendo la protección final.
--
--  Aplicar con:
--    npx wrangler d1 execute ruleta-db --remote --file=./migrations/007_tope_por_casilla.sql
-- ════════════════════════════════════════════════════════════════════════

-- El tope nuevo arranca con el valor que ya tenía el viejo.
INSERT OR IGNORE INTO settings (key, value)
SELECT 'max_bet_casilla', COALESCE(
  (SELECT value FROM settings WHERE key = 'max_bet_per_spin'), '500');

-- El viejo queda en la tabla por si hay que mirar atrás, pero ya no se usa.
UPDATE settings SET value = value WHERE key = 'max_bet_per_spin';
