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

      'REGISTRARME': 'CREATE ACCOUNT',
      'Creá tu cuenta': 'Create your account',
      'Ingresá para jugar': 'Sign in to play',
      'Registrate': 'Sign up',
      'Iniciá sesión': 'Sign in',
      '¿Ya tenés cuenta? ': 'Already have an account? ',
      '¿No tenés cuenta? ': "Don't have an account? ",
      'Teléfono (ej: 04141234567)': 'Phone (e.g. 04141234567)',
      'Correo electrónico': 'Email address',
      'Código de tu socio (opcional)': "Your teller's code (optional)",
      'Un documento, una cuenta. Solo el número: el tipo va aparte.':
        'One ID, one account. Just the number — the type goes in the box next to it.',
      'Si alguien te invitó, poné acá su código. Si entraste por su enlace, ya viene puesto.':
        'If someone invited you, put their code here. If you came through their link, it is already filled in.',
      'A este banco y teléfono te mandamos el Pago Móvil cuando retires.':
        'We use this bank and phone to pay you when you withdraw.',
      'Tu banco...': 'Your bank...',
      'Error inesperado': 'Something went wrong',
      'No se pudo guardar': 'Could not be saved',
      'El usuario debe tener al menos 3 caracteres': 'The username needs at least 3 characters',
      'La contraseña debe tener al menos 6 caracteres': 'The password needs at least 6 characters',
      'Poné tu nombre': 'Enter your first name',
      'Poné tu apellido': 'Enter your last name',
      'Poné el número de tu documento': 'Enter your ID number',
      'Poné tu teléfono: es a donde te vamos a pagar': 'Enter your phone — that is where we pay you',
      'Poné un correo válido': 'Enter a valid email address',
      'Elegí tu banco': 'Choose your bank',
      'Número (ej: {n})': 'Number (e.g. {n})',
      'Cédula': 'National ID',
      'Extranjero': 'Foreign ID',
      'RIF': 'Tax ID',
      'Gubernamental': 'Government',
      'Pasaporte': 'Passport',

      // ── Las condiciones ──────────────────────────────────────────────
      'ANTES DE EMPEZAR': 'BEFORE YOU START',
      'Es un': 'This is a',
      'juego de azar': 'game of chance',
      'podés perder lo que apostás.': 'you can lose what you bet.',
      'Para retirar hay que haber jugado el': 'To withdraw you must have wagered',
      'de lo que recargaste.': 'of what you deposited.',
      'Se recarga y se cobra': 'You deposit and collect',
      'con tu taquillero.': 'with your teller.',
      'Leer las condiciones completas': 'Read the full terms',
      'CONDICIONES DE VOLTIO': 'VOLTIO TERMS',
      'versión': 'version',
      'CERRAR': 'CLOSE',
      'ACEPTAR Y SEGUIR': 'ACCEPT AND CONTINUE',
      'GUARDANDO...': 'SAVING...',
      'Salir sin aceptar': 'Leave without accepting',
      'Hola': 'Hello',
      ': pusimos por escrito las condiciones de la casa. Leelas y aceptalas para seguir jugando.':
        ': we have put the house terms in writing. Read them and accept to keep playing.',
      'Para crear la cuenta hay que leer y aceptar las condiciones.':
        'To create your account you must read and accept the terms.',
      'Hay que aceptar las condiciones para seguir.': 'You must accept the terms to continue.',
      'Tengo 18 años cumplidos, entiendo que es un juego de azar en el que puedo perder mi dinero, y acepto las condiciones de VOLTIO.':
        'I am 18 or older, I understand this is a game of chance in which I can lose my money, '
        + 'and I accept the VOLTIO terms.',
      'Esto es un juego de azar': 'This is a game of chance',
      'Podés perder el dinero que apostás. No es una inversión ni una forma de ganarse la vida: jugá sólo lo que puedas perder sin que te cambie el mes.':
        'You can lose the money you bet. This is not an investment or a way to make a living: '
        + 'only play what you can afford to lose.',
      'Para retirar hay que jugar': 'You have to play before you can withdraw',
      'Antes de pedir un retiro tenés que haber apostado al menos el {n}% de lo que recargaste. Si recargás y no jugás, no se puede retirar: la casa no es una casa de cambio.':
        'Before requesting a withdrawal you must have wagered at least {n}% of what you '
        + 'deposited. If you deposit and do not play, you cannot withdraw: the house is not a '
        + 'currency exchange.',
      'La plata entra y sale en efectivo': 'Money comes in and goes out in cash',
      'Recargás y cobrás en la mano de tu taquillero. La recarga mínima es {min} y el retiro mínimo {ret}. VOLTIO NO te va a pedir nunca datos de tu banco ni claves por la aplicación: si alguien te los pide, no es de la casa.':
        'You deposit and collect in person with your teller. The minimum deposit is {min} and '
        + 'the minimum withdrawal is {ret}. VOLTIO will NEVER ask for your bank details or '
        + 'passwords through the app: if someone asks, they are not from the house.',
      'El resultado lo decide el servidor y queda anotado':
        'The result is decided by the server and recorded',
      'El número de la ruleta y las cartas del blackjack se sortean en el servidor de la casa, no en tu teléfono, y cada jugada queda registrada con su fecha y su monto. Si dudás de una jugada, se puede revisar.':
        'The roulette number and the blackjack cards are drawn on the house server, not on your '
        + 'phone, and every round is recorded with its date and amount. If you have doubts about '
        + 'a round, it can be reviewed.',
      'Tenés que ser mayor de 18 años': 'You must be 18 or older',
      'Al crear tu cuenta declarás que tenés 18 años cumplidos. Una cuenta de un menor de edad se cierra y lo jugado no se paga.':
        'By creating your account you declare that you are 18 or older. An account belonging to '
        + 'a minor is closed and its play is not paid out.',

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
      // Lo retenido por un retiro que el socio todavía no aprobó: es plata del
      // jugador que no puede jugar, y la mesa ahora lo dice en vez de sumarla
      // al saldo.
      'en revisión': 'on hold',
      'Ese saldo está retenido por un retiro en revisión':
        'That money is on hold for a withdrawal under review',
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
      'MATRIZ': 'HEAD OFFICE',
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

  // La v1 sale para público de habla inglesa, así que el idioma de arranque
  // es el INGLÉS y no el del teléfono: un venezolano con el teléfono en
  // español también vería español, y no es lo que la casa quiere mostrar
  // primero. El que prefiera español lo cambia con el interruptor y queda
  // guardado para siempre en ese teléfono.
  const IDIOMA_DE_ARRANQUE = 'en';

  function idiomaInicial() {
    const guardado = localStorage.getItem(GUARDADO);
    if (guardado === 'es' || guardado === 'en') return guardado;
    return IDIOMA_DE_ARRANQUE;
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
