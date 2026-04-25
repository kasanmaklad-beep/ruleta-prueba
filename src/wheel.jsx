// Ruleta Americana 3D con física realista
// Orden oficial de casillas en ruleta americana (empezando por 0, sentido horario):
const AMERICAN_WHEEL_ORDER = [
  0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1,
  '00', 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2
];

const RED_NUMBERS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const BLACK_NUMBERS = new Set([2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35]);

function numColor(n) {
  if (n === 0 || n === '00') return 'green';
  return RED_NUMBERS.has(n) ? 'red' : 'black';
}

window.AMERICAN_WHEEL_ORDER = AMERICAN_WHEEL_ORDER;
window.RED_NUMBERS = RED_NUMBERS;
window.BLACK_NUMBERS = BLACK_NUMBERS;
window.numColor = numColor;

// ═══════════════════════════════════════════════════════════════════
// RouletteWheel — rueda 3D con bola animada físicamente
// Props:
//   spinning, resultIndex (index en AMERICAN_WHEEL_ORDER), onSpinEnd,
//   spinDuration, theme ('classic'|'modern'|'lightning'),
//   lightningNumbers (Map<number|'00', multiplier>),
//   lightningIntensity, zoomed (boolean)
// ═══════════════════════════════════════════════════════════════════

function RouletteWheel({
  spinning,
  resultIndex,
  onSpinEnd,
  spinDuration = 7,
  theme = 'classic',
  lightningNumbers = new Map(),
  lightningIntensity = 1,
  zoomed = false,
}) {
  const N = AMERICAN_WHEEL_ORDER.length; // 38
  const pocketAngle = 360 / N;

  // Rotación de la rueda (grados)
  const [wheelRot, setWheelRot] = React.useState(0);
  // Ángulo de la bola relativo a la mesa (grados), sentido contrario
  const [ballAngle, setBallAngle] = React.useState(0);
  // Radio de la bola (0..1 — 1 = pegado al borde exterior, 0 = centro)
  const [ballRadius, setBallRadius] = React.useState(1);
  // La bola está "asentada" en la casilla (sigue a la rueda)
  const [ballSeated, setBallSeated] = React.useState(true);

  const animRef = React.useRef(null);
  const lastTickAngleRef = React.useRef(0);

  React.useEffect(() => {
    if (!spinning || resultIndex == null) return;

    const startTime = performance.now();
    const duration = spinDuration * 1000;
    const startWheelRot = wheelRot;
    const startBallAngle = ballAngle;

    // Cuántas vueltas da la rueda y la bola (opuestas)
    const wheelTurns = 6 + Math.random() * 2; // 6-8 vueltas
    const ballTurns = 12 + Math.random() * 4; // 12-16 vueltas (más rápida inicialmente)

    // Ángulo final: la bola debe quedar en la casilla resultIndex
    // La casilla resultIndex está en el ángulo (resultIndex * pocketAngle) dentro de la rueda.
    // Ángulo absoluto de esa casilla al final = startWheelRot + wheelTurns*360 + finalSlotAngle (mod 360)
    // La bola debe llegar a ese ángulo absoluto (dirección opuesta).
    const slotAngleInWheel = resultIndex * pocketAngle;
    const finalWheelRot = startWheelRot + wheelTurns * 360;
    const finalBallAbsAngle = finalWheelRot + slotAngleInWheel;

    // La bola va en sentido opuesto (-). Su ángulo absoluto final debe igualar finalBallAbsAngle.
    // Elegimos finalBallAngle tal que gira -ballTurns*360 desde startBallAngle y termina en finalBallAbsAngle.
    // finalBallAngle = startBallAngle - ballTurns*360 + delta
    // Queremos finalBallAngle ≡ finalBallAbsAngle (mod 360)
    const rawBall = startBallAngle - ballTurns * 360;
    const need = finalBallAbsAngle;
    const deltaMod = ((need - rawBall) % 360 + 360) % 360;
    // Si deltaMod > 180, ajustar para que no retroceda mucho
    const finalBallAngle = rawBall + deltaMod;

    let lastTickAngle = startBallAngle;
    lastTickAngleRef.current = startBallAngle;

    // Inicia sonido del giro
    if (window.AudioEngine) {
      window.AudioEngine.startSpin();
    }

    let ballHasLanded = false;

    function frame(now) {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);

      // Easing de la rueda (suave, mantiene velocidad más tiempo)
      const wheelEase = 1 - Math.pow(1 - t, 2.5);
      const currentWheelRot = startWheelRot + (finalWheelRot - startWheelRot) * wheelEase;

      // Easing de la bola (más agresivo al final)
      // Bola viaja rápido inicialmente, luego se frena bruscamente (gravedad + fricción)
      const ballEase = 1 - Math.pow(1 - t, 3.2);
      const currentBallAngle = startBallAngle + (finalBallAngle - startBallAngle) * ballEase;

      // Radio de la bola: pegada al borde hasta ~75%, luego cae hacia el centro hasta la casilla
      // Con rebotes físicos
      let currentRadius = 1;
      if (t < 0.70) {
        currentRadius = 1;
      } else if (t < 0.85) {
        // Cae hacia los deflectores
        const tt = (t - 0.70) / 0.15;
        currentRadius = 1 - tt * 0.12;
      } else if (t < 0.95) {
        // Rebotes en deflectores (bounce)
        const tt = (t - 0.85) / 0.10;
        const bounce = Math.abs(Math.sin(tt * Math.PI * 4)) * (1 - tt) * 0.08;
        currentRadius = 0.88 - tt * 0.13 + bounce;
      } else {
        // Se asienta en la casilla
        const tt = (t - 0.95) / 0.05;
        currentRadius = 0.75 - tt * 0.15;
      }

      setWheelRot(currentWheelRot);
      setBallAngle(currentBallAngle);
      setBallRadius(currentRadius);

      // TICKS: cada vez que la bola pasa por un separador (relativo a la rueda)
      if (t < 0.97) {
        const relAngle = currentBallAngle - currentWheelRot;
        const angleDiff = Math.abs(relAngle - lastTickAngle);
        if (angleDiff >= pocketAngle * 0.95) {
          // Velocidad instantánea (grados/s aprox)
          const speed = angleDiff / 0.016;
          const vel = Math.min(1, speed / 800);
          if (window.AudioEngine) window.AudioEngine.tick(0.4 + vel * 0.6);
          if (window.AudioEngine) window.AudioEngine.updateSpinIntensity(1 - t * 0.5);
          lastTickAngle = relAngle;
        }
      }

      if (t < 1) {
        animRef.current = requestAnimationFrame(frame);
      } else {
        // Landed
        setBallSeated(true);
        if (!ballHasLanded) {
          ballHasLanded = true;
          if (window.AudioEngine) {
            window.AudioEngine.stopSpin();
            window.AudioEngine.ballDrop();
          }
          setTimeout(() => onSpinEnd && onSpinEnd(), 500);
        }
      }
    }

    setBallSeated(false);
    animRef.current = requestAnimationFrame(frame);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (window.AudioEngine) window.AudioEngine.stopSpin();
    };
    // eslint-disable-next-line
  }, [spinning, resultIndex]);

  // Estilos por tema
  const themes = {
    classic: {
      outerRing: 'radial-gradient(circle at 30% 30%, #7a5a2f 0%, #4a3518 55%, #2a1e0c 100%)',
      innerHub: 'radial-gradient(circle at 35% 35%, #c9a44a 0%, #8b6a20 50%, #3d2e10 100%)',
      divider: 'linear-gradient(180deg, #e8c76a, #8b6a20)',
      tableBg: '#0a0a0a',
      accent: '#d4a94a',
    },
    modern: {
      outerRing: 'radial-gradient(circle at 30% 30%, #2a2a2a 0%, #151515 55%, #050505 100%)',
      innerHub: 'radial-gradient(circle at 35% 35%, #d4af37 0%, #8a7020 50%, #2e2408 100%)',
      divider: 'linear-gradient(180deg, #f4d46a, #a08030)',
      tableBg: '#080808',
      accent: '#d4af37',
    },
    lightning: {
      outerRing: 'radial-gradient(circle at 30% 30%, #2a1a4a 0%, #120a28 55%, #04020f 100%)',
      innerHub: 'radial-gradient(circle at 35% 35%, #7ab8ff 0%, #2a5a9a 50%, #0a1838 100%)',
      divider: 'linear-gradient(180deg, #9fd8ff, #3a6aaa)',
      tableBg: '#05030f',
      accent: '#5ab8ff',
    },
  };
  const th = themes[theme] || themes.classic;

  // Tamaño de la rueda
  const WHEEL_SIZE = 520;
  const OUTER_R = WHEEL_SIZE / 2;
  const POCKET_R = OUTER_R - 30; // borde exterior de casillas
  const INNER_R = OUTER_R - 110; // borde interior (donde empieza el hub)
  const BALL_TRACK_R = OUTER_R - 8; // pista de la bola al borde

  // Construir pockets
  const pockets = AMERICAN_WHEEL_ORDER.map((n, i) => {
    const angle = i * pocketAngle;
    const color = numColor(n);
    const isLightning = lightningNumbers.has(n);
    return { n, i, angle, color, isLightning, mult: lightningNumbers.get(n) };
  });

  return (
    <div
      style={{
        position: 'relative',
        width: WHEEL_SIZE,
        height: WHEEL_SIZE,
        transform: zoomed ? 'scale(1.25)' : 'scale(1)',
        transition: 'transform 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
        filter: zoomed ? 'drop-shadow(0 40px 80px rgba(0,0,0,0.8))' : 'drop-shadow(0 20px 50px rgba(0,0,0,0.6))',
      }}
    >
      {/* Base / mesa debajo de la rueda */}
      <div
        style={{
          position: 'absolute',
          inset: -40,
          borderRadius: '50%',
          background: `radial-gradient(circle at 50% 40%, ${theme === 'lightning' ? '#1a1040' : '#2a1a08'} 0%, #000 80%)`,
          boxShadow: 'inset 0 0 60px rgba(0,0,0,0.9), 0 30px 80px rgba(0,0,0,0.8)',
        }}
      />

      {/* Anillo exterior de madera/metal (fijo) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: th.outerRing,
          boxShadow: `inset 0 0 0 3px ${theme === 'lightning' ? '#4a7ab8' : '#8b6a20'}, inset 0 10px 30px rgba(0,0,0,0.7), inset 0 -10px 30px rgba(0,0,0,0.5)`,
        }}
      />

      {/* Deflectores (fijos) — pequeños diamantes metálicos */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
        const a = (i * 45) + 22.5;
        const r = OUTER_R - 48;
        const x = Math.cos((a - 90) * Math.PI / 180) * r;
        const y = Math.sin((a - 90) * Math.PI / 180) * r;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 14,
              height: 14,
              marginLeft: -7,
              marginTop: -7,
              transform: `translate(${x}px, ${y}px) rotate(45deg)`,
              background: 'linear-gradient(135deg, #f0d48a, #8b6a20)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.4)',
              borderRadius: 2,
            }}
          />
        );
      })}

      {/* ═══ Rueda giratoria ═══ */}
      <div
        style={{
          position: 'absolute',
          inset: 18,
          borderRadius: '50%',
          transform: `rotate(${wheelRot}deg)`,
          willChange: 'transform',
        }}
      >
        {/* Casillas */}
        <svg
          viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`}
          style={{ position: 'absolute', inset: -18, width: WHEEL_SIZE, height: WHEEL_SIZE }}
        >
          <defs>
            <radialGradient id={`hub-${theme}`} cx="50%" cy="45%" r="50%">
              <stop offset="0%" stopColor={theme === 'lightning' ? '#7ab8ff' : '#d4af37'} />
              <stop offset="60%" stopColor={theme === 'lightning' ? '#2a5a9a' : '#8a7020'} />
              <stop offset="100%" stopColor={theme === 'lightning' ? '#0a1838' : '#2e2408'} />
            </radialGradient>
            <filter id="ltg-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="ltg-glow-strong" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id={`ltg-aura-${theme}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={theme === 'lightning' ? '#9fd8ff' : '#ffd84a'} stopOpacity="0.9" />
              <stop offset="50%" stopColor={theme === 'lightning' ? '#5ab8ff' : '#ffaa00'} stopOpacity="0.5" />
              <stop offset="100%" stopColor={theme === 'lightning' ? '#5ab8ff' : '#ffaa00'} stopOpacity="0" />
            </radialGradient>
          </defs>

          {pockets.map((p) => {
            const cx = WHEEL_SIZE / 2;
            const cy = WHEEL_SIZE / 2;
            const a1 = (p.angle - pocketAngle / 2 - 90) * Math.PI / 180;
            const a2 = (p.angle + pocketAngle / 2 - 90) * Math.PI / 180;
            const x1o = cx + Math.cos(a1) * POCKET_R;
            const y1o = cy + Math.sin(a1) * POCKET_R;
            const x2o = cx + Math.cos(a2) * POCKET_R;
            const y2o = cy + Math.sin(a2) * POCKET_R;
            const x1i = cx + Math.cos(a1) * INNER_R;
            const y1i = cy + Math.sin(a1) * INNER_R;
            const x2i = cx + Math.cos(a2) * INNER_R;
            const y2i = cy + Math.sin(a2) * INNER_R;

            const fill = p.color === 'red' ? '#c8101a' : p.color === 'black' ? '#151515' : '#0d7a2e';

            const d = `M ${x1o} ${y1o} A ${POCKET_R} ${POCKET_R} 0 0 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${INNER_R} ${INNER_R} 0 0 0 ${x1i} ${y1i} Z`;

            return (
              <g key={p.i}>
                <path d={d} fill={fill} />
                {/* Brillo interior */}
                <path
                  d={d}
                  fill="url(#pocketShine)"
                  opacity="0.3"
                />
                {p.isLightning && (
                  <>
                    {/* Relleno pulsante dorado/azul sobre la casilla */}
                    <path
                      d={d}
                      fill={theme === 'lightning' ? '#5ab8ff' : '#ffd84a'}
                      style={{ animation: 'pocketLtgPulse 0.7s ease-in-out infinite alternate', mixBlendMode: 'screen' }}
                    />
                    {/* Borde brillante grueso */}
                    <path
                      d={d}
                      fill="none"
                      stroke={theme === 'lightning' ? '#ffffff' : '#fff5b0'}
                      strokeWidth="3.5"
                      filter="url(#ltg-glow-strong)"
                      style={{ animation: 'ltgFlicker 0.45s ease-in-out infinite alternate' }}
                    />
                    {/* Segundo borde más fino color acento */}
                    <path
                      d={d}
                      fill="none"
                      stroke={theme === 'lightning' ? '#9fd8ff' : '#ffd84a'}
                      strokeWidth="1.8"
                      style={{ animation: 'ltgFlicker 0.6s ease-in-out infinite alternate-reverse' }}
                    />
                  </>
                )}
              </g>
            );
          })}

          <defs>
            <linearGradient id="pocketShine" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.3)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
            </linearGradient>
          </defs>

          {/* Separadores metálicos */}
          {pockets.map((p) => {
            const a = (p.angle - pocketAngle / 2 - 90) * Math.PI / 180;
            const cx = WHEEL_SIZE / 2;
            const cy = WHEEL_SIZE / 2;
            const x1 = cx + Math.cos(a) * INNER_R;
            const y1 = cy + Math.sin(a) * INNER_R;
            const x2 = cx + Math.cos(a) * POCKET_R;
            const y2 = cy + Math.sin(a) * POCKET_R;
            return (
              <line
                key={'div-' + p.i}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={theme === 'lightning' ? '#c9e5ff' : '#e8c76a'}
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity="0.9"
              />
            );
          })}

          {/* Números */}
          {pockets.map((p) => {
            const cx = WHEEL_SIZE / 2;
            const cy = WHEEL_SIZE / 2;
            const tr = (POCKET_R + INNER_R) / 2;
            const a = (p.angle - 90) * Math.PI / 180;
            const tx = cx + Math.cos(a) * tr;
            const ty = cy + Math.sin(a) * tr;
            return (
              <g key={'t-' + p.i}>
                {p.isLightning && (
                  <>
                    {/* Aura radial detrás del número */}
                    <circle
                      cx={tx} cy={ty} r="22"
                      fill={`url(#ltg-aura-${theme})`}
                      style={{ animation: 'ltgAuraPulse 0.8s ease-in-out infinite alternate', transformOrigin: `${tx}px ${ty}px` }}
                    />
                    {/* Estrella/destello */}
                    <text
                      x={tx} y={ty - 13}
                      fill={theme === 'lightning' ? '#9fd8ff' : '#ffd84a'}
                      fontSize="9"
                      fontWeight="900"
                      textAnchor="middle"
                      transform={`rotate(${p.angle}, ${tx}, ${ty})`}
                      style={{ filter: `drop-shadow(0 0 4px ${theme === 'lightning' ? '#5ab8ff' : '#ffd84a'})`, animation: 'ltgFlicker 0.5s ease-in-out infinite alternate' }}
                    >
                      ⚡
                    </text>
                  </>
                )}
                <text
                  x={tx}
                  y={ty}
                  fill={p.isLightning ? (theme === 'lightning' ? '#ffffff' : '#fff5b0') : '#fff'}
                  fontSize={p.isLightning ? "16" : "14"}
                  fontWeight={p.isLightning ? "900" : "700"}
                  fontFamily="Georgia, serif"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${p.angle}, ${tx}, ${ty})`}
                  style={{
                    textShadow: p.isLightning
                      ? `0 0 6px ${theme === 'lightning' ? '#9fd8ff' : '#ffd84a'}, 0 0 12px ${theme === 'lightning' ? '#5ab8ff' : '#ffaa00'}, 0 1px 2px rgba(0,0,0,0.8)`
                      : '0 1px 2px rgba(0,0,0,0.8)',
                  }}
                >
                  {p.n}
                </text>
              </g>
            );
          })}

          {/* ═══ Marcador del número ganador ═══ */}
          {!spinning && resultIndex != null && (() => {
            const p = pockets[resultIndex];
            const cx = WHEEL_SIZE / 2;
            const cy = WHEEL_SIZE / 2;
            const a1 = (p.angle - pocketAngle / 2 - 90) * Math.PI / 180;
            const a2 = (p.angle + pocketAngle / 2 - 90) * Math.PI / 180;
            const x1o = cx + Math.cos(a1) * POCKET_R;
            const y1o = cy + Math.sin(a1) * POCKET_R;
            const x2o = cx + Math.cos(a2) * POCKET_R;
            const y2o = cy + Math.sin(a2) * POCKET_R;
            const x1i = cx + Math.cos(a1) * INNER_R;
            const y1i = cy + Math.sin(a1) * INNER_R;
            const x2i = cx + Math.cos(a2) * INNER_R;
            const y2i = cy + Math.sin(a2) * INNER_R;
            const d = `M ${x1o} ${y1o} A ${POCKET_R} ${POCKET_R} 0 0 1 ${x2o} ${y2o} L ${x2i} ${y2i} A ${INNER_R} ${INNER_R} 0 0 0 ${x1i} ${y1i} Z`;
            const tr = (POCKET_R + INNER_R) / 2;
            const ang = (p.angle - 90) * Math.PI / 180;
            const tx = cx + Math.cos(ang) * tr;
            const ty = cy + Math.sin(ang) * tr;
            const crownR = POCKET_R + 18;
            const crownX = cx + Math.cos(ang) * crownR;
            const crownY = cy + Math.sin(ang) * crownR;
            return (
              <g style={{ pointerEvents: 'none' }}>
                <path d={d} fill="#ffd84a" opacity="0.35"
                  style={{ animation: 'winnerPulse 0.8s ease-in-out infinite alternate', mixBlendMode: 'screen' }} />
                <path d={d} fill="none" stroke="#fff5b0" strokeWidth="4"
                  filter="url(#ltg-glow-strong)"
                  style={{ animation: 'winnerFlick 0.5s ease-in-out infinite alternate' }} />
                <path d={d} fill="none" stroke="#ffd84a" strokeWidth="2" />
                <circle cx={tx} cy={ty} r="26" fill={`url(#ltg-aura-${theme})`}
                  style={{ animation: 'winnerAura 1s ease-in-out infinite alternate', transformOrigin: `${tx}px ${ty}px` }} />
                <text x={crownX} y={crownY} fontSize="20" textAnchor="middle" dominantBaseline="middle"
                  transform={`rotate(${p.angle}, ${crownX}, ${crownY})`}
                  style={{ filter: 'drop-shadow(0 0 6px #ffd84a) drop-shadow(0 0 12px #ffaa00)', animation: 'winnerFlick 0.6s ease-in-out infinite alternate' }}>
                  ★
                </text>
              </g>
            );
          })()}

          {/* Hub central */}
          <circle cx={WHEEL_SIZE / 2} cy={WHEEL_SIZE / 2} r={INNER_R - 10} fill={`url(#hub-${theme})`} />
          {/* 4 radios decorativos del hub */}
          {[0, 90, 180, 270].map((a) => {
            const cx = WHEEL_SIZE / 2;
            const cy = WHEEL_SIZE / 2;
            const rad = (a - 90) * Math.PI / 180;
            const x = cx + Math.cos(rad) * (INNER_R - 15);
            const y = cy + Math.sin(rad) * (INNER_R - 15);
            return (
              <line
                key={'spoke-' + a}
                x1={cx} y1={cy}
                x2={x} y2={y}
                stroke={theme === 'lightning' ? '#4a8acc' : '#8b6a20'}
                strokeWidth="3"
                opacity="0.5"
              />
            );
          })}
          {/* Corona central */}
          <circle cx={WHEEL_SIZE / 2} cy={WHEEL_SIZE / 2} r={22} fill={th.accent} opacity="0.9" />
          <circle cx={WHEEL_SIZE / 2} cy={WHEEL_SIZE / 2} r={8} fill="#1a1006" />
        </svg>
      </div>

      {/* ═══ Bola ═══ */}
      {(() => {
        // Posición de la bola: usa siempre ballAngle (que conserva el ángulo
        // del último aterrizaje entre rondas, así la próxima esfera sale desde ahí).
        const rotForBall = ballAngle;
        const r = ballRadius * (BALL_TRACK_R - 18) + 18;
        const rad = (rotForBall - 90) * Math.PI / 180;
        const bx = Math.cos(rad) * r;
        const by = Math.sin(rad) * r;
        return (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 14,
              height: 14,
              marginLeft: -7,
              marginTop: -7,
              transform: `translate(${bx}px, ${by}px)`,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 30% 30%, #ffffff 0%, #e0e0e0 50%, #888 100%)',
              boxShadow: '0 3px 6px rgba(0,0,0,0.7), inset -1px -2px 3px rgba(0,0,0,0.3)',
              zIndex: 10,
              pointerEvents: 'none',
            }}
          />
        );
      })()}

    </div>
  );
}

window.RouletteWheel = RouletteWheel;
