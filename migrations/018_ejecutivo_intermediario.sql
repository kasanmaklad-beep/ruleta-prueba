-- ════════════════════════════════════════════════════════════════════════
--  EL EJECUTIVO ES UN INTERMEDIARIO, NO UN COMISIONISTA
--
--  Decisión del dueño (03/08/2026): el ejecutivo no gana nada de la venta.
--  Reparte fichas, le cobra a sus banqueros, y le entrega a la casa TODO lo
--  que cobró. Se le paga por fuera del sistema.
--
--  Eso es exactamente lo que hace `exec_asalariado = 1`, así que pasa a ser
--  la forma normal y no la excepción. La columna sigue existiendo por si
--  algún día hay un ejecutivo a comisión, pero deja de ser lo que viene
--  puesto de fábrica.
--
--  POR QUÉ HAY QUE ARREGLAR LOS QUE YA EXISTEN: un ejecutivo con
--  `commission_pct = 0` y `exec_asalariado = 0` queda en la peor combinación
--  posible — la deuda se calcula como "vendido × 0" y le da CERO, así que
--  cobraría todo y no le debería nada a nadie. El sistema no avisaría nunca
--  porque el número cuadra solo consigo mismo.
-- ════════════════════════════════════════════════════════════════════════

UPDATE users SET exec_asalariado = 1 WHERE role = 'exec';
