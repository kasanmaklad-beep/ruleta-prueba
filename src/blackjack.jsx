// ════════════════════════════════════════════════════════════════════════
//  LA MESA DE 21 — la pantalla (Etapa B3).
//  Ver ESTRUCTURA-BLACKJACK.md.
//
//  LA REGLA DE ESTE ARCHIVO: acá NO se juega. No se baraja, no se cuenta una
//  mano, no se decide quién ganó y no se sabe cuál es la carta tapada. Todo
//  eso vive en worker/blackjack.js. Esta pantalla dibuja lo último que dijo
//  el servidor y le manda de vuelta lo que el jugador tocó. Si alguna vez
//  aparece acá adentro una cuenta de puntos, está mal.
//
//  El aspecto viene de la maqueta que el dueño miró (`maqueta-blackjack.html`):
//  las cuentas grandes, los tres puestos y el sonido fabricado con Web Audio,
//  sin un solo archivo descargado.
//
//  La mesa está como en el casino: el CRUPIER ENFRENTE —arriba, del otro lado
//  del paño— y el jugador de este lado, con sus cartas, sus fichas y los
//  botones al alcance de la mano. La maqueta se probó dada vuelta (el jugador
//  arriba), y al verla armada el dueño pidió volver a lo de siempre: la
//  postura de la mesa de verdad se lee sola y la invertida hay que pensarla.
//  El canto redondeado y el arco acompañan: los dos abrazan el lado de acá.
// ════════════════════════════════════════════════════════════════════════
(() => {
  const { useState, useEffect, useRef, useCallback } = React;

  // Si por lo que sea el diccionario no cargó (una copia vieja de index.html
  // guardada en el teléfono, por ejemplo), T() sigue existiendo y devuelve el
  // español. Una pantalla en español se lee; una pantalla en blanco por un
  // "T is not defined" no.
  const T = window.T || ((s) => s);

  const ESTILOS = `
.bj-pantalla{
    --fondo:#0a0604; --paño:#0e3b2e; --oro:#ffd84a; --oro-suave:#d4a94a;
    --texto:#e8dcc0; --tenue:#bba876; --borde:#b88a28;
    --rojo:#c0392b; --verde:#4fd1a5;
  }
.bj-marca{letter-spacing:6px; font-size:12px; color:var(--oro); font-weight:700}
.bj-marca small{display:block; letter-spacing:3px; font-size:8px; color:var(--tenue); margin-top:2px}
/* ── La mesa ───────────────────────────────────────────────────────────
     Dos piezas, como una mesa de verdad: el CANTO (el borde acolchado de
     cuero donde se apoyan los codos) y el PAÑO adentro. Separarlos es lo que
     hace que deje de parecer un recuadro y empiece a parecer una mesa. */
  .bj-mesa{
    width:100%; max-width:520px; margin-top:12px;
    border-radius:20px 20px 46px 46px; padding:9px;
    background:
      linear-gradient(180deg,#4a3520 0%,#2a1c0e 45%,#3d2a16 100%);
    box-shadow:
      0 14px 44px rgba(0,0,0,.7),
      inset 0 1px 0 rgba(255,216,74,.28),
      inset 0 -2px 6px rgba(0,0,0,.6);
    border:1px solid #14100a;
  }
.bj-paño{
    border-radius:14px 14px 40px 40px; padding:14px 13px 12px; position:relative; overflow:hidden;
    /* La mesa no se encoge cuando no hay cartas. Antes, apostando, el paño
       medía 538 px y dejaba 188 de pantalla negra debajo: parecía una mesa
       chiquita en el medio del teléfono. Ahora ocupa lo que hay, y el sobrante
       queda como fieltro vacío en el medio —que es lo que tiene una mesa de
       verdad esperando la próxima mano— y no como un agujero abajo.
       Es un MÍNIMO: cuando la mano es larga el paño crece solo y esto no
       estorba. */
    display:flex; flex-direction:column; min-height:calc(100vh - 190px);
    background:
      /* el pozo de luz que cae sobre la mesa */
      radial-gradient(ellipse 130% 70% at 50% 2%, rgba(255,255,255,.13), transparent 62%),
      /* la sombra del fondo, donde no llega la lámpara */
      radial-gradient(ellipse 120% 60% at 50% 118%, rgba(0,0,0,.6), transparent 72%),
      /* el tejido del fieltro: dos tramas cruzadas, muy tenues */
      repeating-linear-gradient(45deg, rgba(0,0,0,.055) 0 1px, transparent 1px 3px),
      repeating-linear-gradient(-45deg, rgba(255,255,255,.035) 0 1px, transparent 1px 3px),
      linear-gradient(180deg,#155843 0%, var(--paño) 55%, #06251c 100%);
    box-shadow:inset 0 2px 10px rgba(0,0,0,.55);
  }
/* ── LA BANDA DEL CENTRO ────────────────────────────────────────────────
     Un solo dibujo: las reglas siguiendo la curva, el arco doble y la marca
     en su medallón. Va de canto a canto del paño (por eso los márgenes
     negativos, que compensan el relleno) y no recibe toques: es fieltro
     pintado, no un control. */
  .bj-banda{
    display:block; width:calc(100% + 26px); margin:2px -13px 4px;
    pointer-events:none; overflow:visible;
  }
/* El renglón de arriba: la regla que decide cuánto cobra el jugador con un
     natural. Es la que más pesa de las dos, y por eso va en oro. */
  .bj-regla{
    font-family:Georgia,serif; font-size:13px; font-weight:700; letter-spacing:2.6px;
    fill:rgba(255,216,74,.62);
  }
/* El de abajo: cómo juega la casa y entre qué montos se apuesta. */
  .bj-casa{
    font-family:Georgia,serif; font-size:9px; letter-spacing:1.5px;
    fill:rgba(255,236,190,.42);
  }
.bj-arco-grueso{fill:none; stroke:rgba(255,238,200,.32); stroke-width:2}
.bj-arco-fino{fill:none; stroke:rgba(255,216,74,.14); stroke-width:1}
/* El medallón está POR ENCIMA del arco a propósito: lo interrumpe, como una
     chapa remachada sobre la línea pintada. El relleno oscuro es lo que corta
     el arco por debajo. */
  .bj-medallon{fill:rgba(5,30,22,.88); stroke:rgba(255,216,74,.28); stroke-width:1}
/* La marca, hundida en el fieltro: casi no se ve, se nota cuando la luz le
     pega. Si compite con las cartas, está mal. */
  .bj-marca{
    font-family:Georgia,serif; font-size:9.5px; font-weight:700; letter-spacing:3.5px;
    fill:rgba(255,236,190,.32);
  }
/* La leyenda suelta del paño. Hoy la usa sólo el cartel de MESA EN PRUEBAS:
     las reglas de la casa se mudaron a la banda de arriba. */
  .bj-letrero{
    text-align:center; margin:0 0 8px; line-height:1.75;
    color:rgba(255,236,190,.42); letter-spacing:1.6px; font-size:9px;
    text-shadow:0 1px 0 rgba(0,0,0,.5);
  }
.bj-letrero b{display:block; font-size:11.5px; letter-spacing:2.6px; color:rgba(255,216,74,.62); font-weight:700}
.bj-fila-crupier{display:flex; align-items:center; gap:10px; margin-bottom:4px}
.bj-avatar{
    width:38px; height:38px; border-radius:50%; flex:none;
    background:linear-gradient(160deg,#2a2118,#0f0b06);
    border:1px solid var(--borde); display:grid; place-items:center; font-size:19px;
  }
.bj-quien{font-size:10px; letter-spacing:2.5px; color:var(--tenue)}
/* El rótulo TU MANO / TU APUESTA y todo lo que va debajo se pegan al fondo del
   paño. Así el fieltro que sobra queda en el MEDIO de la mesa, entre el arco y
   tus cartas, y no en un hueco debajo de los botones. */
  .bj-paño > .bj-quien{margin-top:auto}
/* La mano del crupier: sus cartas y, al lado derecho, lo que lleva. */
/* La mano del crupier: sus cartas y DEBAJO su cuenta.
   Estuvo al lado y estaba mal: el número competía por el ancho con las cartas,
   así que una mano larga lo empujaba fuera del paño y el paño lo recortaba —
   desaparecía justo cuando más se lo mira. Debajo no compite con nada y no
   puede irse a ninguna parte. Además queda igual que la del jugador, que
   siempre estuvo abajo: la mesa se lee de una sola manera. */
  .bj-mano-crupier{display:flex; flex-direction:column; align-items:center; gap:5px}
/* Va con DOS clases (.bj-mano-crupier .bj-cuenta) y no con una sola: la regla
   general de .bj-cuenta está escrita más abajo en esta misma hoja, y entre dos
   reglas que pesan igual gana la última. Con dos clases pesa más y no depende
   del orden. */
.bj-mano-crupier .bj-cuenta{
    font-size:30px; padding:9px 20px; min-width:70px; margin-top:0; flex:none;
    border-color:rgba(255,216,74,.5);
  }
/* Cuánto se encima cada carta del crupier. Con la cuenta debajo, las cartas
   tienen los 309 px del paño enteros para ellas y no 183: hasta cinco cartas
   entran abiertas, sin encimarse más de lo que ya vienen. De seis en adelante
   el paso es (309 − 74) ÷ (n − 1) y el margen ese paso menos los 74 de la
   carta. Con dos cartas —el 95% de las manos— no toca nada. */
  .bj-mano-crupier .bj-cartas[data-n="5"] .bj-carta + .bj-carta{margin-left:-22px}
.bj-mano-crupier .bj-cartas[data-n="6"] .bj-carta + .bj-carta{margin-left:-30px}
.bj-mano-crupier .bj-cartas[data-n="7"] .bj-carta + .bj-carta{margin-left:-37px}
.bj-mano-crupier .bj-cartas[data-n="8"] .bj-carta + .bj-carta{margin-left:-42px}
.bj-mano-crupier .bj-cartas[data-n="9"] .bj-carta + .bj-carta{margin-left:-46px}
.bj-mano-crupier{min-width:0}
.bj-mano-crupier .bj-cartas{min-width:0}
/* Sin cartas repartidas no se guarda el lugar de una carta. Antes daba igual
   —la cuenta iba al costado— pero ahora que va debajo, ese hueco reservado
   abría un vacío de 106 px entre el crupier y su cuenta, con la mesa esperando
   que el jugador apueste. */
  .bj-mano-crupier .bj-cartas[data-n="0"]{min-height:0; margin:0}
/* La cuenta de la mano. Es EL número de esta pantalla: el jugador lo mira
     antes de cada decisión, muchas veces con el teléfono en la mano y a
     distancia de brazo. Va grande, con su propio aro, y es lo que más pesa
     visualmente después de las cartas. */
  .bj-cuenta{
    font-size:22px; line-height:1; color:var(--oro); font-weight:700;
    background:rgba(0,0,0,.45); border:1px solid rgba(255,216,74,.35);
    border-radius:22px; padding:7px 16px; display:inline-block; margin-top:4px;
    min-width:54px; text-align:center; letter-spacing:.5px;
    text-shadow:0 0 12px rgba(255,216,74,.25);
  }
/* El "blando" y el "+ ?" son aclaraciones, no el número: van más chicos y
     pegados, para que no le compitan de tamaño. */
  .bj-cuenta .bj-nota{font-size:12px; font-weight:400; color:var(--tenue); letter-spacing:1px}
/* Las cartas se montan un poco unas sobre otras, como una mano repartida
     de verdad. El índice va arriba a la izquierda justamente para que se siga
     leyendo aunque la de al lado la tape; y así entran cinco cartas en el
     ancho de un teléfono sin que se corten a otro renglón. */
  .bj-cartas{display:flex; min-height:106px; align-items:flex-start; margin:6px 0 6px; padding-left:2px}
.bj-carta{
    width:74px; height:104px; border-radius:9px; flex:none; position:relative;
    margin-left:-16px;
    background:linear-gradient(160deg,#fffdf5,#ece6d6 70%,#ddd5c0);
    border:1px solid #b9b09a;
    box-shadow:0 4px 12px rgba(0,0,0,.55), inset 0 1px 0 #fff;
    color:#1a1a1a; font-family:Georgia,serif;
  }
.bj-carta:first-child{margin-left:0}
.bj-carta.bj-roja{color:var(--rojo)}
/* El índice de la esquina: el valor y abajo su palo, como en una baraja de
     verdad. Va arriba a la izquierda y repetido al revés abajo a la derecha,
     para que la carta se lea de las dos maneras y también cuando la de al
     lado la tapa. */
  .bj-carta .bj-idx{position:absolute; left:6px; top:5px; line-height:1; text-align:center}
.bj-carta .bj-idx.bj-abajo{left:auto; right:6px; top:auto; bottom:5px; transform:rotate(180deg)}
.bj-carta .bj-idx .bj-v{font-size:15px; font-weight:700; display:block}
.bj-carta .bj-idx .bj-p{font-size:11px; display:block; margin-top:1px}
.bj-carta .bj-palo{position:absolute; inset:0; display:grid; place-items:center; font-size:38px}
.bj-carta .bj-palo.bj-as{font-size:52px}
/* El dibujo del medio: los palos repartidos como en cualquier baraja. Va en
   SVG para que escale solo cuando la carta se achica en los puestos. Se deja
   aire arriba y abajo para no pisar los índices de las esquinas. */
.bj-carta .bj-pipas{position:absolute; left:9%; right:9%; top:7%; bottom:7%; width:82%; height:86%}
/* Las figuras vienen dibujadas enteras, con sus índices y su borde. La lámina
   es un poco más angosta que nuestra carta, así que entra ENTERA (contain) y
   no recortada: si se recorta, lo primero que se pierde es el índice de la
   esquina, que es justo lo que el jugador mira cuando las cartas se montan. */
/* Las dos manos de un puesto dividido: cada una con su marco, y la que está
   en turno marcada. Con las cartas más chicas, para que las dos entren en el
   ancho del círculo sin desarmar la fila de puestos. */
.bj-col .bj-mano.bj-partida{
    border-radius:8px; padding:2px 3px; margin-bottom:3px;
    box-shadow:inset 0 0 0 1px rgba(255,236,190,.12);
  }
.bj-col .bj-mano.bj-partida.bj-activa{
    background:rgba(255,216,74,.10); box-shadow:inset 0 0 0 1px rgba(255,216,74,.45);
  }
.bj-col .bj-mano.bj-partida .bj-carta{width:38px; height:55px; border-radius:5px; margin-left:-18px}
.bj-col .bj-mano.bj-partida .bj-carta:first-child{margin-left:0}
.bj-col .bj-mano.bj-partida .bj-cartas{min-height:57px}
.bj-col .bj-mano.bj-partida .bj-cuenta{font-size:13px; padding:3px 8px; min-width:30px}
/* Al dividir, el puesto queda con DOS apuestas. La pila del círculo suma las
   dos, y una pila no se lee en números: se lee de un vistazo. Así que cada
   mano dividida lleva escrito lo que tiene puesto, que es lo que el jugador
   necesita saber antes de decidir si pide o se planta. */
.bj-col .bj-mano.bj-partida .bj-apostado{
    display:block; font-size:9px; letter-spacing:1px; color:#c9b781; margin-top:2px;
  }
.bj-carta.bj-figura{background:#fffdf5; overflow:hidden}
.bj-carta.bj-figura img{width:100%; height:100%; object-fit:contain; display:block}
.bj-carta .bj-pipa{fill:currentColor}
.bj-carta.bj-tapada{
    background:
      /* el enrejado cruzado del dorso de una baraja */
      repeating-linear-gradient(45deg, rgba(255,255,255,.10) 0 2px, transparent 2px 7px),
      repeating-linear-gradient(-45deg, rgba(0,0,0,.22) 0 2px, transparent 2px 7px),
      radial-gradient(circle at 50% 45%, #9a2a2a 0%, #6d1a1a 60%, #4a1010 100%);
    border-color:#3d0f0f;
  }
/* El doble filete del borde, que es lo que hace que un dorso se vea impreso
   y no pintado. */
  .bj-carta.bj-tapada::after{
    content:''; position:absolute; inset:5px; border-radius:5px;
    border:1px solid rgba(255,216,74,.45);
    box-shadow:inset 0 0 0 1px rgba(0,0,0,.35), inset 0 0 0 4px rgba(255,216,74,.10);
  }
/* El reparto: la carta entra deslizándose desde arriba. */
  @keyframes reparte{
    from{transform:translateY(-90px) rotate(-8deg); opacity:0}
    to{transform:none; opacity:1}
  }
.bj-carta.bj-nueva{animation:reparte .34s cubic-bezier(.2,.8,.3,1) both}
.bj-mano{border-radius:10px; padding:2px 8px 2px; margin:0 -8px}
.bj-mano.bj-activa{background:rgba(255,216,74,.07); box-shadow:inset 0 0 0 1px rgba(255,216,74,.3)}
.bj-resultado{font-size:12px; letter-spacing:2px; font-weight:700; margin-top:-6px}
.bj-gana{color:var(--verde)}
.bj-pierde{color:#e57373}
.bj-empate{color:var(--tenue)}
.bj-natural{color:var(--oro)}
/* Los tres botones tienen que entrar en UNA fila: si DOBLAR se va a un
     segundo renglón, en un teléfono queda debajo del borde y no se ve. */
  .bj-botones{display:flex; gap:7px; flex-wrap:wrap; justify-content:center; margin-top:10px}
/* Todos los botones de la mesa van de canto recto: es una mesa de fieltro y
   madera, no una aplicación de teléfono. */
  .bj-botones button{border-radius:4px}
/* Los CUATRO de jugada son cuadrados iguales, como las teclas de una botonera:
   el dedo apunta mucho mejor a cuatro blancos del mismo tamaño que a cuatro de
   anchos distintos, y son los que se tocan en cada mano.
   Los de apostar y recoger NO se cuadran a propósito: dicen cosas como
   "APOSTAR 170 EN 2" o "PONÉ AL MENOS 10", y esas palabras no entran en un
   cuadrado sin partirse en cuatro renglones. Cantos rectos sí, forma no. */
  .bj-botones.bj-jugada{gap:6px; flex-wrap:nowrap}
/* 72 es el cuadrado más grande que entra: cuatro de 72 con tres huecos de 6
   son 306 de los 309 que tiene el paño. Con 76 el cuarto botón se caía al
   renglón de abajo.
   La letra va en 10 y sin separación entre letras porque la palabra más larga
   que muestran es PLANTARME, y a 11 con separación no entraba: se salía del
   cuadrado (es una sola palabra, no tiene por dónde partirse). */
  .bj-botones.bj-jugada button{
    width:72px; height:72px; padding:2px 1px; font-size:10px; letter-spacing:0;
    line-height:1.25; white-space:normal; display:flex; align-items:center;
    justify-content:center; text-align:center; flex:none;
  }
button{
    font-family:Georgia,serif; font-size:11.5px; letter-spacing:1.2px; font-weight:700;
    padding:11px 11px; border-radius:8px; cursor:pointer; color:#1a1206;
    background:linear-gradient(180deg,#ffe98a,#d4a017); border:1px solid #8a6a10;
    box-shadow:0 3px 0 #6d5410, 0 5px 12px rgba(0,0,0,.45);
  }
button:active{transform:translateY(2px); box-shadow:0 1px 0 #6d5410}
button[disabled]{opacity:.35; cursor:not-allowed; box-shadow:none; transform:none}
button.bj-gris{background:linear-gradient(180deg,#5c5c5c,#3a3a3a); color:#e8dcc0; border-color:#2a2a2a; box-shadow:0 3px 0 #222}
/* Un color por acción (ver COLOR_ACCION). Mismo relieve que el dorado: cambia
   el color, no la forma, así los cuatro siguen siendo la misma botonera. */
button.bj-rojo{
    background:linear-gradient(180deg,#e2565a,#a3131b); color:#fff5f2;
    border-color:#7a0d12; box-shadow:0 3px 0 #6a0b10, 0 5px 12px rgba(0,0,0,.45);
    text-shadow:0 1px 2px rgba(0,0,0,.5);
  }
button.bj-rojo:active{box-shadow:0 1px 0 #6a0b10}
button.bj-azul{
    background:linear-gradient(180deg,#63b8f0,#1f6ea8); color:#f2fbff;
    border-color:#164e77; box-shadow:0 3px 0 #12405f, 0 5px 12px rgba(0,0,0,.45);
    text-shadow:0 1px 2px rgba(0,0,0,.5);
  }
button.bj-azul:active{box-shadow:0 1px 0 #12405f}
button.bj-violeta{
    background:linear-gradient(180deg,#b489e8,#6a35b0); color:#f8f2ff;
    border-color:#4d2380; box-shadow:0 3px 0 #401d6b, 0 5px 12px rgba(0,0,0,.45);
    text-shadow:0 1px 2px rgba(0,0,0,.5);
  }
button.bj-violeta:active{box-shadow:0 1px 0 #401d6b}
.bj-barra{
    width:100%; max-width:520px; display:flex; justify-content:space-between; align-items:center;
    margin-top:12px; font-size:11px; color:var(--tenue); letter-spacing:1px;
  }
.bj-saldo{color:var(--oro); font-size:15px; font-weight:700; letter-spacing:0}
.bj-sonido{cursor:pointer; font-size:14px; opacity:.8; user-select:none}
.bj-sonido.bj-mudo{opacity:.35}
/* ── Las fichas ────────────────────────────────────────────────────────
     Cada valor tiene SU color, como en cualquier casino: el jugador aprende
     a leer la apuesta de un vistazo, sin contar números. Se respeta la
     convención internacional donde existe (negra 100, violeta 500), porque
     el que ya jugó en otro lado la reconoce sin que nadie se la explique.
     El dibujo es el clásico: cuerpo de color con las muescas blancas del
     canto y la cara más clara en el medio. */
  .bj-fichas{display:flex; gap:8px; justify-content:center; margin:8px 0 0; flex-wrap:wrap}
/* ── El fichero del crupier ────────────────────────────────────────────
     La bandeja de la casa, vista desde arriba: cada tubo es una columna de
     fichas de canto. Puro adorno — la plata de verdad la lleva el servidor —
     pero sin ella el lado del crupier es un vacío y la mesa no se cree. */
  .bj-fichero{
    display:flex; gap:5px; justify-content:center; align-items:flex-end;
    margin:0 auto 6px; padding:5px 8px 6px; width:max-content; max-width:100%;
    background:linear-gradient(180deg,#33230f,#150e06);
    border:1px solid #0c0805; border-radius:8px;
    box-shadow:inset 0 2px 7px rgba(0,0,0,.75), 0 3px 8px rgba(0,0,0,.5);
  }
/* En un teléfono de pantalla corta el fichero de la casa se va. Es lo único
   de la mesa que no hace nada —es el adorno que le da cuerpo al lado del
   crupier— y son 44 px que en esas pantallas hacen la diferencia entre ver
   los botones o tener que deslizar justo cuando hay que decidir. */
  @media (max-height: 720px){
    .bj-fichero{display:none}
    /* La mesa entera baja una talla. No es que sobre nada: es que en 667 px de
       alto hay que elegir, y se elige que los botones queden a la vista antes
       que el tamaño de las cosas. */
    .bj-avatar{width:30px; height:30px; font-size:15px}
    .bj-mano-crupier .bj-cuenta{font-size:24px; padding:6px 16px; min-width:58px}
    .bj-botones.bj-jugada button{width:64px; height:64px; font-size:9.5px}
    .bj-mesa{margin-top:6px}
  }
.bj-tubo{
    width:29px; height:25px; border-radius:3px;
    background:repeating-linear-gradient(180deg,
      var(--cuerpo) 0 3px, rgba(0,0,0,.5) 3px 3.9px);
    box-shadow:inset 0 0 0 1px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.28);
  }
.bj-ficha{
    width:50px; height:50px; border-radius:50%; display:grid; place-items:center; cursor:pointer;
    font-size:13px; font-weight:700; font-family:Georgia,serif; flex:none;
    color:var(--texto-ficha); user-select:none;
    background:
      radial-gradient(circle at 50% 50%, var(--cara) 0 55%, transparent 55%),
      repeating-conic-gradient(from 9deg, var(--muesca) 0 13deg, var(--cuerpo) 13deg 32deg);
    border:1px solid rgba(0,0,0,.5);
    box-shadow:0 3px 7px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.18);
    text-shadow:0 1px 1px rgba(0,0,0,.35);
    transition:transform .08s;
  }
.bj-ficha:active{transform:translateY(3px) scale(.96)}
.bj-ficha[disabled]{opacity:.3; pointer-events:none}
/* ── El sitio de la apuesta ────────────────────────────────────────────
     En una mesa de verdad el círculo está PINTADO en el paño y no se va a
     ninguna parte: las fichas se ponen ahí y se quedan ahí mientras se juega
     la mano. Por eso acá también está siempre, debajo de las cartas, que es
     donde está en la mesa (el jugador tiene el círculo del lado de adentro y
     las cartas del lado del crupier). */
  /* ── Los tres puestos ──────────────────────────────────────────────────
     Cada columna es un círculo de la mesa con lo suyo: sus cartas, su cuenta
     y sus fichas. La misma columna sirve apostando y jugando — en la mesa el
     círculo tampoco cambia de lugar cuando reparten. */
  .bj-puestos{display:flex; align-items:flex-end; justify-content:center; gap:6px; margin:0 0 4px}
.bj-col{
    flex:1 1 0; min-width:0; display:flex; flex-direction:column; align-items:center; gap:2px;
    border-radius:12px; padding:4px 2px 5px; transition:background .15s;
  }
.bj-col.bj-vacia{opacity:.5}
/* El círculo donde van a caer las fichas que toques. */
  .bj-col.bj-elegida{background:rgba(255,255,255,.045); box-shadow:inset 0 0 0 1px rgba(255,236,190,.18)}
/* El puesto que el crupier está atendiendo. */
  .bj-col.bj-activa{background:rgba(255,216,74,.09); box-shadow:inset 0 0 0 1px rgba(255,216,74,.42)}
.bj-col .bj-cartas{min-height:74px; margin:0; padding:0; justify-content:center}
.bj-col .bj-carta{width:48px; height:70px; border-radius:6px; margin-left:-22px; box-shadow:0 3px 8px rgba(0,0,0,.5)}
.bj-col .bj-carta:first-child{margin-left:0}
/* ── Que una mano larga no se lleve puesta a la de al lado ────────────────
   Los puestos que nadie está jugando le ceden el ancho a los que sí. Con una
   sola mano sobre el paño —lo normal— las cartas pasan de 99 px de lugar a
   229, y una mano de cinco entra entera y grande.
   APOSTANDO no se encogen: ahí los tres círculos son la forma de elegir dónde
   va la ficha, y achicarlos sería sacarle al jugador el lugar donde toca. */
  .bj-puestos.bj-con-cartas .bj-col.bj-vacia{flex:0 0 auto; width:30px; padding:4px 0; opacity:.22}
.bj-puestos.bj-con-cartas .bj-col.bj-vacia .bj-cartas{min-height:0}
.bj-puestos.bj-con-cartas .bj-col.bj-vacia .bj-circulo{
    width:26px; height:26px; border-width:1px; box-shadow:none;
  }
/* Cuánto se encima cada carta sobre la anterior. Sale de una cuenta, no del
   ojo: (ancho de la columna − 48 de carta) ÷ (n − 1) es el paso con el que la
   mano entra justa, y el margen es ese paso menos el ancho de la carta.
   Va con el signo + (carta que sigue a otra carta) y no con :not(:first-child)
   para no pisar la regla de la primera, que no lleva margen.
   Con UN solo puesto en juego sobra lugar hasta ocho cartas: no hace falta
   ninguna regla. */
  .bj-puestos[data-juego="2"] .bj-cartas[data-n="5"] .bj-carta + .bj-carta{margin-left:-27px}
.bj-puestos[data-juego="2"] .bj-cartas[data-n="6"] .bj-carta + .bj-carta{margin-left:-31px}
.bj-puestos[data-juego="2"] .bj-cartas[data-n="7"] .bj-carta + .bj-carta{margin-left:-34px}
.bj-puestos[data-juego="2"] .bj-cartas[data-n="8"] .bj-carta + .bj-carta{margin-left:-36px}
.bj-puestos[data-juego="3"] .bj-cartas[data-n="4"] .bj-carta + .bj-carta{margin-left:-32px}
.bj-puestos[data-juego="3"] .bj-cartas[data-n="5"] .bj-carta + .bj-carta{margin-left:-36px}
.bj-puestos[data-juego="3"] .bj-cartas[data-n="6"] .bj-carta + .bj-carta{margin-left:-38px}
.bj-puestos[data-juego="3"] .bj-cartas[data-n="7"] .bj-carta + .bj-carta{margin-left:-40px}
.bj-puestos[data-juego="3"] .bj-cartas[data-n="8"] .bj-carta + .bj-carta{margin-left:-41px}
/* ── Tus cartas crecen cuando hay lugar ──────────────────────────────────
   Jugando UN solo puesto —lo que hace casi siempre el que se sienta— la mano
   tiene los 229 px del paño en vez de 99, así que las cartas pueden ser de
   verdad y no miniaturas. Con dos o tres puestos se quedan chicas porque no
   entrarían: el ancho manda.
   Nunca llegan a las del crupier (74 × 104) y está bien: son tres manos
   posibles contra una sola de él. */
  .bj-puestos[data-juego="1"] .bj-col .bj-carta{width:60px; height:86px; border-radius:7px}
.bj-puestos[data-juego="1"] .bj-col .bj-carta .bj-idx .bj-v{font-size:13.5px}
.bj-puestos[data-juego="1"] .bj-col .bj-carta .bj-idx .bj-p{font-size:10px}
.bj-puestos[data-juego="1"] .bj-col .bj-carta .bj-palo{font-size:31px}
.bj-puestos[data-juego="1"] .bj-col .bj-carta .bj-palo.bj-as{font-size:40px}
.bj-puestos[data-juego="1"] .bj-col .bj-cartas{min-height:90px}
/* Con la carta más grande, una mano de seis o más vuelve a no entrar: mismo
   remedio, medido sobre los 229 px que tiene un puesto solo. */
  .bj-puestos[data-juego="1"] .bj-cartas[data-n="6"] .bj-carta + .bj-carta{margin-left:-26px}
.bj-puestos[data-juego="1"] .bj-cartas[data-n="7"] .bj-carta + .bj-carta{margin-left:-32px}
.bj-puestos[data-juego="1"] .bj-cartas[data-n="8"] .bj-carta + .bj-carta{margin-left:-36px}
.bj-col .bj-carta .bj-idx{left:4px; top:3px}
.bj-col .bj-carta .bj-idx.bj-abajo{right:4px; bottom:3px}
.bj-col .bj-carta .bj-idx .bj-v{font-size:11px}
.bj-col .bj-carta .bj-idx .bj-p{font-size:8px}
.bj-col .bj-carta .bj-palo{font-size:25px}
.bj-col .bj-carta .bj-palo.bj-as{font-size:32px}
.bj-col .bj-carta.bj-tapada::after{inset:4px}
/* La cuenta va SIEMPRE por encima de las cartas: es el número que el jugador
   mira para decidir si pide o se planta, y una carta de otro puesto no se lo
   puede tapar nunca. */
  .bj-pie-col{min-height:30px; display:flex; flex-direction:column; align-items:center; gap:1px;
    position:relative; z-index:3}
/* Tu cuenta iba en 15 px contra los 30 de la del crupier. Es el número con el
   que decidís pedir o plantarte: no puede ser la mitad de chico que el de
   enfrente. A 19 sigue entrando en la columna más angosta (tres puestos). */
  .bj-col .bj-cuenta{font-size:19px; padding:5px 11px; min-width:40px; border-radius:16px; margin-top:0}
.bj-col .bj-cuenta .bj-nota{font-size:8px}
.bj-col .bj-resultado{font-size:8.5px; letter-spacing:.5px}
/* El círculo donde caen las fichas. Creció de 58 a 68: es el blanco al que se
   apunta con el dedo para apostar, y de ancho sobra lugar en los tres casos
   (tres círculos de 68 son 204 de los 309 del paño). */
  .bj-circulo{
    width:68px; height:68px; border-radius:50%; position:relative; flex:none;
    border:2px solid rgba(255,236,190,.22);
    box-shadow:
      inset 0 0 0 5px rgba(0,0,0,.14),
      inset 0 0 0 6px rgba(255,236,190,.13),
      inset 0 0 22px rgba(0,0,0,.4);
    display:grid; place-items:center;
  }
.bj-circulo.bj-tocable{cursor:pointer}
.bj-circulo .bj-rotulo{
    font-size:7.5px; letter-spacing:2px; color:rgba(255,236,190,.3); text-align:center; line-height:1.9;
  }
/* La pila: las fichas de canto, una encima de la otra. */
  .bj-pila{position:absolute; bottom:10px; left:50%; transform:translateX(-50%); width:36px}
.bj-pila .bj-ficha{margin-top:-30px; cursor:inherit; pointer-events:none; width:36px; height:36px; font-size:10px}
.bj-pila .bj-ficha:first-child{margin-top:0}
.bj-en-pruebas{
    display:block; margin-top:5px; font-size:8px; letter-spacing:2px; font-weight:700;
    color:#0a0a0a; background:linear-gradient(180deg,#9ad7ff,#2b8fd4);
    border-radius:3px; padding:3px 7px;
  }
.bj-monto{text-align:center; line-height:1.1}
.bj-monto b{display:block; font-size:15px; color:var(--oro); font-weight:700; text-shadow:0 2px 6px rgba(0,0,0,.7)}
.bj-oculto{display:none !important}
`;


  // ── El sonido de la mesa ───────────────────────────────────────────────
  // Se fabrica acá con Web Audio: ni un archivo ni una descarga. Tres ruidos,
  // ninguno de más de un cuarto de segundo — en una mesa lo que se oye es el
  // golpe seco de la arcilla y el roce de la carta, no una orquesta.
  const Sonido = (() => {
    let ac = null, mudo = false;
    const ctx = () => {
      if (mudo) return null;
      if (!ac) {
        try { ac = new (window.AudioContext || window.webkitAudioContext)(); }
        catch (e) { return null; }
      }
      // Al volver de una llamada el navegador deja el audio suspendido.
      if (ac.state === 'suspended') ac.resume();
      return ac;
    };
    const ruido = (a, dur) => {
      const n = Math.max(1, Math.floor(a.sampleRate * dur));
      const buf = a.createBuffer(1, n, a.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      return buf;
    };
    const golpe = (a, t, { frec, q, vol, dur }) => {
      const src = a.createBufferSource(); src.buffer = ruido(a, dur);
      const bp = a.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = frec; bp.Q.value = q;
      const g = a.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      src.connect(bp); bp.connect(g); g.connect(a.destination);
      src.start(t); src.stop(t + dur + 0.01);
    };
    const tono = (a, t, frec, vol, dur, tipo) => {
      const o = a.createOscillator(); o.type = tipo || 'triangle'; o.frequency.value = frec;
      const g = a.createGain();
      g.gain.setValueAtTime(0.0008, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
      o.connect(g); g.connect(a.destination);
      o.start(t); o.stop(t + dur + 0.02);
    };
    return {
      get mudo() { return mudo; },
      alternar() { mudo = !mudo; return mudo; },
      ficha() {
        const a = ctx(); if (!a) return;
        const t = a.currentTime;
        golpe(a, t, { frec: 1500, q: 1.1, vol: 0.30, dur: 0.07 });
        tono(a, t + 0.004, 2550, 0.05, 0.05);
        tono(a, t + 0.010, 3350, 0.035, 0.045);
      },
      carta() {
        const a = ctx(); if (!a) return;
        const t = a.currentTime;
        const src = a.createBufferSource(); src.buffer = ruido(a, 0.14);
        const bp = a.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.8;
        bp.frequency.setValueAtTime(3200, t);
        bp.frequency.exponentialRampToValueAtTime(700, t + 0.13);
        const g = a.createGain();
        g.gain.setValueAtTime(0.0008, t);
        g.gain.exponentialRampToValueAtTime(0.16, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0008, t + 0.14);
        src.connect(bp); bp.connect(g); g.connect(a.destination);
        src.start(t); src.stop(t + 0.15);
      },
      resultado(manos) {
        const a = ctx(); if (!a) return;
        const t = a.currentTime;
        const res = (manos || []).map((h) => h.resultado);
        if (res.includes('natural')) {
          [784, 988, 1319, 1568].forEach((f, i) => tono(a, t + i * 0.075, f, 0.12, 0.3));
        } else if (res.includes('gana')) {
          [660, 880].forEach((f, i) => tono(a, t + i * 0.085, f, 0.11, 0.26));
        } else if (res.length && res.every((r) => r === 'empate')) {
          tono(a, t, 440, 0.07, 0.2);
        } else {
          tono(a, t, 200, 0.10, 0.3, 'sine');
          tono(a, t + 0.06, 150, 0.08, 0.32, 'sine');
        }
      },
    };
  })();

  // ── Las fichas ─────────────────────────────────────────────────────────
  // Donde hay convención internacional se respeta (negra 100, violeta 500):
  // el que ya jugó en otro lado la reconoce sola.
  const FICHAS = [
    { v: 10,  cuerpo: '#cfc9b6', muesca: '#ffffff', cara: '#efebdd', texto: '#2b2b2b' },
    { v: 20,  cuerpo: '#a82126', muesca: '#ffffff', cara: '#cc3b39', texto: '#fff' },
    { v: 50,  cuerpo: '#15693f', muesca: '#ffffff', cara: '#238f58', texto: '#fff' },
    { v: 100, cuerpo: '#141414', muesca: '#ffffff', cara: '#2f2f2f', texto: '#fff' },
    { v: 500, cuerpo: '#4c2578', muesca: '#ffffff', cara: '#6c3aa3', texto: '#fff' },
  ];
  const fichaDe = (v) => FICHAS.find((f) => f.v === v) || FICHAS[0];

  // Con qué fichas se arma un monto, para dibujar la pila del círculo.
  function pilaPara(monto) {
    const out = [];
    let resto = monto;
    for (const f of [...FICHAS].sort((a, b) => b.v - a.v)) {
      while (resto >= f.v && out.length < 12) { out.push(f.v); resto -= f.v; }
    }
    return out;
  }

  const PALOS = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const ROJOS = { H: 1, D: 1 };
  const NOMBRE = () => ({
    gana: T('GANASTE'), pierde: T('PERDISTE'), empate: T('EMPATE'), natural: T('¡BLACKJACK!'),
  });
  const TEXTO_ACCION = () => ({
    pedir: T('PEDIR'), plantarse: T('PLANTARME'), doblar: T('DOBLAR'), dividir: T('DIVIDIR'),
  });

  // Un color por acción. En una mesa con cuatro botones iguales el jugador los
  // lee cada vez; con color los agarra sin leer, que es lo que pasa cuando se
  // juega rápido y de memoria. Los tonos son los de las fichas de la mesa, así
  // que no entra una paleta nueva:
  //   PEDIR      dorado  — la de la casa, la que más se toca
  //   PLANTARME  rojo    — la que corta la mano
  //   DOBLAR     azul    — pone más plata
  //   DIVIDIR    violeta — abre otra mano
  const COLOR_ACCION = {
    pedir: '', plantarse: 'bj-rojo', doblar: 'bj-azul', dividir: 'bj-violeta',
  };

  function Ficha({ f, texto, onClick, disabled }) {
    return (
      <div
        className="bj-ficha"
        onClick={disabled ? undefined : onClick}
        style={{
          '--cuerpo': f.cuerpo, '--muesca': f.muesca,
          '--cara': f.cara, '--texto-ficha': f.texto,
          ...(disabled ? { opacity: 0.3, pointerEvents: 'none' } : {}),
        }}
      >{texto != null ? texto : f.v}</div>
    );
  }

  // ── Dónde van los palos en una carta de números ─────────────────────────
  // Es el reparto de cualquier baraja de póker: dos columnas a los costados
  // y, según el número, alguno en el medio. Las coordenadas van en tanto por
  // uno de la carta; las de la mitad de abajo se dibujan CABEZA ABAJO, que es
  // lo que hace que la carta se lea igual dada vuelta.
  const IZQ = 0.28, DER = 0.72, CEN = 0.5;
  const ARR = 0.17, MED = 0.5, ABA = 0.83;          // tres filas (hasta el 6)
  const F1 = 0.17, F2 = 0.383, F3 = 0.617, F4 = 0.83; // cuatro filas (8 en adelante)
  const ENTRE_ARRIBA = 0.285, ENTRE_ABAJO = 0.715;   // los del medio del 7 y el 10

  const PIPAS = {
    '2':  [[CEN, ARR], [CEN, ABA]],
    '3':  [[CEN, ARR], [CEN, MED], [CEN, ABA]],
    '4':  [[IZQ, ARR], [DER, ARR], [IZQ, ABA], [DER, ABA]],
    '5':  [[IZQ, ARR], [DER, ARR], [CEN, MED], [IZQ, ABA], [DER, ABA]],
    '6':  [[IZQ, ARR], [DER, ARR], [IZQ, MED], [DER, MED], [IZQ, ABA], [DER, ABA]],
    '7':  [[IZQ, ARR], [DER, ARR], [CEN, ENTRE_ARRIBA],
           [IZQ, MED], [DER, MED], [IZQ, ABA], [DER, ABA]],
    '8':  [[IZQ, ARR], [DER, ARR], [CEN, ENTRE_ARRIBA],
           [IZQ, MED], [DER, MED], [CEN, ENTRE_ABAJO], [IZQ, ABA], [DER, ABA]],
    '9':  [[IZQ, F1], [DER, F1], [IZQ, F2], [DER, F2], [CEN, MED],
           [IZQ, F3], [DER, F3], [IZQ, F4], [DER, F4]],
    '10': [[IZQ, F1], [DER, F1], [CEN, ENTRE_ARRIBA], [IZQ, F2], [DER, F2],
           [IZQ, F3], [DER, F3], [CEN, ENTRE_ABAJO], [IZQ, F4], [DER, F4]],
  };

  // ── Las figuras ──────────────────────────────────────────────────────────
  // El rey, la reina y la jota son dibujos, no geometría: una baraja de verdad
  // son litografías con cientos de trazos. Dibujarlas a mano quedaba de
  // juguete, así que se usan las de la baraja de patrón inglés de Dmitry
  // Fomin, que está en DOMINIO PÚBLICO (CC0) — ver public/cartas/ORIGEN.txt.
  // Los números y el as los sigue dibujando esta pantalla.
  const FIGURAS_CARTA = { J: 'jack', Q: 'queen', K: 'king' };
  const PALO_ARCHIVO = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
  const imagenDeFigura = (rango, palo) =>
    `/cartas/${FIGURAS_CARTA[rango]}_${PALO_ARCHIVO[palo]}.webp`;

  // Una carta. La tapada no trae datos: el servidor no manda lo que no se ve.
  function Carta({ carta, nueva }) {
    if (carta && typeof carta === 'object' && carta.tapada) {
      return <div className={'bj-carta bj-tapada' + (nueva ? ' bj-nueva' : '')} />;
    }
    const rango = String(carta)[0], palo = String(carta)[1];
    const valor = rango === 'T' ? '10' : rango;
    const simbolo = PALOS[palo];
    const idx = (
      <><span className="bj-v">{valor}</span><span className="bj-p">{simbolo}</span></>
    );

    // El dibujo del medio va en SVG y no en texto suelto: así escala solo
    // cuando la carta se achica en las columnas de los puestos, sin tener que
    // llevar dos juegos de tamaños.
    // Una figura es una carta dibujada entera: se muestra la lámina sola, sin
    // los índices ni el fondo de acá, porque ya los trae puestos.
    if (FIGURAS_CARTA[rango]) {
      return (
        <div className={'bj-carta bj-figura' + (nueva ? ' bj-nueva' : '')}>
          <img src={imagenDeFigura(rango, palo)} alt={`${valor} de ${PALO_ARCHIVO[palo]}`} />
        </div>
      );
    }

    const puntos = PIPAS[valor];
    const centro = (
      <svg className="bj-pipas" viewBox="0 0 100 140" preserveAspectRatio="xMidYMid meet">
        {rango === 'A' ? (
          <text x="50" y="70" className="bj-pipa" fontSize="72"
                textAnchor="middle" dominantBaseline="central">{simbolo}</text>
        ) : puntos ? (
          puntos.map(([x, y], i) => (
            <text key={i} x={x * 100} y={y * 140} className="bj-pipa" fontSize="31"
                  textAnchor="middle" dominantBaseline="central"
                  transform={y > 0.5 ? `rotate(180 ${x * 100} ${y * 140})` : undefined}>
              {simbolo}
            </text>
          ))
        ) : null}
      </svg>
    );

    return (
      <div className={'bj-carta' + (ROJOS[palo] ? ' bj-roja' : '') + (nueva ? ' bj-nueva' : '')}>
        <div className="bj-idx">{idx}</div>
        {centro}
        <div className="bj-idx bj-abajo">{idx}</div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  //  LA BANDA DEL CENTRO — la franja que separa al crupier del jugador.
  //
  //  En una mesa de verdad esta franja no es adorno: es donde están impresas
  //  las reglas de la casa, SIGUIENDO la curva del arco, y donde va la marca
  //  del salón. Antes eran tres cosas rectas apiladas —dos renglones, la
  //  palabra VOLTIO y una línea curva— y se leía como una lista, no como una
  //  mesa. Ahora es una sola pieza dibujada.
  //
  //  Va en SVG y no en HTML por una razón concreta: en HTML el texto no puede
  //  seguir una curva. El dibujo se escala solo con el ancho del paño.
  //
  //  Lo que dice sale SIEMPRE de la ficha de la mesa, nunca escrito a mano: si
  //  el dueño cambia el pago del natural o los topes, cambia el paño. Y no
  //  dice nada que la mesa no haga: no hay línea de seguro porque esta mesa no
  //  ofrece seguro — el crupier mira su carta tapada del lado del servidor
  //  (ver worker/blackjack.js).
  // ══════════════════════════════════════════════════════════════════════
  function BandaCentral({ pagoNatural, minimo, maximo }) {
    const regla = pagoNatural >= 1.5
      ? T('EL BLACKJACK PAGA 3 A 2')
      : T('EL BLACKJACK PAGA 6 A 5');
    const casa = T('EL CRUPIER SE PLANTA EN 17 · APUESTA {min}–{max}',
      { min: minimo, max: maximo });

    return (
      <svg className="bj-banda" viewBox="0 0 340 86"
           preserveAspectRatio="xMidYMid meet" aria-hidden="true">
        <defs>
          {/* Las dos curvas por las que camina el texto. No se dibujan nunca:
              son el renglón, no una línea. */}
          <path id="bj-curva-regla" d="M 14,18 Q 170,44 326,18" fill="none" />
          <path id="bj-curva-casa" d="M 16,38 Q 170,63 324,38" fill="none" />
        </defs>

        <text className="bj-regla">
          <textPath href="#bj-curva-regla" startOffset="50%" textAnchor="middle">
            {regla}
          </textPath>
        </text>
        <text className="bj-casa">
          <textPath href="#bj-curva-casa" startOffset="50%" textAnchor="middle">
            {casa}
          </textPath>
        </text>

        {/* El arco doble abrazando el lado del jugador: el grueso marca el
            límite y el fino le hace de filete, como el pintado de una mesa. */}
        <path className="bj-arco-grueso" d="M 0,56 Q 170,86 340,56" />
        <path className="bj-arco-fino" d="M 0,62 Q 170,92 340,62" />

        {/* La marca en medallón, montada sobre el arco: ahí es donde una mesa
            lleva el nombre de la casa. Va hundida en el fieltro, no escrita
            encima: casi no se ve, se nota cuando la luz le pega. */}
        <ellipse className="bj-medallon" cx="170" cy="74" rx="38" ry="11" />
        <text className="bj-marca" x="170" y="77.5" textAnchor="middle">VOLTIO</text>
      </svg>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  //  La pantalla
  // ══════════════════════════════════════════════════════════════════════
  function BlackjackScreen({ user, mesa, onSalirAlSalon, onOpenWallet, onLogout }) {
    // `E` es lo ÚLTIMO que dijo el servidor y la única verdad de la mesa.
    const [E, setE] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [ocupado, setOcupado] = useState(false);
    const [aviso, setAviso] = useState('');
    const [mudo, setMudo] = useState(false);

    // La apuesta no es un número que se escribe: es una pila de fichas que se
    // van poniendo, y hay una pila por puesto.
    const [pilas, setPilas] = useState([[], [], []]);
    const [puestoActivo, setPuestoActivo] = useState(1);

    // Cuando la mano termina, la mesa NO se limpia sola: las cartas y la
    // apuesta se quedan a la vista para que el jugador vea cómo le fue. Recién
    // cuando toca OTRA MANO (o REPETIR) el crupier barre el paño. Antes de esto
    // la ficha de la mano muerta se quedaba puesta y no había forma de sacarla:
    // se podían poner fichas nuevas y el círculo seguía mostrando la apuesta
    // vieja, así que el jugador miraba 20 mientras estaba por apostar 100.
    const [barrido, setBarrido] = useState(false);

    // Qué cartas ya se dibujaron, para animar y hacer sonar solo las nuevas.
    const vistas = useRef(new Set());
    const primerDibujo = useRef(true);
    const estadoPrevio = useRef(null);

    const idMesa = (mesa && mesa.id) || 'blackjack';
    const puestos = (E && E.mesa && E.mesa.puestos) || (mesa && mesa.puestos) || 3;
    const minimo = (E && E.mesa && E.mesa.apuesta_min) || (mesa && mesa.apuesta_min) || 10;
    const maximo = (E && E.mesa && E.mesa.apuesta_max) || (mesa && mesa.apuesta_max) || 500;
    const jugando = E && E.estado === 'jugando';
    // La mano terminada, todavía sobre el paño: cartas, resultado y la apuesta
    // como quedó. Es el momento en que en una mesa de verdad el crupier paga y
    // recién después recoge.
    const mostrandoCierre = !!E && E.estado === 'cerrada' && !barrido
                            && ((E.manos || []).length > 0);
    // Con la mano a la vista no se pone una ficha nueva: primero se barre.
    const enPaño = jugando || mostrandoCierre;
    // Cuántos puestos tienen cartas de verdad. Manda el ancho: los puestos que
    // nadie está jugando le ceden su lugar a los que sí, y una mano larga
    // necesita saber cuánto espacio le tocó para saber cuánto encimar las
    // cartas. Con la mesa vacía (apostando) son los tres, que es cuando el
    // jugador tiene que poder elegir dónde poner la ficha.
    const puestosEnJuego = enPaño
      ? new Set(((E && E.manos) || []).map((h) => h.puesto)).size || 1
      : puestos;
    // El saldo que se muestra y con el que se apuesta es el DISPONIBLE: lo que
    // hay menos lo retenido por un retiro esperando aprobación. Esa plata es
    // del jugador pero no la puede jugar —el servidor descuenta contra
    // `balance - held_balance`—, así que mostrarle el total lo mandaba a
    // apostar contra un número que la mesa le iba a rechazar. La CAJA siempre
    // mostró el disponible: acá se muestra lo mismo.
    const bruto = E && E.balance != null ? E.balance : (user ? user.balance : 0);
    const retenido = (E && E.held_balance != null)
      ? E.held_balance : ((user && user.held_balance) || 0);
    const saldo = Math.max(0, bruto - retenido);

    const montoDe = (p) => (pilas[p] || []).reduce((s, v) => s + v, 0);
    const montoTotal = () => pilas.reduce((s, _, p) => s + montoDe(p), 0);
    const conFichas = () => [0, 1, 2].filter((p) => montoDe(p) > 0);

    // ── Hablar con el servidor ───────────────────────────────────────────
    const aplicar = useCallback((d) => {
      if (!d) return;
      if (d.error) { setAviso(d.error); return; }
      setAviso('');
      setE(d);
      setPilas([[], [], []]);
      setBarrido(false);
    }, []);

    const cargar = useCallback(async () => {
      try {
        const d = await window.Api.bjRonda(idMesa);
        // Si la mano se cerró sola mientras el jugador no estaba, hay que
        // decírselo: si no, solo ve el saldo distinto y no entiende nada.
        const cerroSola = d && d.estado === 'cerrada' && !estadoPrevio.current;
        setE(d);
        if (cerroSola) {
          const pago = (d.manos || []).reduce((s, h) => s + (h.pago || 0), 0);
          setAviso(pago > 0
            ? T('Tu mano anterior había quedado abierta: se jugó sola y cobraste {n}.', { n: pago })
            : T('Tu mano anterior había quedado abierta y se jugó sola.'));
        }
      } catch (err) {
        setAviso(T(err.message) || T('No pude abrir la mesa'));
      } finally {
        setCargando(false);
      }
    }, [idMesa]);

    useEffect(() => { cargar(); }, [cargar]);

    // Las figuras son láminas: se piden al entrar a la mesa para que ninguna
    // aparezca en blanco justo cuando el crupier la reparte. Son 196 KB en
    // total y se piden UNA vez; después las tiene el navegador.
    useEffect(() => {
      Object.keys(FIGURAS_CARTA).forEach((r) => {
        Object.keys(PALO_ARCHIVO).forEach((p) => {
          const img = new Image();
          img.src = imagenDeFigura(r, p);
        });
      });
    }, []);

    // El sonido del cierre: cuando la mano pasa de jugando a cerrada.
    useEffect(() => {
      if (!E) return;
      const antes = estadoPrevio.current;
      if (antes === 'jugando' && E.estado === 'cerrada') Sonido.resultado(E.manos);
      estadoPrevio.current = E.estado;
    }, [E]);

    const jugar = async (accion) => {
      if (ocupado || !E) return;
      setOcupado(true);
      try {
        // La versión viaja SIEMPRE: es lo que hace que el doble toque no pida
        // dos cartas. La pone el servidor y el cliente la devuelve tal cual.
        const d = await window.Api.bjJugar(accion, E.ronda, E.version);
        aplicar(d);
      } catch (err) {
        setAviso(T(err.message) || T('No se pudo jugar'));
        // Si el servidor rechazó por versión vieja, lo que corresponde es
        // volver a mirar la mesa, no insistir con lo que teníamos.
        cargar();
      } finally { setOcupado(false); }
    };

    const apostar = async () => {
      const abiertos = conFichas();
      if (!abiertos.length || ocupado) return;
      setOcupado(true);
      try {
        const d = await window.Api.bjApostar(idMesa,
          abiertos.map((p) => ({ puesto: p, apuesta: montoDe(p) })));
        vistas.current = new Set();
        primerDibujo.current = false;
        aplicar(d);
      } catch (err) {
        setAviso(T(err.message) || T('No se pudo apostar'));
      } finally { setOcupado(false); }
    };

    const ponerFicha = (v) => {
      if (ocupado || enPaño) return;
      if (montoDe(puestoActivo) + v > maximo) {
        setAviso(T('El máximo por puesto en esta mesa es {n}', { n: maximo }));
        return;
      }
      if (montoTotal() + v > saldo) { setAviso(T('No te alcanza el saldo')); return; }
      setAviso('');
      Sonido.ficha();
      setPilas((ps) => ps.map((p, i) => (i === puestoActivo ? [...p, v] : p)));
    };

    const sacarFicha = (p) => {
      if (!(pilas[p] || []).length) return false;
      Sonido.ficha();
      setPilas((ps) => ps.map((x, i) => (i === p ? x.slice(0, -1) : x)));
      return true;
    };

    const tocarCirculo = (p) => {
      if (ocupado || enPaño) return;
      // El clic que manda el navegador al soltar un arrastre no cuenta: si
      // contara, la ficha recién sacada volvería a la mesa. Se descarta por
      // tiempo, no con una bandera de un solo uso — ese clic no siempre llega,
      // y entonces la bandera se comía el toque siguiente.
      if (Date.now() - arrastreHecho.current < 350) return;
      if (puestoActivo !== p) { setPuestoActivo(p); return; }
      sacarFicha(p);
    };

    // ── Arrastrar una ficha ya puesta ─────────────────────────────────────
    // Igual que en el paño de la ruleta, y a propósito: el mismo movimiento
    // tiene que significar lo mismo en las dos mesas.
    //   · soltarla sobre OTRO círculo → la ficha se muda a ese puesto
    //   · soltarla fuera de los círculos → se retira
    //   · tocar el círculo → saca la de arriba (el gesto de antes, sigue)
    // Sólo se toma el movimiento HORIZONTAL (los círculos con ficha llevan
    // `pan-y`): los verticales quedan para desplazar la pantalla, que si no el
    // jugador no podría bajar con el dedo apoyado sobre su apuesta.
    const arrastreHecho = React.useRef(0);
    const [arrastre, setArrastre] = useState(null);

    const puestoBajo = (x, y) => {
      const el = document.elementFromPoint(x, y);
      const c = el && el.closest ? el.closest('[data-puesto]') : null;
      return c ? Number(c.dataset.puesto) : null;
    };

    const mudarFicha = (desde, hasta) => {
      const ficha = (pilas[desde] || [])[(pilas[desde] || []).length - 1];
      if (ficha == null) return;
      const yaHay = (pilas[hasta] || []).reduce((a, b) => a + b, 0);
      if (yaHay + ficha > maximo) {
        setAviso(T('El máximo por puesto en esta mesa es {n}: la ficha se queda donde estaba.', { n: maximo }));
        return;
      }
      setAviso('');
      Sonido.ficha();
      setPilas((ps) => ps.map((x, i) => {
        if (i === desde) return x.slice(0, -1);
        if (i === hasta) return [...x, ficha];
        return x;
      }));
    };

    const arrastreDe = (p) => {
      if (ocupado || enPaño) return {};

      const arrancar = (x0, y0, tipo) => {
        const monto = (pilas[p] || [])[(pilas[p] || []).length - 1];
        if (monto == null) return;
        let vivo = false;
        const puntoDe = (ev) => (ev.touches && ev.touches[0]) || (ev.changedTouches && ev.changedTouches[0]) || ev;

        const mover = (ev) => {
          const q = puntoDe(ev);
          if (!vivo) {
            const dx = q.clientX - x0, dy = q.clientY - y0;
            if (!(Math.abs(dx) >= 26 && Math.abs(dx) > Math.abs(dy))) return;
            vivo = true;
          }
          if (ev.cancelable && ev.type === 'touchmove') ev.preventDefault();
          setArrastre({ desde: p, monto, x: q.clientX, y: q.clientY, destino: puestoBajo(q.clientX, q.clientY) });
        };

        const soltar = (ev) => {
          window.removeEventListener('mousemove', mover);
          window.removeEventListener('mouseup', soltar);
          window.removeEventListener('touchmove', mover, { passive: false });
          window.removeEventListener('touchend', soltar);
          if (!vivo) return;
          const q = puntoDe(ev);
          const destino = puestoBajo(q.clientX, q.clientY);
          setArrastre(null);
          arrastreHecho.current = Date.now();
          if (destino == null) {
            if (sacarFicha(p) && navigator.vibrate) navigator.vibrate(30);
          } else if (destino !== p) {
            mudarFicha(p, destino);
            if (navigator.vibrate) navigator.vibrate(20);
          }
        };

        if (tipo === 'touch') {
          window.addEventListener('touchmove', mover, { passive: false });
          window.addEventListener('touchend', soltar);
        } else {
          window.addEventListener('mousemove', mover);
          window.addEventListener('mouseup', soltar);
        }
      };

      return {
        onTouchStart: (e) => { const t = e.touches[0]; arrancar(t.clientX, t.clientY, 'touch'); },
        onMouseDown: (e) => { if (e.button === 0) arrancar(e.clientX, e.clientY, 'mouse'); },
      };
    };

    // Lo que había puesto cada puesto AL EMPEZAR la mano que terminó. No es la
    // suma de lo que quedó en la mesa: si se dividió hay dos manos con la misma
    // apuesta (sumarlas repetiría el doble), y si se dobló la mano quedó con el
    // doble anotado (repetirlo obligaría a doblar de entrada). Así que se toma
    // la PRIMERA mano del puesto y, si está doblada, se le saca la mitad.
    const apostadoAntes = () => {
      const out = [0, 0, 0];
      for (const p of [0, 1, 2]) {
        const suyas = ((E && E.manos) || []).filter((h) => h.puesto === p)
          .sort((a, b) => a.indice - b.indice);
        if (!suyas.length) continue;
        const primera = suyas[0];
        out[p] = primera.estado === 'doblada' ? Math.round(primera.apuesta / 2) : primera.apuesta;
      }
      return out;
    };

    // El barrido: se recoge la mano terminada. `repetir` vuelve a poner la
    // misma apuesta sobre el paño limpio (sin cobrarla: eso lo hace APOSTAR).
    const barrer = (repetir) => {
      const previas = apostadoAntes();
      const total = previas.reduce((a, b) => a + b, 0);
      if (repetir && total > saldo) {
        setAviso(T('No te alcanza el saldo para repetir la misma apuesta.'));
        return;
      }
      setAviso('');
      Sonido.ficha();
      setPilas(repetir ? previas.map((m) => (m > 0 ? pilaPara(m) : [])) : [[], [], []]);
      setBarrido(true);
    };

    // Marca una carta como vista y avisa si es nueva (para animarla y sonarla).
    let nuevasEnEsteDibujo = 0;
    const esNueva = (clave) => {
      if (vistas.current.has(clave)) return false;
      vistas.current.add(clave);
      if (!primerDibujo.current) {
        const cuando = nuevasEnEsteDibujo++ * 130;
        setTimeout(() => Sonido.carta(), cuando);
      }
      return !primerDibujo.current;
    };

    if (cargando) {
      return (
        <div className="bj-pantalla" style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#0a0604', color: '#d4a94a', fontFamily: 'Georgia, serif', letterSpacing: 2,
        }}>{T('Abriendo la mesa…')}</div>
      );
    }

    // ── Una columna: el puesto con sus cartas, su cuenta y su círculo ────
    const Columna = (p) => {
      // Barrida la mesa, las manos ya no están sobre el paño aunque el
      // servidor las siga contando en la ronda cerrada.
      const manos = enPaño ? ((E && E.manos) || []).filter((h) => h.puesto === p) : [];
      const enJuego = manos.reduce((s, h) => s + h.apuesta, 0);
      const monto = manos.length ? enJuego : montoDe(p);
      const editable = !enPaño;
      const enTurno = jugando && manos.some(
        (h) => h.indice === E.mano_activa && h.estado === 'jugando');

      return (
        <div key={p} className={'bj-col'
          + (enTurno ? ' bj-activa' : '')
          + (!monto && !manos.length ? ' bj-vacia' : '')
          + (editable && p === puestoActivo ? ' bj-elegida' : '')}>
          {/* Un puesto puede tener DOS manos si se dividió. Cada una va con
              sus cartas y su cuenta pegadas: si se mezclaran las cartas de las
              dos en una fila, el jugador no sabría cuál está jugando ni qué
              suma cada una. La que está en turno se marca. */}
          {manos.map((h) => {
            const suTurno = jugando && h.indice === E.mano_activa && h.estado === 'jugando';
            return (
              <div key={h.indice}
                   className={'bj-mano' + (manos.length > 1 ? ' bj-partida' : '')
                     + (manos.length > 1 && suTurno ? ' bj-activa' : '')}>
                {/* `data-n` es cuántas cartas tiene la mano. Lo lee la hoja de
                    estilos para encimarlas más cuanto más larga sea: una mano
                    de cinco con las medidas sueltas mide 162 px y la columna
                    tiene 99, así que se salía del paño y se acostaba encima
                    del puesto de al lado, tapándole la cuenta. */}
                <div className="bj-cartas" data-n={h.cartas.length}>
                  {h.cartas.map((c, i) => (
                    <Carta key={`m${h.indice}-${i}`} carta={c} nueva={esNueva(`m${h.indice}-${i}`)} />
                  ))}
                </div>
                <div className="bj-pie-col">
                  <span className="bj-cuenta">
                    {h.total}{h.blando ? <span className="bj-nota"> {T('blando')}</span> : null}
                  </span>
                  {manos.length > 1 && (
                    <span className="bj-apostado">${h.apuesta}</span>
                  )}
                  {h.resultado && (
                    <div className={'bj-resultado bj-' + h.resultado}>
                      {NOMBRE()[h.resultado]}{h.pago ? ' +' + h.pago : ''}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {!manos.length && <div className="bj-cartas" />}

          <div className={'bj-circulo' + (editable ? ' bj-tocable' : '')}
               data-puesto={p}
               onClick={() => tocarCirculo(p)}
               {...(editable && (pilas[p] || []).length ? arrastreDe(p) : {})}
               style={editable && (pilas[p] || []).length ? { touchAction: 'pan-y' } : undefined}>
            {monto ? (
              <div className="bj-pila">
                {pilaPara(monto).sort((a, b) => b - a).map((v, i, todas) => (
                  <Ficha key={i} f={fichaDe(v)} texto={i === todas.length - 1 ? String(v) : ''} />
                ))}
              </div>
            ) : editable ? (
              <div className="bj-rotulo">{p === puestoActivo ? T('ACÁ') : ''}</div>
            ) : null}
          </div>
        </div>
      );
    };

    const abiertos = conFichas();
    const flojo = abiertos.find((p) => montoDe(p) < minimo);

    return (
      <div className="bj-pantalla" style={{
        minHeight: '100vh', background: '#0a0604', color: '#e8dcc0',
        fontFamily: 'Georgia, "Times New Roman", serif',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '8px 12px 18px',
      }}>
        <style>{ESTILOS}</style>

        {/* La cabecera del salón: saldo, caja y la puerta de salida. */}
        <div className="bj-barra">
          <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="bj-gris" style={{ padding: '6px 10px', fontSize: 11 }}
                    onClick={onSalirAlSalon}>← {T('SALÓN')}</button>
            {onOpenWallet && (
              <button className="bj-gris" style={{ padding: '6px 10px', fontSize: 11 }}
                      onClick={onOpenWallet}>{T('CAJA')}</button>
            )}
          </span>
          {/* El usuario a la vista: en esta mesa se apuesta plata, y el jugador
              tiene que poder ver con qué cuenta está sin salir a buscarlo. */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {user && user.username && (
              <span style={{ fontSize: 10, color: '#bba876', letterSpacing: 1 }}>
                {user.username}
              </span>
            )}
            <span>
              <span className={'bj-sonido' + (mudo ? ' bj-mudo' : '')}
                    onClick={() => { setMudo(Sonido.alternar()); }}
                    title="Sonido">{mudo ? '🔇' : '🔊'}</span>
              {/* El saldo se escribe como lo escribe toda la casa: con el
                  símbolo de la moneda configurada, no con el formato de un
                  país clavado a mano. */}
              {' '}{T('saldo')} <span className="bj-saldo">{window.UI.plata(saldo)}</span>
              {/* Lo retenido se dice, no se esconde: si el número baja sin
                  explicación, el jugador cree que le faltó plata. */}
              {retenido > 0 && (
                <span style={{
                  display: 'block', fontSize: 9, color: '#c9a227',
                  whiteSpace: 'nowrap', textAlign: 'right', lineHeight: 1.3,
                }}>
                  +{window.UI.plata(retenido)} {T('en revisión')}
                </span>
              )}
            </span>
          </span>
        </div>

        {/* La ficha en la mano mientras se la arrastra. Va por portal al body:
            el paño está escalado y un `position: fixed` adentro de algo
            transformado se acomoda respecto de ESO y no de la pantalla. */}
        {arrastre && ReactDOM.createPortal((
          <div style={{
            position: 'fixed', left: arrastre.x, top: arrastre.y,
            transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 10000,
            width: 40, height: 40, borderRadius: '50%',
            background: (fichaDe(arrastre.monto) || {}).cuerpo || '#b4101a',
            border: arrastre.destino != null ? '2px dashed rgba(255,255,255,.9)' : '3px solid #ff5252',
            color: '#fff', fontFamily: 'Georgia, serif', fontWeight: 900, fontSize: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 6px 14px rgba(0,0,0,.75)',
          }}>{arrastre.destino != null ? arrastre.monto : '✕'}</div>
        ), document.body)}

        {/* Los avisos van FUERA de la mesa: un error al entrar tiene que verse
            aunque el paño todavía no se haya dibujado. */}
        {aviso && (
          <div style={{
            margin: '2px 0 6px', padding: '8px 12px', borderRadius: 8, maxWidth: 420,
            background: 'rgba(180,16,26,0.15)', border: '1px solid #8a2b28',
            color: '#ffc9c9', fontSize: 12.5, textAlign: 'center', lineHeight: 1.5,
          }}>{aviso}</div>
        )}

        {/* La mesa como en el casino: el CRUPIER ENFRENTE —arriba, del otro
            lado del paño— y el jugador de este lado, con sus cartas, sus
            fichas y los botones al alcance de la mano. El canto redondeado y
            el arco acompañan: los dos abrazan el lado del jugador. */}
        <div className="bj-mesa">
          <div className="bj-paño">
            {/* El fichero de la casa, detrás del crupier: la bandeja de donde
                saca para pagar. Es adorno, pero sin ella el lado de enfrente
                queda vacío y la mesa no se cree. */}
            {/* Cada tubo YA ES el dibujo de una columna de fichas de canto
                (las rayas del fondo): no lleva fichas adentro. De la más
                chica a la más grande, como la ordena cualquier crupier. */}
            <div className="bj-fichero">
              {FICHAS.map((f) => (
                <div key={f.v} className="bj-tubo" title={`fichas de ${f.v}`}
                     style={{ '--cuerpo': f.cuerpo }} />
              ))}
            </div>

            <div className="bj-fila-crupier">
              <div className="bj-avatar">🎩</div>
              <div className="bj-quien">{T('CRUPIER')}</div>
            </div>

            {/* Las cartas del crupier y SU CUENTA al lado, a la derecha: es
                donde la mira el jugador —al lado de lo que está contando— y no
                arriba, separada de las cartas. Va más grande que la del
                jugador porque es la que manda la decisión de pedir o plantarse. */}
            <div className="bj-mano-crupier">
              {/* `data-n` otra vez: al crupier su cuenta le va AL LADO de las
                  cartas, así que una mano larga no le tapa el número — se lo
                  empuja afuera del paño y el paño lo recorta. Con cinco cartas
                  la fila mide 318 px en un paño de 309: la cuenta quedaba 122
                  px afuera y el jugador se quedaba sin saber qué llevaba el
                  crupier justo cuando más importa. */}
              <div className="bj-cartas"
                   data-n={enPaño && E.crupier ? ((E.crupier.cartas || []).length) : 0}>
                {(enPaño ? ((E.crupier && E.crupier.cartas) || []) : []).map((c, i) => (
                  <Carta key={'c' + i} carta={c} nueva={esNueva('c' + i)} />
                ))}
              </div>
              <div className="bj-cuenta bj-cuenta-crupier">
                {enPaño && E.crupier ? (
                  <>{E.crupier.total}{E.crupier.parcial ? <span className="bj-nota"> + ?</span> : null}</>
                ) : '—'}
              </div>
            </div>

            <BandaCentral
              pagoNatural={(E.mesa && E.mesa.pago_natural) || 1.5}
              minimo={minimo} maximo={maximo} />

            {/* La mesa en pruebas lo dice EN EL PAÑO. El que está probando
                juega con plata de verdad: tiene que saber en qué mesa está
                parado sin tener que acordarse. Va fuera de la banda porque no
                es una regla de la casa: es un cartel temporal. */}
            {/* Los DOS signos de admiración no sobran. `en_pruebas` es 0 o 1,
                y un 0 en React no desaparece: se dibuja. La mesa abierta venía
                escribiendo un "0" pegado al final del letrero, así que el tope
                de apuesta se leía "10–5000" en vez de "10–500". */}
            {!!(E.mesa && E.mesa.en_pruebas) && (
              <div className="bj-letrero">
                <span className="bj-en-pruebas">{T('MESA EN PRUEBAS · NO ABIERTA AL PÚBLICO')}</span>
              </div>
            )}

            <div className="bj-quien" style={{ marginBottom: 2 }}>
              {enPaño ? T('TU MANO') : T('TU APUESTA')}
            </div>

            <div className={'bj-puestos' + (enPaño ? ' bj-con-cartas' : '')}
                 data-juego={puestosEnJuego}>
              {Array.from({ length: puestos }, (_, p) => Columna(p))}
            </div>

            {/* Las fichas del jugador, de su lado: a mano, sin cruzar el paño.
                Con la mano terminada todavía sobre la mesa no se muestran:
                primero se recoge, después se apuesta. */}
            {!enPaño && (
              <div className="bj-fichas">
                {FICHAS.map((f) => (
                  <Ficha key={f.v} f={f} onClick={() => ponerFicha(f.v)}
                         disabled={ocupado || f.v > saldo - montoTotal()} />
                ))}
              </div>
            )}

            <div className={'bj-botones' + (jugando ? ' bj-jugada' : '')}>
              {jugando ? (
                // Ojo: PEDIR va con clase VACÍA —el botón dorado es el estilo
                // base—, así que no sirve `COLOR_ACCION[a] || …`: un vacío es
                // falso y lo pintaba de gris.
                ((E.acciones) || []).map((a) => (
                  <button key={a}
                          className={a in COLOR_ACCION ? COLOR_ACCION[a] : 'bj-gris'}
                          disabled={ocupado} onClick={() => jugar(a)}>
                    {TEXTO_ACCION()[a] || a.toUpperCase()}
                  </button>
                ))
              ) : mostrandoCierre ? (
                /* La mano terminó y sigue sobre el paño. Acá se recoge: OTRA
                   MANO deja la mesa limpia, REPETIR la deja limpia y vuelve a
                   poner la misma apuesta, que es lo que hace casi siempre el
                   que acaba de jugar. Sin estos botones la ficha de la mano
                   muerta se quedaba puesta para siempre. */
                <>
                  <button disabled={ocupado} onClick={() => barrer(true)}>
                    {T('REPETIR {n}', { n: apostadoAntes().reduce((a, b) => a + b, 0) })}
                  </button>
                  <button className="bj-gris" disabled={ocupado}
                          onClick={() => barrer(false)}>{T('OTRA MANO')}</button>
                </>
              ) : (
                <>
                  <button
                    disabled={ocupado || !abiertos.length || flojo !== undefined}
                    onClick={apostar}>
                    {!abiertos.length ? T('PONÉ AL MENOS {n}', { n: minimo })
                      : flojo !== undefined ? T('MÍNIMO {n} POR PUESTO', { n: minimo })
                      : abiertos.length > 1
                        ? T('APOSTAR {n} EN {p}', { n: montoTotal(), p: abiertos.length })
                        : T('APOSTAR {n}', { n: montoTotal() })}
                  </button>
                  {!!abiertos.length && (
                    <button className="bj-gris" disabled={ocupado}
                            onClick={() => setPilas([[], [], []])}>{T('LEVANTAR')}</button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  window.BlackjackScreen = BlackjackScreen;
  // La carta se expone para poder mirar la baraja entera sin jugar
  // (maquetas/cartas.html). No la usa el juego.
  window.CartaBlackjack = Carta;
  window.ESTILOS_BLACKJACK = ESTILOS;
})();
