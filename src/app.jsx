// App principal — Ruleta Catatumbo
const { useState, useEffect, useRef, useMemo, useCallback } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "classic",
  "spinDuration": 7,
  "volume": 70,
  "lightningIntensity": 70,
  "autoSpin": false
}/*EDITMODE-END*/;

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

function RouletteApp() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  // Estado del juego
  const [balance, setBalance] = useState(STARTING_BALANCE);
  const [bets, setBets] = useState([]);
  const [lastBets, setLastBets] = useState([]);
  const [selectedChip, setSelectedChip] = useState(5);
  const [phase, setPhase] = useState('betting'); // 'betting' | 'lightning' | 'spinning' | 'result'
  const [resultIndex, setResultIndex] = useState(null);
  const [resultNum, setResultNum] = useState(null);
  const [history, setHistory] = useState([]); // últimos resultados
  const [lightningNumbers, setLightningNumbers] = useState(new Map());
  const [winAmount, setWinAmount] = useState(null);
  const [message, setMessage] = useState('Haz tu apuesta');
  const [cameraZoom, setCameraZoom] = useState(false);
  const [lightningBolts, setLightningBolts] = useState([]); // efectos visuales
  const [winDetails, setWinDetails] = useState(null);

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
  const wheelMaxSize = isMobile ? Math.min(vw - 24, 460) : 620;
  const wheelScale = wheelMaxSize / 620;
  const tableMaxW = isMobile ? vw - 24 : 810;
  const tableScale = Math.min(1, tableMaxW / 810);

  // Volume
  useEffect(() => {
    if (window.AudioEngine) window.AudioEngine.setVolume(t.volume / 100);
  }, [t.volume]);

  const totalBet = bets.reduce((s, b) => s + b.amount, 0);

  const placeBet = useCallback((bet) => {
    if (phase !== 'betting') return;
    if (bet.amount > balance) {
      setMessage('Saldo insuficiente');
      return;
    }
    setBalance((b) => b - bet.amount);
    setBets((bs) => [...bs, bet]);
  }, [phase, balance]);

  const removeBet = useCallback((type, payload) => {
    if (phase !== 'betting') return;
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
  }, [phase]);

  const clearBets = useCallback(() => {
    if (phase !== 'betting') return;
    setBalance((b) => b + totalBet);
    setBets([]);
  }, [phase, totalBet]);


  // Genera los números Lightning para esta ronda
  const generateLightning = useCallback(() => {
    const count = 1 + Math.floor(Math.random() * 5); // 1-5
    const pool = [...AMERICAN_WHEEL_ORDER];
    const chosen = new Map();
    for (let i = 0; i < count; i++) {
      const idx = Math.floor(Math.random() * pool.length);
      const n = pool.splice(idx, 1)[0];
      // Multiplicadores tipo lightning: 50x, 100x, 150x, 200x, 300x, 400x, 500x
      const multPool = [50, 75, 100, 150, 200, 300, 400, 500];
      const mult = multPool[Math.floor(Math.random() * multPool.length)];
      chosen.set(n, mult);
    }
    return chosen;
  }, []);

  const spawnBolt = useCallback(() => {
    const id = Math.random();
    setLightningBolts((bs) => [...bs, { id, x: Math.random() * 100, seed: Math.random() }]);
    setTimeout(() => {
      setLightningBolts((bs) => bs.filter((b) => b.id !== id));
    }, 600);
  }, []);

  const startSpin = useCallback(() => {
    if (phase !== 'betting' || bets.length === 0) {
      setMessage('Debes apostar primero');
      return;
    }
    setLastBets(bets.map(b => ({ ...b })));
    setPhase('lightning');
    setMessage('⚡ GENERANDO MULTIPLICADORES ⚡');

    // Animación Lightning
    const ltg = generateLightning();
    setLightningNumbers(ltg);

    // Sonidos de truenos escalonados
    const intensity = t.lightningIntensity / 100;
    const keys = [...ltg.keys()];
    keys.forEach((_, i) => {
      setTimeout(() => {
        if (window.AudioEngine) window.AudioEngine.thunder(0.5 + intensity * 0.8);
        spawnBolt();
      }, 300 + i * 400);
    });

    // Después de la fase Lightning, lanzar spin
    const totalLtgTime = 500 + keys.length * 400 + 800;
    setTimeout(() => {
      setPhase('spinning');
      setCameraZoom(true);
      setMessage('¡No más apuestas!');
      const idx = Math.floor(Math.random() * AMERICAN_WHEEL_ORDER.length);
      setResultIndex(idx);
      setResultNum(AMERICAN_WHEEL_ORDER[idx]);
    }, totalLtgTime);
  }, [phase, bets, generateLightning, t.lightningIntensity, spawnBolt]);

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
      setMessage('Debes apostar primero');
      return;
    }
    // Repetir apuestas (sin girar) — el jugador decide cuándo girar
    const total = lastBets.reduce((s, b) => s + b.amount, 0);
    if (total > balance) { setMessage('Saldo insuficiente para repetir'); return; }
    setBalance((b) => b - total);
    setBets(lastBets.map(b => ({ ...b })));
    if (window.AudioEngine) window.AudioEngine.chip();
  }, [phase, bets, lastBets, balance, startSpin]);

  const handleSpinEnd = useCallback(() => {
    setCameraZoom(false);
    setPhase('result');

    // Calcular ganancias
    let total = 0;
    let anyLightning = false;
    let biggestHit = null;
    bets.forEach((b) => {
      const { win, multiplier, isLightningHit } = calcWin(b, resultNum, lightningNumbers);
      total += win;
      if (isLightningHit) anyLightning = true;
      if (win > 0 && (!biggestHit || win > biggestHit.win)) {
        biggestHit = { bet: b, win, multiplier, isLightningHit };
      }
    });

    setWinAmount(total);
    setWinDetails(biggestHit);
    setBalance((bal) => bal + total);
    setHistory((h) => [{ n: resultNum, color: numColor(resultNum), lightning: anyLightning }, ...h].slice(0, 15));

    if (total > 0) {
      if (window.AudioEngine) window.AudioEngine.win(total >= 500 || anyLightning);
      setMessage(anyLightning ? `⚡ ¡LIGHTNING WIN! $${total.toLocaleString()} ⚡` : `¡Ganaste $${total.toLocaleString()}!`);
    } else {
      if (window.AudioEngine) window.AudioEngine.lose();
      setMessage(`Salió ${resultNum}. Sin ganancias.`);
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
      setMessage('Haz tu apuesta');
    }, 6000);
  }, [bets, resultNum, lightningNumbers]);

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
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontSize: isMobile ? 12 : 28, fontWeight: 900, letterSpacing: isMobile ? 1 : 4,
            color: t.theme === 'lightning' ? '#9fd8ff' : '#d4a94a',
            textShadow: t.theme === 'lightning'
              ? '0 0 20px #5ab8ff, 0 2px 4px rgba(0,0,0,0.8)'
              : '0 2px 4px rgba(0,0,0,0.8)',
            whiteSpace: 'nowrap',
          }}>
            ⚡ RULETA CATATUMBO ⚡
          </div>
          {!isMobile && (
            <div style={{ fontSize: 11, letterSpacing: 3, color: '#888', marginTop: 2 }}>
              AMERICAN · 0 · 00 · MULTIPLICADORES HASTA 500x
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: isMobile ? 10 : 24, alignItems: 'center' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: isMobile ? 8 : 10, letterSpacing: isMobile ? 1 : 2, color: '#888' }}>APUESTA</div>
            <div style={{ fontSize: isMobile ? 12 : 22, fontWeight: 900, color: '#ffd84a' }}>${totalBet.toLocaleString()}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: isMobile ? 8 : 10, letterSpacing: isMobile ? 1 : 2, color: '#888' }}>SALDO</div>
            <div style={{ fontSize: isMobile ? 14 : 26, fontWeight: 900, color: '#fff' }}>${balance.toLocaleString()}</div>
          </div>
        </div>
      </div>

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
          minHeight: isMobile ? 28 : 54,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          flexWrap: 'wrap',
          animation: phase === 'lightning' ? 'pulseBar 0.6s ease-in-out infinite alternate' : 'none',
        }}
      >
        {phase === 'betting' ? (
          history.length > 0 ? (
            <>
              <span style={{ fontSize: isMobile ? 8 : 10, letterSpacing: 2, color: '#888', marginRight: 4 }}>HIST.</span>
              {history.map((h, i) => (
                <div key={i} style={{
                  width: isMobile ? 18 : 30, height: isMobile ? 18 : 30, borderRadius: '50%',
                  background: h.color === 'red' ? '#b8101a' : h.color === 'black' ? '#151515' : '#0d7a2e',
                  border: h.lightning ? `2px solid ${t.theme === 'lightning' ? '#9fd8ff' : '#ffd84a'}` : '1px solid #444',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: isMobile ? 9 : 12, fontWeight: 900, color: '#fff',
                  boxShadow: h.lightning ? `0 0 8px ${t.theme === 'lightning' ? '#5ab8ff' : '#ffd84a'}` : 'none',
                  opacity: Math.max(0.4, 1 - i * 0.07),
                  flexShrink: 0,
                }}>{h.n}</div>
              ))}
            </>
          ) : (
            <span>{message}</span>
          )
        ) : (
          <>
            {phase === 'result' && resultNum != null && (
              <div style={{
                width: isMobile ? 32 : 40, height: isMobile ? 32 : 40, borderRadius: '50%',
                background: numColor(resultNum) === 'red' ? '#b8101a' : numColor(resultNum) === 'black' ? '#151515' : '#0d7a2e',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: isMobile ? 14 : 18, fontWeight: 900, marginRight: 10,
                border: '2px solid #fff',
                flexShrink: 0,
              }}>{resultNum}</div>
            )}
            <span>{message}</span>
          </>
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
            display: (!isMobile || phase === 'lightning' || phase === 'spinning') ? 'flex' : 'none',
            flexDirection: 'column', alignItems: 'center', gap: isMobile ? 10 : 16
          }}>
            <div style={{
              width: wheelMaxSize,
              height: wheelMaxSize,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative',
              overflow: 'visible',
            }}>
              <div style={{
                width: 620, height: 620,
                transform: `scale(${wheelScale})`,
                transformOrigin: 'center center',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'absolute',
                left: '50%', top: '50%',
                marginLeft: -310, marginTop: -310,
              }}>
                <RouletteWheel
                  spinning={phase === 'spinning'}
                  resultIndex={phase === 'spinning' || phase === 'result' ? resultIndex : null}
                  onSpinEnd={handleSpinEnd}
                  spinDuration={t.spinDuration}
                  theme={t.theme}
                  lightningNumbers={lightningNumbers}
                  lightningIntensity={t.lightningIntensity / 100}
                  zoomed={cameraZoom}
                />
              </div>
            </div>

            {/* History */}
            <div style={{ display: 'flex', gap: 6, width: '100%', justifyContent: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: '#888', alignSelf: 'center', marginRight: 8 }}>HISTORIAL</div>
              {history.length === 0 && <div style={{ color: '#555', fontSize: 12, fontStyle: 'italic' }}>Aún no hay giros</div>}
              {history.map((h, i) => (
                <div
                  key={i}
                  style={{
                    width: isMobile ? 24 : 28, height: isMobile ? 24 : 28, borderRadius: '50%',
                    background: h.color === 'red' ? '#b8101a' : h.color === 'black' ? '#151515' : '#0d7a2e',
                    border: h.lightning ? `2px solid ${t.theme === 'lightning' ? '#9fd8ff' : '#ffd84a'}` : '1px solid #444',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: isMobile ? 10 : 11, fontWeight: 900, color: '#fff',
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
        {(!isMobile || phase === 'betting' || phase === 'result') && (
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
                      bets={bets}
                      onPlaceBet={placeBet}
                      onRemoveBet={removeBet}
                      selectedChip={selectedChip}
                      disabled={phase !== 'betting'}
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
                    gap: 4,
                    alignItems: 'center',
                    padding: '4px 4px',
                    background: 'linear-gradient(180deg, #2a1a08, #1a0d02)',
                    borderRadius: '0 6px 6px 0', // sin redondeo en el borde izquierdo (pegado a pantalla)
                    border: `1px solid ${t.theme === 'lightning' ? '#2a4a8a' : '#8b6a20'}`,
                    borderLeft: 'none',
                    alignSelf: 'stretch',
                    flexShrink: 0,
                    width: 56,
                  }}>
                    {CHIP_VALUES.map((v) => (
                      <Chip
                        key={v}
                        value={v}
                        selected={selectedChip === v}
                        disabled={phase !== 'betting' || v > balance}
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
                      margin: '4px 0',
                      opacity: 0.5,
                    }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', alignItems: 'stretch' }}>
                      <ActionBtn onClick={clearBets} disabled={phase !== 'betting' || bets.length === 0} compact>
                        LIMPIAR
                      </ActionBtn>
                      <ActionBtn
                        id="spin-btn"
                        onClick={handleSpinClick}
                        disabled={phase !== 'betting' || (bets.length === 0 && lastBets.length === 0)}
                        primary
                        theme={t.theme}
                        compact
                      >
                        {bets.length === 0 && lastBets.length > 0 ? 'GIRAR ↻' : 'GIRAR'}
                      </ActionBtn>
                    </div>
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
                        bets={bets}
                        onPlaceBet={placeBet}
                        onRemoveBet={removeBet}
                        selectedChip={selectedChip}
                        disabled={phase !== 'betting'}
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
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                  {CHIP_VALUES.map((v) => (
                    <Chip
                      key={v}
                      value={v}
                      selected={selectedChip === v}
                      disabled={phase !== 'betting' || v > balance}
                      onClick={() => {
                        setSelectedChip(v);
                        if (window.AudioEngine) window.AudioEngine.chip();
                      }}
                    />
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <ActionBtn onClick={clearBets} disabled={phase !== 'betting' || bets.length === 0}>
                    LIMPIAR
                  </ActionBtn>
                  <ActionBtn
                    id="spin-btn"
                    onClick={handleSpinClick}
                    disabled={phase !== 'betting' || (bets.length === 0 && lastBets.length === 0)}
                    primary
                    theme={t.theme}
                  >
                    {bets.length === 0 && lastBets.length > 0 ? 'GIRAR ↻' : 'GIRAR'}
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
                  <span><b style={{ color: '#fff' }}>PLENO</b> 1 nº · 35:1</span>
                  <span><b style={{ color: '#fff' }}>SPLIT</b> 2 nº · 17:1</span>
                  <span><b style={{ color: '#fff' }}>CALLE</b> 3 nº · 11:1</span>
                  <span><b style={{ color: '#fff' }}>CUATRO</b> 4 nº · 8:1</span>
                  <span><b style={{ color: '#fff' }}>LÍNEA</b> 6 nº · 5:1</span>
                  <span><b style={{ color: '#fff' }}>TOP-LINE</b> 0,00,1,2,3 · 6:1</span>
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
      </TweaksPanel>
    </div>
  );
}

function ActionBtn({ children, onClick, disabled, primary, theme, id, compact }) {
  const accent = theme === 'lightning' ? '#5ab8ff' : '#d4a94a';
  const press = (e) => { if (!disabled) e.currentTarget.style.transform = 'scale(0.97)'; };
  const release = (e) => { e.currentTarget.style.transform = 'scale(1)'; };
  return (
    <button
      id={id}
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: compact ? 1 : 'none',
        padding: compact ? '5px 4px' : '10px 20px',
        borderRadius: 4,
        border: primary ? `2px solid ${accent}` : '1px solid #555',
        background: primary
          ? `linear-gradient(180deg, ${accent}, ${theme === 'lightning' ? '#2a5a9a' : '#8b6a20'})`
          : 'linear-gradient(180deg, #333, #111)',
        color: primary ? '#1a1006' : '#ddd',
        fontFamily: 'Georgia, serif',
        fontWeight: 900,
        fontSize: compact ? 9 : 13,
        letterSpacing: compact ? 0.5 : 2,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.35 : 1,
        boxShadow: primary ? `0 4px 10px rgba(0,0,0,0.6), 0 0 20px ${accent}55` : '0 3px 6px rgba(0,0,0,0.5)',
        transition: 'transform 0.1s, box-shadow 0.2s',
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

// Mount
const root = ReactDOM.createRoot(document.getElementById('app'));
root.render(<RouletteApp />);
