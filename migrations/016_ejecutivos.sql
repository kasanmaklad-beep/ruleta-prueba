-- ════════════════════════════════════════════════════════════════════════
--  LA CAPA EJECUTIVA — un piso más entre la matriz y los banqueros.
--
--  matriz → ejecutivo → banquero → jugador
--
--  El ejecutivo recibe fichas de la casa EN CONSIGNACIÓN (no las paga por
--  adelantado, como sí hace el banquero), crea y maneja a sus banqueros, y
--  rinde cuentas cada tanto. Esta migración es sólo la ETAPA 1: el vínculo y
--  el techo. Las fichas y la deuda llegan en la etapa 3.
--
--  POR QUÉ UNA COLUMNA NUEVA Y NO REUSAR `cashier_id`:
--  `cashier_id` significa hoy "el banquero de este JUGADOR", y hay consultas
--  que cuentan como jugador a cualquiera que la tenga puesta —por ejemplo la
--  que arma la lista de banqueros con su cantidad de jugadores—. Si a un
--  banquero le pusiéramos ahí su ejecutivo, empezaría a contarse a sí mismo
--  como jugador de alguien. En código donde se mueve plata, una columna que
--  significa una sola cosa vale más que una columna ahorrada.
-- ════════════════════════════════════════════════════════════════════════

-- De qué ejecutivo cuelga este banquero. NULL = cuelga directo de la matriz,
-- que es como están todos los banqueros de hoy y como pueden seguir estando:
-- la capa nueva no obliga a nadie a usarla.
ALTER TABLE users ADD COLUMN exec_id INTEGER;

-- Techo de exposición: cuánto se le puede tener asignado sin rendir. Lo usa la
-- etapa 3 para FRENAR la asignación cuando la deuda lo alcanza. 0 = sin techo.
ALTER TABLE users ADD COLUMN exec_limite INTEGER NOT NULL DEFAULT 0;

-- Para listar rápido "los banqueros de este ejecutivo".
CREATE INDEX IF NOT EXISTS idx_users_exec ON users(exec_id);
