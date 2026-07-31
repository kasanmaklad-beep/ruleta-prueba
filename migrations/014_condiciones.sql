-- ════════════════════════════════════════════════════════════════════════
--  014 — La aceptación de las condiciones
--
--  Un check que no se guarda no sirve para nada: el día que alguien reclame,
--  "aceptó los términos" sin fecha ni versión no dice nada. Se guardan las
--  tres cosas que hacen falta para que la aceptación signifique algo:
--
--    condiciones_version  QUÉ aceptó — la versión del texto que estaba
--                         publicada ese día. Si mañana cambia una condición
--                         importante, sube la versión y se le vuelve a pedir;
--                         y siempre se puede saber cuál firmó cada uno.
--    condiciones_at       CUÁNDO lo aceptó (UTC, como todo en esta base).
--    nacido_antes_de_18   Que declaró ser mayor de edad. Va aparte de la
--                         aceptación general aunque se marquen con la misma
--                         casilla: es la única declaración que tiene
--                         consecuencia legal por sí sola.
--
--  Las cuentas que ya existían quedan en NULL: no aceptaron nada, y eso es
--  exactamente lo que hay que poder ver. Al entrar se les pide.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN condiciones_version TEXT;
ALTER TABLE users ADD COLUMN condiciones_at TEXT;
ALTER TABLE users ADD COLUMN mayor_de_edad INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_condiciones ON users(condiciones_version);
