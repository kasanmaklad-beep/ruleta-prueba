// ════════════════════════════════════════════════════════════════════════
//  LAS CONDICIONES DE VOLTIO — expone window.CONDICIONES
//
//  Cinco puntos ciertos, no diez páginas prestadas de otro casino. Un texto
//  largo no lo lee nadie, y encima le pone a la casa obligaciones que no va a
//  poder cumplir (pagos en 24 horas, soporte a toda hora). Acá está sólo lo
//  que el jugador NECESITA saber antes de poner plata, que es distinto de
//  todo lo que se le podría contar:
//
//    · que puede perder,            · cuánto hay que jugar antes de retirar,
//    · cómo entra y sale la plata,  · quién decide el resultado,
//    · la edad mínima.
//
//  Lo que paga cada apuesta NO va acá: va en la pantalla de reglas, que se
//  consulta jugando. Acá va sólo lo que hay que saber ANTES de poner plata.
//
//  LA VERSIÓN IMPORTA. Se guarda junto con la aceptación de cada jugador
//  (migración 014). Si cambia algo de fondo —la regla de retiro, los
//  mínimos, la edad— se sube la versión y se les vuelve a pedir; si sólo se
//  corrige una coma, NO se toca, porque volver a pedir por una coma enseña a
//  aceptar sin leer.
// ════════════════════════════════════════════════════════════════════════
(() => {
  const T = window.T || ((s) => s);

  const VERSION = '2026-07-31';

  // Los números salen de la configuración real de la casa (los manda el
  // servidor con /api/me). Escribirlos a mano acá sería la forma más fácil de
  // que un día el texto diga una cosa y la mesa haga otra.
  function puntos(cfg) {
    const c = cfg || {};
    const plata = (n) => (window.UI ? window.UI.plata(n) : `$${n}`);
    const jugarAntes = c.wager_pct_required != null ? c.wager_pct_required : 25;

    return [
      {
        titulo: T('Esto es un juego de azar'),
        texto: T('Podés perder el dinero que apostás. No es una inversión ni una forma de '
          + 'ganarse la vida: jugá sólo lo que puedas perder sin que te cambie el mes.'),
      },
      {
        titulo: T('Para retirar hay que jugar'),
        texto: T('Antes de pedir un retiro tenés que haber apostado al menos el {n}% de lo '
          + 'que recargaste. Si recargás y no jugás, no se puede retirar: la casa no es '
          + 'una casa de cambio.', { n: jugarAntes }),
      },
      {
        titulo: T('La plata entra y sale en efectivo'),
        texto: T('Recargás y cobrás en la mano de tu taquillero. La recarga mínima es {min} '
          + 'y el retiro mínimo {ret}. VOLTIO NO te va a pedir nunca datos de tu banco ni '
          + 'claves por la aplicación: si alguien te los pide, no es de la casa.',
          { min: plata(c.min_topup != null ? c.min_topup : 5),
            ret: plata(c.min_withdrawal != null ? c.min_withdrawal : 10) }),
      },
      {
        titulo: T('El resultado lo decide el servidor y queda anotado'),
        texto: T('El número de la ruleta y las cartas del blackjack se sortean en el '
          + 'servidor de la casa, no en tu teléfono, y cada jugada queda registrada con su '
          + 'fecha y su monto. Si dudás de una jugada, se puede revisar.'),
      },
      {
        titulo: T('Tenés que ser mayor de 18 años'),
        texto: T('Al crear tu cuenta declarás que tenés 18 años cumplidos. Una cuenta de un '
          + 'menor de edad se cierra y lo jugado no se paga.'),
      },
    ];
  }

  // Lo que se acepta con la casilla. Corto a propósito: es lo que el jugador
  // va a leer de verdad.
  function declaracion() {
    return T('Tengo 18 años cumplidos, entiendo que es un juego de azar en el que puedo '
      + 'perder mi dinero, y acepto las condiciones de VOLTIO.');
  }

  window.CONDICIONES = { VERSION, puntos, declaracion };
})();
