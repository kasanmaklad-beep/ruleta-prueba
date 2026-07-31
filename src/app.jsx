// App principal — Ruleta Catatumbo
const { useState, useEffect, useRef, useMemo, useCallback } = React;

  // Si por lo que sea el diccionario no cargó (una copia vieja de index.html
  // guardada en el teléfono, por ejemplo), T() sigue existiendo y devuelve el
  // español. Una pantalla en español se lee; una pantalla en blanco por un
  // "T is not defined" no.
  const T = window.T || ((s) => s);

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "classic",
  "spinDuration": 7,
  "volume": 70,
  "lightningIntensity": 70,
  "autoSpin": false,
  "pruebaGiros": 0
}/*EDITMODE-END*/;

// ═══════════════════════════════════════════════════════════════
//  PUBLICIDAD — banner vertical bajo el botón GIRAR (columna móvil).
//  Para agregar o quitar avisos, editá este array. Rotan solos.
//  (Solo visual: no son enlaces.)
// ═══════════════════════════════════════════════════════════════
const ADS = [
  {
    id: 'catatumbo',
    title: 'CATATUMBO',
    color: '#ff0000',      // rojo puro
    glow: 'rgba(255,0,0,0.55)',
  },
];
const AD_ROTATE_MS = 6000;

// Tiempo con las apuestas abiertas y el cilindro ya girando (como en el casino)
const OPEN_BETS_MS = 6000;

// ── Tiempos de la ronda, después de que sale el número ────────────────────
// Es tiempo muerto: la mesa está cerrada y no se puede apostar. Antes eran
// 15s (5 en la rueda + 10 en el paño), que con el giro y la ventana de
// apuestas daban 28s por jugada. Se dejó el marcador de la rueda —que es el
// momento en que se ve dónde cayó la bola— y se recortó el del paño.
const HOLD_RUEDA_MS = 4000;   // el ganador señalado sobre la rueda
const HOLD_PANO_MS  = 5000;   // el ganador señalado sobre el paño
const ESPERA_RONDA_MS = HOLD_RUEDA_MS + HOLD_PANO_MS;   // 9s (antes 15s)

// Cuántos números ganadores se recuerdan. Con más no entran en la barra del
// celular y el jugador tampoco los mira.
const HISTORIAL_MAX = 10;

// ── La mesa que se está jugando ───────────────────────────────────────────
// La FICHA manda: qué rueda (y en qué orden), si las casillas llevan animales,
// si hay rayos y cuánto paga el pleno. Viene del servidor en /api/games, así
// que el paño, el cilindro y el sorteo hablan siempre del mismo catálogo.
// El id viaja además en cada giro, para separar la plata por mesa en los
// reportes. Cuál mesa se juega lo elige el jugador en el salón; esta constante
// es a dónde se entra cuando nadie eligió nada (…/juego a secas, un enlace
// viejo, o una mesa que se cerró).
const MESA_POR_DEFECTO = 'catatumbo';

// Respaldo mientras el catálogo no llegó (o si la llamada falla): la mesa
// insignia, que es la única encendida. Sin esto la pantalla quedaría en blanco
// por un problema de red.
const FICHA_CATATUMBO = {
  id: 'catatumbo',
  label: 'Catatumbo',
  ruedaLabel: 'Americana (0 y 00)',
  orden: window.AMERICAN_WHEEL_ORDER,
  casillas: 38,
  dobleCero: true,
  animales: true,
  rayos: true,
  pagoPleno: 29,
};

// De qué juego es una mesa. Las fichas viejas (antes de que existiera el
// blackjack) no traen `tipo`: esas son ruletas.
function esRuleta(m) {
  return !m || !m.tipo || m.tipo === 'ruleta';
}

// La ficha del servidor viene en snake_case; los componentes la usan en
// camelCase. Un solo lugar donde se traduce.
function fichaDeMesa(m) {
  if (!m) return null;
  return {
    id: m.id,
    label: m.label,
    ruedaLabel: m.rueda_label,
    orden: m.orden,
    casillas: m.casillas,
    dobleCero: !!m.doble_cero,
    animales: !!m.animales,
    rayos: !!m.rayos,
    pagoPleno: m.pago_pleno,
    activa: !!(m.activo || m.en_pruebas),
    enPruebas: !!m.en_pruebas,
  };
}

// Mesa pedida por la dirección (…/juego?mesa=europea). Es lo que escribe el
// salón al entrar a una mesa, y también sirve para compartir un enlace o
// probar una mesa nueva a mano. Vale solo para mesas ENCENDIDAS del catálogo:
// con una cerrada se cae a la de siempre, así nadie queda trabado en una mesa
// donde el servidor no lo dejaría jugar.
function mesaDelEnlace() {
  try {
    return (new URLSearchParams(window.location.search).get('mesa') || '').trim().toLowerCase();
  } catch (e) { return ''; }
}

// Estilos de sonido del giro que puede elegir el jugador (botón 🔊 en la cabecera)
const SPIN_SOUND_OPTIONS = [
  { value: 'clasico', label: 'Clásico', hint: 'Whoosh de aire (original)' },
  { value: 'madera', label: 'Madera', hint: 'Rodadura grave y cálida' },
  { value: 'casino', label: 'Casino', hint: 'Amplio, con cuerpo' },
  { value: 'suave', label: 'Suave', hint: 'Apenas un susurro' },
  { value: 'turbo', label: 'Turbo', hint: 'Agudo, sensación de velocidad' },
  { value: 'roce', label: 'Roce de bola', hint: 'El tono baja al frenar la rueda' },
  { value: 'silencio', label: 'Silencio', hint: 'Solo la bolita' },
];

const CHIP_VALUES = [1, 5, 25, 100, 500];
const STARTING_BALANCE = 1000;

function Chip({ value, selected, onClick, disabled, compact }) {
  const colors = {
    1: { base: '#fafafa', dark: '#a0a0a0', text: '#1a1a1a' },
    5: { base: '#d41a1a', dark: '#7a0a0a', text: '#fff' },
    25: { base: '#2a8a2a', dark: '#0a4a0a', text: '#fff' },
    100: { base: '#222', dark: '#000', text: '#fff' },
    500: { base: '#6a00a0', dark: '#3a0060', text: '#fff' },
  };
  const c = colors[value];
  const size = compact ? 44 : 62;
  const fontSize = compact ? 11 : 16;
  const innerInset = compact ? 5 : 8;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        position: 'relative',
        width: size,
        height: size,
        borderRadius: '50%',
        border: 'none',
        background: `radial-gradient(circle at 35% 30%, ${c.base} 0%, ${c.dark} 100%)`,
        color: c.text,
        fontWeight: 900,
        fontSize: fontSize,
        fontFamily: 'Georgia, serif',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transform: selected ? `translateY(${compact ? -8 : -12}px) scale(1.08)` : 'translateY(0)',
        transition: 'transform 0.2s, box-shadow 0.2s',
        boxShadow: selected
          ? `0 14px 24px rgba(0,0,0,0.6), 0 0 0 3px #ffd84a, inset 0 -4px 8px rgba(0,0,0,0.4), inset 0 4px 8px rgba(255,255,255,0.3)`
          : `0 6px 12px rgba(0,0,0,0.5), inset 0 -4px 8px rgba(0,0,0,0.4), inset 0 4px 8px rgba(255,255,255,0.3)`,
        opacity: disabled ? 0.4 : 1,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: innerInset,
          borderRadius: '50%',
          border: `${compact ? 1.5 : 2}px dashed ${c.text === '#fff' ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.3)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ${value}
      </div>
    </button>
  );
}

// ═══ Celebración visual cuando el jugador gana ═══
function WinCelebration({ amount, lightning, isMobile }) {
  const coins = useMemo(() => {
    const COUNT = 36;
    return Array.from({ length: COUNT }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 1.2,
      duration: 1.6 + Math.random() * 1.4,
      dx: (Math.random() - 0.5) * 120,
      size: 18 + Math.random() * 18,
      icon: lightning ? (Math.random() < 0.5 ? '⚡' : '★') : (Math.random() < 0.6 ? '🪙' : '★'),
      rot: Math.random() * 360,
    }));
  }, [lightning]);

  return (
    <div style={{
      position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 9999, overflow: 'hidden',
    }}>
      {/* Flash dorado */}
      <div style={{
        position: 'absolute', inset: 0,
        background: lightning
          ? 'radial-gradient(circle at 50% 40%, rgba(159,216,255,0.6), rgba(90,184,255,0) 60%)'
          : 'radial-gradient(circle at 50% 40%, rgba(255,216,74,0.55), rgba(255,170,0,0) 60%)',
        animation: 'screenFlash 0.9s ease-out forwards',
      }} />

      {/* Lluvia de monedas/estrellas */}
      {coins.map((c) => (
        <div
          key={c.id}
          style={{
            position: 'absolute',
            top: 0,
            left: `${c.left}%`,
            fontSize: c.size,
            color: lightning ? '#9fd8ff' : '#ffd84a',
            filter: `drop-shadow(0 0 6px ${lightning ? '#5ab8ff' : '#ffaa00'})`,
            animation: `coinFall ${c.duration}s cubic-bezier(0.4, 0.2, 0.6, 1) ${c.delay}s forwards`,
            ['--dx']: `${c.dx}px`,
            transform: `rotate(${c.rot}deg)`,
            willChange: 'transform, opacity',
          }}
        >
          {c.icon}
        </div>
      ))}

      {/* Banner ¡GANASTE! */}
      <div style={{
        position: 'absolute',
        left: '50%', top: '38%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        animation: 'winBannerPop 0.7s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
      }}>
        <div style={{
          fontFamily: 'Georgia, serif',
          fontSize: isMobile ? 36 : 64,
          fontWeight: 900,
          letterSpacing: isMobile ? 3 : 6,
          color: lightning ? '#fff' : '#fff5b0',
          textShadow: lightning
            ? '0 0 20px #5ab8ff, 0 0 40px #9fd8ff, 0 4px 8px rgba(0,0,0,0.8)'
            : '0 0 20px #ffd84a, 0 0 40px #ffaa00, 0 4px 8px rgba(0,0,0,0.8)',
          animation: 'winBannerGlow 1.2s ease-in-out infinite',
        }}>
          {lightning ? '⚡ LIGHTNING WIN ⚡' : '¡GANASTE!'}
        </div>
        <div style={{
          marginTop: isMobile ? 8 : 14,
          fontSize: isMobile ? 30 : 56,
          fontWeight: 900,
          color: lightning ? '#9fd8ff' : '#ffd84a',
          textShadow: '0 0 16px rgba(0,0,0,0.9), 0 4px 8px rgba(0,0,0,0.8)',
          letterSpacing: 2,
        }}>
          +${amount.toLocaleString()}
        </div>
      </div>
    </div>
  );
}

function RouletteApp({ user, config, mesa, onLogout, onOpenSalon, onOpenAdmin, onOpenCashier, onOpenWallet }) {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // La ficha de la mesa: de acá sale cómo se dibujan el cilindro y el paño.
  const ficha = mesa || FICHA_CATATUMBO;

  // Topes POR CASILLA del paño. Manda el servidor: esto es para frenar la
  // ficha al ponerla, en vez de rechazar la jugada con el cilindro girando.
  // El pleno lleva el suyo, más bajo: paga 29:1 y con Lightning hasta 500x.
  const maxCasilla = (config && config.max_bet_casilla) || 0;
  const maxPleno = (config && config.max_bet_pleno) || 0;
  const topeDe = useCallback(
    (tipo) => (tipo === 'straight' ? (maxPleno || maxCasilla) : maxCasilla),
    [maxCasilla, maxPleno]
  );

  // Estado del juego — el saldo es autoritativo del servidor (cae a STARTING_BALANCE solo sin sesión)
  const [balance, setBalance] = useState(user ? user.balance : STARTING_BALANCE);
  const [bets, setBets] = useState([]);
  const [lastBets, setLastBets] = useState([]);
  // Aviso corto que pisa al historial: si no, el jugador toca una ficha
  // rechazada y no ve ninguna explicación.
  const [aviso, setAviso] = useState('');
  const avisoRef = useRef(null);
  const [selectedChip, setSelectedChip] = useState(5);
  const [phase, setPhase] = useState('betting'); // 'betting' | 'lightning' | 'spinning' | 'result'
  const [resultIndex, setResultIndex] = useState(null);
  const [resultNum, setResultNum] = useState(null);
  const [history, setHistory] = useState([]); // últimos resultados
  const [lightningNumbers, setLightningNumbers] = useState(new Map());
  const [winAmount, setWinAmount] = useState(null);
  const [message, setMessage] = useState(T('Haz tu apuesta'));
  const [cameraZoom, setCameraZoom] = useState(false);
  const [lightningBolts, setLightningBolts] = useState([]); // efectos visuales
  const [winDetails, setWinDetails] = useState(null);
  // Resultado autoritativo del servidor para la ronda en curso (lo llena startSpin,
  // lo consume handleSpinEnd). Contiene { resultNum, win, anyLightning, winDetails, balance }.
  const serverSpinRef = useRef(null);
  // Apuestas al día: al cerrarse la ventana tomamos las últimas, incluidas
  // las que el jugador puso con la rueda ya girando.
  const betsRef = useRef([]);
  // Tras caer la bola mantenemos la rueda visible 5s con el número ganador marcado
  // (en móvil, si no, la vista saltaría al paño y no se llega a ver).
  const [holdWinner, setHoldWinner] = useState(false);
  // Sonido del giro elegido por el jugador (persistido en el navegador)
  const [spinSound, setSpinSound] = useState(() => {
    try { return localStorage.getItem('ruleta_spin_sound') || 'clasico'; } catch (e) { return 'clasico'; }
  });
  const [soundMenu, setSoundMenu] = useState(false);
  // Segundos restantes con las apuestas abiertas y la rueda ya girando
  const [betCountdown, setBetCountdown] = useState(0);

  // ── Modo prueba ──────────────────────────────────────────────────────────
  // Lleva la cuenta de los giros y de cómo evoluciona el saldo, para medir en
  // la práctica lo que dicen las tablas. Se enciende de dos formas: con
  // ?prueba=100 en la dirección, o desde el panel de la tuerca — que es lo
  // cómodo en el celular, donde escribir la dirección es un fastidio.
  // Apagado (0), no se dibuja nada: el jugador común nunca lo ve.
  const pruebaDeUrl = (() => {
    try {
      const n = Number(new URLSearchParams(window.location.search).get('prueba'));
      return Number.isFinite(n) && n > 0 ? Math.min(n, 10000) : 0;
    } catch (e) { return 0; }
  })();
  const pruebaTotal = Math.min(Number(t.pruebaGiros) || pruebaDeUrl || 0, 10000);
  const [prueba, setPrueba] = useState(null); // { giros, apostado, ganado, saldoInicial }
  // Voz que narra el número ganador (recordada en el navegador)
  const [voiceOn, setVoiceOn] = useState(() => {
    try { return localStorage.getItem('ruleta_voz') !== 'off'; } catch (e) { return true; }
  });
  // Publicidad rotativa del banner vertical (bajo GIRAR)
  const [adIndex, setAdIndex] = useState(0);
  useEffect(() => {
    if (ADS.length < 2) return;
    const iv = setInterval(() => setAdIndex((i) => (i + 1) % ADS.length), AD_ROTATE_MS);
    return () => clearInterval(iv);
  }, []);

  // Viewport / responsive
  const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const [vh, setVh] = useState(typeof window !== 'undefined' ? window.innerHeight : 768);
  useEffect(() => {
    const onR = () => { setVw(window.innerWidth); setVh(window.innerHeight); };
    window.addEventListener('resize', onR);
    window.addEventListener('orientationchange', onR);
    return () => {
      window.removeEventListener('resize', onR);
      window.removeEventListener('orientationchange', onR);
    };
  }, []);
  const isMobile = vw < 1280;
  // En móvil, mientras las apuestas están abiertas mostramos el cilindro en
  // chico y flotando, para que el jugador VEA la bolita girando sin perder
  // el paño de vista (el mini no intercepta los toques).
  const miniRueda = isMobile && phase === 'openbets';
  // Media luna: se ve solo el arco superior del cilindro (la pista de la bola
  // y los números), como una franja curva sobre el 0/00.
  const CRES_W = Math.min(vw - 12, 430);
  const CRES_H = 58;
  const cresScale = CRES_W / 520;   // el diámetro del cilindro ocupa todo el ancho
  // El cilindro vive en un marco fijo durante toda la tirada: primero asoma
  // como media luna y después BAJA hasta verse entero, sin cambiar de tamaño,
  // para que se perciba que es la misma ruleta.
  const ruedaFija = isMobile && (phase === 'openbets' || phase === 'spinning' || (phase === 'result' && holdWinner));
  const CRES_FULL_H = CRES_W;                                   // diámetro completo
  const cresTop = miniRueda ? 74 : Math.max(74, Math.round((vh - CRES_FULL_H) / 2));
  const wheelMaxSize = isMobile ? Math.min(vw - 24, 460) : 620;
  const wheelScale = wheelMaxSize / 620;
  const tableMaxW = isMobile ? vw - 24 : 810;
  const tableScale = Math.min(1, tableMaxW / 810);

  // Volume
  useEffect(() => {
    if (window.AudioEngine) window.AudioEngine.setVolume(t.volume / 100);
  }, [t.volume]);

  // Estilo de sonido del giro (cilindro) — elegible por el jugador y recordado
  useEffect(() => {
    if (window.AudioEngine && window.AudioEngine.setSpinStyle) {
      window.AudioEngine.setSpinStyle(spinSound);
    }
    try { localStorage.setItem('ruleta_spin_sound', spinSound); } catch (e) {}
  }, [spinSound]);

  // Voz del número ganador
  useEffect(() => {
    if (window.Voice) window.Voice.setEnabled(voiceOn);
    try { localStorage.setItem('ruleta_voz', voiceOn ? 'on' : 'off'); } catch (e) {}
  }, [voiceOn]);

  const totalBet = bets.reduce((s, b) => s + b.amount, 0);
  // Se puede apostar con la mesa abierta y también mientras el cilindro
  // gira, hasta que se canta "no más apuestas".
  const apuestasAbiertas = phase === 'betting' || phase === 'openbets';

  const avisar = useCallback((txt) => {
    setAviso(txt);
    clearTimeout(avisoRef.current);
    // Siete segundos: el aviso explica qué hacer, hay que dar tiempo a leerlo.
    avisoRef.current = setTimeout(() => setAviso(''), 7000);
  }, []);

  const placeBet = useCallback((bet) => {
    if (!apuestasAbiertas) return;
    if (bet.amount > balance) {
      avisar(T('Saldo insuficiente'));
      return;
    }
    // Tope por casilla: se frena acá, con la ficha en la mano. Cubrir otras
    // posiciones sigue permitido — lo que no se puede es cargar una sola.
    const tope = topeDe(bet.type);
    if (tope > 0) {
      const key = betKey(bet.type, bet.payload);
      const yaPuesto = bets.reduce(
        (s, b) => (betKey(b.type, b.payload) === key ? s + b.amount : s), 0);
      if (yaPuesto + bet.amount > tope) {
        const donde = bet.type === 'straight' ? 'pleno' : 'casilla';
        avisar(
          yaPuesto >= tope
            ? `Ese ${donde} ya está en el máximo ($${tope.toLocaleString()}). Probá en otro.`
            : `El máximo por ${donde} es $${tope.toLocaleString()}: ahí solo entran $${(tope - yaPuesto).toLocaleString()} más.`
        );
        return;
      }
    }
    setBalance((b) => b - bet.amount);
    setBets((bs) => [...bs, bet]);
  }, [apuestasAbiertas, balance, bets, topeDe, avisar]);

  // Mudar una ficha de una casilla a otra: se levanta la ÚLTIMA de la casilla
  // de origen y se apoya en la de destino, con el mismo monto. No es poner una
  // ficha nueva — el saldo no se toca, la plata ya estaba sobre el paño.
  //
  // Lo único que puede negarse es el tope del destino: si la casilla a la que
  // se la lleva ya está cargada, la ficha se queda donde estaba y se avisa.
  // Dejarla caer igual sería armar una apuesta que el servidor va a rechazar
  // al girar, y ahí el jugador ya no entiende qué pasó.
  const moveBet = useCallback((origen, destino) => {
    if (!apuestasAbiertas) return;
    const claveOrigen = betKey(origen.type, origen.payload);
    const claveDestino = betKey(destino.type, destino.payload);
    if (claveOrigen === claveDestino) return;

    const idx = [...bets].reverse().findIndex((b) => betKey(b.type, b.payload) === claveOrigen);
    if (idx === -1) return;
    const realIdx = bets.length - 1 - idx;
    const ficha = bets[realIdx];

    const tope = topeDe(destino.type);
    if (tope > 0) {
      const yaPuesto = bets.reduce(
        (acc, b, i) => (i !== realIdx && betKey(b.type, b.payload) === claveDestino ? acc + b.amount : acc), 0);
      if (yaPuesto + ficha.amount > tope) {
        const donde = destino.type === 'straight' ? 'pleno' : 'casilla';
        avisar(`El máximo por ${donde} es $${tope.toLocaleString()}: la ficha se queda donde estaba.`);
        return;
      }
    }

    setBets((bs) => bs.map((b, i) => (i === realIdx
      ? { type: destino.type, payload: destino.payload, numbers: destino.numbers, amount: b.amount }
      : b)));
  }, [apuestasAbiertas, bets, topeDe, avisar]);

  const removeBet = useCallback((type, payload) => {
    if (!apuestasAbiertas) return;
    setBets((bs) => {
      // Remueve la última ficha de ese tipo
      const key = betKey(type, payload);
      const idx = [...bs].reverse().findIndex((b) => betKey(b.type, b.payload) === key);
      if (idx === -1) return bs;
      const realIdx = bs.length - 1 - idx;
      const removed = bs[realIdx];
      setBalance((bal) => bal + removed.amount);
      return bs.filter((_, i) => i !== realIdx);
    });
  }, [apuestasAbiertas]);

  const clearBets = useCallback(() => {
    if (!apuestasAbiertas) return;
    setBalance((b) => b + totalBet);
    setBets([]);
  }, [apuestasAbiertas, totalBet]);


  // Los números Lightning NO se sortean acá: los manda el servidor en la
  // respuesta de /api/game/spin. Este archivo solo los dibuja.

  const spawnBolt = useCallback(() => {
    const id = Math.random();
    setLightningBolts((bs) => [...bs, { id, x: Math.random() * 100, seed: Math.random() }]);
    setTimeout(() => {
      setLightningBolts((bs) => bs.filter((b) => b.id !== id));
    }, 600);
  }, []);

  // Anima la fase Lightning + giro usando el resultado ya decidido por el servidor.
  const runSpinAnimation = useCallback((server) => {
    // Reconstruir el Map de Lightning con las mismas claves que la rueda (int o '00').
    const ltg = new Map((server.lightning || []).map(([n, m]) => [n === '00' ? '00' : Number(n), m]));
    const resultNum = server.resultNum === '00' ? '00' : Number(server.resultNum);

    // El giro arranca YA: los Lightning no se muestran de antemano, se van
    // encendiendo uno a uno mientras la bolita corre (efecto sorpresa).
    setLightningNumbers(new Map());
    setPhase('spinning');
    setCameraZoom(true);
    setMessage(T('¡No más apuestas!'));
    if (window.Voice) window.Voice.anunciarNoMasApuestas();
    setResultIndex(server.resultIndex);
    setResultNum(resultNum);

    // Revelado progresivo, repartido en la primera mitad del giro para que
    // todos estén a la vista bastante antes de que caiga la bola.
    const intensity = t.lightningIntensity / 100;
    const entradas = [...ltg.entries()];
    const spinMs = (t.spinDuration || 7) * 1000;
    const inicio = Math.min(1000, spinMs * 0.18);
    const ventana = Math.max(0, spinMs * 0.55 - inicio);
    const paso = entradas.length > 1 ? ventana / (entradas.length - 1) : 0;

    entradas.forEach(([n, m], i) => {
      setTimeout(() => {
        setLightningNumbers((prev) => {
          const next = new Map(prev);
          next.set(n, m);
          return next;
        });
        if (window.AudioEngine) window.AudioEngine.thunder(0.5 + intensity * 0.8);
        spawnBolt();
      }, inicio + i * paso);
    });
  }, [t.lightningIntensity, t.spinDuration, spawnBolt]);

  // Cierra la ventana de apuestas: recién acá se consulta al servidor, que
  // valida y descuenta TODO lo apostado (incluido lo puesto durante el giro),
  // sortea el número y calcula el premio.
  const cerrarApuestas = useCallback(() => {
    const finales = betsRef.current;
    if (!finales || finales.length === 0) {
      setPhase('betting');
      setMessage(T('Haz tu apuesta'));
      return;
    }
    setLastBets(finales.map(b => ({ ...b })));
    setMessage(T('¡No más apuestas!'));
    window.Api.spin(finales.map(b => ({ type: b.type, payload: b.payload, amount: b.amount })), ficha.id)
      .then((server) => {
        serverSpinRef.current = server;
        // OJO: `server.balance` ya trae el premio sumado — el servidor sortea y
        // acredita antes de que la bola caiga. Mostrarlo acá le cantaba al
        // jugador que había ganado con la rueda todavía girando. Durante el
        // giro se muestra el saldo con lo apostado descontado pero SIN el
        // premio; el premio entra en handleSpinEnd, cuando para la rueda.
        if (typeof server.balance === 'number') {
          const premio = typeof server.win === 'number' ? server.win : 0;
          setBalance(server.balance - premio);
        }
        // Modo prueba: se anota el giro con lo apostado y lo ganado.
        if (pruebaTotal > 0) {
          const stake = finales.reduce((s, b) => s + b.amount, 0);
          const win = typeof server.win === 'number' ? server.win : 0;
          setPrueba((p) => {
            // El saldo de partida se deduce del que informa el servidor: se le
            // devuelve lo apostado y se le quita lo ganado. Usar el saldo local
            // daba un número corrido, porque acá todavía es el de antes del giro.
            const base = p || {
              giros: 0, apostado: 0, ganado: 0,
              saldoInicial: (typeof server.balance === 'number' ? server.balance : 0) - win + stake,
            };
            return {
              ...base,
              giros: base.giros + 1,
              apostado: base.apostado + stake,
              ganado: base.ganado + win,
            };
          });
        }
        runSpinAnimation(server);
      })
      .catch((err) => {
        // Falló (saldo insuficiente / tope / red): volver a apostar y sincronizar
        // saldo. El sonido del giro hay que cortarlo a mano: el cilindro ya
        // estaba sonando y si no, queda sonando para siempre.
        if (window.AudioEngine) { try { window.AudioEngine.stopSpin(); } catch (e) {} }
        setPhase('betting');
        setMessage(err && err.message ? T(err.message) : T('No se pudo girar'));
        window.Api.me().then((d) => d && d.user && setBalance(d.user.balance)).catch(() => {});
      });
  }, [runSpinAnimation, ficha.id, pruebaTotal]);

  const startSpin = useCallback(() => {
    if (phase !== 'betting' || bets.length === 0) {
      avisar('Debes apostar primero');
      return;
    }
    // Red de seguridad: normalmente el tope ya se frenó al poner la ficha,
    // pero si alguna casilla quedó pasada no se arranca el cilindro para
    // terminar rechazando la jugada seis segundos después.
    if (maxCasilla > 0 || maxPleno > 0) {
      const porCasilla = new Map();
      for (const b of bets) {
        const k = betKey(b.type, b.payload);
        const prev = porCasilla.get(k) || { monto: 0, type: b.type };
        prev.monto += b.amount;
        porCasilla.set(k, prev);
      }
      for (const [, c] of porCasilla) {
        const tope = topeDe(c.type);
        if (tope > 0 && c.monto > tope) {
          const donde = c.type === 'straight' ? 'un pleno' : 'una casilla';
          avisar(`Hay ${donde} con $${c.monto.toLocaleString()} y el máximo es $${tope.toLocaleString()}. Sacá fichas de ahí.`);
          return;
        }
      }
    }
    // El cilindro arranca YA, en giro libre y sin resultado: las apuestas
    // siguen abiertas unos segundos, como en una mesa real.
    serverSpinRef.current = null;
    setLightningNumbers(new Map());
    setResultIndex(null);
    setResultNum(null);
    setCameraZoom(false);
    setPhase('openbets');
    setBetCountdown(Math.round(OPEN_BETS_MS / 1000));
  }, [phase, bets, maxCasilla, maxPleno, topeDe, avisar]);

  // Mantener betsRef al día para poder cerrar con las apuestas más recientes
  useEffect(() => { betsRef.current = bets; }, [bets]);

  // Cuenta regresiva de la ventana de apuestas
  useEffect(() => {
    if (phase !== 'openbets') return;
    const t0 = Date.now();
    const iv = setInterval(() => {
      const restante = Math.max(0, OPEN_BETS_MS - (Date.now() - t0));
      const seg = Math.ceil(restante / 1000);
      setBetCountdown(seg);
      setMessage(T('⏳ APUESTAS ABIERTAS · {seg}', { seg }));
      if (restante <= 0) { clearInterval(iv); cerrarApuestas(); }
    }, 200);
    return () => clearInterval(iv);
  }, [phase, cerrarApuestas]);

  // GIRAR de doble función:
  // - Hay apuestas en mesa → gira la ruleta
  // - Sin apuestas pero sí lastBets → solo repite las apuestas (no gira)
  //   El jugador puede luego añadir más apuestas a su gusto y volver a tocar GIRAR para arrancar.
  // - Sin nada → muestra aviso
  const handleSpinClick = useCallback(() => {
    if (phase !== 'betting') return;
    if (bets.length > 0) {
      startSpin();
      return;
    }
    if (lastBets.length === 0) {
      setMessage(T('Debes apostar primero'));
      return;
    }
    // Repetir apuestas (sin girar) — el jugador decide cuándo girar
    const total = lastBets.reduce((s, b) => s + b.amount, 0);
    if (total > balance) { setMessage(T('Saldo insuficiente para repetir')); return; }
    setBalance((b) => b - total);
    setBets(lastBets.map(b => ({ ...b })));
    if (window.AudioEngine) window.AudioEngine.chip();
  }, [phase, bets, lastBets, balance, startSpin]);

  const handleSpinEnd = useCallback(() => {
    setCameraZoom(false);
    setPhase('result');
    // La rueda queda con el ganador señalado antes de volver al paño
    setHoldWinner(true);
    setTimeout(() => setHoldWinner(false), HOLD_RUEDA_MS);

    // El premio ya fue calculado y acreditado por el servidor en /api/game/spin.
    const server = serverSpinRef.current || {};
    const total = typeof server.win === 'number' ? server.win : 0;
    const anyLightning = !!server.anyLightning;

    setWinAmount(total);
    setWinDetails(server.winDetails || null);
    if (typeof server.balance === 'number') setBalance(server.balance);

    setHistory((h) => [{ n: resultNum, color: numColor(resultNum), lightning: anyLightning }, ...h].slice(0, HISTORIAL_MAX));

    // Voz: "Número ganador: catorce, Paloma" (+ el premio si ganó). En una mesa
    // sin animales canta solo el número: ahí la Paloma no existe.
    if (window.Voice) {
      const animal = ficha.animales ? (window.ANIMALS || {})[resultNum] : null;
      window.Voice.anunciarGanador(resultNum, animal ? animal[1] : null, animal ? animal[2] : null);
      if (total > 0) setTimeout(() => window.Voice.anunciarPremio(total), 1400);
    }

    if (total > 0) {
      if (window.AudioEngine) window.AudioEngine.win(total >= 500 || anyLightning);
      // Si el premio tocó el techo por giro, se avisa para que no parezca un error.
      const tope = server.capped
        ? T(' (tope máximo por giro; el premio completo era {n})',
            { n: window.UI.plata(server.grossWin) })
        : '';
      setMessage(
        (anyLightning
          ? T('⚡ ¡LIGHTNING WIN! {n} ⚡', { n: window.UI.plata(total) })
          : T('¡Ganaste {n}!', { n: window.UI.plata(total) })) + tope
      );
    } else {
      if (window.AudioEngine) window.AudioEngine.lose();
      // El número y el animal ya se ven grandes al lado: el texto no los repite.
      setMessage(T('Sin ganancias esta vez'));
    }

    // Siguiente ronda
    setTimeout(() => {
      setPhase('betting');
      setBets([]);
      setResultIndex(null);
      setResultNum(null);
      setLightningNumbers(new Map());
      setWinAmount(null);
      setWinDetails(null);
      setMessage(T('Haz tu apuesta'));
    }, ESPERA_RONDA_MS);
  }, [resultNum, ficha.animales]);

  // Auto-spin
  useEffect(() => {
    if (!t.autoSpin) return;
    if (phase === 'betting' && lastBets.length > 0 && balance >= lastBets.reduce((s, b) => s + b.amount, 0)) {
      const timer = setTimeout(() => {
        // Repetir apuestas anteriores
        const total = lastBets.reduce((s, b) => s + b.amount, 0);
        setBalance((b) => b - total);
        setBets(lastBets.map(b => ({ ...b })));
        setTimeout(() => {
          // Forzar spin
          document.getElementById('spin-btn')?.click();
        }, 800);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [t.autoSpin, phase, lastBets, balance]);

  // Theme background
  const bgByTheme = {
    classic: 'radial-gradient(ellipse at center, #3a1f08 0%, #1a0d02 60%, #050200 100%)',
    modern: 'radial-gradient(ellipse at center, #1a1a1a 0%, #0a0a0a 60%, #000 100%)',
    lightning: 'radial-gradient(ellipse at center, #1a0a4a 0%, #0a0420 60%, #02010a 100%)',
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: bgByTheme[t.theme] || bgByTheme.classic,
        color: '#fff',
        fontFamily: 'Georgia, serif',
        padding: isMobile ? '2px 0 4px' : '16px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: isMobile ? 2 : 16,
        overflow: isMobile ? 'visible' : 'hidden',
        position: 'relative',
      }}
    >
      {/* Efectos de rayos (overlay) */}
      {lightningBolts.map((b) => (
        <LightningBolt key={b.id} seed={b.seed} theme={t.theme} />
      ))}

      {/* ═══ Celebración de victoria ═══ */}
      {phase === 'result' && winAmount > 0 && (
        <WinCelebration amount={winAmount} lightning={winDetails && winDetails.isLightningHit} isMobile={isMobile} />
      )}

      {/* HEADER */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${t.theme === 'lightning' ? '#2a4a8a' : '#8b6a20'}`,
          padding: isMobile ? '2px 6px 4px' : '0 0 12px',
          gap: 8,
        }}
      >
        <div style={{ minWidth: 0, flexShrink: 1, overflow: 'hidden' }}>
          <div style={{
            fontSize: isMobile ? 11 : 28, fontWeight: 900, letterSpacing: isMobile ? 0.5 : 4,
            color: t.theme === 'lightning' ? '#9fd8ff' : '#d4a94a',
            textShadow: t.theme === 'lightning'
              ? '0 0 20px #5ab8ff, 0 2px 4px rgba(0,0,0,0.8)'
              : '0 2px 4px rgba(0,0,0,0.8)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {isMobile
              ? `⚡ ${ficha.label.toUpperCase()}`
              : `⚡ ${ficha.label.toUpperCase()} ⚡`}
          </div>
          {!isMobile && (
            <div style={{ fontSize: 11, letterSpacing: 3, color: '#888', marginTop: 2 }}>
              {[
                (ficha.ruedaLabel || '').toUpperCase(),
                ficha.animales ? `${ficha.casillas} ANIMALES` : null,
                ficha.rayos
                  ? 'MULTIPLICADORES HASTA 500x'
                  : `PLENO PAGA ${ficha.pagoPleno} A 1`,
              ].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: isMobile ? 10 : 24, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: isMobile ? 8 : 10, letterSpacing: isMobile ? 1 : 2, color: '#888' }}>{T('APUESTA')}</div>
            <div style={{ fontSize: isMobile ? 12 : 22, fontWeight: 900, color: '#ffd84a' }}>${totalBet.toLocaleString()}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: isMobile ? 8 : 10, letterSpacing: isMobile ? 1 : 2, color: '#888' }}>{T('SALDO')}</div>
            <div style={{ fontSize: isMobile ? 14 : 26, fontWeight: 900, color: '#fff' }}>${balance.toLocaleString()}</div>
          </div>
          {/* Sonido del giro */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setSoundMenu((v) => !v)}
              title="Sonido del giro"
              style={{
                padding: isMobile ? '3px 7px' : '6px 11px', borderRadius: 4,
                border: `1px solid ${soundMenu ? '#d4a94a' : '#555'}`,
                background: 'rgba(0,0,0,0.4)', color: '#d4a94a',
                fontSize: isMobile ? 12 : 15, cursor: 'pointer', lineHeight: 1,
              }}
            >{spinSound === 'silencio' ? '🔇' : '🔊'}</button>
            {soundMenu && (
              <>
                <div onClick={() => setSoundMenu(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
                <div style={{
                  position: 'absolute', right: 0, top: '110%', zIndex: 999,
                  background: 'linear-gradient(180deg, #2a1a08, #140a02)',
                  border: '1px solid #8b6a20', borderRadius: 8, padding: 8,
                  boxShadow: '0 10px 30px rgba(0,0,0,0.8)', minWidth: 190,
                }}>
                  <div style={{ fontSize: 9, letterSpacing: 2, color: '#888', padding: '2px 6px 6px' }}>
                    SONIDO DEL GIRO
                  </div>
                  {SPIN_SOUND_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      onClick={() => {
                        setSpinSound(o.value);
                        if (window.AudioEngine && window.AudioEngine.previewSpin) window.AudioEngine.previewSpin(o.value);
                      }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        padding: '7px 8px', marginBottom: 2, borderRadius: 5,
                        border: 'none', cursor: 'pointer', fontFamily: 'Georgia, serif',
                        background: spinSound === o.value ? 'rgba(212,169,74,0.22)' : 'transparent',
                        color: spinSound === o.value ? '#ffd84a' : '#ddd',
                      }}
                    >
                      <div style={{ fontSize: 13, fontWeight: 700 }}>
                        {spinSound === o.value ? '✓ ' : ''}{o.label}
                      </div>
                      <div style={{ fontSize: 10, color: '#999' }}>{o.hint}</div>
                    </button>
                  ))}
                  <div style={{ fontSize: 9, color: '#777', padding: '4px 6px 6px' }}>
                    Tocá una opción para escucharla
                  </div>
                  {/* Voz del número ganador */}
                  <div style={{ borderTop: '1px solid #4a3a18', paddingTop: 8, marginTop: 2 }}>
                    <button
                      onClick={() => {
                        const nuevo = !voiceOn;
                        setVoiceOn(nuevo);
                        if (nuevo && window.Voice) {
                          window.Voice.setEnabled(true);
                          window.Voice.anunciarGanador(14, 'PALOMA', 'la');
                        }
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                        padding: '7px 8px', borderRadius: 5, border: 'none', cursor: 'pointer',
                        fontFamily: 'Georgia, serif', textAlign: 'left',
                        background: voiceOn ? 'rgba(212,169,74,0.22)' : 'transparent',
                        color: voiceOn ? '#ffd84a' : '#ddd',
                      }}
                    >
                      <span style={{ fontSize: 14 }}>{voiceOn ? '🗣️' : '🤐'}</span>
                      <span>
                        <div style={{ fontSize: 13, fontWeight: 700 }}>
                          Voz {voiceOn ? 'activada' : 'desactivada'}
                        </div>
                        <div style={{ fontSize: 10, color: '#999' }}>Canta el número ganador</div>
                      </span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          {(onOpenAdmin || onOpenCashier || onOpenWallet || onLogout) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
              {user && (
                <div style={{ fontSize: isMobile ? 8 : 10, color: '#888', letterSpacing: 1, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {user.username}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6 }}>
                {onOpenSalon && (
                  <button onClick={onOpenSalon} style={{
                    padding: isMobile ? '2px 6px' : '5px 10px', borderRadius: 4,
                    border: '1px solid #8b6a20', background: 'rgba(0,0,0,0.4)', color: '#ffd84a',
                    fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: isMobile ? 8 : 11,
                    letterSpacing: 1, cursor: 'pointer',
                  }}>{T('SALÓN')}</button>
                )}
                {onOpenWallet && (
                  <button onClick={onOpenWallet} style={{
                    padding: isMobile ? '2px 6px' : '5px 10px', borderRadius: 4,
                    border: '1px solid #2a8a2a', background: 'rgba(42,138,42,0.25)', color: '#9ff0a0',
                    fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: isMobile ? 8 : 11,
                    letterSpacing: 1, cursor: 'pointer',
                  }}>{T('CAJA')}</button>
                )}
                {onOpenCashier && (
                  <button onClick={onOpenCashier} style={{
                    padding: isMobile ? '2px 6px' : '5px 10px', borderRadius: 4,
                    border: '1px solid #8b6a20', background: 'rgba(0,0,0,0.4)', color: '#d4a94a',
                    fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: isMobile ? 8 : 11,
                    letterSpacing: 1, cursor: 'pointer',
                  }}>TAQUILLA</button>
                )}
                {onOpenAdmin && (
                  <button onClick={onOpenAdmin} style={{
                    padding: isMobile ? '2px 6px' : '5px 10px', borderRadius: 4,
                    border: '1px solid #8b6a20', background: 'rgba(0,0,0,0.4)', color: '#d4a94a',
                    fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: isMobile ? 8 : 11,
                    letterSpacing: 1, cursor: 'pointer',
                  }}>ADMIN</button>
                )}
                {onLogout && (
                  <button onClick={onLogout} style={{
                    padding: isMobile ? '2px 6px' : '5px 10px', borderRadius: 4,
                    border: '1px solid #555', background: 'rgba(0,0,0,0.4)', color: '#aaa',
                    fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: isMobile ? 8 : 11,
                    letterSpacing: 1, cursor: 'pointer',
                  }}>{T('SALIR')}</button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Marcador del modo prueba (?prueba=100). No aparece sin el parámetro. */}
      {pruebaTotal > 0 && <MarcadorPrueba total={pruebaTotal} p={prueba} saldo={balance} isMobile={isMobile} />}

      {/* Mensaje/estado — durante betting muestra el historial de números salidos */}
      <div
        style={{
          textAlign: 'center',
          padding: isMobile ? '3px 6px' : '14px 16px',
          borderRadius: isMobile ? 0 : 6,
          margin: isMobile ? '0 4px' : 0,
          background: phase === 'lightning'
            ? 'linear-gradient(90deg, rgba(90,184,255,0.2), rgba(159,216,255,0.3), rgba(90,184,255,0.2))'
            : winAmount > 0
              ? 'linear-gradient(90deg, rgba(255,216,74,0.15), rgba(255,216,74,0.3), rgba(255,216,74,0.15))'
              : 'rgba(0,0,0,0.35)',
          border: `1px solid ${t.theme === 'lightning' ? '#2a4a8a' : '#8b6a20'}`,
          fontSize: isMobile ? 11 : 18,
          fontWeight: 800,
          letterSpacing: 1,
          color: phase === 'lightning' ? '#9fd8ff' : winAmount > 0 ? '#ffd84a' : '#fff',
          textShadow: phase === 'lightning' ? '0 0 12px #5ab8ff' : winAmount > 0 ? '0 0 10px #ffd84a' : 'none',
          // Al mostrar el ganador la barra crece: el número y el animal van grandes.
          minHeight: phase === 'result' ? (isMobile ? 78 : 112) : (isMobile ? 28 : 54),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          flexWrap: 'wrap',
          animation: phase === 'lightning' ? 'pulseBar 0.6s ease-in-out infinite alternate' : 'none',
        }}
      >
        {aviso ? (
          <span style={{ color: '#ff9a9a' }}>{aviso}</span>
        ) : phase === 'betting' ? (
          history.length > 0 ? (
            <>
              <span style={{ fontSize: isMobile ? 8 : 10, letterSpacing: 2, color: '#888', marginRight: 4 }}>HIST.</span>
              {history.map((h, i) => (
                <div key={i} style={{
                  width: isMobile ? 26 : 34, height: isMobile ? 26 : 34, borderRadius: '50%',
                  background: h.color === 'red' ? '#b8101a' : h.color === 'black' ? '#151515' : '#0d7a2e',
                  border: h.lightning ? `2px solid ${t.theme === 'lightning' ? '#9fd8ff' : '#ffd84a'}` : '1px solid #666',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: isMobile ? 13 : 15, fontWeight: 900, color: '#fff',
                  boxShadow: h.lightning ? `0 0 8px ${t.theme === 'lightning' ? '#5ab8ff' : '#ffd84a'}` : 'none',
                  opacity: Math.max(0.4, 1 - i * 0.07),
                  flexShrink: 0,
                }}>{h.n}</div>
              ))}
            </>
          ) : (
            <span>{message}</span>
          )
        ) : phase === 'result' && resultNum != null ? (
          <GanadorGrande
            n={resultNum}
            color={numColor(resultNum)}
            mensaje={message}
            gano={winAmount > 0}
            isMobile={isMobile}
            conAnimales={ficha.animales}
          />
        ) : (
          <span>{message}</span>
        )}
      </div>

      {/* Lightning numbers indicator — siempre visible */}
      {lightningNumbers.size > 0 && (
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center',
          padding: '8px 12px',
          background: 'rgba(0,0,0,0.4)',
          border: `1px solid ${t.theme === 'lightning' ? '#5ab8ff' : '#ffd84a'}`,
          borderRadius: 4,
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 10, letterSpacing: 2, color: '#888' }}>LIGHTNING:</span>
          {[...lightningNumbers.entries()].map(([n, m]) => (
            <div key={n} style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '3px 8px',
              background: numColor(n) === 'red' ? '#b8101a' : numColor(n) === 'black' ? '#151515' : '#0d7a2e',
              borderRadius: 3,
              border: `1.5px solid ${t.theme === 'lightning' ? '#9fd8ff' : '#ffd84a'}`,
              boxShadow: `0 0 10px ${t.theme === 'lightning' ? '#5ab8ff' : '#ffd84a'}`,
            }}>
              <span style={{ fontWeight: 900, fontSize: isMobile ? 12 : 14 }}>{n}</span>
              <span style={{ color: t.theme === 'lightning' ? '#9fd8ff' : '#ffd84a', fontWeight: 900, fontSize: isMobile ? 11 : 13 }}>
                ⚡{m}x
              </span>
            </div>
          ))}
        </div>
      )}

      {/* MAIN AREA: wheel + betting */}
      <div style={{
        display: isMobile ? 'flex' : 'grid',
        flexDirection: 'column',
        gridTemplateColumns: isMobile ? undefined : '620px 1fr',
        gap: isMobile ? 12 : 24,
        alignItems: isMobile ? 'stretch' : 'start',
      }}>
        {/* LEFT: Wheel + history — en móvil solo durante lightning/spinning (oculto pero montado para preservar estado) */}
        {(
          <div style={{
            display: (!isMobile || miniRueda || phase === 'spinning' || (phase === 'result' && holdWinner)) ? 'flex' : 'none',
            flexDirection: 'column', alignItems: 'center', gap: isMobile ? 10 : 16,
            // En móvil, durante el giro (y los 5s de marcador) la rueda es lo único
            // en pantalla: ocupamos el alto disponible y la centramos.
            // Marco fijo del cilindro en móvil: de media luna a rueda completa.
            // Solo cambian la altura de la "ventana" y su posición, así que el
            // cilindro parece bajar hasta mostrarse entero (mismo tamaño siempre).
            ...(ruedaFija ? {
              position: 'fixed',
              top: cresTop,
              left: '50%',
              marginLeft: -CRES_W / 2,
              width: CRES_W,
              height: miniRueda ? CRES_H : CRES_FULL_H,
              zIndex: 60,
              gap: 0,
              pointerEvents: 'none',
              overflow: 'hidden',
              borderRadius: miniRueda ? '0 0 14px 14px' : '50%',
              borderBottom: miniRueda ? '2px solid rgba(212,169,74,0.8)' : 'none',
              boxShadow: miniRueda ? '0 8px 22px rgba(0,0,0,0.8)' : '0 18px 44px rgba(0,0,0,0.85)',
              // Descenso lento y con suspenso: arranca despacio, toma cuerpo y
              // se asienta con calma (la bola recién cae a los ~7s, hay margen).
              transition: 'top 2100ms cubic-bezier(.42,.02,.28,1), height 2100ms cubic-bezier(.42,.02,.28,1), border-radius 1600ms ease-in-out',
            } : {}),
          }}>
            <div style={{
              width: ruedaFija ? CRES_W : wheelMaxSize,
              height: ruedaFija ? '100%' : wheelMaxSize,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
              overflow: ruedaFija ? 'hidden' : 'visible',
            }}>
              <div style={{
                width: 620, height: 620,
                transform: `scale(${ruedaFija ? cresScale : wheelScale})`,
                // Anclado ABAJO: la rueda "cuelga" del borde inferior de la
                // ventana. Al crecer la ventana se va descubriendo entera.
                transformOrigin: ruedaFija ? 'bottom center' : 'center center',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'absolute',
                left: '50%',
                marginLeft: -310,
                ...(ruedaFija
                  // El root de la rueda (520) está 50px dentro del box de 620:
                  // bajamos ese offset para que su borde inferior quede al ras.
                  ? { bottom: -50 * cresScale, top: 'auto', marginTop: 0 }
                  : { top: '50%', marginTop: -310 }),
              }}>
                <RouletteWheel
                  orden={ficha.orden}
                  nombre={ficha.label}
                  spinning={phase === 'spinning'}
                  freeSpin={phase === 'openbets'}
                  resultIndex={phase === 'spinning' || phase === 'result' ? resultIndex : null}
                  onSpinEnd={handleSpinEnd}
                  spinDuration={t.spinDuration}
                  theme={t.theme}
                  lightningNumbers={lightningNumbers}
                  lightningIntensity={t.lightningIntensity / 100}
                  // En el celular el cilindro vive dentro de un marco que lo
                  // recorta, y ese marco mide justo el diámetro de la rueda.
                  // Con el zoom de cámara la pista de la bola —que corre por
                  // el borde— quedaba FUERA del recorte: la bolita se perdía
                  // durante todo el giro y reaparecía recién al caer hacia el
                  // número. Acá el zoom no hace falta: la rueda ya crece sola
                  // de media luna a rueda entera.
                  zoomed={cameraZoom && !ruedaFija}
                  // La rueda se dibuja a 520 y en el celular se achica: si la
                  // bola no se agranda en la misma proporción, en pantalla
                  // queda de 10 píxeles y no se sigue con la vista.
                  bolaPx={ruedaFija ? Math.round(14 / cresScale) : 14}
                />
              </div>
            </div>

            {/* History — se oculta en el mini-cilindro flotante (no cabe) */}
            <div style={{ display: ruedaFija ? 'none' : 'flex', gap: 6, width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: '#888', alignSelf: 'center', marginRight: 8 }}>HISTORIAL</div>
              {history.length === 0 && <div style={{ color: '#555', fontSize: 12, fontStyle: 'italic' }}>Aún no hay giros</div>}
              {history.map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: isMobile ? 32 : 34, height: isMobile ? 32 : 34, borderRadius: '50%',
                    background: h.color === 'red' ? '#b8101a' : h.color === 'black' ? '#151515' : '#0d7a2e',
                    border: h.lightning ? `2px solid ${t.theme === 'lightning' ? '#9fd8ff' : '#ffd84a'}` : '1px solid #666',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: isMobile ? 15 : 15, fontWeight: 900, color: '#fff',
                    boxShadow: h.lightning ? `0 0 8px ${t.theme === 'lightning' ? '#5ab8ff' : '#ffd84a'}` : 'none',
                    opacity: 1 - i * 0.05,
                  }}
                >
                  {h.n}
                </div>
              ))}
            </div>

            {/* En móvil durante el giro: botón discreto para ver el paño */}
            {isMobile && phase === 'result' && (
              <div style={{ fontSize: 10, color: '#666', letterSpacing: 1 }}>
                Próxima ronda iniciando…
              </div>
            )}
          </div>
        )}

        {/* RIGHT: betting table + controls — en móvil durante apuestas y resultado */}
        {(!isMobile || phase === 'betting' || phase === 'openbets' || (phase === 'result' && !holdWinner)) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: isMobile ? 10 : 12, minWidth: 0 }}>
            {/* Mesa: en móvil rotada 90° (vertical) con fichas en columna a la izquierda */}
            {(() => {
              // Dimensiones naturales del wrapper de BettingTable (incluye padding + border)
              // TOTAL_W (778) + 16 = 794 ; TOTAL_H + OUTER_H*2 (356) + 16 = 372
              const NATURAL_W = 794;
              const NATURAL_H = 372;
              if (!isMobile) {
                return (
                  <div style={{
                    width: NATURAL_W,
                    height: NATURAL_H,
                    margin: '0 auto',
                    position: 'relative',
                  }}>
                    <BettingTable
                      mesa={ficha}
                      bets={bets}
                      onPlaceBet={placeBet}
                      onRemoveBet={removeBet}
                      onMoveBet={moveBet}
                      selectedChip={selectedChip}
                      disabled={!apuestasAbiertas}
                      theme={t.theme}
                      lightningNumbers={lightningNumbers}
                      rotateLabels={false}
                      winningNumber={phase === 'result' ? resultNum : null}
                    />
                  </div>
                );
              }
              // Móvil: fichas verticales a la izquierda + paño rotado 90° a la derecha
              // FULL SCREEN: usa el 100% del ancho/alto con escalado NO-UNIFORME
              // (estiramos x e y por separado para llenar exacto, sin huecos laterales)
              const CHIP_COL_W = 56; // ancho de la columna de fichas
              const GAP = 2;
              // Espacio disponible horizontal: ancho total - columna fichas - gap
              const availableForTableWidth = vw - CHIP_COL_W - GAP;
              // Espacio disponible vertical: alto - header (~32) - mensaje (~32) - margen
              const availableForTableHeight = vh - 80;
              // Calculamos escalas independientes por eje:
              // - sByW: escala que el ancho de la fuente (NATURAL_H, eje Y rotado→X pantalla) necesita para llenar el ancho disponible
              // - sByH: escala que el alto de la fuente (NATURAL_W, eje X rotado→Y pantalla) necesita para llenar el alto disponible
              const sByW = availableForTableWidth / NATURAL_H;
              const sByH = availableForTableHeight / NATURAL_W;
              // Escalas no-uniformes aplicadas en ejes de la fuente (antes del rotate)
              const scaleX = sByH; // fuente X → pantalla Y → debe ajustarse al alto disponible
              const scaleY = sByW; // fuente Y → pantalla X → debe ajustarse al ancho disponible
              const finalW = availableForTableWidth;
              const finalH = availableForTableHeight;
              return (
                <div style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'flex-start',
                  justifyContent: 'flex-start',
                  gap: GAP,
                  padding: 0,
                  overflow: 'visible',
                  width: '100%',
                }}>
                  {/* Columna izquierda: fichas + botones (LIMPIAR / REPETIR / GIRAR) */}
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 19,
                    alignItems: 'center',
                    padding: '8px 4px',
                    background: 'linear-gradient(180deg, #2a1a08, #1a0d02)',
                    borderRadius: '0 6px 6px 0', // sin redondeo en el borde izquierdo (pegado a pantalla)
                    border: `1px solid ${t.theme === 'lightning' ? '#2a4a8a' : '#8b6a20'}`,
                    borderLeft: 'none',
                    alignSelf: 'stretch',
                    flexShrink: 0,
                    width: 56,
                    // El paño puede ser más alto que la pantalla; acotamos la columna
                    // para que el letrero de abajo quede siempre visible.
                    maxHeight: 'calc(100vh - 78px)',
                  }}>
                    {CHIP_VALUES.map((v) => (
                      <Chip
                        key={v}
                        value={v}
                        selected={selectedChip === v}
                        disabled={!apuestasAbiertas || v > balance}
                        compact
                        onClick={() => {
                          setSelectedChip(v);
                          if (window.AudioEngine) window.AudioEngine.chip();
                        }}
                      />
                    ))}
                    {/* Separador y botones de acción debajo de las fichas */}
                    <div style={{
                      width: '100%',
                      height: 1,
                      background: t.theme === 'lightning' ? '#2a4a8a' : '#8b6a20',
                      margin: '18px 0',
                      opacity: 0.5,
                    }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 34, width: '100%', alignItems: 'stretch' }}>
                      <ActionBtn onClick={clearBets} disabled={!apuestasAbiertas || bets.length === 0} compact>
                        {T('LIMPIAR')}
                      </ActionBtn>
                      <ActionBtn
                        id="spin-btn"
                        onClick={handleSpinClick}
                        disabled={phase !== 'betting' || (bets.length === 0 && lastBets.length === 0)}
                        primary
                        theme={t.theme}
                        compact
                      >
                        {bets.length === 0 && lastBets.length > 0 ? `${T('GIRAR')} ↻` : T('GIRAR')}
                      </ActionBtn>
                    </div>

                    {/* ═══ Publicidad — banner vertical bajo GIRAR ═══ */}
                    {(() => {
                      const ad = ADS[adIndex % ADS.length];
                      return (
                        <div style={{
                          // Ocupa todo el hueco libre debajo de GIRAR
                          flex: 1,
                          minHeight: 120,
                          width: '100%',
                          marginTop: 10,
                          borderRadius: 6,
                          border: `1px solid ${ad.color}66`,
                          background: 'linear-gradient(180deg, rgba(20,0,4,0.75), rgba(0,0,0,0.4))',
                          animation: 'neonTube 2.6s ease-in-out infinite',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          overflow: 'hidden',
                          padding: '5px 2px',
                        }}>
                          {/* Letrero de neón vertical — solo el nombre */}
                          <div key={ad.id} style={{
                            flex: 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            minHeight: 0, width: '100%',
                          }}>
                            <div style={{
                              writingMode: 'vertical-rl',
                              transform: 'rotate(180deg)',
                              fontFamily: 'Georgia, serif',
                              fontWeight: 900,
                              fontSize: 21,
                              letterSpacing: 2,
                              color: '#fff',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxHeight: '100%',
                              // Neón: solo la respiración del brillo (sin parpadeo)
                              animation: 'neonBreath 2.8s ease-in-out infinite',
                            }}>{ad.title}</div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  {/* Paño rotado — full screen con escalado NO-UNIFORME */}
                  <div style={{
                    width: finalW,
                    height: finalH,
                    position: 'relative',
                    overflow: 'visible',
                    flexShrink: 0,
                  }}>
                    <div style={{
                      width: NATURAL_W,
                      height: NATURAL_H,
                      // CSS aplica transforms de derecha a izquierda:
                      // 1) scale(scaleX, scaleY) escala los ejes de la fuente
                      // 2) rotate(90) gira a vertical
                      // 3) translate posiciona en pantalla
                      transform: `translate(${finalW}px, 0) rotate(90deg) scale(${scaleX}, ${scaleY})`,
                      transformOrigin: '0 0',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                    }}>
                      <BettingTable
                        mesa={ficha}
                        bets={bets}
                        onPlaceBet={placeBet}
                        onRemoveBet={removeBet}
                        onMoveBet={moveBet}
                        selectedChip={selectedChip}
                        disabled={!apuestasAbiertas}
                        theme={t.theme}
                        lightningNumbers={lightningNumbers}
                        rotateLabels={true}
                        winningNumber={phase === 'result' ? resultNum : null}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Desktop: chip tray + botones en fila. Móvil ya los tiene en la columna izquierda. */}
            {!isMobile && (
              <div style={{
                display: 'flex', flexDirection: 'row',
                justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px',
                background: 'linear-gradient(180deg, #2a1a08, #1a0d02)',
                borderRadius: 8,
                border: `1px solid ${t.theme === 'lightning' ? '#2a4a8a' : '#8b6a20'}`,
              }}>
                <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
                  {CHIP_VALUES.map((v) => (
                    <Chip
                      key={v}
                      value={v}
                      selected={selectedChip === v}
                      disabled={!apuestasAbiertas || v > balance}
                      onClick={() => {
                        setSelectedChip(v);
                        if (window.AudioEngine) window.AudioEngine.chip();
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 28 }}>
                  <ActionBtn onClick={clearBets} disabled={!apuestasAbiertas || bets.length === 0}>
                    {T('LIMPIAR')}
                  </ActionBtn>
                  <ActionBtn
                    id="spin-btn"
                    onClick={handleSpinClick}
                    disabled={phase !== 'betting' || (bets.length === 0 && lastBets.length === 0)}
                    primary
                    theme={t.theme}
                  >
                    {bets.length === 0 && lastBets.length > 0 ? `${T('GIRAR')} ↻` : T('GIRAR')}
                  </ActionBtn>
                </div>
              </div>
            )}

            {/* Tipos de apuesta — solo desktop */}
            {!isMobile && (
              <>
                <div style={{
                  display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center',
                  padding: '10px 12px',
                  background: 'rgba(0,0,0,0.35)',
                  border: '1px solid #333',
                  borderRadius: 4,
                  fontSize: 10,
                  letterSpacing: 1,
                  color: '#aaa',
                }}>
                  {/* El pleno lo paga la mesa (29:1 con rayos, 35:1 sin ellos)
                      y el top-line solo existe donde hay 00. */}
                  <span><b style={{ color: '#fff' }}>PLENO</b> 1 nº · {ficha.pagoPleno}:1</span>
                  <span><b style={{ color: '#fff' }}>SPLIT</b> 2 nº · 17:1</span>
                  <span><b style={{ color: '#fff' }}>CALLE</b> 3 nº · 11:1</span>
                  <span><b style={{ color: '#fff' }}>CUATRO</b> 4 nº · 8:1</span>
                  <span><b style={{ color: '#fff' }}>LÍNEA</b> 6 nº · 5:1</span>
                  {ficha.dobleCero && (
                    <span><b style={{ color: '#fff' }}>TOP-LINE</b> 0,00,1,2,3 · 6:1</span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: '#666', textAlign: 'center', letterSpacing: 1 }}>
                  CLIC IZQ: APOSTAR · CLIC DER: RETIRAR · APUNTA A LAS LÍNEAS Y ESQUINAS PARA APUESTAS INTERNAS
                </div>
              </>
            )}
            {isMobile && (
              <div style={{ fontSize: 10, color: '#666', textAlign: 'center', letterSpacing: 1, padding: '0 8px' }}>
                TOCAR: APOSTAR · MANTENER PRESIONADO: RETIRAR
              </div>
            )}
          </div>
        )}
      </div>

      {/* TWEAKS PANEL */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Aspecto" />
        <TweakRadio
          label="Tema"
          value={t.theme}
          options={['classic', 'modern', 'lightning']}
          onChange={(v) => setTweak('theme', v)}
        />
        <TweakSection label="Jugabilidad" />
        <TweakSlider
          label="Duración giro"
          value={t.spinDuration}
          min={3}
          max={12}
          step={1}
          unit="s"
          onChange={(v) => setTweak('spinDuration', v)}
        />
        <TweakSlider
          label="Volumen"
          value={t.volume}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => setTweak('volume', v)}
        />
        <TweakSlider
          label="Intens. rayos"
          value={t.lightningIntensity}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => setTweak('lightningIntensity', v)}
        />
        <TweakToggle
          label="Auto-spin"
          value={t.autoSpin}
          onChange={(v) => setTweak('autoSpin', v)}
        />

        {/* Modo prueba: acá se enciende desde el celular, sin tener que
            escribir ?prueba=100 en la dirección. En 0 queda apagado. */}
        <TweakSection label="Modo prueba" />
        <TweakNumber
          label="Giros a contar"
          value={Number(t.pruebaGiros) || 0}
          min={0}
          max={1000}
          step={10}
          onChange={(v) => { setTweak('pruebaGiros', v); setPrueba(null); }}
        />
        {pruebaTotal > 0 && (
          <TweakButton
            label={`Reiniciar (van ${prueba ? prueba.giros : 0})`}
            secondary
            onClick={() => setPrueba(null)}
          />
        )}
      </TweaksPanel>
    </div>
  );
}

function ActionBtn({ children, onClick, disabled, primary, theme, id, compact }) {
  const accent = theme === 'lightning' ? '#5ab8ff' : '#d4a94a';
  // Canto inferior sólido: da el volumen de tecla física
  const canto = primary
    ? (theme === 'lightning' ? '#1d3f6b' : '#6b5010')
    : '#5a0d13';   // canto del rojo de LIMPIAR
  const alturaCanto = compact ? 5 : 6;
  // Al presionar el botón "se hunde" contra su canto
  const press = (e) => {
    if (disabled) return;
    e.currentTarget.style.transform = `translateY(${alturaCanto - 1}px)`;
    e.currentTarget.style.filter = 'brightness(1.1)';
  };
  const release = (e) => {
    e.currentTarget.style.transform = 'translateY(0)';
    e.currentTarget.style.filter = 'none';
  };
  return (
    <button
      id={id}
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: compact ? 1 : 'none',
        padding: compact ? '13px 3px' : '16px 24px',
        minHeight: compact ? 42 : 52,
        borderRadius: 5,
        // GIRAR: dorado encendido. LIMPIAR: metal claro con filo dorado
        // (antes era gris casi invisible sobre el fondo oscuro).
        border: primary ? `2px solid ${accent}` : '1px solid #f0737d',
        background: primary
          ? `linear-gradient(180deg, ${theme === 'lightning' ? '#8fd0ff' : '#f0cf72'} 0%, ${accent} 45%, ${theme === 'lightning' ? '#2a5a9a' : '#8b6a20'} 100%)`
          // LIMPIAR en rojo encendido: se distingue del dorado de GIRAR
          : 'linear-gradient(180deg, #e04b57 0%, #b52633 55%, #7d1119 100%)',
        color: primary ? '#1a1006' : '#ffffff',
        fontFamily: 'Georgia, serif',
        fontWeight: 900,
        fontSize: compact ? 8 : 13,
        letterSpacing: compact ? 0 : 2,
        textShadow: primary
          ? '0 1px 0 rgba(255,255,255,0.45)'
          : '0 0 8px rgba(255,255,255,0.7), 0 1px 2px rgba(0,0,0,0.85)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        boxShadow: primary
          // canto sólido (volumen) + halo dorado + brillo interior superior
          ? `0 ${alturaCanto}px 0 ${canto}, 0 ${alturaCanto + 5}px 12px rgba(0,0,0,0.65), 0 0 26px ${accent}aa, inset 0 2px 0 rgba(255,255,255,0.8), inset 0 -4px 8px rgba(0,0,0,0.35)`
          : `0 ${alturaCanto}px 0 ${canto}, 0 ${alturaCanto + 4}px 10px rgba(0,0,0,0.6), 0 0 16px rgba(224,75,87,0.55), inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -4px 8px rgba(0,0,0,0.4)`,
        transition: 'transform 0.09s ease, filter 0.09s ease, box-shadow 0.2s',
        touchAction: 'manipulation',
      }}
      onMouseDown={press}
      onMouseUp={release}
      onMouseLeave={release}
      onTouchStart={press}
      onTouchEnd={release}
    >
      {children}
    </button>
  );
}

// Rayo SVG animado overlay
function LightningBolt({ seed, theme }) {
  const x = 20 + seed * 60;
  const color = theme === 'lightning' ? '#9fd8ff' : '#ffd84a';
  const path = generateBoltPath(seed);
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 100,
        animation: 'boltFlash 0.55s ease-out forwards',
      }}
    >
      <div style={{
        position: 'absolute',
        inset: 0,
        background: `radial-gradient(ellipse at ${x}% 30%, ${color}44 0%, transparent 50%)`,
      }} />
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
      >
        <path
          d={path}
          stroke={color}
          strokeWidth="0.4"
          fill="none"
          style={{ filter: `drop-shadow(0 0 6px ${color}) drop-shadow(0 0 12px ${color})` }}
        />
      </svg>
    </div>
  );
}

function generateBoltPath(seed) {
  let rnd = seed;
  const rand = () => { rnd = (rnd * 9301 + 49297) % 233280; return rnd / 233280; };
  const x0 = 20 + rand() * 60;
  let x = x0;
  let y = 0;
  let d = `M ${x} ${y}`;
  while (y < 100) {
    y += 4 + rand() * 8;
    x += (rand() - 0.5) * 10;
    d += ` L ${x} ${y}`;
  }
  return d;
}

// ═══ El número y el animal que salieron ═══
// Es el momento que el jugador espera, así que va grande: la figura del animal,
// el número en su color y el nombre. Antes era un círculo de 56px y, cuando
// ganaba, el animal ni se mostraba — el mensaje solo decía cuánto ganó.
function GanadorGrande({ n, color, mensaje, gano, isMobile, conAnimales = true }) {
  // [emoji, nombre, artículo] — en una mesa sin animales queda solo el número.
  const animal = (conAnimales && (window.ANIMALS || {})[n]) || null;
  const fondo = color === 'red' ? '#b8101a' : color === 'black' ? '#151515' : '#0d7a2e';

  const dFicha = isMobile ? 62 : 92;
  const dNumero = isMobile ? 30 : 46;
  const dEmoji = isMobile ? 40 : 62;
  const dNombre = isMobile ? 13 : 20;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: isMobile ? 10 : 18, flexWrap: 'wrap', width: '100%',
    }}>
      {/* La figura del animal */}
      {animal && (
        <div style={{
          fontSize: dEmoji, lineHeight: 1, flexShrink: 0,
          filter: 'drop-shadow(0 0 10px rgba(255,216,74,0.7))',
        }}>{animal[0]}</div>
      )}

      {/* El número, en el color de su casilla */}
      <div style={{
        width: dFicha, height: dFicha, borderRadius: '50%', background: fondo,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: dNumero, fontWeight: 900, color: '#fff', flexShrink: 0,
        border: `${isMobile ? 3 : 4}px solid #fff`,
        boxShadow: '0 0 20px rgba(255,216,74,0.9), 0 3px 12px rgba(0,0,0,0.8)',
      }}>{n}</div>

      {/* Nombre del animal y el resultado de la jugada */}
      <div style={{ textAlign: 'left', minWidth: 0 }}>
        {animal && (
          <div style={{
            fontSize: dNombre, fontWeight: 900, letterSpacing: 2, color: '#ffd84a',
            textTransform: 'uppercase', lineHeight: 1.1,
            textShadow: '0 2px 6px rgba(0,0,0,0.8)',
          }}>{animal[1]}</div>
        )}
        <div style={{
          fontSize: isMobile ? 11 : 16, fontWeight: 800,
          color: gano ? '#ffd84a' : '#ddd', marginTop: 2,
        }}>{mensaje}</div>
      </div>
    </div>
  );
}

// ═══ Marcador del modo prueba ═══
// Sirve para medir en la práctica lo que dicen las tablas: cuántos giros van,
// cuánto se apostó en total y cómo quedó el saldo. Solo existe con ?prueba=N.
function MarcadorPrueba({ total, p, saldo, isMobile }) {
  const giros = p ? p.giros : 0;
  const apostado = p ? p.apostado : 0;
  const ganado = p ? p.ganado : 0;
  const inicial = p ? p.saldoInicial : saldo;
  const neto = saldo - inicial;
  const termino = giros >= total;

  // Cuánto se quedó la casa de todo lo que pasó por la mesa.
  const ventaja = apostado > 0 ? ((apostado - ganado) / apostado) * 100 : 0;

  // En el celular la pantalla es del juego: el marcador va apretado, en una
  // línea, para no empujar el paño hacia abajo.
  const caja = (etiqueta, valor, color) => (
    <div style={{ textAlign: 'center', minWidth: 0 }}>
      <div style={{
        fontSize: isMobile ? 6.5 : 9, letterSpacing: isMobile ? 0 : 1, color: '#999',
        whiteSpace: 'nowrap',
      }}>{etiqueta}</div>
      <div style={{
        fontSize: isMobile ? 11 : 16, fontWeight: 900, color: color || '#fff',
        whiteSpace: 'nowrap',
      }}>{valor}</div>
    </div>
  );

  const plata = (v) => (isMobile
    ? (Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))
    : `$${v.toLocaleString()}`);

  return (
    <div style={{
      margin: isMobile ? '3px 4px 0' : '0 0 8px',
      padding: isMobile ? '4px 6px' : '10px 16px',
      borderRadius: 8,
      background: termino ? 'rgba(90,184,255,0.15)' : 'rgba(0,0,0,0.4)',
      border: `1px solid ${termino ? '#5ab8ff' : '#3a5a8a'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      gap: isMobile ? 4 : 8, flexWrap: isMobile ? 'nowrap' : 'wrap',
      fontFamily: 'Georgia, serif', overflowX: 'auto',
    }}>
      {caja('GIROS', `${giros}/${total}`, termino ? '#9fd8ff' : '#5ab8ff')}
      {caja(isMobile ? T('INICIAL') : T('SALDO INICIAL'), plata(inicial))}
      {caja('AHORA', plata(saldo), '#ffd84a')}
      {caja('NETO', `${neto >= 0 ? '+' : '−'}${plata(Math.abs(neto))}`,
        neto >= 0 ? '#7ee08a' : '#ff9a9a')}
      {caja(isMobile ? 'APOSTADO' : 'APOSTADO EN TOTAL', plata(apostado))}
      {/* Con pocos giros el porcentaje salta por todos lados y confunde:
          recién con unos cuantos empieza a significar algo. */}
      {giros >= 10
        ? caja(isMobile ? 'LA CASA' : 'SE QUEDÓ LA CASA', `${ventaja.toFixed(1)}%`,
            ventaja >= 0 ? '#7ee08a' : '#ff9a9a')
        : caja(isMobile ? 'LA CASA' : 'SE QUEDÓ LA CASA', `en ${10 - giros}`, '#777')}
      {termino && !isMobile && (
        <div style={{ fontSize: 12, color: '#9fd8ff', fontWeight: 700 }}>
          ✓ {total} giros cumplidos
        </div>
      )}
    </div>
  );
}

// ═══ Enlace de invitación abierto con otra sesión ya iniciada ═══
// Sin esto, el código de socio se perdía en silencio y el invitado terminaba
// dentro de la cuenta de quien estaba logueado en ese navegador.
function PantallaInvitacion({ codigo, user, onRegistrarme, onSeguir }) {
  const boton = {
    width: '100%', padding: '13px', borderRadius: 6, fontWeight: 900,
    fontSize: 14, letterSpacing: 1, cursor: 'pointer', fontFamily: 'Georgia, serif',
  };
  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at center, #3a1f08 0%, #1a0d02 60%, #050200 100%)',
      color: '#fff', fontFamily: 'Georgia, serif',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 420,
        background: 'linear-gradient(180deg, #2a1a08, #1a0d02)',
        border: '1px solid #8b6a20', borderRadius: 12, padding: 28,
        boxShadow: '0 20px 60px rgba(0,0,0,0.7)', textAlign: 'center',
      }}>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 2, color: '#d4a94a' }}>
          ⚡ RULETA CATATUMBO ⚡
        </div>
        <div style={{ fontSize: 13, color: '#aaa', marginTop: 14, lineHeight: 1.6 }}>
          Te invitaron con el código
        </div>
        <div style={{
          fontSize: 30, fontWeight: 900, letterSpacing: 3, color: '#ffd84a',
          fontFamily: 'monospace', background: 'rgba(0,0,0,0.4)',
          padding: '10px 16px', borderRadius: 8, border: '1px dashed #8b6a20',
          margin: '10px 0 18px',
        }}>{codigo}</div>

        <div style={{
          fontSize: 14, color: '#ffc9c9', background: 'rgba(180,16,26,0.18)',
          border: '1px solid #b8101a', borderRadius: 6, padding: '10px 12px',
          marginBottom: 18, lineHeight: 1.6,
        }}>
          En este navegador ya hay una sesión abierta como <b>{user.username}</b>.
        </div>

        <button
          onClick={onRegistrarme}
          style={{
            ...boton, border: '2px solid #d4a94a', marginBottom: 10,
            background: 'linear-gradient(180deg, #d4a94a, #8b6a20)', color: '#1a1006',
          }}
        >SALIR Y CREAR MI CUENTA</button>

        <button
          onClick={onSeguir}
          style={{
            ...boton, border: '1px solid #555',
            background: 'linear-gradient(180deg, #333, #111)', color: '#ddd',
          }}
        >SEGUIR COMO {user.username.toUpperCase()}</button>

        <div style={{ fontSize: 11, color: '#888', marginTop: 14, lineHeight: 1.5 }}>
          Si la cuenta de arriba no es tuya, tocá “salir y crear mi cuenta”: así quedás
          registrado con este código.
        </div>
      </div>
    </div>
  );
}

// ═══ Raíz: gate de autenticación + ruteo /admin, /taquilla y /billetera ═══
function AppRoot() {
  const [status, setStatus] = useState('loading'); // loading | login | game | admin | taquilla | billetera
  const [user, setUser] = useState(null);
  // Límites vigentes (topes, mínimos). Vienen con /api/me.
  const [config, setConfig] = useState(null);
  // Catálogo de mesas del salón (/api/games) y cuál se está jugando.
  // La mesa la elige el jugador en el salón y viaja en la dirección
  // (…/juego?mesa=europea): así se sostiene al recargar la página, al volver
  // de la caja y en un enlace compartido.
  const [mesas, setMesas] = useState(null);
  const [mesaId, setMesaId] = useState(() => mesaDelEnlace() || MESA_POR_DEFECTO);

  const rutaActual = () => window.location.pathname.replace(/\/+$/, '') || '/';

  // Código de socio que viene en el enlace (.../?ref=S0009).
  const refDelEnlace = () => {
    try { return (new URLSearchParams(window.location.search).get('ref') || '').toUpperCase(); }
    catch (e) { return ''; }
  };

  // A qué pantalla mandar según la URL y lo que el usuario tiene permitido.
  // Al entrar (raíz) cada uno cae en su lugar de trabajo: el dueño en su panel,
  // el taquillero en la taquilla y el jugador en el SALÓN (elige mesa ahí).
  // El dueño no entra a jugar, entra a administrar; para las mesas está el
  // botón SALÓN, y /juego es la entrada directa a la mesa (la del enlace, o
  // la de siempre si no dice ninguna).
  const pantallaPara = (u) => {
    const ruta = rutaActual();
    if (ruta === '/admin' && u.role === 'admin') return 'admin';
    if (ruta === '/taquilla' && (u.role === 'cashier' || u.role === 'admin')) return 'taquilla';
    if (ruta === '/billetera') return 'billetera';
    if (ruta === '/juego') return 'game';
    if (ruta === '/mesa21') return 'mesa21';
    if (ruta === '/salon') return 'salon';
    if (ruta === '/') {
      if (u.role === 'admin') return 'admin';
      if (u.role === 'cashier') return 'taquilla';
      return 'salon';
    }
    return 'game';
  };

  const ir = (ruta, pantalla) => {
    window.history.pushState({}, '', ruta);
    setStatus(pantalla);
  };

  useEffect(() => {
    if (!window.Api || !window.Api.getToken()) { setStatus('login'); return; }
    window.Api.me()
      .then((d) => {
        const u = d.user;
        setUser(u);
        if (d.config) {
          setConfig(d.config);
          // El formateador de plata tiene que saber la moneda ANTES de que se
          // dibuje el primer monto, si no el jugador ve el símbolo cambiar.
          if (window.UI && window.UI.setMoneda) window.UI.setMoneda(d.config.moneda);
        }
        // Llegó por un enlace de invitación pero ya hay una sesión abierta:
        // hay que preguntar, porque si no el código se pierde en silencio y el
        // invitado termina metido en la cuenta de otro.
        setStatus(refDelEnlace() ? 'invitacion' : pantallaPara(u));
      })
      .catch(() => { window.Api.logout(); setStatus('login'); });
  }, []);

  // El catálogo de mesas, apenas hay sesión. Si falla se juega igual: la mesa
  // insignia tiene su ficha de respaldo en el cliente.
  useEffect(() => {
    if (!user || !window.Api || !window.Api.games) return;
    window.Api.games()
      .then((d) => setMesas(d && Array.isArray(d.mesas) ? d.mesas : null))
      .catch(() => {});
  }, [user]);

  // La ficha de la mesa en juego. Null = todavía no se puede dibujar (pidieron
  // una mesa que no es la insignia y el catálogo todavía no llegó): mejor
  // esperar que dibujar una rueda equivocada, porque el resultado viene como
  // índice del orden de casillas y caería en otro número.
  //
  // Una mesa cerrada o desconocida (enlace viejo, mesa que se apagó) no deja
  // la pantalla trabada: se cae a la mesa de siempre, que es lo que el jugador
  // espera cuando toca un enlace que ya no existe.
  const fichaMesa = (() => {
    const cat = mesas || [];
    if (cat.length === 0) return mesaId === FICHA_CATATUMBO.id ? FICHA_CATATUMBO : null;
    // Solo ruletas: una mesa de 21 tiene su propia pantalla y no se dibuja con
    // esta ficha (no tiene rueda ni casillas).
    // `activo || en_pruebas`: el servidor sólo le manda una mesa en pruebas a
    // quien puede entrar (el dueño o una cuenta de prueba), así que si la ficha
    // llegó hasta acá, esta pantalla es para él.
    const elegida = cat.find((m) => m.id === mesaId && (m.activo || m.en_pruebas) && esRuleta(m));
    if (elegida) return fichaDeMesa(elegida);
    const deSiempre = cat.find((m) => m.id === MESA_POR_DEFECTO);
    return deSiempre ? fichaDeMesa(deSiempre) : FICHA_CATATUMBO;
  })();

  // La mesa de 21 que se está jugando, si es que se entró a una.
  const mesa21 = (mesas || []).find(
    (m) => m.id === mesaId && (m.activo || m.en_pruebas) && !esRuleta(m)) || null;

  // Si se pidió una mesa que no se puede jugar y se cayó a la de siempre, la
  // dirección se corrige sola: si no, quedaría diciendo una mesa y mostrando
  // otra, y ese enlace equivocado se seguiría compartiendo.
  const idFicha = fichaMesa && fichaMesa.id;
  useEffect(() => {
    if (status !== 'game' || !idFicha || idFicha === mesaId) return;
    setMesaId(idFicha);
    window.history.replaceState({}, '', `/juego?mesa=${encodeURIComponent(idFicha)}`);
  }, [status, idFicha, mesaId]);

  // Entrar a una mesa desde el salón. La mesa viaja en la dirección para que
  // al recargar la página se vuelva a abrir la misma.
  const entrarAMesa = (id) => {
    const mesa = id || MESA_POR_DEFECTO;
    // Cada juego tiene su pantalla: la ruleta en /juego y el blackjack en
    // /mesa21. Lo decide la ficha, no el botón que se tocó.
    const ficha = (mesas || []).find((m) => m.id === mesa);
    const es21 = ficha && !esRuleta(ficha);
    setMesaId(mesa);
    window.history.pushState({}, '', `${es21 ? '/mesa21' : '/juego'}?mesa=${encodeURIComponent(mesa)}`);
    setStatus(es21 ? 'mesa21' : 'game');
    window.Api.me().then((d) => {
      if (d && d.user) setUser(d.user);
      if (d && d.config) setConfig(d.config);
    }).catch(() => {});
  };

  // Refresca el usuario al volver al juego: el saldo pudo cambiar en la billetera.
  // Va a /juego (y no a la raíz) para que al recargar la página el dueño y el
  // taquillero se queden en la mesa en vez de rebotar a su panel. Se vuelve a
  // la MISMA mesa que se estaba jugando, no a la de siempre.
  const volverAlJuego = () => entrarAMesa(mesaId);

  // Al salón siempre con el saldo fresco: se llega desde la mesa o la caja,
  // y en las dos el saldo pudo haber cambiado.
  const irAlSalon = () => {
    window.history.pushState({}, '', '/salon');
    setStatus('salon');
    window.Api.me().then((d) => {
      if (d && d.user) setUser(d.user);
      if (d && d.config) setConfig(d.config);
    }).catch(() => {});
  };

  if (status === 'loading') {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0604', color: '#d4a94a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Georgia, serif', letterSpacing: 2,
      }}>Cargando…</div>
    );
  }

  if (status === 'login') {
    return <LoginScreen onAuth={(u) => {
      setUser(u);
      setStatus(pantallaPara(u));
      // Los límites llegan con /api/me: se piden apenas entra.
      window.Api.me().then((d) => d && d.config && setConfig(d.config)).catch(() => {});
    }} />;
  }

  // Cerrar sesión tiene que estar a mano desde cualquier pantalla: el dueño no
  // debería pasar por la mesa de juego solo para salir.
  const salir = () => {
    window.Api.logout();
    setUser(null);
    window.history.pushState({}, '', '/');
    setStatus('login');
  };

  // Enlace de invitación con una sesión ya abierta: se pregunta en vez de
  // decidir solo, así el invitado no termina jugando en la cuenta de otro.
  if (status === 'invitacion') {
    return <PantallaInvitacion
      codigo={refDelEnlace()}
      user={user}
      onRegistrarme={() => { window.Api.logout(); setUser(null); setStatus('login'); }}
      onSeguir={() => {
        window.history.replaceState({}, '', window.location.pathname);
        setStatus(pantallaPara(user));
      }}
    />;
  }

  if (status === 'admin')     return <AdminPanel user={user} onExit={volverAlJuego} onLogout={salir} />;
  if (status === 'taquilla')  return <CashierPanel user={user} onExit={volverAlJuego} onLogout={salir} />;
  if (status === 'billetera') return <WalletPanel user={user} onExit={volverAlJuego} onLogout={salir} />;

  const esAdmin = user && user.role === 'admin';
  const esTaquillero = user && (user.role === 'cashier' || user.role === 'admin');

  // ── La mesa de 21 ────────────────────────────────────────────────────────
  if (status === 'mesa21') {
    if (!mesa21) {
      // La mesa no existe, está cerrada, o el catálogo todavía no llegó.
      return (
        <div style={{
          minHeight: '100vh', background: '#0a0604', color: '#d4a94a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'Georgia, serif', letterSpacing: 2,
        }}>Abriendo la mesa…</div>
      );
    }
    return <BlackjackScreen
      user={user}
      mesa={mesa21}
      onSalirAlSalon={irAlSalon}
      onOpenWallet={() => ir('/billetera', 'billetera')}
      onLogout={salir}
    />;
  }

  if (status === 'salon') {
    return <SalonScreen
      user={user}
      mesas={mesas}
      onEntrarMesa={entrarAMesa}
      onOpenWallet={() => ir('/billetera', 'billetera')}
      onOpenCashier={esTaquillero ? () => ir('/taquilla', 'taquilla') : null}
      onOpenAdmin={esAdmin ? () => ir('/admin', 'admin') : null}
      onLogout={salir}
    />;
  }

  if (!fichaMesa) {
    return (
      <div style={{
        minHeight: '100vh', background: '#0a0604', color: '#d4a94a',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'Georgia, serif', letterSpacing: 2,
      }}>Abriendo la mesa…</div>
    );
  }

  return <RouletteApp
    user={user}
    config={config}
    mesa={fichaMesa}
    onLogout={salir}
    onOpenSalon={irAlSalon}
    onOpenAdmin={esAdmin ? () => ir('/admin', 'admin') : null}
    onOpenCashier={esTaquillero ? () => ir('/taquilla', 'taquilla') : null}
    onOpenWallet={() => ir('/billetera', 'billetera')}
  />;
}

// Mount
const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(<AppRoot />);
