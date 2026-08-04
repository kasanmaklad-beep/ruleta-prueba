-- ════════════════════════════════════════════════════════════════════════
--  PEDIDOS DE CUPO — el banquero pide fichas sin levantar el teléfono.
--
--  Hasta acá el circuito era: el banquero llama, y el ejecutivo (o el dueño)
--  se lo carga desde su panel. Con un banquero funciona. Con quince, el que
--  está arriba atiende llamadas todo el día y no queda registro de quién
--  pidió qué ni cuándo.
--
--  Es la misma mecánica que ya usan las recargas de los jugadores: se pide,
--  queda pendiente, y el de arriba aprueba o rechaza. La APROBACIÓN no
--  inventa nada: ejecuta la misma entrega de cupo que hoy se hace a mano.
--
--  `exec_id` guarda A QUIÉN se le pidió, y se copia del banquero en el
--  momento del pedido. Se guarda en vez de mirarlo al aprobar porque un
--  banquero puede cambiar de ejecutivo: el pedido tiene que seguir siendo del
--  que lo recibió, no del que esté de turno cuando alguien lo mire.
--  NULL = se lo pidió a la matriz (banquero que cuelga directo de la casa).
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS cupo_pedidos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  cashier_id  INTEGER NOT NULL,                  -- quién pide
  exec_id     INTEGER,                           -- a quién (NULL = a la matriz)
  amount      INTEGER NOT NULL,                  -- cuánto cupo pide
  status      TEXT    NOT NULL DEFAULT 'pending',-- pending | approved | rejected
  note        TEXT,                              -- lo que escribió al pedir
  respuesta   TEXT,                              -- el motivo, si lo rechazan
  paid_amount INTEGER,                           -- lo que pagó, al aprobarse
  reviewed_by INTEGER,
  reviewed_at TEXT,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (cashier_id) REFERENCES users(id)
);

-- Para que cada uno encuentre rápido lo suyo: el banquero sus pedidos, y el
-- ejecutivo los que tiene pendientes.
CREATE INDEX IF NOT EXISTS idx_pedidos_cashier ON cupo_pedidos(cashier_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_exec    ON cupo_pedidos(exec_id, status, created_at DESC);
