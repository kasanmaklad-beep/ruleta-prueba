-- Migración inicial: usuarios y transacciones
-- Aplicar con:
--   npx wrangler d1 execute ruleta-db --remote --file=./migrations/001_init.sql
-- (usar --local en lugar de --remote para la base de datos local de desarrollo)

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  username      TEXT    NOT NULL UNIQUE,
  password_hash TEXT    NOT NULL,
  balance       INTEGER NOT NULL DEFAULT 0,   -- saldo en unidades enteras (la ruleta usa montos enteros)
  is_admin      INTEGER NOT NULL DEFAULT 0,   -- 0 = jugador, 1 = administrador
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS transactions (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  type       TEXT    NOT NULL,   -- 'deposit' | 'bet' | 'win'
  amount     INTEGER NOT NULL,   -- siempre positivo; el signo lo da 'type'
  note       TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_tx_user    ON transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tx_recent  ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_name ON users(username);
