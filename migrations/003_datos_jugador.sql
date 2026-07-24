-- ════════════════════════════════════════════════════════════════════════
--  Migración 003 — Ficha completa del jugador
--  Nombre, apellido, correo y banco. La cédula ya existía (002) pero era
--  opcional y se pedía recién al primer retiro; ahora se pide al registrarse.
--
--  Aplicar con:
--    npx wrangler d1 execute ruleta-db --remote --file=./migrations/003_datos_jugador.sql
--  (usar --local para la base de desarrollo)
--
--  Solo agrega columnas: las cuentas que ya existen siguen funcionando, con
--  estos campos vacíos hasta que se completen desde el panel.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN first_name TEXT;
ALTER TABLE users ADD COLUMN last_name  TEXT;
ALTER TABLE users ADD COLUMN email      TEXT;
ALTER TABLE users ADD COLUMN bank       TEXT;   -- banco para pagarle el retiro

-- Una cédula = una cuenta. Evita que la misma persona abra varias cuentas.
-- Si ya hubiera cédulas repetidas (por ejemplo de pruebas), se conserva la de
-- la cuenta más vieja y se vacía en las demás, así la migración nunca falla.
-- El dueño puede volver a cargarlas desde el panel.
UPDATE users SET cedula = NULL
 WHERE cedula IS NOT NULL
   AND id NOT IN (SELECT MIN(id) FROM users WHERE cedula IS NOT NULL GROUP BY cedula);

-- Las cuentas sin cédula no chocan entre sí: en SQLite los NULL no cuentan
-- como repetidos.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_cedula ON users(cedula);

CREATE INDEX IF NOT EXISTS idx_users_email     ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_last_name ON users(last_name);
