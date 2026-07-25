-- ════════════════════════════════════════════════════════════════════════
--  Migración 008 — Tope aparte para el pleno
--
--  500 al rojo y 500 a un pleno no son el mismo riesgo: el rojo paga como
--  mucho 1.000, el pleno paga 15.000 — y con Lightning, hasta 250.000.
--  Por eso el pleno lleva su propio límite, más bajo.
--
--  Con 100 al pleno, el peor Lightning (500x) paga 50.000: justo el techo
--  de premio por giro.
--
--  Aplicar con:
--    npx wrangler d1 execute ruleta-db --remote --file=./migrations/008_tope_pleno.sql
-- ════════════════════════════════════════════════════════════════════════

INSERT OR IGNORE INTO settings (key, value) VALUES ('max_bet_pleno', '100');
