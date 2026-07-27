-- Limpieza de arranque: borra las cuentas de jugador de la etapa de pruebas
-- y todo lo que colgaba de ellas. Conserva la cuenta del dueño (role='admin').
--
-- NO es una migración de esquema: se corre una sola vez, el día que el
-- sistema administrativo entra en producción. Antes de correrla hay que
-- tener el respaldo hecho (respaldos/produccion-AAAAMMDD-HHMM.sql).

-- Todos los movimientos, incluidos los del dueño: su saldo también se pone
-- en cero más abajo, y un historial que no cuadre con el saldo confunde más
-- de lo que sirve.
DELETE FROM transactions;

DELETE FROM topups
 WHERE user_id IN (SELECT id FROM users WHERE role != 'admin');

DELETE FROM withdrawals
 WHERE user_id IN (SELECT id FROM users WHERE role != 'admin');

DELETE FROM credit_ledger
 WHERE cashier_id IN (SELECT id FROM users WHERE role != 'admin');

DELETE FROM users WHERE role != 'admin';

-- El dueño arranca sin saldo de juego: lo suyo es el panel, no la ruleta.
UPDATE users SET balance = 0, held_balance = 0 WHERE role = 'admin';
