-- ════════════════════════════════════════════════════════════════════════
--  Migración 009 — Los rayos (Lightning) se ajustan desde el panel
--
--  Hasta acá los 8 multiplicadores (50x…500x) salían todos con la misma
--  probabilidad. Eso da un promedio de 222x y hace que el PLENO devuelva
--  más de lo que recibe: la casa perdía 18,9% en cada número apostado,
--  mientras el resto de la mesa le dejaba 5,3%.
--
--  Ahora los multiplicadores llevan peso: el 50x sale seguido y el 500x es
--  raro, como en las mesas reales. Con estos pesos el pleno queda en 5,37%
--  a favor de la casa, alineado con el resto.
--
--  Aplicar con:
--    npx wrangler d1 execute ruleta-db --remote --file=./migrations/009_lightning_ajustable.sql
-- ════════════════════════════════════════════════════════════════════════

INSERT OR IGNORE INTO settings (key, value) VALUES
  -- Cuántos números reciben rayo en cada giro (de mínimo a máximo).
  ('ltg_min', '1'),
  ('ltg_max', '5'),
  -- Peso de cada multiplicador, en el orden 50, 75, 100, 150, 200, 300, 400, 500.
  -- Perfil "Equilibrado": deja el pleno en 5,37% para la casa.
  ('ltg_pesos', '40,20,15,11,7,4,2,1');
