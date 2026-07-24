-- ════════════════════════════════════════════════════════════════════════
--  Migración 006 — Modelo franquicia: el socio cobra y paga a sus afiliados
--
--  · Las recargas y retiros de un afiliado los atiende SU SOCIO, no la casa.
--    (topups.cashier_id / withdrawals.cashier_id: NULL = lo atiende la casa)
--  · El número del socio cambia de significado: commission_pct ahora es
--    "el % del valor de las fichas que PAGA a la casa" (típico: 20).
--  · risk_share_pct: participación del socio en la ganancia (franquicia con
--    responsabilidad compartida, máximo 30). 0 = riesgo completo del socio.
--  · collect_details: los datos de pago que el socio muestra a sus afiliados.
--
--  Aplicar con:
--    npx wrangler d1 execute ruleta-db --remote --file=./migrations/006_franquicia.sql
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE topups      ADD COLUMN cashier_id INTEGER;
ALTER TABLE withdrawals ADD COLUMN cashier_id INTEGER;

ALTER TABLE users ADD COLUMN collect_details TEXT;
ALTER TABLE users ADD COLUMN risk_share_pct  REAL NOT NULL DEFAULT 0;

-- commission_pct: antes guardaba el descuento (10 = paga 90%); ahora guarda
-- lo que paga (20 = paga 20%). Se invierte para no romper la historia.
UPDATE users SET commission_pct = 100 - commission_pct WHERE role = 'cashier';

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('bank_p2p',   'Configurá acá tus datos P2P (Binance u otro)'),
  ('cupo_alert', '2000');   -- avisar cuando el cupo de un socio baje de esto

CREATE INDEX IF NOT EXISTS idx_topups_cashier ON topups(cashier_id, status);
CREATE INDEX IF NOT EXISTS idx_wd_cashier     ON withdrawals(cashier_id, status);
