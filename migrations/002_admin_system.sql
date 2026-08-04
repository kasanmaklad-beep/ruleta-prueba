-- ════════════════════════════════════════════════════════════════════════
--  Migración 002 — Sistema administrativo de Ruleta Catatumbo
--  Roles (jugador/taquillero/dueño), cupo prepago de taquilleros,
--  recargas con referencia, retiros con saldo congelado y configuración.
--
--  Aplicar con:
--    npx wrangler d1 execute ruleta-db --remote --file=./migrations/002_admin_system.sql
--  (usar --local para la base de desarrollo)
--
--  Todas las columnas se agregan con valor por defecto, así que la base
--  existente sigue funcionando igual mientras no se use lo nuevo.
-- ════════════════════════════════════════════════════════════════════════

-- ── users: rol, datos de contacto/cobro y contadores ──────────────────────
ALTER TABLE users ADD COLUMN role            TEXT    NOT NULL DEFAULT 'player'; -- player | cashier | admin
ALTER TABLE users ADD COLUMN status          TEXT    NOT NULL DEFAULT 'active'; -- active | blocked
ALTER TABLE users ADD COLUMN phone           TEXT;
ALTER TABLE users ADD COLUMN cedula          TEXT;
ALTER TABLE users ADD COLUMN payout_method   TEXT;    -- pago_movil | transferencia | zelle | binance
ALTER TABLE users ADD COLUMN payout_details  TEXT;    -- banco, teléfono, correo o wallet

-- Saldo congelado por retiros pendientes. El saldo disponible para jugar
-- siempre es (balance - held_balance).
ALTER TABLE users ADD COLUMN held_balance    INTEGER NOT NULL DEFAULT 0;

-- Solo para taquilleros: cupo disponible para cargar y su % de comisión.
ALTER TABLE users ADD COLUMN credit_balance  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN commission_pct  REAL    NOT NULL DEFAULT 0;

-- Taquillero que trajo al jugador (informativo, para reportes; no da comisión).
ALTER TABLE users ADD COLUMN cashier_id      INTEGER;

-- Contadores históricos para la regla de "hay que jugar antes de retirar".
ALTER TABLE users ADD COLUMN wagered_total   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN deposited_total INTEGER NOT NULL DEFAULT 0;

-- Los administradores actuales (is_admin = 1) pasan a rol 'admin'.
UPDATE users SET role = 'admin' WHERE is_admin = 1;

-- El total recargado histórico se reconstruye de las transacciones ya existentes.
UPDATE users SET deposited_total = COALESCE(
  (SELECT SUM(t.amount) FROM transactions t WHERE t.user_id = users.id AND t.type = 'deposit'), 0);
UPDATE users SET wagered_total = COALESCE(
  (SELECT SUM(t.amount) FROM transactions t WHERE t.user_id = users.id AND t.type = 'bet'), 0);

CREATE INDEX IF NOT EXISTS idx_users_role    ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_cashier ON users(cashier_id);

-- ── transactions: quién lo hizo y con qué operación se relaciona ──────────
-- type pasa a admitir: deposit | bet | win | withdraw | adjust
ALTER TABLE transactions ADD COLUMN actor_id INTEGER;  -- quién ejecutó (dueño o taquillero)
ALTER TABLE transactions ADD COLUMN ref_id   INTEGER;  -- id de topup / withdrawal / credit_ledger
ALTER TABLE transactions ADD COLUMN source   TEXT;     -- game | admin | cashier | player

CREATE INDEX IF NOT EXISTS idx_tx_type ON transactions(type, created_at DESC);

-- ── settings: configuración editable desde el panel ───────────────────────
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by INTEGER
);

INSERT OR IGNORE INTO settings (key, value) VALUES
  ('rate_usd',            '40'),      -- bolívares por dólar (Zelle / Binance)
  ('max_bet_per_spin',    '500'),     -- tope de apuesta total por giro
  ('max_win_per_spin',    '50000'),   -- techo de premio por giro (protege del 500x)
  ('min_topup',           '100'),     -- recarga mínima
  ('min_withdrawal',      '500'),     -- retiro mínimo
  ('wager_pct_required',  '50'),      -- % de lo recargado que hay que jugar para retirar
  ('registration_open',   '1'),       -- 1 = cualquiera puede registrarse
  ('bank_pago_movil',     'Configurá acá los datos de tu Pago Móvil'),
  ('bank_transferencia',  'Configurá acá tu cuenta bancaria'),
  ('bank_zelle',          'Configurá acá tu correo de Zelle'),
  ('bank_binance',        'Configurá acá tu usuario de Binance');

-- ── topups: solicitudes de recarga a la cuenta principal ──────────────────
CREATE TABLE IF NOT EXISTS topups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  amount      INTEGER NOT NULL,           -- monto en bolívares a acreditar
  currency    TEXT    NOT NULL DEFAULT 'BS',  -- BS | USD
  amount_fx   REAL,                       -- monto original si vino en divisa
  rate        REAL,                       -- tasa usada en la conversión
  method      TEXT    NOT NULL,           -- pago_movil | transferencia | zelle | binance
  reference   TEXT,                       -- número de referencia o hash
  status      TEXT    NOT NULL DEFAULT 'pending', -- pending | approved | rejected
  note        TEXT,
  reviewed_by INTEGER,
  reviewed_at TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_topups_status ON topups(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_topups_user   ON topups(user_id, created_at DESC);

-- ── withdrawals: solicitudes de retiro ────────────────────────────────────
CREATE TABLE IF NOT EXISTS withdrawals (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  amount      INTEGER NOT NULL,
  method      TEXT    NOT NULL,           -- pago_movil | transferencia | zelle | binance
  destination TEXT,                       -- a dónde se le paga (teléfono, cuenta, correo)
  cedula      TEXT,
  status      TEXT    NOT NULL DEFAULT 'pending', -- pending | paid | rejected
  paid_by     TEXT,                       -- owner | cashier
  payer_id    INTEGER,                    -- taquillero que pagó, si aplica
  note        TEXT,
  reviewed_by INTEGER,
  reviewed_at TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_wd_status ON withdrawals(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wd_user   ON withdrawals(user_id, created_at DESC);

-- ── credit_ledger: movimientos de cupo de cada taquillero ─────────────────
CREATE TABLE IF NOT EXISTS credit_ledger (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  cashier_id  INTEGER NOT NULL,
  type        TEXT    NOT NULL,   -- purchase | load | withdrawal_refill | adjust
                                 -- + exec_assign | exec_sale | exec_settle (capa ejecutiva, 03/08/2026)
  amount      INTEGER NOT NULL,   -- positivo suma cupo, negativo lo consume
  paid_amount INTEGER,            -- lo que el taquillero pagó (solo en 'purchase')
  player_id   INTEGER,            -- jugador afectado (en 'load' y 'withdrawal_refill')
  ref_id      INTEGER,            -- id del retiro, si aplica
  note        TEXT,
  actor_id    INTEGER,            -- quién registró el movimiento
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (cashier_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_ledger_cashier ON credit_ledger(cashier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_recent  ON credit_ledger(created_at DESC);
