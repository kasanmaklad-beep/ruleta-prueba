-- ════════════════════════════════════════════════════════════════════════
--  UNA SOLA SESIÓN POR CUENTA
--
--  Hasta acá el pase que se entregaba al entrar sólo decía "este es el
--  jugador N" y valía 24 horas. Dos teléfonos con el mismo usuario y clave
--  entraban a la vez y el servidor no tenía forma de distinguirlos: no podía
--  saber si una cuenta la usaba una persona o cuatro, ni echar a nadie.
--
--  `sesion` es una marca al azar que se genera CADA VEZ que alguien entra y
--  viaja dentro del pase. El servidor compara la del pase con la guardada
--  acá: si no coinciden, ese aparato queda afuera. Entrar desde un teléfono
--  nuevo saca al anterior.
--
--  Arranca en NULL a propósito. Con NULL se acepta cualquier pase, así que
--  las sesiones que están abiertas AHORA no se cortan de golpe con el
--  despliegue: cada cuenta empieza a exigirlo la primera vez que su dueño
--  vuelve a entrar. Nadie se queda afuera en el medio de una mano.
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN sesion TEXT;
