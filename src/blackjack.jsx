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
/* La marca estampada en el fieltro, en la banda del arco — que es donde va
     en las mesas de verdad y es la única franja que nunca tapan las cartas.
     Va HUNDIDA, no escrita encima: el logo de una mesa está serigrafiado y
     casi no se ve, se nota cuando la luz le pega. De ahí el relieve (una luz
     arriba, una sombra abajo) y lo bajo de la opacidad: no compite con nada. */
  .bj-marca-paño{
    text-align:center; margin:0 0 3px; pointer-events:none;
    font-size:23px; letter-spacing:11px; font-weight:700; font-family:Georgia,serif;
    color:rgba(255,236,190,.13);
    text-shadow:0 1px 0 rgba(255,255,255,.07), 0 -1px 1px rgba(0,0,0,.35);
  }
/* El arco que separa la zona del crupier de la del jugador. Curva hacia
     ABAJO, abrazando el lado del jugador, que es el de acá: la mesa está
     como en el casino — el crupier enfrente, arriba, y uno de este lado. */
  .bj-arco{
    height:19px; margin:0 -13px 3px; pointer-events:none;
    border-bottom:2px solid rgba(255,238,200,.32);
    border-radius:0 0 50% 50% / 0 0 100% 100%;
    box-shadow:0 5px 0 -3px rgba(255,216,74,.14);
  }
/* La leyenda impresa en el paño: las reglas de la casa. No es adorno —
     son las dos que el jugador tiene que saber antes de sentarse, y salen
     de la ficha de la mesa, no escritas a mano. */
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
button{
    font-family:Georgia,serif; font-size:11.5px; letter-spacing:1.2px; font-weight:700;
    padding:11px 11px; border-radius:8px; cursor:pointer; color:#1a1206;
    background:linear-gradient(180deg,#ffe98a,#d4a017); border:1px solid #8a6a10;
    box-shadow:0 3px 0 #6d5410, 0 5px 12px rgba(0,0,0,.45);
  }
button:active{transform:translateY(2px); box-shadow:0 1px 0 #6d5410}
button[disabled]{opacity:.35; cursor:not-allowed; box-shadow:none; transform:none}
button.bj-gris{background:linear-gradient(180deg,#5c5c5c,#3a3a3a); color:#e8dcc0; border-color:#2a2a2a; box-shadow:0 3px 0 #222}
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
.bj-col .bj-carta .bj-idx{left:4px; top:3px}
.bj-col .bj-carta .bj-idx.bj-abajo{right:4px; bottom:3px}
.bj-col .bj-carta .bj-idx .bj-v{font-size:11px}
.bj-col .bj-carta .bj-idx .bj-p{font-size:8px}
.bj-col .bj-carta .bj-palo{font-size:25px}
.bj-col .bj-carta .bj-palo.bj-as{font-size:32px}
.bj-col .bj-carta.bj-tapada::after{inset:4px}
.bj-pie-col{min-height:30px; display:flex; flex-direction:column; align-items:center; gap:1px}
.bj-col .bj-cuenta{font-size:15px; padding:4px 10px; min-width:36px; border-radius:16px; margin-top:0}
.bj-col .bj-cuenta .bj-nota{font-size:8px}
.bj-col .bj-resultado{font-size:8.5px; letter-spacing:.5px}
.bj-circulo{
    width:58px; height:58px; border-radius:50%; position:relative; flex:none;
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
  const NOMBRE = { gana: 'GANASTE', pierde: 'PERDISTE', empate: 'EMPATE', natural: '¡BLACKJACK!' };
  const TEXTO_ACCION = { pedir: 'PEDIR', plantarse: 'PLANTARME', doblar: 'DOBLAR', dividir: 'DIVIDIR' };

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
    const saldo = E && E.balance != null ? E.balance : (user ? user.balance : 0);

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
            ? `Tu mano anterior había quedado abierta: se jugó sola y cobraste ${pago}.`
            : 'Tu mano anterior había quedado abierta y se jugó sola.');
        }
      } catch (err) {
        setAviso(err.message || 'No pude abrir la mesa');
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
        setAviso(err.message || 'No se pudo jugar');
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
        setAviso(err.message || 'No se pudo apostar');
      } finally { setOcupado(false); }
    };

    const ponerFicha = (v) => {
      if (ocupado || enPaño) return;
      if (montoDe(puestoActivo) + v > maximo) {
        setAviso(`El máximo por puesto en esta mesa es ${maximo}`);
        return;
      }
      if (montoTotal() + v > saldo) { setAviso('No te alcanza el saldo'); return; }
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

    // Retirar una ficha CORRIÉNDOLA fuera del círculo. Es el gesto que la mano
    // hace sola; el toque sigue funcionando igual para el que ya lo aprendió.
    // Sólo se toma el movimiento HORIZONTAL (y el círculo lleva `pan-y`): los
    // verticales quedan para desplazar la pantalla, que si no el jugador no
    // podría bajar con el dedo apoyado sobre su apuesta.
    const arrastreHecho = React.useRef(0);
    const arrastreDe = (p) => {
      if (ocupado || enPaño) return {};
      const empezar = (x0, y0, escuchar) => {
        let listo = false;
        const mover = (x, y) => {
          if (listo) return false;
          const dx = x - x0, dy = y - y0;
          if (Math.abs(dx) >= 26 && Math.abs(dx) > Math.abs(dy)) {
            listo = true;
            if (sacarFicha(p) && navigator.vibrate) navigator.vibrate(30);
            arrastreHecho.current = Date.now();
            return true;   // una sola ficha por arrastre
          }
          return false;
        };
        escuchar(mover);
      };
      return {
        onTouchStart: (e) => {
          const t = e.touches[0];
          empezar(t.clientX, t.clientY, (mover) => {
            const alMover = (ev) => { if (mover(ev.touches[0].clientX, ev.touches[0].clientY)) fin(); };
            const fin = () => {
              e.target.removeEventListener('touchmove', alMover);
              e.target.removeEventListener('touchend', fin);
            };
            e.target.addEventListener('touchmove', alMover);
            e.target.addEventListener('touchend', fin);
          });
        },
        onMouseDown: (e) => {
          if (e.button !== 0) return;
          empezar(e.clientX, e.clientY, (mover) => {
            const alMover = (ev) => { if (mover(ev.clientX, ev.clientY)) fin(); };
            const fin = () => {
              window.removeEventListener('mousemove', alMover);
              window.removeEventListener('mouseup', fin);
            };
            window.addEventListener('mousemove', alMover);
            window.addEventListener('mouseup', fin);
          });
        },
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
        setAviso('No te alcanza el saldo para repetir la misma apuesta.');
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
        }}>Abriendo la mesa…</div>
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
                <div className="bj-cartas">
                  {h.cartas.map((c, i) => (
                    <Carta key={`m${h.indice}-${i}`} carta={c} nueva={esNueva(`m${h.indice}-${i}`)} />
                  ))}
                </div>
                <div className="bj-pie-col">
                  <span className="bj-cuenta">
                    {h.total}{h.blando ? <span className="bj-nota"> blando</span> : null}
                  </span>
                  {manos.length > 1 && (
                    <span className="bj-apostado">${h.apuesta}</span>
                  )}
                  {h.resultado && (
                    <div className={'bj-resultado bj-' + h.resultado}>
                      {NOMBRE[h.resultado]}{h.pago ? ' +' + h.pago : ''}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {!manos.length && <div className="bj-cartas" />}

          <div className={'bj-circulo' + (editable ? ' bj-tocable' : '')}
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
              <div className="bj-rotulo">{p === puestoActivo ? 'ACÁ' : ''}</div>
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
                    onClick={onSalirAlSalon}>← SALÓN</button>
            {onOpenWallet && (
              <button className="bj-gris" style={{ padding: '6px 10px', fontSize: 11 }}
                      onClick={onOpenWallet}>CAJA</button>
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
              {' '}saldo <span className="bj-saldo">{Number(saldo).toLocaleString('es-VE')}</span>
            </span>
          </span>
        </div>

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
              <div>
                <div className="bj-quien">CRUPIER</div>
                <div className="bj-cuenta">
                  {enPaño && E.crupier ? (
                    <>{E.crupier.total}{E.crupier.parcial ? <span className="bj-nota"> + ?</span> : null}</>
                  ) : '—'}
                </div>
              </div>
            </div>

            <div className="bj-cartas">
              {(enPaño ? ((E.crupier && E.crupier.cartas) || []) : []).map((c, i) => (
                <Carta key={'c' + i} carta={c} nueva={esNueva('c' + i)} />
              ))}
            </div>

            <div className="bj-letrero">
              <b>EL BLACKJACK PAGA {(E.mesa && E.mesa.pago_natural) >= 1.5 ? '3 A 2' : '6 A 5'}</b>
              EL CRUPIER SE PLANTA EN 17 · APUESTA {minimo}–{maximo}
              {/* La mesa en pruebas lo dice EN EL PAÑO. El que está probando
                  juega con plata de verdad: tiene que saber en qué mesa está
                  parado sin tener que acordarse. */}
              {E.mesa && E.mesa.en_pruebas && (
                <span className="bj-en-pruebas">MESA EN PRUEBAS · NO ABIERTA AL PÚBLICO</span>
              )}
            </div>
            <div className="bj-marca-paño">VOLTIO</div>
            <div className="bj-arco" />

            <div className="bj-quien" style={{ marginBottom: 2 }}>
              {enPaño ? 'TU MANO' : 'TU APUESTA'}
            </div>

            <div className={'bj-puestos' + (enPaño ? ' bj-con-cartas' : '')}>
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

            <div className="bj-botones">
              {jugando ? (
                ((E.acciones) || []).map((a) => (
                  <button key={a} className={a === 'pedir' ? '' : 'bj-gris'}
                          disabled={ocupado} onClick={() => jugar(a)}>
                    {TEXTO_ACCION[a] || a.toUpperCase()}
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
                    REPETIR {apostadoAntes().reduce((a, b) => a + b, 0)}
                  </button>
                  <button className="bj-gris" disabled={ocupado}
                          onClick={() => barrer(false)}>OTRA MANO</button>
                </>
              ) : (
                <>
                  <button
                    disabled={ocupado || !abiertos.length || flojo !== undefined}
                    onClick={apostar}>
                    {!abiertos.length ? `PONÉ AL MENOS ${minimo}`
                      : flojo !== undefined ? `MÍNIMO ${minimo} POR PUESTO`
                      : `APOSTAR ${montoTotal()}${abiertos.length > 1 ? ' EN ' + abiertos.length : ''}`}
                  </button>
                  {!!abiertos.length && (
                    <button className="bj-gris" disabled={ocupado}
                            onClick={() => setPilas([[], [], []])}>LEVANTAR</button>
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
