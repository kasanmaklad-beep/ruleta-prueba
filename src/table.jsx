// Paño de apuestas americano clásico (layout de casino con 0 y 00)
// Sistema completo con apuestas internas: straight, split, street, corner, six-line, top-line, basket

// Pagos (sin contar la apuesta original): straight 35, split 17, street 11, corner 8,
// six-line 5, top-line (0,00,1,2,3) 6, basket (0,00,2 o 0,1,2 o 00,2,3) 11.
// Aquí calcWin retorna pago BRUTO incluyendo la apuesta (amount * (payout+1)).

function BettingTable({ bets, onPlaceBet, onRemoveBet, selectedChip, disabled, theme, lightningNumbers, rotateLabels, winningNumber }) {
  // Helper: contra-rotación de textos cuando el paño está girado 90° (móvil vertical)
  const rotText = (cx, cy) => rotateLabels ? `rotate(-90 ${cx} ${cy})` : undefined;
  const felt = {
    classic: { bg: '#0a5a2a', border: '#d4a94a', text: '#f4e8b8' },
    modern: { bg: '#062418', border: '#d4af37', text: '#e8d890' },
    lightning: { bg: '#0a1838', border: '#5ab8ff', text: '#c9e5ff' },
  }[theme] || { bg: '#0a5a2a', border: '#d4a94a', text: '#f4e8b8' };

  const accent = theme === 'lightning' ? '#9fd8ff' : '#ffd84a';
  const accentGlow = theme === 'lightning' ? '#5ab8ff' : '#ffd84a';

  // ───────────────────────────────────────────────
  // GEOMETRÍA del paño (en píxeles relativos al SVG/overlay)
  // 12 columnas × 3 filas + columna 0/00 a la izquierda
  // ───────────────────────────────────────────────
  const ZERO_W = 50;       // ancho de la columna 0/00
  const NUM_W = 56;        // ancho de cada celda numérica
  const NUM_H = 84;        // alto de cada celda numérica (más alto = números más visibles en vista rotada móvil)
  const COL21_W = 56;      // ancho columna 2:1
  const OUTER_H = 52;      // alto de docenas / exteriores

  const TOTAL_W = ZERO_W + NUM_W * 12 + COL21_W;
  // TOTAL_H = altura del grid de números (sin contar las filas de docenas/exteriores)
  const TOTAL_H = NUM_H * 3;

  // Posición central de la celda numérica n
  // Layout: filas top→bottom = 3, 2, 1
  // n = 1..36
  const cellRect = (n) => {
    const row = ((n - 1) % 3); // 0 = bottom (1,4..), 1=mid, 2=top
    const col = Math.floor((n - 1) / 3); // 0..11
    const rowFromTop = 2 - row; // top row first
    const x = ZERO_W + col * NUM_W;
    const y = rowFromTop * NUM_H;
    return { x, y, w: NUM_W, h: NUM_H, cx: x + NUM_W / 2, cy: y + NUM_H / 2 };
  };

  const zeroRect = () => ({ x: 0, y: 0, w: ZERO_W, h: NUM_H * 1.5, cx: ZERO_W / 2, cy: NUM_H * 0.75 });
  const dzeroRect = () => ({ x: 0, y: NUM_H * 1.5, w: ZERO_W, h: NUM_H * 1.5, cx: ZERO_W / 2, cy: NUM_H * 2.25 });

  // ───────────────────────────────────────────────
  // Construir HOTSPOTS para apuestas internas
  // ───────────────────────────────────────────────
  const hotspots = [];

  // STRAIGHT 1..36
  for (let n = 1; n <= 36; n++) {
    const r = cellRect(n);
    hotspots.push({ type: 'straight', payload: n, numbers: [n], x: r.x, y: r.y, w: r.w, h: r.h, chipX: r.cx, chipY: r.cy });
  }
  // STRAIGHT 0 / 00
  const z = zeroRect();
  hotspots.push({ type: 'straight', payload: 0, numbers: [0], x: z.x, y: z.y, w: z.w, h: z.h, chipX: z.cx, chipY: z.cy });
  const dz = dzeroRect();
  hotspots.push({ type: 'straight', payload: '00', numbers: ['00'], x: dz.x, y: dz.y, w: dz.w, h: dz.h, chipX: dz.cx, chipY: dz.cy });

  // SPLIT horizontales (entre números adyacentes en la misma fila): n y n+3 (col→col+1)
  // Ej: 1|4, 2|5, 3|6, ..., 33|36
  for (let n = 1; n <= 33; n++) {
    const r1 = cellRect(n);
    const r2 = cellRect(n + 3);
    if (r1.y !== r2.y) continue;
    const cx = (r1.x + r1.w + r2.x) / 2;
    const cy = r1.cy;
    hotspots.push({
      type: 'split', payload: [n, n + 3].sort((a, b) => a - b).join('-'),
      numbers: [n, n + 3],
      x: cx - 8, y: cy - 12, w: 16, h: 24,
      chipX: cx, chipY: cy,
    });
  }
  // SPLIT verticales (misma columna, filas adyacentes): n y n+1 si están en la misma col
  for (let n = 1; n <= 35; n++) {
    if (n % 3 === 0) continue; // 3,6,9... no se splittean con n+1 (otra columna)
    const r1 = cellRect(n);
    const r2 = cellRect(n + 1);
    const cx = r1.cx;
    const cy = (r1.y + (r1.y < r2.y ? r1.h : 0) + r2.y + (r2.y < r1.y ? r2.h : 0)) / 2;
    // simpler: borde común
    const yBorder = Math.max(r1.y, r2.y);
    hotspots.push({
      type: 'split', payload: [n, n + 1].sort((a, b) => a - b).join('-'),
      numbers: [n, n + 1],
      x: cx - 12, y: yBorder - 8, w: 24, h: 16,
      chipX: cx, chipY: yBorder,
    });
  }
  // SPLIT 0-00
  {
    const cx = ZERO_W / 2;
    const cy = NUM_H * 1.5;
    hotspots.push({ type: 'split', payload: '0-00', numbers: [0, '00'], x: cx - 12, y: cy - 8, w: 24, h: 16, chipX: cx, chipY: cy });
  }

  // STREET (3 números de una fila): {1,2,3}, {4,5,6}, ..., {34,35,36}
  for (let col = 0; col < 12; col++) {
    const baseN = col * 3 + 1;
    const r = cellRect(baseN); // bottom (n=baseN)
    const xRight = r.x + r.w;
    const yTop = r.y - 2 * NUM_H; // top of column
    const yBottom = r.y + r.h;
    hotspots.push({
      type: 'street', payload: `${baseN}-${baseN + 1}-${baseN + 2}`,
      numbers: [baseN, baseN + 1, baseN + 2],
      x: xRight - 10, y: yTop, w: 20, h: NUM_H * 3,
      chipX: xRight, chipY: yBottom,
    });
  }

  // CORNER (4 números): cuadrado entre dos columnas y dos filas
  // n, n+3, n+1, n+4 (donde n%3 != 0)
  for (let n = 1; n <= 32; n++) {
    if (n % 3 === 0) continue;
    const r1 = cellRect(n);
    const r2 = cellRect(n + 4); // diagonal
    if (r1.y === r2.y) continue;
    // esquina común: (r1.x + r1.w, max(r1.y, r2.y))
    const cx = r1.x + r1.w;
    const cy = Math.max(r1.y, r2.y);
    const nums = [n, n + 1, n + 3, n + 4].sort((a, b) => a - b);
    hotspots.push({
      type: 'corner', payload: nums.join('-'),
      numbers: nums,
      x: cx - 10, y: cy - 10, w: 20, h: 20,
      chipX: cx, chipY: cy,
    });
  }

  // SIX-LINE (2 streets adyacentes, 6 números): {1..6}, {4..9}, ..., {31..36}
  for (let col = 0; col < 11; col++) {
    const baseN = col * 3 + 1;
    const r = cellRect(baseN);
    const xRight = r.x + r.w;
    const yBottom = r.y + r.h;
    const nums = [baseN, baseN + 1, baseN + 2, baseN + 3, baseN + 4, baseN + 5];
    hotspots.push({
      type: 'sixline', payload: nums.join('-'),
      numbers: nums,
      x: xRight - 10, y: yBottom - 10, w: 20, h: 20,
      chipX: xRight, chipY: yBottom,
    });
  }

  // TOP-LINE (5 números: 0, 00, 1, 2, 3) — esquina entre 0/00 y la primera columna
  {
    const r1 = cellRect(1); // bottom-left de la columna 1
    const cx = r1.x;
    const cy = r1.y; // top de la celda 3 (yTop col)
    // Hotspot en la unión 00-3 (esquina)
    const yTop = cellRect(3).y; // top of col-1's top cell
    hotspots.push({
      type: 'topline', payload: '0-00-1-2-3',
      numbers: [0, '00', 1, 2, 3],
      x: cx - 10, y: yTop + NUM_H / 2 - 10, w: 20, h: 20,
      chipX: cx, chipY: yTop + NUM_H / 2,
    });
  }
  // BASKET no aplica en americana (basket = top-line aquí). Lo omitimos para no duplicar.

  // ───────────────────────────────────────────────
  // Helpers de apuestas
  // ───────────────────────────────────────────────
  const placeBet = (type, payload, numbers) => {
    if (disabled || !selectedChip) return;
    if (window.AudioEngine) window.AudioEngine.chip();
    onPlaceBet({ type, payload, numbers, amount: selectedChip });
  };
  const betTotalForKey = (type, payload) => {
    return bets
      .filter((b) => b.type === type && String(b.payload) === String(payload))
      .reduce((s, b) => s + b.amount, 0);
  };

  // ───────────────────────────────────────────────
  // UI: SVG fondo + overlays para hotspots
  // ───────────────────────────────────────────────

  const [hover, setHover] = React.useState(null);

  // Highlight de números afectados por el hover
  const hoverNumbers = React.useMemo(() => {
    if (!hover || !hover.numbers) return new Set();
    return new Set(hover.numbers.map(String));
  }, [hover]);

  return (
    <div
      style={{
        padding: 6,
        background: `radial-gradient(ellipse at center, ${felt.bg} 0%, ${shade(felt.bg, -30)} 100%)`,
        borderRadius: 6,
        boxShadow: `inset 0 0 40px rgba(0,0,0,0.6), 0 8px 24px rgba(0,0,0,0.5)`,
        border: `2px solid ${felt.border}`,
        width: '100%',
        userSelect: 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <div style={{ position: 'relative', width: TOTAL_W, height: TOTAL_H + OUTER_H * 2 }}>
          {/* ===== CELDAS PRINCIPALES (visual) ===== */}
          <svg
            viewBox={`0 0 ${TOTAL_W} ${TOTAL_H + OUTER_H * 2}`}
            width={TOTAL_W}
            height={TOTAL_H + OUTER_H * 2}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          >
            <defs>
              <filter id="felt-ltg-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <radialGradient id="felt-ltg-aura" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor={accent} stopOpacity="0.7" />
                <stop offset="60%" stopColor={accentGlow} stopOpacity="0.3" />
                <stop offset="100%" stopColor={accentGlow} stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* 0 */}
            <CellRect x={0} y={0} w={ZERO_W} h={NUM_H * 1.5} fill="#0d7a2e" stroke={felt.border} />
            {/* 00 */}
            <CellRect x={0} y={NUM_H * 1.5} w={ZERO_W} h={NUM_H * 1.5} fill="#0d7a2e" stroke={felt.border} />

            {/* Números 1..36 */}
            {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => {
              const r = cellRect(n);
              const c = numColor(n);
              const fill = c === 'red' ? '#b8101a' : '#151515';
              return <CellRect key={n} x={r.x} y={r.y} w={r.w} h={r.h} fill={fill} stroke={felt.border} />;
            })}

            {/* Highlight de hover */}
            {hover && hover.numbers && hover.numbers.map((n, i) => {
              const r = n === 0 ? zeroRect() : n === '00' ? dzeroRect() : cellRect(n);
              if (!r) return null;
              return (
                <rect
                  key={i}
                  x={r.x + 2} y={r.y + 2} width={r.w - 4} height={r.h - 4}
                  fill="rgba(255,255,255,0.15)"
                  stroke={accent}
                  strokeWidth="2"
                  style={{ pointerEvents: 'none', filter: `drop-shadow(0 0 6px ${accentGlow})` }}
                />
              );
            })}

            {/* Texto 0 */}
            <text x={ZERO_W / 2} y={NUM_H * 0.85} fill="#fff" fontSize="22" fontWeight="900" fontFamily="Georgia, serif" textAnchor="middle"
              transform={rotText(ZERO_W / 2, NUM_H * 0.75)}>0</text>
            <text x={ZERO_W / 2} y={NUM_H * 1.5 + NUM_H * 0.85} fill="#fff" fontSize="22" fontWeight="900" fontFamily="Georgia, serif" textAnchor="middle"
              transform={rotText(ZERO_W / 2, NUM_H * 2.25)}>00</text>

            {/* Números 1..36 texto */}
            {Array.from({ length: 36 }, (_, i) => i + 1).map((n) => {
              const r = cellRect(n);
              const isLtg = lightningNumbers && lightningNumbers.has(n);
              return (
                <text key={'t' + n} x={r.cx} y={r.cy + 6}
                  fill={isLtg ? '#fff5b0' : '#fff'}
                  fontSize={isLtg ? "20" : "18"}
                  fontWeight="900" fontFamily="Georgia, serif" textAnchor="middle"
                  transform={rotText(r.cx, r.cy)}
                  style={{
                    textShadow: isLtg
                      ? `0 0 8px ${accent}, 0 0 14px ${accentGlow}, 0 1px 2px rgba(0,0,0,0.9)`
                      : '0 1px 2px rgba(0,0,0,0.8)',
                  }}
                >
                  {n}
                </text>
              );
            })}

            {/* ═══ LIGHTNING OVERLAYS — sobre celdas afectadas ═══ */}
            {[...Array(36).keys()].map((i) => i + 1).concat([0, '00']).filter((n) => lightningNumbers && lightningNumbers.has(n)).map((n) => {
              const r = n === 0 ? zeroRect() : n === '00' ? dzeroRect() : cellRect(n);
              return (
                <g key={'ltg-overlay-' + n}>
                  {/* Aura radial pulsante */}
                  <ellipse
                    cx={r.cx} cy={r.cy} rx={r.w * 0.7} ry={r.h * 0.6}
                    fill="url(#felt-ltg-aura)"
                    style={{
                      animation: 'ltgAuraPulse 0.85s ease-in-out infinite alternate',
                      transformOrigin: `${r.cx}px ${r.cy}px`,
                    }}
                  />
                  {/* Marco eléctrico pulsante */}
                  <rect
                    x={r.x + 2} y={r.y + 2} width={r.w - 4} height={r.h - 4}
                    fill="none"
                    stroke={accent}
                    strokeWidth="3"
                    filter="url(#felt-ltg-glow)"
                    style={{ animation: 'ltgFlicker 0.5s ease-in-out infinite alternate' }}
                  />
                  {/* Marco interior fino blanco */}
                  <rect
                    x={r.x + 4} y={r.y + 4} width={r.w - 8} height={r.h - 8}
                    fill="none"
                    stroke="#fff"
                    strokeWidth="0.8"
                    opacity="0.85"
                    style={{ animation: 'ltgFlicker 0.45s ease-in-out infinite alternate-reverse' }}
                  />
                </g>
              );
            })}

            {/* Multiplicador grande arriba de cada celda Lightning */}
            {[...Array(36).keys()].map((i) => i + 1).concat([0, '00']).filter((n) => lightningNumbers && lightningNumbers.has(n)).map((n) => {
              const r = n === 0 ? zeroRect() : n === '00' ? dzeroRect() : cellRect(n);
              const mult = lightningNumbers.get(n);
              return (
                <g key={'lt-mult-' + n} transform={rotText(r.cx, r.y - 2)}>
                  {/* Pill background */}
                  <rect
                    x={r.cx - 22} y={r.y - 9}
                    width="44" height="14"
                    rx="7"
                    fill={accent}
                    stroke="#fff"
                    strokeWidth="1"
                    filter="url(#felt-ltg-glow)"
                    style={{ animation: 'ltgFlicker 0.55s ease-in-out infinite alternate' }}
                  />
                  <text
                    x={r.cx} y={r.y + 1}
                    fill="#1a0a00"
                    fontSize="10"
                    fontWeight="900"
                    fontFamily="Georgia, serif"
                    textAnchor="middle"
                  >
                    ⚡ {mult}x
                  </text>
                </g>
              );
            })}

            {/* Columnas 2:1 */}
            {[0, 1, 2].map((i) => {
              const x = ZERO_W + 12 * NUM_W;
              const y = i * NUM_H;
              return <CellRect key={'c' + i} x={x} y={y} w={COL21_W} h={NUM_H} fill="rgba(0,0,0,0.25)" stroke={felt.border} />;
            })}
            {[0, 1, 2].map((i) => {
              const cx = ZERO_W + 12 * NUM_W + COL21_W / 2;
              const cy = i * NUM_H + NUM_H / 2;
              return (
                <text key={'ct' + i} x={cx} y={cy + 5}
                  fill={felt.text} fontSize={rotateLabels ? 12 : 14} fontWeight="800" fontFamily="Georgia, serif" textAnchor="middle" letterSpacing={rotateLabels ? 0 : 2}
                  transform={rotText(cx, cy)}>
                  2:1
                </text>
              );
            })}

            {/* Docenas */}
            {[0, 1, 2].map((i) => {
              const x = ZERO_W + i * 4 * NUM_W;
              return <CellRect key={'d' + i} x={x} y={TOTAL_H} w={4 * NUM_W} h={OUTER_H} fill="rgba(0,0,0,0.3)" stroke={felt.border} />;
            })}
            {['1st 12', '2nd 12', '3rd 12'].map((label, i) => {
              const cx = ZERO_W + i * 4 * NUM_W + 2 * NUM_W;
              const cy = TOTAL_H + OUTER_H / 2;
              return (
                <text key={'dt' + i} x={cx} y={cy + 5}
                  fill={felt.text} fontSize={rotateLabels ? 12 : 14} fontWeight="800" fontFamily="Georgia, serif" textAnchor="middle" letterSpacing={rotateLabels ? 0 : 2}
                  transform={rotText(cx, cy)}>
                  {label}
                </text>
              );
            })}

            {/* ═══ MARCADOR 3D del número ganador ═══ */}
            {winningNumber != null && (() => {
              const n = winningNumber;
              const r = n === 0 ? zeroRect() : n === '00' ? dzeroRect() : cellRect(n);
              if (!r) return null;
              const cx = r.cx;
              const cy = r.cy;
              const coinR = Math.min(r.w, r.h) * 0.36;
              const coinRy = coinR * 0.62;
              const sideH = coinR * 0.32;
              return (
                <g style={{ pointerEvents: 'none' }}>
                  <defs>
                    <radialGradient id="winner-coin-top" cx="35%" cy="30%" r="75%">
                      <stop offset="0%" stopColor="#fffbe6" />
                      <stop offset="35%" stopColor="#ffe680" />
                      <stop offset="70%" stopColor="#e0a020" />
                      <stop offset="100%" stopColor="#7a4a08" />
                    </radialGradient>
                    <linearGradient id="winner-coin-side" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#c88a18" />
                      <stop offset="50%" stopColor="#7a4a08" />
                      <stop offset="100%" stopColor="#3a2004" />
                    </linearGradient>
                    <radialGradient id="winner-rays" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="#fff5b0" stopOpacity="0.9" />
                      <stop offset="50%" stopColor="#ffd84a" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="#ffd84a" stopOpacity="0" />
                    </radialGradient>
                    <filter id="winner-glow" x="-100%" y="-100%" width="300%" height="300%">
                      <feGaussianBlur stdDeviation="4" result="b" />
                      <feMerge>
                        <feMergeNode in="b" /><feMergeNode in="b" /><feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Aura radial pulsante */}
                  <circle cx={cx} cy={cy} r={Math.max(r.w, r.h) * 0.65}
                    fill="url(#winner-rays)"
                    style={{ animation: 'winnerAura 1.1s ease-in-out infinite alternate', transformOrigin: `${cx}px ${cy}px` }} />

                  {/* Borde celda dorado pulsante */}
                  <rect x={r.x + 2} y={r.y + 2} width={r.w - 4} height={r.h - 4}
                    fill="rgba(255,216,74,0.12)"
                    stroke="#fff5b0" strokeWidth="3"
                    filter="url(#winner-glow)"
                    style={{ animation: 'winnerFlick 0.5s ease-in-out infinite alternate' }} />
                  <rect x={r.x + 5} y={r.y + 5} width={r.w - 10} height={r.h - 10}
                    fill="none" stroke="#ffd84a" strokeWidth="1.2" opacity="0.9" />

                  {/* Rayos de luz (8 direcciones) */}
                  {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
                    const len = Math.max(r.w, r.h) * 0.95;
                    const rad = (deg - 90) * Math.PI / 180;
                    const x2 = cx + Math.cos(rad) * len;
                    const y2 = cy + Math.sin(rad) * len;
                    return (
                      <line key={deg} x1={cx} y1={cy} x2={x2} y2={y2}
                        stroke="#fff5b0" strokeWidth="1.5" opacity="0.55"
                        strokeLinecap="round"
                        style={{ animation: `winnerFlick ${0.5 + (deg % 90) / 180}s ease-in-out infinite alternate` }} />
                    );
                  })}

                  {/* Moneda 3D — grupo con scale-pulse */}
                  <g style={{ animation: 'winnerCoinPulse 1.2s ease-in-out infinite alternate', transformOrigin: `${cx}px ${cy}px`, transformBox: 'fill-box' }}>
                    {/* Sombra debajo */}
                    <ellipse cx={cx} cy={cy + sideH + coinRy * 0.8} rx={coinR * 0.95} ry={coinRy * 0.35}
                      fill="rgba(0,0,0,0.55)" />

                    {/* Lateral cilíndrico (cara lateral de la moneda) */}
                    <path
                      d={`M ${cx - coinR} ${cy} A ${coinR} ${coinRy} 0 0 0 ${cx + coinR} ${cy} L ${cx + coinR} ${cy + sideH} A ${coinR} ${coinRy} 0 0 1 ${cx - coinR} ${cy + sideH} Z`}
                      fill="url(#winner-coin-side)" stroke="#3a2004" strokeWidth="0.8" />

                    {/* Cara superior de la moneda */}
                    <ellipse cx={cx} cy={cy} rx={coinR} ry={coinRy}
                      fill="url(#winner-coin-top)" stroke="#5a3404" strokeWidth="1" />
                    {/* Bisel interior */}
                    <ellipse cx={cx} cy={cy} rx={coinR * 0.78} ry={coinRy * 0.78}
                      fill="none" stroke="#fff5b0" strokeWidth="0.6" opacity="0.85" />
                    <ellipse cx={cx} cy={cy} rx={coinR * 0.82} ry={coinRy * 0.82}
                      fill="none" stroke="#7a4a08" strokeWidth="0.4" opacity="0.7" />
                    {/* Brillo superior */}
                    <ellipse cx={cx - coinR * 0.25} cy={cy - coinRy * 0.4} rx={coinR * 0.4} ry={coinRy * 0.18}
                      fill="rgba(255,255,255,0.55)" />

                    {/* Número ganador en la cara */}
                    <text x={cx} y={cy + coinRy * 0.38}
                      fill="#3a2004"
                      fontSize={String(n).length > 1 ? coinR * 0.95 : coinR * 1.15}
                      fontWeight="900" fontFamily="Georgia, serif" textAnchor="middle"
                      transform={rotText(cx, cy)}
                      style={{ filter: 'drop-shadow(0 1px 0 rgba(255,255,255,0.6))' }}>
                      {n}
                    </text>
                  </g>

                  {/* Corona/estrella flotante sobre la moneda */}
                  <g transform={rotText(cx, cy)}>
                    <text x={cx} y={cy - coinRy - 4}
                      fontSize={coinR * 0.95}
                      textAnchor="middle" dominantBaseline="middle"
                      style={{
                        filter: 'drop-shadow(0 0 6px #ffd84a) drop-shadow(0 0 12px #ffaa00)',
                        animation: 'winnerFlick 0.6s ease-in-out infinite alternate',
                      }}>
                      ♛
                    </text>
                  </g>
                </g>
              );
            })()}

            {/* Exteriores: 1-18 / EVEN / RED / BLACK / ODD / 19-36 */}
            {(() => {
              const segW = 2 * NUM_W;
              const yRow = TOTAL_H + OUTER_H;
              return (
                <>
                  {[0, 1, 2, 3, 4, 5].map((i) => {
                    const x = ZERO_W + i * segW;
                    const fill = i === 2 ? '#b8101a' : i === 3 ? '#151515' : 'rgba(0,0,0,0.3)';
                    return <CellRect key={'o' + i} x={x} y={yRow} w={segW} h={OUTER_H} fill={fill} stroke={felt.border} />;
                  })}
                  {['1–18', 'EVEN', '◆', '◆', 'ODD', '19–36'].map((label, i) => {
                    const cx = ZERO_W + i * segW + segW / 2;
                    const cy = yRow + OUTER_H / 2;
                    const isRombo = label === '◆';
                    return (
                      <text key={'ot' + i} x={cx} y={cy + 6}
                        fill={i === 2 || i === 3 ? '#fff' : felt.text} fontSize={isRombo ? 18 : (rotateLabels ? 12 : 14)}
                        fontWeight="800" fontFamily="Georgia, serif" textAnchor="middle" letterSpacing={rotateLabels ? 0 : 2}
                        transform={rotText(cx, cy)}>
                        {label}
                      </text>
                    );
                  })}
                </>
              );
            })()}
          </svg>

          {/* ===== HOTSPOTS clicables (en orden: outer primero, luego inner para que inner gane) ===== */}
          {/* Outer hotspots */}
          {[
            { type: 'column', payload: 3, x: ZERO_W + 12 * NUM_W, y: 0, w: COL21_W, h: NUM_H, numbers: [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36] },
            { type: 'column', payload: 2, x: ZERO_W + 12 * NUM_W, y: NUM_H, w: COL21_W, h: NUM_H, numbers: [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35] },
            { type: 'column', payload: 1, x: ZERO_W + 12 * NUM_W, y: 2 * NUM_H, w: COL21_W, h: NUM_H, numbers: [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34] },
            { type: 'dozen', payload: 1, x: ZERO_W, y: TOTAL_H, w: 4 * NUM_W, h: OUTER_H, numbers: range(1, 12) },
            { type: 'dozen', payload: 2, x: ZERO_W + 4 * NUM_W, y: TOTAL_H, w: 4 * NUM_W, h: OUTER_H, numbers: range(13, 24) },
            { type: 'dozen', payload: 3, x: ZERO_W + 8 * NUM_W, y: TOTAL_H, w: 4 * NUM_W, h: OUTER_H, numbers: range(25, 36) },
            { type: 'half', payload: 'low', x: ZERO_W, y: TOTAL_H + OUTER_H, w: 2 * NUM_W, h: OUTER_H, numbers: range(1, 18) },
            { type: 'parity', payload: 'even', x: ZERO_W + 2 * NUM_W, y: TOTAL_H + OUTER_H, w: 2 * NUM_W, h: OUTER_H, numbers: range(2, 36, 2) },
            { type: 'color', payload: 'red', x: ZERO_W + 4 * NUM_W, y: TOTAL_H + OUTER_H, w: 2 * NUM_W, h: OUTER_H, numbers: [...RED_NUMBERS] },
            { type: 'color', payload: 'black', x: ZERO_W + 6 * NUM_W, y: TOTAL_H + OUTER_H, w: 2 * NUM_W, h: OUTER_H, numbers: [...BLACK_NUMBERS] },
            { type: 'parity', payload: 'odd', x: ZERO_W + 8 * NUM_W, y: TOTAL_H + OUTER_H, w: 2 * NUM_W, h: OUTER_H, numbers: range(1, 35, 2) },
            { type: 'half', payload: 'high', x: ZERO_W + 10 * NUM_W, y: TOTAL_H + OUTER_H, w: 2 * NUM_W, h: OUTER_H, numbers: range(19, 36) },
          ].map((h, i) => (
            <Hotspot
              key={'out' + i}
              hot={h}
              onPlace={() => placeBet(h.type, h.payload, h.numbers)}
              onRemove={() => onRemoveBet(h.type, h.payload)}
              onHover={setHover}
              total={betTotalForKey(h.type, h.payload)}
              chipPos={null}
              showChip={false}
              disabled={disabled}
              rotateChip={rotateLabels}
            />
          ))}

          {/* Inner hotspots (straight + split + street + corner + sixline + topline) */}
          {hotspots.map((h, i) => (
            <Hotspot
              key={'in' + i}
              hot={h}
              onPlace={() => placeBet(h.type, h.payload, h.numbers || [h.payload])}
              onRemove={() => onRemoveBet(h.type, h.payload)}
              onHover={setHover}
              total={betTotalForKey(h.type, h.payload)}
              chipPos={{ x: h.chipX, y: h.chipY }}
              showChip
              disabled={disabled}
              rotateChip={rotateLabels}
            />
          ))}

          {/* CHIPS centradas para outer bets (esquina inferior derecha de la celda outer) */}
          {[
            { type: 'column', payload: 3, cx: ZERO_W + 12 * NUM_W + COL21_W / 2, cy: NUM_H / 2 },
            { type: 'column', payload: 2, cx: ZERO_W + 12 * NUM_W + COL21_W / 2, cy: NUM_H * 1.5 },
            { type: 'column', payload: 1, cx: ZERO_W + 12 * NUM_W + COL21_W / 2, cy: NUM_H * 2.5 },
            { type: 'dozen', payload: 1, cx: ZERO_W + 2 * NUM_W, cy: TOTAL_H + OUTER_H / 2 },
            { type: 'dozen', payload: 2, cx: ZERO_W + 6 * NUM_W, cy: TOTAL_H + OUTER_H / 2 },
            { type: 'dozen', payload: 3, cx: ZERO_W + 10 * NUM_W, cy: TOTAL_H + OUTER_H / 2 },
            { type: 'half', payload: 'low', cx: ZERO_W + NUM_W, cy: TOTAL_H + OUTER_H * 1.5 },
            { type: 'parity', payload: 'even', cx: ZERO_W + 3 * NUM_W, cy: TOTAL_H + OUTER_H * 1.5 },
            { type: 'color', payload: 'red', cx: ZERO_W + 5 * NUM_W, cy: TOTAL_H + OUTER_H * 1.5 },
            { type: 'color', payload: 'black', cx: ZERO_W + 7 * NUM_W, cy: TOTAL_H + OUTER_H * 1.5 },
            { type: 'parity', payload: 'odd', cx: ZERO_W + 9 * NUM_W, cy: TOTAL_H + OUTER_H * 1.5 },
            { type: 'half', payload: 'high', cx: ZERO_W + 11 * NUM_W, cy: TOTAL_H + OUTER_H * 1.5 },
          ].map((h, i) => {
            const total = betTotalForKey(h.type, h.payload);
            if (total === 0) return null;
            return <ChipStack key={'oc' + i} x={h.cx} y={h.cy} amount={total} rotate={rotateLabels} />;
          })}
        </div>
      </div>
    </div>
  );
}

function range(a, b, step = 1) {
  const r = [];
  for (let i = a; i <= b; i += step) r.push(i);
  return r;
}

// Rectángulo de celda
function CellRect({ x, y, w, h, fill, stroke }) {
  return (
    <>
      <rect x={x} y={y} width={w} height={h} fill={fill} stroke={stroke} strokeWidth="1.5" />
      {/* Brillo sutil */}
      <rect x={x} y={y} width={w} height={h / 2} fill="rgba(255,255,255,0.06)" pointerEvents="none" />
    </>
  );
}

// Hotspot clicable + chip stack si corresponde
// Long-press (500ms) en táctil = retirar (sustituye al clic derecho)
function Hotspot({ hot, onPlace, onRemove, onHover, total, chipPos, showChip, disabled, rotateChip }) {
  const longPressTimer = React.useRef(null);
  const longPressFired = React.useRef(false);
  const startPos = React.useRef({ x: 0, y: 0 });

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const onTouchStart = (e) => {
    if (disabled) return;
    longPressFired.current = false;
    const touch = e.touches[0];
    startPos.current = { x: touch.clientX, y: touch.clientY };
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      onRemove();
      if (navigator.vibrate) navigator.vibrate(35);
    }, 500);
  };

  const onTouchMove = (e) => {
    const touch = e.touches[0];
    const dx = touch.clientX - startPos.current.x;
    const dy = touch.clientY - startPos.current.y;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) cancelLongPress();
  };

  const onTouchEnd = () => {
    cancelLongPress();
  };

  const handleClick = (e) => {
    if (longPressFired.current) {
      e.preventDefault();
      longPressFired.current = false;
      return;
    }
    onPlace();
  };

  return (
    <>
      <div
        onClick={handleClick}
        onContextMenu={(e) => { e.preventDefault(); onRemove(); }}
        onMouseEnter={() => onHover(hot)}
        onMouseLeave={() => onHover(null)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={cancelLongPress}
        style={{
          position: 'absolute',
          left: hot.x,
          top: hot.y,
          width: hot.w,
          height: hot.h,
          cursor: disabled ? 'default' : 'pointer',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent',
          zIndex: hot.type === 'straight' || hot.type === 'column' || hot.type === 'dozen' || hot.type === 'half' || hot.type === 'parity' || hot.type === 'color' ? 2 : 5,
        }}
      />
      {showChip && total > 0 && chipPos && (
        <ChipStack x={chipPos.x} y={chipPos.y} amount={total} rotate={rotateChip} />
      )}
    </>
  );
}

// Pila de fichas centrada en (x,y)
function ChipStack({ x, y, amount, rotate }) {
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        transform: rotate ? 'translate(-50%, -50%) rotate(-90deg)' : 'translate(-50%, -50%)',
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: chipColorFor(amount),
        border: '2px dashed rgba(255,255,255,0.85)',
        color: '#fff',
        fontSize: 11,
        fontWeight: 900,
        fontFamily: 'Georgia, serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 8px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.4), inset 0 -2px 4px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.3)',
        zIndex: 20,
        pointerEvents: 'none',
        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
      }}
    >
      {amount >= 1000 ? (amount / 1000).toFixed(amount >= 10000 ? 0 : 1) + 'k' : amount}
    </div>
  );
}

// Helpers
function betKey(type, payload) {
  return `${type}:${payload}`;
}

function chipColorFor(amount) {
  if (amount >= 500) return 'radial-gradient(circle at 35% 30%, #a040d4 0%, #6a00a0 60%, #3a0060 100%)';
  if (amount >= 100) return 'radial-gradient(circle at 35% 30%, #444 0%, #222 60%, #000 100%)';
  if (amount >= 25) return 'radial-gradient(circle at 35% 30%, #4ac84a 0%, #2a8a2a 60%, #0a4a0a 100%)';
  if (amount >= 5) return 'radial-gradient(circle at 35% 30%, #ff4040 0%, #d41a1a 60%, #7a0a0a 100%)';
  return 'radial-gradient(circle at 35% 30%, #ffffff 0%, #d0d0d0 60%, #909090 100%)';
}

function shade(hex, percent) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const num = parseInt(h, 16);
  let r = (num >> 16) + percent;
  let g = ((num >> 8) & 0xff) + percent;
  let b = (num & 0xff) + percent;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// ───────────────────────────────────────────────
// CALCULAR GANANCIA — soporta TODOS los tipos
// ───────────────────────────────────────────────
function calcWin(bet, result, lightningNumbers) {
  const { type, amount, numbers, payload } = bet;
  const n = result;
  let win = 0;
  let multiplier = 1;
  let isLightningHit = false;

  // Pagos (payout = ganancia neta a 1; pago bruto = amount * (payout+1))
  const PAYOUT = {
    straight: 35,
    split: 17,
    street: 11,
    corner: 8,
    sixline: 5,
    topline: 6,
    column: 2,
    dozen: 2,
    half: 1,
    parity: 1,
    color: 1,
  };

  // ¿La apuesta cubre el número resultado?
  const numsArr = numbers || [payload];
  const covers = numsArr.some((x) => String(x) === String(n));

  // Lightning solo aplica a STRAIGHT al número con rayo
  if (type === 'straight' && covers && lightningNumbers && lightningNumbers.has(n)) {
    multiplier = lightningNumbers.get(n);
    isLightningHit = true;
  }

  if (covers) {
    const p = PAYOUT[type];
    if (p != null) {
      // Para straight con lightning: usar multiplier directo (ej: 100x = amount * 100)
      if (isLightningHit) {
        win = amount * multiplier;
      } else {
        win = amount * (p + 1);
      }
    }
  }

  // Para outer bets, el 0 y 00 NUNCA cubren
  // (nuestro array `numbers` para outer ya excluye 0/00, pero double-check)
  if ((type === 'column' || type === 'dozen' || type === 'half' || type === 'parity' || type === 'color') && (n === 0 || n === '00')) {
    win = 0;
  }

  return { win, multiplier, isLightningHit };
}

window.BettingTable = BettingTable;
window.calcWin = calcWin;
window.betKey = betKey;
window.chipColorFor = chipColorFor;
