// Motor de audio sintetizado con Web Audio API
// Todos los sonidos se generan en vivo — no se necesitan archivos externos.

const AudioEngine = (() => {
  let ctx = null;
  let masterGain = null;
  let spinGain = null;
  let spinOsc = null;
  let spinNoise = null;
  let spinFilter = null;   // filtro del ruido (se modula en estilos dinámicos)
  let spinOscGain = null;
  let spinCfg = null;      // config del estilo en curso
  let spinActive = false;
  let volume = 0.7;

  function ensureCtx() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function setVolume(v) {
    volume = v;
    if (masterGain) masterGain.gain.setTargetAtTime(v, ctx.currentTime, 0.05);
  }

  // White noise buffer (reusable)
  let noiseBuffer = null;
  function getNoiseBuffer() {
    if (noiseBuffer) return noiseBuffer;
    const c = ensureCtx();
    const length = c.sampleRate * 2;
    noiseBuffer = c.createBuffer(1, length, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }

  // ═══ Estilos de sonido del giro (cilindro) ═══
  // Cada estilo define el ruido (aire/rodadura) y el tono grave (masa girando).
  const SPIN_STYLES = {
    // Whoosh de aire original
    clasico: {
      level: 0.25,
      noise: { type: 'bandpass', freq: 600, q: 1.2, gain: 1 },
      osc: { type: 'sawtooth', freq: 60, gain: 0.08 },
    },
    // Rodadura cálida sobre madera: grave, sin siseo agudo
    madera: {
      level: 0.28,
      noise: { type: 'lowpass', freq: 380, q: 0.8, gain: 0.9 },
      osc: { type: 'sine', freq: 45, gain: 0.14 },
    },
    // Casino amplio: ruido medio con cuerpo, tono doble
    casino: {
      level: 0.22,
      noise: { type: 'bandpass', freq: 1100, q: 0.9, gain: 0.8 },
      osc: { type: 'triangle', freq: 82, gain: 0.07 },
    },
    // Suave: apenas un susurro de fondo
    suave: {
      level: 0.12,
      noise: { type: 'lowpass', freq: 700, q: 0.7, gain: 0.6 },
      osc: null,
    },
    // Turbo: energético y agudo, sensación de velocidad
    turbo: {
      level: 0.3,
      noise: { type: 'bandpass', freq: 1900, q: 2.2, gain: 1 },
      osc: { type: 'sawtooth', freq: 110, gain: 0.09 },
    },
    // Roce de bola: textura de bola rodando en la pista y tono que SUBE y BAJA
    // con la velocidad real de la rueda (agudo al lanzar, grave al frenar).
    roce: {
      level: 0.3,
      dynamic: true,
      // El filtro barre de grave (rueda frenando) a agudo (rueda rápida)
      noise: { type: 'bandpass', freq: 900, q: 3.2, gain: 1, freqMin: 260, freqMax: 2300 },
      osc: { type: 'triangle', freq: 70, gain: 0.1, freqMin: 38, freqMax: 150 },
    },
    // Silencio: solo se oyen los ticks de la bolita
    silencio: null,
  };
  let spinStyle = 'clasico';
  function setSpinStyle(s) { if (s && (s in SPIN_STYLES)) spinStyle = s; }

  // Giro continuo del cilindro. styleOverride solo lo usa la vista previa:
  // así se escucha una muestra sin alterar el estilo elegido por el jugador.
  function startSpin(styleOverride) {
    if (spinActive) return;
    const cfg = SPIN_STYLES[styleOverride && (styleOverride in SPIN_STYLES) ? styleOverride : spinStyle];
    spinCfg = cfg;
    if (!cfg) { spinActive = true; return; } // 'silencio': nada continuo
    const c = ensureCtx();
    spinActive = true;

    spinGain = c.createGain();
    spinGain.gain.value = 0;
    spinGain.gain.setTargetAtTime(cfg.level, c.currentTime, 0.3);
    spinGain.connect(masterGain);

    // Ruido filtrado = aire / rodadura
    spinNoise = c.createBufferSource();
    spinNoise.buffer = getNoiseBuffer();
    spinNoise.loop = true;
    const filt = c.createBiquadFilter();
    filt.type = cfg.noise.type;
    filt.frequency.value = cfg.noise.freq;
    filt.Q.value = cfg.noise.q;
    spinFilter = filt;
    const nGain = c.createGain();
    nGain.gain.value = cfg.noise.gain;
    spinNoise.connect(filt);
    filt.connect(nGain);
    nGain.connect(spinGain);
    spinNoise.start();

    // Tono grave = masa girando (opcional según estilo)
    if (cfg.osc) {
      spinOsc = c.createOscillator();
      spinOsc.type = cfg.osc.type;
      spinOsc.frequency.value = cfg.osc.freq;
      const oscGain = c.createGain();
      oscGain.gain.value = cfg.osc.gain;
      spinOscGain = oscGain;
      spinOsc.connect(oscGain);
      oscGain.connect(spinGain);
      spinOsc.start();
    }
  }

  // Reproduce una muestra corta del estilo, SIN cambiar el estilo elegido
  // (el estilo real lo fija setSpinStyle desde la app).
  function previewSpin(style) {
    if (spinActive) return; // no interrumpir un giro real
    startSpin(style);
    // Barrido de velocidad (rápido → lento) para oír cómo cae el tono
    const steps = 14, dur = 2200;
    for (let i = 0; i <= steps; i++) {
      setTimeout(() => updateSpinIntensity(1 - i / steps), (dur / steps) * i);
    }
    setTimeout(() => stopSpin(), dur + 150);
  }

  function updateSpinIntensity(intensity) {
    // intensity 0..1 = velocidad relativa de la bola
    if (!spinActive || !spinGain) return;
    const v = Math.max(0, Math.min(1, intensity));
    const now = ctx.currentTime;
    const g = 0.05 + v * 0.3;
    spinGain.gain.setTargetAtTime(g, now, 0.1);

    // Estilos dinámicos: el tono y el filtro siguen a la velocidad
    // (agudo cuando la rueda va rápido, grave a medida que frena).
    if (spinCfg && spinCfg.dynamic) {
      if (spinFilter && spinCfg.noise.freqMin != null) {
        const f = spinCfg.noise.freqMin + (spinCfg.noise.freqMax - spinCfg.noise.freqMin) * v;
        spinFilter.frequency.setTargetAtTime(f, now, 0.08);
      }
      if (spinOsc && spinCfg.osc && spinCfg.osc.freqMin != null) {
        const f = spinCfg.osc.freqMin + (spinCfg.osc.freqMax - spinCfg.osc.freqMin) * v;
        spinOsc.frequency.setTargetAtTime(f, now, 0.08);
      }
    }
  }

  function stopSpin() {
    if (!spinActive) return;
    const c = ctx;
    spinActive = false;
    // Estilo 'silencio': no se creó ningún nodo continuo
    if (!spinGain) { spinOsc = null; spinNoise = null; spinFilter = null; spinOscGain = null; spinCfg = null; return; }
    const g = spinGain;
    const o = spinOsc;
    const n = spinNoise;
    g.gain.setTargetAtTime(0, c.currentTime, 0.2);
    setTimeout(() => {
      try { o.stop(); } catch (e) {}
      try { n.stop(); } catch (e) {}
      try { g.disconnect(); } catch (e) {}
    }, 800);
    spinGain = null;
    spinOsc = null;
    spinNoise = null;
    spinFilter = null;
    spinOscGain = null;
    spinCfg = null;
  }

  // ── Liberar los nodos al terminar ──────────────────────────────────────
  // Cada sonido arma unos nodos y los cuelga del master. Si no se sueltan al
  // terminar, quedan ahí para siempre y el motor de audio los sigue
  // procesando: el "tic" de la bolita suena ~70 veces por segundo, así que en
  // media hora de juego se acumulan cientos de miles y la página se traba.
  // Soltando el nodo de arriba, todo lo que cuelga de él se libera solo.
  function liberarAlTerminar(fuente, ...nodos) {
    const soltar = () => {
      for (const n of nodos) { try { n.disconnect(); } catch (e) {} }
    };
    if (fuente && typeof fuente.addEventListener === 'function') {
      fuente.addEventListener('ended', soltar, { once: true });
    } else {
      setTimeout(soltar, 3000);
    }
  }

  // Tick = bolita rebotando en el separador metálico
  function tick(velocity = 1) {
    const c = ensureCtx();
    const now = c.currentTime;
    const g = c.createGain();
    g.connect(masterGain);

    // Click corto metálico
    const osc = c.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(2800 + Math.random() * 800, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.04);

    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3500;
    bp.Q.value = 6;

    osc.connect(bp);
    bp.connect(g);

    const amp = 0.15 * velocity;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(amp, now + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    osc.start(now);
    osc.stop(now + 0.08);
    liberarAlTerminar(osc, g, bp, osc);
  }

  // Ball drop = bolita cayendo en la casilla
  function ballDrop() {
    const c = ensureCtx();
    const now = c.currentTime;
    // Varios ticks rápidos decrecientes
    for (let i = 0; i < 6; i++) {
      setTimeout(() => tick(1 - i * 0.12), i * 55);
    }
    // Thud final grave
    setTimeout(() => {
      const g = c.createGain();
      const osc = c.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, c.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, c.currentTime + 0.15);
      osc.connect(g);
      g.connect(masterGain);
      g.gain.setValueAtTime(0, c.currentTime);
      g.gain.linearRampToValueAtTime(0.3, c.currentTime + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.25);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + 0.3);
      liberarAlTerminar(osc, g, osc);
    }, 380);
  }

  // Trueno/rayo para Lightning
  function thunder(intensity = 1) {
    const c = ensureCtx();
    const now = c.currentTime;

    // Crack inicial (ruido agudo)
    const crackSrc = c.createBufferSource();
    crackSrc.buffer = getNoiseBuffer();
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2000;
    const crackGain = c.createGain();
    crackSrc.connect(hp);
    hp.connect(crackGain);
    crackGain.connect(masterGain);
    crackGain.gain.setValueAtTime(0, now);
    crackGain.gain.linearRampToValueAtTime(0.5 * intensity, now + 0.005);
    crackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    crackSrc.start(now);
    crackSrc.stop(now + 0.25);
    liberarAlTerminar(crackSrc, crackGain, hp, crackSrc);

    // Rumble grave (trueno sostenido)
    const rumbleSrc = c.createBufferSource();
    rumbleSrc.buffer = getNoiseBuffer();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 200;
    const rumbleGain = c.createGain();
    rumbleSrc.connect(lp);
    lp.connect(rumbleGain);
    rumbleGain.connect(masterGain);
    rumbleGain.gain.setValueAtTime(0, now);
    rumbleGain.gain.linearRampToValueAtTime(0.45 * intensity, now + 0.08);
    rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    rumbleSrc.start(now);
    rumbleSrc.stop(now + 1.3);
    liberarAlTerminar(rumbleSrc, rumbleGain, lp, rumbleSrc);

    // Zap eléctrico (osc descendente rápido)
    const zap = c.createOscillator();
    zap.type = 'sawtooth';
    zap.frequency.setValueAtTime(800, now);
    zap.frequency.exponentialRampToValueAtTime(80, now + 0.4);
    const zapGain = c.createGain();
    zap.connect(zapGain);
    zapGain.connect(masterGain);
    zapGain.gain.setValueAtTime(0, now);
    zapGain.gain.linearRampToValueAtTime(0.15 * intensity, now + 0.01);
    zapGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    zap.start(now);
    zap.stop(now + 0.45);
    liberarAlTerminar(zap, zapGain, zap);
  }

  // Ficha al colocar apuesta
  function chip() {
    const c = ensureCtx();
    const now = c.currentTime;
    // Dos clicks secos metálicos (ficha chocando)
    for (let i = 0; i < 2; i++) {
      const t = now + i * 0.035;
      const g = c.createGain();
      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1800 - i * 300, t);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2000;
      bp.Q.value = 4;
      osc.connect(bp);
      bp.connect(g);
      g.connect(masterGain);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.25, t + 0.002);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      osc.start(t);
      osc.stop(t + 0.07);
      liberarAlTerminar(osc, g, bp, osc);
    }
  }

  // Win fanfare
  function win(big = false) {
    const c = ensureCtx();
    const now = c.currentTime;
    const notes = big ? [523, 659, 784, 1047, 1319] : [523, 659, 784];
    notes.forEach((freq, i) => {
      const t = now + i * 0.1;
      const osc = c.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const g = c.createGain();
      osc.connect(g);
      g.connect(masterGain);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.2, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.start(t);
      osc.stop(t + 0.35);
      liberarAlTerminar(osc, g, osc);
    });
  }

  // Lose — descending pitch
  function lose() {
    const c = ensureCtx();
    const now = c.currentTime;
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(80, now + 0.5);
    const g = c.createGain();
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 800;
    osc.connect(lp);
    lp.connect(g);
    g.connect(masterGain);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(0.15, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    osc.start(now);
    osc.stop(now + 0.55);
    liberarAlTerminar(osc, g, lp, osc);
  }

  // ── Silencio cuando nadie está mirando ──────────────────────────────────
  // El giro es un sonido continuo: si la pestaña queda de fondo (o se apaga el
  // servidor con la página abierta), seguía sonando para siempre. Se corta el
  // giro y se suspende el audio; al volver, se reanuda.

  function silenciar() {
    try { stopSpin(); } catch (e) {}
    if (ctx && ctx.state === 'running') { try { ctx.suspend(); } catch (e) {} }
  }

  function reanudar() {
    if (ctx && ctx.state === 'suspended') { try { ctx.resume(); } catch (e) {} }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) silenciar(); else reanudar();
    });
    // Cerrar o recargar la pestaña: soltar el audio en el acto.
    window.addEventListener('pagehide', silenciar);
    window.addEventListener('beforeunload', silenciar);
  }

  return {
    ensureCtx,
    setVolume,
    startSpin,
    updateSpinIntensity,
    stopSpin,
    setSpinStyle,
    getSpinStyle: () => spinStyle,
    previewSpin,
    spinStyles: Object.keys(SPIN_STYLES),
    tick,
    ballDrop,
    thunder,
    chip,
    win,
    lose,
    silenciar,
    reanudar,
  };
})();

window.AudioEngine = AudioEngine;

// ═══════════════════════════════════════════════════════════════════
//  VOZ (Web Speech API) — narra el número ganador en español.
//  No usa archivos ni red: la síntesis la hace el propio dispositivo.
//  Si el equipo no tiene voces en español, simplemente no habla.
// ═══════════════════════════════════════════════════════════════════
const Voice = (() => {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  let enabled = true;
  let voice = null;
  // Orden de preferencia: Paulina (es-MX) → cualquier es-MX → cualquier es-*
  const PREFERRED = ['Paulina', 'Mónica'];

  function pickVoice() {
    if (!supported) return null;
    const all = speechSynthesis.getVoices();
    if (!all.length) return null;
    for (const name of PREFERRED) {
      const v = all.find((x) => x.name.startsWith(name));
      if (v) return v;
    }
    return all.find((x) => /^es-MX/i.test(x.lang))
        || all.find((x) => /^es/i.test(x.lang))
        || null;
  }

  if (supported) {
    voice = pickVoice();
    // En algunos navegadores la lista llega asíncrona
    speechSynthesis.onvoiceschanged = () => { if (!voice) voice = pickVoice(); };
  }

  function setEnabled(v) { enabled = !!v; if (!enabled) cancel(); }
  function isEnabled() { return enabled; }
  function isSupported() { return supported && !!pickVoice(); }
  function cancel() { if (supported) { try { speechSynthesis.cancel(); } catch (e) {} } }

  function say(text, opts = {}) {
    if (!supported || !enabled || !text) return;
    if (!voice) voice = pickVoice();
    try {
      const u = new SpeechSynthesisUtterance(text);
      if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = 'es-MX'; }
      u.rate = opts.rate || 1.02;
      u.pitch = opts.pitch || 1;
      u.volume = opts.volume != null ? opts.volume : 1;
      speechSynthesis.speak(u);
    } catch (e) { /* si falla, el juego sigue igual */ }
  }

  // "0" → cero · "00" → doble cero · el resto lo lee bien el sintetizador
  function numeroHablado(n) {
    const s = String(n);
    if (s === '00') return 'doble cero';
    if (s === '0') return 'cero';
    return s;
  }

  // Los nombres vienen en MAYÚSCULAS (del paño). Algunos sintetizadores las
  // deletrean, así que las pasamos a "Caballo", "Águila", etc.
  function nombrePropio(s) {
    if (!s) return '';
    const t = String(s).toLowerCase();
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  // Estilo lotería de animalitos: "¡Salió la Paloma, número catorce!"
  // El 00 suena mejor sin la palabra "número": "¡Salió la Ballena, doble cero!"
  function anunciarGanador(n, animal, articulo) {
    cancel(); // corta cualquier anuncio anterior
    if (!animal) { say(`Número ganador: ${numeroHablado(n)}`); return; }
    const art = articulo || 'el';
    const nombre = nombrePropio(animal);
    const num = numeroHablado(n);
    const cola = String(n) === '00' ? 'doble cero' : `número ${num}`;
    say(`¡Salió ${art} ${nombre}, ${cola}!`);
  }
  function anunciarPremio(monto) { say(`¡Ganaste ${monto}!`); }
  function anunciarNoMasApuestas() { cancel(); say('No más apuestas', { rate: 1.08 }); }

  // La voz también se calla si la pestaña pasa a segundo plano o se cierra:
  // si no, termina de cantar el número aunque ya nadie esté mirando.
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => { if (document.hidden) cancel(); });
    window.addEventListener('pagehide', cancel);
    window.addEventListener('beforeunload', cancel);
  }

  return { say, setEnabled, isEnabled, isSupported, cancel, anunciarGanador, anunciarPremio, anunciarNoMasApuestas };
})();

window.Voice = Voice;
