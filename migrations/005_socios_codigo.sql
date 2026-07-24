-- ════════════════════════════════════════════════════════════════════════
--  Migración 005 — Código de referencia del socio
--  Cada socio (antes "taquillero") tiene un código propio. Quien se registre
--  con ese código queda adjudicado a su cuenta como afiliado.
--
--  Aplicar con:
--    npx wrangler d1 execute ruleta-db --remote --file=./migrations/005_socios_codigo.sql
--  (usar --local para la base de desarrollo)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN referral_code TEXT;

-- Quién lo dio de alta (la casa matriz) y cuándo se afilió el jugador.
ALTER TABLE users ADD COLUMN created_by   INTEGER;
ALTER TABLE users ADD COLUMN affiliated_at TEXT;

-- A los socios que ya existen se les arma un código con su id: S0009.
UPDATE users
   SET referral_code = 'S' || substr('0000' || id, -4)
 WHERE role = 'cashier' AND referral_code IS NULL;

-- Los jugadores que ya estaban asociados a un socio quedan con la fecha en
-- que se creó la cuenta, que es lo más cercano que tenemos.
UPDATE users SET affiliated_at = created_at
 WHERE cashier_id IS NOT NULL AND affiliated_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral ON users(referral_code);
