// Piezas visuales compartidas por el panel, la banca y la billetera.
// Expone window.UI. Mantiene el mismo aire que el juego: dorado sobre negro.
(function () {
  const { useState } = React;

  // ── El color de cada panel ────────────────────────────────────────────
  // Los tres paneles (dueño, banquero, jugador) comparten estos estilos, y hasta
  // ahora compartían también el color: los tres eran dorados y de un vistazo
  // no se sabía en cuál estabas. Ahora el color sale de variables CSS que cada
  // panel define en su raíz — así no hay que duplicar ni un estilo, y el que
  // no las define sigue viéndose dorado como siempre.
  const GOLD = 'var(--acento, #d4a94a)';
  const BORDER = 'var(--borde, #8b6a20)';
  const LINEA = 'var(--linea, #3a2a10)';       // separadores
  const LINEA_SUAVE = 'var(--linea-suave, #221a0c)';
  const FONDO_PAGINA = 'var(--fondo-pagina, radial-gradient(ellipse at center, #2a1a08 0%, #120a02 60%, #050200 100%))';
  const FONDO_TARJETA = 'var(--fondo-tarjeta, linear-gradient(180deg, #1a1410, #100a06))';

  // Las tres paletas. Se aplican con `style={{ ...UI.paleta('dueno') }}` en la
  // raíz de cada panel; de ahí para abajo hereda todo.
  const PALETAS = {
    // El dueño: azul. Es el panel donde se mueve la plata de todos.
    dueno: {
      '--acento': '#5aa9e6',
      '--borde': '#2b5f8f',
      '--linea': '#1e3a52',
      '--linea-suave': '#142634',
      '--fondo-pagina': 'radial-gradient(ellipse at center, #0a2036 0%, #061420 60%, #020609 100%)',
      '--fondo-tarjeta': 'linear-gradient(180deg, #0e1c28, #071018)',
      '--boton-acento': 'linear-gradient(180deg, #7cc3f5, #2b6f9e)',
      '--boton-texto': '#04121d',
      // La tarjeta del número grande (cupo, saldo): más clara que el resto,
      // en el tono del panel.
      '--fondo-destacado': 'linear-gradient(180deg, #10283a, #071620)',
    },
    // El banquero: verde. Es la banca: entra y sale efectivo.
    socio: {
      '--acento': '#4fd18b',
      '--borde': '#2a7f52',
      '--linea': '#1e4a34',
      '--linea-suave': '#132a1f',
      '--fondo-pagina': 'radial-gradient(ellipse at center, #08301f 0%, #051a11 60%, #010806 100%)',
      '--fondo-tarjeta': 'linear-gradient(180deg, #0c2118, #06120d)',
      '--boton-acento': 'linear-gradient(180deg, #86e7b4, #2a8a5c)',
      '--boton-texto': '#03150d',
      '--fondo-destacado': 'linear-gradient(180deg, #0d2b1d, #061510)',
    },
    // El ejecutivo: violeta. No es el azul de la matriz ni el verde de la
    // banca — el del medio tiene que saber de un vistazo en qué panel está.
    ejecutivo: {
      '--acento': '#a78bfa',
      '--borde': '#5b3fa8',
      '--linea': '#3a2a63',
      '--linea-suave': '#22183a',
      '--fondo-pagina': 'radial-gradient(ellipse at center, #1e1136 0%, #120a20 60%, #06030c 100%)',
      '--fondo-tarjeta': 'linear-gradient(180deg, #1a1030, #0d0718)',
      '--boton-acento': 'linear-gradient(180deg, #c4b0ff, #6b4bc4)',
      '--boton-texto': '#0d0620',
      '--fondo-destacado': 'linear-gradient(180deg, #241640, #120a22)',
    },
    // El jugador: el dorado de la casa, que es el de las mesas.
    jugador: {
      '--acento': '#d4a94a',
      '--borde': '#8b6a20',
      '--linea': '#3a2a10',
      '--linea-suave': '#221a0c',
      '--fondo-pagina': 'radial-gradient(ellipse at center, #2a1a08 0%, #120a02 60%, #050200 100%)',
      '--fondo-tarjeta': 'linear-gradient(180deg, #1a1410, #100a06)',
      '--boton-acento': 'linear-gradient(180deg, #d4a94a, #8b6a20)',
      '--boton-texto': '#1a1006',
      '--fondo-destacado': 'linear-gradient(180deg, #2a2008, #140d02)',
    },
  };
  const paleta = (rol) => PALETAS[rol] || PALETAS.jugador;

  // ── La moneda de la casa ───────────────────────────────────────────────
  // La define el servidor (ajuste `moneda`) y llega con /api/me. Acá vive el
  // "cómo se escribe": en dólares el símbolo va adelante y los miles con coma
  // ($1,250); en bolívares va atrás y con punto (1.250 Bs). Los montos son
  // SIEMPRE enteros: no hay centavos en ninguna de las dos.
  let MONEDA = 'USD';
  const setMoneda = (m) => { MONEDA = String(m || 'USD').toUpperCase() === 'VES' ? 'VES' : 'USD'; };
  const enBolivares = () => MONEDA === 'VES';
  // El símbolo suelto, para las etiquetas de los formularios: "MONTO ($)".
  const simbolo = () => (enBolivares() ? 'Bs' : '$');
  // El nombre largo, para debajo del saldo grande.
  const nombreMoneda = () => (enBolivares() ? 'bolívares' : 'dólares');

  // Sólo los dígitos, sin símbolo: para las columnas de una tabla, donde el
  // encabezado ya dice de qué se está hablando.
  function bs(n) {
    const v = Number(n || 0);
    return v.toLocaleString(enBolivares() ? 'es-VE' : 'en-US', { maximumFractionDigits: 0 });
  }

  // El monto completo, como lo lee la gente. Es lo que va en las frases.
  function plata(n) {
    return enBolivares() ? `${plata(n)}` : `$${bs(n)}`;
  }

  // Fecha corta legible: "23/07 14:35" a partir de "2026-07-23 18:35:00" (UTC).
  function fecha(sql, conHora = true) {
    if (!sql) return '';
    const iso = String(sql).replace(' ', 'T') + (String(sql).endsWith('Z') ? '' : 'Z');
    const d = new Date(iso);
    if (isNaN(d)) return String(sql);
    const p = (n) => String(n).padStart(2, '0');
    // Se muestra en hora de Venezuela (UTC-4).
    const ve = new Date(d.getTime() - 4 * 3600 * 1000);
    const dia = `${p(ve.getUTCDate())}/${p(ve.getUTCMonth() + 1)}`;
    return conHora ? `${dia} ${p(ve.getUTCHours())}:${p(ve.getUTCMinutes())}` : dia;
  }

  const styles = {
    page: {
      minHeight: '100vh',
      background: FONDO_PAGINA,
      color: '#fff', fontFamily: 'Georgia, serif', padding: '16px 12px',
    },
    card: {
      background: FONDO_TARJETA,
      border: `1px solid ${BORDER}`, borderRadius: 10, padding: 16,
    },
    input: {
      padding: '11px 12px', borderRadius: 6, border: `1px solid ${BORDER}`,
      background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 15,
      fontFamily: 'Georgia, serif', outline: 'none', boxSizing: 'border-box', width: '100%',
    },
    label: { fontSize: 11, color: '#999', letterSpacing: 1, display: 'block', marginBottom: 4 },
    th: {
      textAlign: 'left', padding: '8px 10px', color: '#888', fontSize: 11,
      letterSpacing: 1, borderBottom: `1px solid ${LINEA}`, whiteSpace: 'nowrap',
    },
    td: { padding: '8px 10px', borderBottom: `1px solid ${LINEA_SUAVE}`, fontSize: 14 },
    titulo: { fontSize: 15, fontWeight: 900, letterSpacing: 1, color: GOLD, marginBottom: 12 },
  };

  function Boton({ children, onClick, tono = 'oro', chico, disabled, type, style }) {
    const tonos = {
      oro:   { bg: 'var(--boton-acento, linear-gradient(180deg, #d4a94a, #8b6a20))', bd: GOLD, fg: 'var(--boton-texto, #1a1006)' },
      verde: { bg: 'linear-gradient(180deg, #2a8a2a, #155015)', bd: '#2a8a2a', fg: '#fff' },
      rojo:  { bg: 'linear-gradient(180deg, #b8101a, #6a0a10)', bd: '#b8101a', fg: '#fff' },
      gris:  { bg: 'linear-gradient(180deg, #333, #111)',       bd: '#555',    fg: '#ddd' },
    };
    const t = tonos[tono] || tonos.oro;
    return (
      <button
        type={type || 'button'}
        onClick={onClick}
        disabled={disabled}
        style={{
          padding: chico ? '5px 11px' : '11px 16px',
          borderRadius: 6, border: `${chico ? 1 : 2}px solid ${t.bd}`,
          background: t.bg, color: t.fg, fontWeight: 900,
          fontSize: chico ? 12 : 14, letterSpacing: 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: 'Georgia, serif', opacity: disabled ? 0.45 : 1,
          whiteSpace: 'nowrap', ...style,
        }}
      >{children}</button>
    );
  }

  // Aviso de resultado (verde) o de error (rojo).
  function Aviso({ msg, onClose }) {
    if (!msg) return null;
    const ok = msg.kind === 'ok';
    return (
      <div
        onClick={onClose}
        style={{
          marginBottom: 14, padding: '10px 14px', borderRadius: 6, fontSize: 14,
          cursor: onClose ? 'pointer' : 'default',
          background: ok ? 'rgba(46,138,46,0.2)' : 'rgba(180,16,26,0.2)',
          border: `1px solid ${ok ? '#2a8a2a' : '#b8101a'}`,
          color: ok ? '#9ff0a0' : '#ff9a9a',
        }}
      >{msg.text}</div>
    );
  }

  // Recuadro con un número grande: la unidad mínima de todos los tableros.
  // Los montos largos se achican en vez de partirse: "-1.003.376" tiene que
  // leerse de un saque, no cortado en dos renglones.
  function Dato({ titulo, valor, detalle, color, chico }) {
    const largo = String(valor).length;
    const base = chico ? 18 : 24;
    const size = largo > 12 ? base - 8 : largo > 9 ? base - 5 : base;
    return (
      <div style={{
        background: 'rgba(0,0,0,0.35)', border: `1px solid ${LINEA}`,
        borderRadius: 8, padding: chico ? '10px 12px' : '14px 16px', minWidth: 0,
      }}>
        <div style={{ fontSize: 10, color: '#999', letterSpacing: 1, textTransform: 'uppercase' }}>{titulo}</div>
        <div style={{
          fontSize: size, fontWeight: 900, color: color || '#fff',
          marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{valor}</div>
        {detalle && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{detalle}</div>}
      </div>
    );
  }

  // Encabezado común: título, quién está en sesión y botón de salida.
  //
  // `rol` pinta una cinta con el nombre del panel al lado del título. El color
  // ya lo dice, pero el color solo no alcanza: hay gente que no lo distingue,
  // y a pleno sol en la calle un azul oscuro y un verde oscuro son lo mismo.
  // Escrito no falla.
  // La casa matriz, los banqueros que venden fichas, y el jugador. La cinta dice
  // el rol; el panel del dueño se llama PANEL MATRIZ.
  const NOMBRE_ROL = { dueno: 'MATRIZ', ejecutivo: 'EJECUTIVO', socio: 'BANQUERO', jugador: 'JUGADOR' };

  function Encabezado({ titulo, subtitulo, acciones, rol }) {
    return (
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: `1px solid ${BORDER}`, paddingBottom: 12, marginBottom: 16,
        gap: 10, flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: 2, color: GOLD }}>{titulo}</div>
            {rol && NOMBRE_ROL[rol] && (
              <span style={{
                fontSize: 9, letterSpacing: 2, fontWeight: 900, padding: '3px 8px', borderRadius: 4,
                background: 'var(--boton-acento, linear-gradient(180deg, #d4a94a, #8b6a20))',
                color: 'var(--boton-texto, #1a1006)',
              }}>{NOMBRE_ROL[rol]}</span>
            )}
          </div>
          {subtitulo && <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{subtitulo}</div>}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>{acciones}</div>
      </div>
    );
  }

  // Barra de pestañas con contador opcional (para pendientes).
  function Pestanas({ tabs, activa, onChange }) {
    return (
      <div style={{
        display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap',
        borderBottom: `1px solid ${LINEA_SUAVE}`, paddingBottom: 10,
      }}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              padding: '8px 14px', borderRadius: 6, cursor: 'pointer',
              fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 700, letterSpacing: 1,
              border: `1px solid ${activa === t.id ? GOLD : LINEA}`,
              background: activa === t.id ? 'rgba(212,169,74,0.18)' : 'rgba(0,0,0,0.3)',
              color: activa === t.id ? GOLD : '#999',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {t.label}
            {t.badge > 0 && (
              <span style={{
                background: '#b8101a', color: '#fff', borderRadius: 10,
                padding: '1px 7px', fontSize: 11, fontWeight: 900,
              }}>{t.badge}</span>
            )}
          </button>
        ))}
      </div>
    );
  }

  // Tabla con scroll horizontal: en el celular no rompe el ancho de la página.
  function Tabla({ columnas, children, vacio }) {
    return (
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: columnas.length * 90 }}>
          <thead>
            <tr>{columnas.map((c, i) => <th key={i} style={styles.th}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {React.Children.count(children) === 0
              ? <tr><td style={{ ...styles.td, color: '#777' }} colSpan={columnas.length}>{vacio || 'Sin datos'}</td></tr>
              : children}
          </tbody>
        </table>
      </div>
    );
  }

  // Etiqueta de estado: pendiente / aprobado / rechazado / pagado.
  function Estado({ v }) {
    const map = {
      pending:  ['ESPERANDO', '#ffd84a', 'rgba(255,216,74,0.15)'],
      approved: ['APROBADA', '#7ee08a', 'rgba(46,138,46,0.2)'],
      paid:     ['PAGADO', '#7ee08a', 'rgba(46,138,46,0.2)'],
      rejected: ['RECHAZADA', '#ff9a9a', 'rgba(180,16,26,0.2)'],
      active:   ['ACTIVO', '#7ee08a', 'rgba(46,138,46,0.2)'],
      blocked:  ['BLOQUEADO', '#ff9a9a', 'rgba(180,16,26,0.2)'],
    };
    const [txt, color, bg] = map[v] || [String(v || '').toUpperCase(), '#aaa', 'rgba(255,255,255,0.06)'];
    return (
      <span style={{
        background: bg, color, border: `1px solid ${color}44`,
        borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 900, letterSpacing: 1,
      }}>{txt}</span>
    );
  }

  // Ventana de confirmación: se usa antes de tocar plata.
  function Confirmar({ abierto, titulo, texto, onSi, onNo, tonoSi = 'verde', textoSi = 'CONFIRMAR' }) {
    if (!abierto) return null;
    return (
      <div
        onClick={onNo}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}
      >
        <div onClick={(e) => e.stopPropagation()} style={{ ...styles.card, maxWidth: 420, width: '100%' }}>
          <div style={{ ...styles.titulo, marginBottom: 10 }}>{titulo}</div>
          <div style={{ fontSize: 15, color: '#ddd', lineHeight: 1.5, marginBottom: 18 }}>{texto}</div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <Boton tono="gris" onClick={onNo}>CANCELAR</Boton>
            <Boton tono={tonoSi} onClick={onSi}>{textoSi}</Boton>
          </div>
        </div>
      </div>
    );
  }

  // Campo de formulario con etiqueta.
  function Campo({ label, children }) {
    return <div style={{ minWidth: 0 }}><label style={styles.label}>{label}</label>{children}</div>;
  }

  // Hook chico para formularios: valores y setter por clave.
  function useForm(inicial) {
    const [v, setV] = useState(inicial);
    return [v, (k, val) => setV((p) => ({ ...p, [k]: val })), () => setV(inicial)];
  }

  // Tipos de documento. Debe coincidir con DOC_TYPES en worker/lib.js.
  // La cédula va primera y es la opción por defecto: es la de casi todos.
  // Los tipos de documento son de Venezuela: la LETRA no se traduce (es la que
  // va en el documento), la palabra que la explica sí.
  const T_ = () => window.T || ((x) => x);
  const DOCS_BASE = [
    ['V', 'Cédula', '12345678'],
    ['E', 'Extranjero', '84123456'],
    ['J', 'RIF', '401234567'],
    ['G', 'Gubernamental', '200012345'],
    ['P', 'Pasaporte', 'AB123456'],
  ];
  const DOCS = DOCS_BASE.map(([id, palabra, ej]) => [id, `${id} — ${T_()(palabra)}`, ej]);
  function ejemploDoc(tipo) {
    const d = DOCS.find((x) => x[0] === tipo);
    return d ? d[2] : '12345678';
  }

  // Bancos venezolanos con Pago Móvil, por código. El código es lo que el
  // jugador dicta cuando le vas a transferir.
  const BANCOS = [
    '0102 - Banco de Venezuela',
    '0104 - Venezolano de Crédito',
    '0105 - Mercantil',
    '0108 - Provincial',
    '0114 - Bancaribe',
    '0115 - Exterior',
    '0128 - Banco Caroní',
    '0134 - Banesco',
    '0137 - Sofitasa',
    '0138 - Banco Plaza',
    '0146 - Bangente',
    '0151 - BFC Banco Fondo Común',
    '0156 - 100% Banco',
    '0157 - DelSur',
    '0163 - Banco del Tesoro',
    '0166 - Banco Agrícola de Venezuela',
    '0168 - Bancrecer',
    '0169 - Mi Banco',
    '0171 - Banco Activo',
    '0172 - Bancamiga',
    '0174 - Banplus',
    '0175 - Banco Bicentenario',
    '0177 - Banfanb',
    '0191 - BNC Banco Nacional de Crédito',
    'Otro',
  ];

  // Esta versión maneja solo bolívares. P2P es para quien paga en divisas por
  // fuera: lo que se registra es el monto acordado en Bs.
  const METODOS = [
    ['pago_movil', 'Pago Móvil'],
    ['transferencia', 'Transferencia'],
    ['p2p', 'P2P (divisas)'],
  ];
  // Etiquetas de métodos viejos, para que el historial se siga leyendo bien.
  const METODOS_VIEJOS = { zelle: 'Zelle', binance: 'Binance' };
  function nombreMetodo(m) {
    const f = METODOS.find((x) => x[0] === m);
    return f ? f[1] : (METODOS_VIEJOS[m] || m || '—');
  }

  // ── El interruptor de idioma ───────────────────────────────────────────
  // Dos letras, no una bandera: una bandera dice país y el idioma no es un
  // país (un venezolano en Miami puede querer inglés, y un gringo acá,
  // español). El que está puesto va encendido.
  function Idioma({ chico }) {
    const actual = window.I18N ? window.I18N.get() : 'es';
    const boton = (id, texto) => (
      <button
        key={id}
        onClick={() => window.I18N && window.I18N.set(id)}
        style={{
          padding: chico ? '3px 7px' : '5px 9px',
          fontSize: chico ? 9 : 11, fontWeight: 900, letterSpacing: 1,
          fontFamily: 'Georgia, serif', cursor: 'pointer',
          border: `1px solid ${actual === id ? GOLD : '#555'}`,
          background: actual === id ? 'rgba(212,169,74,0.18)' : 'rgba(0,0,0,0.4)',
          color: actual === id ? GOLD : '#999',
          borderRadius: 4,
        }}
      >{texto}</button>
    );
    return (
      <span style={{ display: 'inline-flex', gap: 4 }}>
        {boton('es', 'ES')}{boton('en', 'EN')}
      </span>
    );
  }

  window.UI = {
    GOLD, BORDER, bs, plata, simbolo, nombreMoneda, setMoneda, enBolivares,
    fecha, styles, paleta, PALETAS, METODOS, BANCOS, DOCS, ejemploDoc, nombreMetodo,
    Boton, Aviso, Dato, Encabezado, Pestanas, Tabla, Estado, Confirmar, Campo, useForm, Idioma,
  };
})();
