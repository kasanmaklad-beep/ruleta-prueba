// ════════════════════════════════════════════════════════════════════════
//  LOS IDIOMAS — expone window.T() y window.I18N
//
//  La clave de cada frase ES LA FRASE EN ESPAÑOL. Se hizo así a propósito:
//
//   · el código se sigue leyendo (`T('Poné al menos 10')` dice lo que dice,
//     no `T('bj.bet.min')`, que obliga a abrir el diccionario para saberlo);
//   · lo que falte traducir sale EN ESPAÑOL, no vacío ni con el nombre de una
//     clave. Una traducción incompleta se ve rara, no rota;
//   · y el español no se toca nunca: sigue viviendo en el código, que es lo
//     que hace falta para la v2 en bolívares.
//
//  Los números y los montos NO pasan por acá: los arma UI.plata(), que ya sabe
//  la moneda de la casa.
//
//  Para agregar una frase: se escribe en inglés en DICC.en con la frase en
//  español como clave. Si una frase lleva un dato adentro, va con llaves:
//      T('Te faltan {n} de apuestas', { n: plata(50) })
// ════════════════════════════════════════════════════════════════════════
(() => {
  const IDIOMAS = [['es', 'Español'], ['en', 'English']];

  const DICC = {
    en: {
      // ── Entrada y registro ───────────────────────────────────────────
      'ENTRAR': 'SIGN IN',
      // "ENTRAR" es dos cosas distintas: entrar a la cuenta y entrar a una
      // mesa. En español la misma palabra sirve; en inglés no. Por eso la del
      // salón lleva su propia clave.
      'ENTRAR A LA MESA': 'ENTER',
      'SALIR': 'LOG OUT',
      'CREAR CUENTA': 'CREATE ACCOUNT',
      'Usuario': 'Username',
      'Contraseña': 'Password',
      'Repetir contraseña': 'Repeat password',
      'Nombre': 'First name',
      'Apellido': 'Last name',
      'Teléfono': 'Phone',
      'Correo': 'Email',
      'Documento': 'ID document',
      'Banco': 'Bank',
      'Ya tengo cuenta': 'I already have an account',
      'Quiero crear una cuenta': 'I want to create an account',
      'Entrando…': 'Signing in…',
      'Creando…': 'Creating…',
      'Usuario o contraseña incorrectos': 'Wrong username or password',
      'Las contraseñas no coinciden': 'The passwords do not match',

      // ── El salón ─────────────────────────────────────────────────────
      'SALÓN DE JUEGOS': 'GAME ROOM',
      'SALDO': 'BALANCE',
      'CAJA': 'CASHIER',
      'TAQUILLA': 'TELLER',
      'PANEL': 'PANEL',
      'BIENVENIDO': 'WELCOME',
      'entraste como': 'signed in as',
      '— ELEGÍ TU MESA —': '— CHOOSE YOUR TABLE —',
      'MESA ABIERTA': 'TABLE OPEN',
      'PRÓXIMAMENTE': 'COMING SOON',
      'EN PRUEBAS': 'IN TESTING',
      'APUESTA DESDE': 'BETS FROM',
      'MUY PRONTO': 'COMING SOON',
      'Abriendo el salón…': 'Opening the room…',
      'No hay mesas abiertas en este momento. Probá de nuevo en un rato.':
        'No tables are open right now. Please check back in a while.',
      'VOLTIO · JUGÁ CON ENERGÍA': 'VOLTIO · PLAY WITH ENERGY',
      'Ruleta americana 0/00 · {n} casillas': 'American roulette 0/00 · {n} pockets',
      'Ruleta europea, un solo cero · {n} casillas': 'European roulette, single zero · {n} pockets',
      'Rayos con premios hasta 500x': 'Lightning prizes up to 500x',
      'El pleno paga {n} a 1': 'Straight up pays {n} to 1',
      'Blackjack · {n} mazos': 'Blackjack · {n} decks',
      'El natural paga 3 a 2': 'Blackjack pays 3 to 2',
      'El natural paga 6 a 5': 'Blackjack pays 6 to 5',

      // ── La mesa de ruleta ────────────────────────────────────────────
      'Haz tu apuesta': 'Place your bets',
      '¡No más apuestas!': 'No more bets!',
      '⏳ APUESTAS ABIERTAS · {seg}': '⏳ BETS OPEN · {seg}',
      'Debes apostar primero': 'Place a bet first',
      'Saldo insuficiente para repetir': 'Not enough balance to repeat',
      'No se pudo girar': 'The spin could not be played',
      'Sin ganancias esta vez': 'No win this time',
      '¡Ganaste {n}!': 'You won {n}!',
      '⚡ ¡LIGHTNING WIN! {n} ⚡': '⚡ LIGHTNING WIN! {n} ⚡',
      ' (tope máximo por giro; el premio completo era {n})':
        ' (max payout per spin; the full prize was {n})',
      'APUESTA': 'BET',
      'LIMPIAR': 'CLEAR',
      'REPETIR': 'REPEAT',
      'GIRAR': 'SPIN',
      'SALÓN': 'ROOM',
      'Saldo insuficiente': 'Not enough balance',
      'No hay apuestas': 'No bets placed',
      'Esa mesa no existe o está cerrada': 'That table does not exist or is closed',
      'GANASTE': 'YOU WON',
      'PERDISTE': 'YOU LOST',

      // ── La mesa de 21 ────────────────────────────────────────────────
      'CRUPIER': 'DEALER',
      'TU MANO': 'YOUR HAND',
      'TU APUESTA': 'YOUR BET',
      'PEDIR': 'HIT',
      'PLANTARME': 'STAND',
      'DOBLAR': 'DOUBLE',
      'DIVIDIR': 'SPLIT',
      'REPETIR {n}': 'REPEAT {n}',
      'OTRA MANO': 'NEW HAND',
      'LEVANTAR': 'TAKE BACK',
      'APOSTAR {n}': 'BET {n}',
      'APOSTAR {n} EN {p}': 'BET {n} ON {p}',
      'PONÉ AL MENOS {n}': 'BET AT LEAST {n}',
      'MÍNIMO {n} POR PUESTO': 'MINIMUM {n} PER SPOT',
      'ACÁ': 'HERE',
      'saldo': 'balance',
      'No se pudo apostar': 'The bet could not be placed',
      'blando': 'soft',
      '¡BLACKJACK!': 'BLACKJACK!',
      'EMPATE': 'PUSH',
      'EL BLACKJACK PAGA 3 A 2': 'BLACKJACK PAYS 3 TO 2',
      'EL BLACKJACK PAGA 6 A 5': 'BLACKJACK PAYS 6 TO 5',
      'EL CRUPIER SE PLANTA EN 17 · APUESTA {min}–{max}':
        'DEALER STANDS ON 17 · BETS {min}–{max}',
      'MESA EN PRUEBAS · NO ABIERTA AL PÚBLICO': 'TABLE IN TESTING · NOT OPEN TO THE PUBLIC',
      'Abriendo la mesa…': 'Opening the table…',
      'El máximo por puesto en esta mesa es {n}': 'The maximum per spot at this table is {n}',
      'El máximo por puesto en esta mesa es {n}: la ficha se queda donde estaba.':
        'The maximum per spot at this table is {n}: the chip stays where it was.',
      'No te alcanza el saldo': 'Not enough balance',
      'No te alcanza el saldo para repetir la misma apuesta.':
        'Not enough balance to repeat the same bet.',
      'Esa mesa está cerrada': 'That table is closed',
      'Tenés una mano sin terminar. Cerrala antes de apostar de nuevo.':
        'You have an unfinished hand. Finish it before betting again.',
      'No se pudo jugar': 'The move could not be played',
      'No pude abrir la mesa': 'Could not open the table',
      'Tu mano anterior había quedado abierta: se jugó sola y cobraste {n}.':
        'Your previous hand was left open: it played itself out and you collected {n}.',
      'Tu mano anterior había quedado abierta y se jugó sola.':
        'Your previous hand was left open and played itself out.',

      // ── La billetera ─────────────────────────────────────────────────
      'MI BILLETERA': 'MY WALLET',
      'JUGADOR': 'PLAYER',
      'DUEÑO': 'OWNER',
      'SOCIO': 'PARTNER',
      'SALDO PARA JUGAR': 'BALANCE TO PLAY',
      'dólares': 'dollars',
      'bolívares': 'bolivars',
      'RECARGAR': 'ADD FUNDS',
      'RETIRAR': 'WITHDRAW',
      'MIS MOVIMIENTOS': 'MY HISTORY',
      '← VOLVER AL JUEGO': '← BACK TO THE GAME',
      'CÓMO RECARGAR': 'HOW TO ADD FUNDS',
      'PEDIR UN RETIRO': 'REQUEST A WITHDRAWAL',
      'PEDIR RETIRO': 'REQUEST WITHDRAWAL',
      'ENVIANDO...': 'SENDING...',
      'Cargando…': 'Loading…',
      'Disponible: {d} · Mínimo: {m}': 'Available: {d} · Minimum: {m}',
      'Todavía no podés retirar': 'You cannot withdraw yet',
      'El retiro mínimo es {n}.': 'The minimum withdrawal is {n}.',
      'Solo tenés {n} disponibles.': 'You only have {n} available.',
      'CUÁNTO QUERÉS RETIRAR ({s})': 'HOW MUCH DO YOU WANT TO WITHDRAW ({s})',
      'Las recargas son': 'Deposits are',
      'en efectivo': 'in cash',
      'Hablá con tu taquillero': 'Talk to your teller',
      ', entregale la plata y él te carga el saldo al instante.':
        ' — hand them the cash and they load your balance right away.',
      'Hablá con el taquillero que te registró: le entregás la plata y él te carga el saldo al instante.':
        'Talk to the teller who registered you: hand them the cash and they load your balance right away.',
      'Cuando te cargue, el saldo aparece acá solo. Si no aparece en el momento, mostrale esta pantalla: cada carga queda anotada con su nombre y la hora.':
        'Once they load it, the balance shows up here on its own. If it does not, show them this screen: every deposit is recorded with their name and the time.',
      'Cobrás en efectivo': 'You collect in cash',
      'INICIAL': 'STARTING',
      'SALDO INICIAL': 'STARTING BALANCE',
    },
  };

  const GUARDADO = 'voltio_idioma';

  function idiomaInicial() {
    const guardado = localStorage.getItem(GUARDADO);
    if (guardado === 'es' || guardado === 'en') return guardado;
    // Sin elección previa manda el idioma del teléfono. Un inglés que entra
    // por primera vez tiene que ver inglés sin tener que buscar el botón.
    return String(navigator.language || 'es').toLowerCase().startsWith('en') ? 'en' : 'es';
  }

  let IDIOMA = idiomaInicial();

  // Reemplaza {llaves} por los datos. Se hace acá y no con plantillas del
  // idioma que llama, porque el orden de las palabras cambia entre idiomas y
  // el dato tiene que poder moverse de lugar dentro de la frase.
  function rellenar(texto, vars) {
    if (!vars) return texto;
    return String(texto).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  }

  // La función de traducir. Si no hay entrada, devuelve el español.
  function T(texto, vars) {
    if (texto == null) return texto;
    const tabla = DICC[IDIOMA];
    const traducido = tabla && Object.prototype.hasOwnProperty.call(tabla, texto)
      ? tabla[texto] : texto;
    return rellenar(traducido, vars);
  }

  // El idioma se cambia recargando la página. Es a propósito: la mitad de las
  // pantallas ya están dibujadas con el idioma anterior y volver a armarlas a
  // mano deja textos mezclados. Recargar es un parpadeo y queda todo igual.
  function set(id) {
    const nuevo = id === 'en' ? 'en' : 'es';
    if (nuevo === IDIOMA) return;
    localStorage.setItem(GUARDADO, nuevo);
    window.location.reload();
  }

  window.T = T;
  window.I18N = {
    get: () => IDIOMA,
    set,
    alternar: () => set(IDIOMA === 'es' ? 'en' : 'es'),
    idiomas: IDIOMAS,
    // Para los mensajes que manda el servidor en español: se traducen por el
    // mismo camino (la clave es el texto español). Lo que no esté, pasa igual.
    delServidor: (msg) => T(msg),
  };
})();
