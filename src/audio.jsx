// Motor de audio sintetizado con Web Audio API
// Todos los sonidos se generan en vivo — no se necesitan archivos externos.

const AudioEngine = (() => {
  let ctx = null;
  let masterGain = null;
  let spinGain = null;
  let spinOsc = null;
  let spinNoise = null;
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

  // Whoosh continuo del giro: ruido filtrado + tono grave
  function startSpin() {
    if (spinActive) return;
    const c = ensureCtx();
    spinActive = true;

    spinGain = c.createGain();
    spinGain.gain.value = 0;
    spinGain.gain.setTargetAtTime(0.25, c.currentTime, 0.3);
    spinGain.connect(masterGain);

    // Ruido filtrado = aire girando
    spinNoise = c.createBufferSource();
    spinNoise.buffer = getNoiseBuffer();
    spinNoise.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 600;
    bp.Q.value = 1.2;
    spinNoise.connect(bp);
    bp.connect(spinGain);
    spinNoise.start();

    // Tono grave = masa girando
    spinOsc = c.createOscillator();
    spinOsc.type = 'sawtooth';
    spinOsc.frequency.value = 60;
    const oscGain = c.createGain();
    oscGain.gain.value = 0.08;
    spinOsc.connect(oscGain);
    oscGain.connect(spinGain);
    spinOsc.start();
  }

  function updateSpinIntensity(intensity) {
    // intensity 0..1
    if (!spinActive || !spinGain) return;
    const g = 0.05 + intensity * 0.3;
    spinGain.gain.setTargetAtTime(g, ctx.currentTime, 0.1);
  }

  function stopSpin() {
    if (!spinActive) return;
    const c = ctx;
    spinActive = false;
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
  }

  return {
    ensureCtx,
    setVolume,
    startSpin,
    updateSpinIntensity,
    stopSpin,
    tick,
    ballDrop,
    thunder,
    chip,
    win,
    lose,
  };
})();

window.AudioEngine = AudioEngine;
