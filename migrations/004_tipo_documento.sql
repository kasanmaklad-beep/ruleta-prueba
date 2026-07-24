-- ════════════════════════════════════════════════════════════════════════
--  Migración 004 — Tipo de documento
--  Un solo documento de identidad con tipo explícito: V, E, J (RIF), G,
--  P (pasaporte) u OTRO. Se guarda siempre como "V-12345678".
--
--  Aplicar con:
--    npx wrangler d1 execute ruleta-db --remote --file=./migrations/004_tipo_documento.sql
--  (usar --local para la base de desarrollo)
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN doc_type TEXT;   -- V | E | J | G | P | OTRO

-- Las cuentas que ya tenían cédula guardada como "V12345678" (sin guion):
-- se les deduce el tipo de la primera letra.
UPDATE users
   SET doc_type = substr(cedula, 1, 1)
 WHERE cedula IS NOT NULL
   AND substr(cedula, 1, 1) IN ('V', 'E', 'J', 'G', 'P');

-- Si no se pudo deducir, se asume venezolano.
UPDATE users SET doc_type = 'V' WHERE cedula IS NOT NULL AND doc_type IS NULL;

-- Y se pasan al formato con guion. Agregar el guion no puede crear
-- duplicados, así que el índice único sigue valiendo.
UPDATE users
   SET cedula = substr(cedula, 1, 1) || '-' || substr(cedula, 2)
 WHERE cedula IS NOT NULL
   AND cedula NOT LIKE '%-%'
   AND substr(cedula, 1, 1) IN ('V', 'E', 'J', 'G', 'P');

CREATE INDEX IF NOT EXISTS idx_users_doc_type ON users(doc_type);
