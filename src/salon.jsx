// ════════════════════════════════════════════════════════════════════════
//  VOLTIO — el salón de juegos.
//  La pantalla donde el jugador elige a qué mesa entrar.
//
//  QUÉ mesas hay y cuáles están abiertas lo dice el servidor (/api/games):
//  el salón no puede inventar una mesa ni dejar entrar a una cerrada, porque
//  el giro se rechazaría igual. Acá abajo vive solo la PRESENTACIÓN de cada
//  una (el ícono y la frase de venta), que es lo único que el servidor no
//  sabe; en la Etapa 4, cuando el dueño arme las mesas desde el panel, eso
//  también pasa a venir de la base.
//  Ver ESTRUCTURA-SALON.md para el plan completo.
// ════════════════════════════════════════════════════════════════════════
(() => {
  const { useState, useEffect } = React;

  // Si por lo que sea el diccionario no cargó (una copia vieja de index.html
  // guardada en el teléfono, por ejemplo), T() sigue existiendo y devuelve el
  // español. Una pantalla en español se lee; una pantalla en blanco por un
  // "T is not defined" no.
  const T = window.T || ((s) => s);

  // La ficha del servidor, vestida para la tarjeta. El ícono, el color y las
  // dos líneas los escribe el dueño en el panel (Etapa 4); si una mesa nueva
  // vino sin ellos, igual se anuncia: el texto se arma con la ficha.
  const DORADO = '#ffd84a';

  function paraLaTarjeta(m) {
    const es21 = m.tipo === 'blackjack';
    const auto = es21 ? [
      T('Blackjack · {n} mazos', { n: m.mazos }),
      m.pago_natural >= 1.5 ? T('El natural paga 3 a 2') : T('El natural paga 6 a 5'),
    ] : [
      m.doble_cero ? T('Ruleta americana 0/00 · {n} casillas', { n: m.casillas })
                   : T('Ruleta europea, un solo cero · {n} casillas', { n: m.casillas }),
      m.rayos ? T('Rayos con premios hasta 500x') : T('El pleno paga {n} a 1', { n: m.pago_pleno }),
    ];
    // Las dos líneas que escribe el dueño están en español y viven en la base
    // (games.detalle1/2), así que el diccionario no las puede tocar. En inglés
    // se prefieren las automáticas —que sí están traducidas— antes que dejar
    // media tarjeta en español. Cuando el panel tenga los campos en inglés,
    // esto pasa a elegir el que corresponda.
    const enEspanol = !window.I18N || window.I18N.get() === 'es';
    const detalle = enEspanol ? [m.detalle1, m.detalle2].filter(Boolean) : [];
    return {
      id: m.id,
      nombre: (m.label || m.id).toUpperCase(),
      icono: m.icono || (es21 ? '🃏' : '🎡'),
      color: m.color || DORADO,
      // La cinta la manda el estado real: una mesa cerrada siempre se anuncia
      // como lo que viene, nunca con un título de venta. Y una mesa EN PRUEBAS
      // se anuncia como lo que es: el que la ve es el dueño o una cuenta de
      // prueba, y tiene que saber que está mirando algo que el público no ve.
      cinta: m.en_pruebas ? T('EN PRUEBAS') : (m.activo ? T('MESA ABIERTA') : T('PRÓXIMAMENTE')),
      enPruebas: !!m.en_pruebas,
      detalle: detalle.length ? detalle : auto,
      // La apuesta más chica que acepta la mesa: en el 21 la pone la ficha de
      // la mesa, y en la ruleta es siempre la de $1.
      apuestaDesde: (m.activo || m.en_pruebas) ? (es21 ? (m.apuesta_min || 1) : 1) : null,
      activa: !!(m.activo || m.en_pruebas),
    };
  }

  const fmt = (n) => '$' + Number(n || 0).toLocaleString('en-US');

  // Cómo se llama el jugador: nombre y apellido si los cargó, y si no, su
  // usuario. Nunca queda vacío el saludo.
  function nombreDe(user) {
    if (!user) return '';
    const partes = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
    return partes || user.username || '';
  }

  // La tarjeta sabe dibujarse apagada, aunque hoy el salón no le mande mesas
  // cerradas: si algún día el dueño quiere anunciar una que viene, alcanza con
  // dejarla pasar en el filtro de arriba.
  function TarjetaMesa({ mesa, isMobile, onEntrar }) {
    const apagada = !mesa.activa;
    return (
      <div style={{
        borderRadius: 12, padding: isMobile ? 14 : 18, position: 'relative',
        background: 'linear-gradient(160deg, rgba(60,38,10,0.9), rgba(20,12,4,0.95))',
        border: `1px solid ${apagada ? '#3a3a3a' : '#b88a28'}`,
        boxShadow: apagada ? 'none' : '0 4px 18px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,216,74,0.15)',
        filter: apagada ? 'saturate(0.25) brightness(0.75)' : 'none',
      }}>
        <div style={{
          position: 'absolute', top: 10, right: 10, fontSize: 8, letterSpacing: 2,
          fontWeight: 700, borderRadius: 3, padding: '3px 7px',
          color: apagada ? '#ccc' : '#0a0a0a',
          background: apagada ? '#555'
            : (mesa.enPruebas ? 'linear-gradient(180deg, #9ad7ff, #2b8fd4)'
                              : 'linear-gradient(180deg, #ffe98a, #d4a017)'),
        }}>{mesa.cinta}</div>

        <div style={{ fontSize: isMobile ? 28 : 34 }}>{mesa.icono}</div>
        <div style={{
          fontSize: isMobile ? 17 : 19, letterSpacing: 2,
          // El color se lo pone el dueño a cada mesa; el dorado es el de casa.
          color: apagada ? '#ffd84a' : mesa.color,
          fontWeight: 900, margin: '6px 0 4px',
        }}>{mesa.nombre}</div>
        <div style={{ fontSize: 11, color: '#bba876', lineHeight: 1.6 }}>
          {mesa.detalle.map((linea, i) => <div key={i}>{linea}</div>)}
        </div>

        <div style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 12,
        }}>
          <div style={{ fontSize: 10, color: '#888' }}>
            {mesa.apuestaDesde != null && (
              <>{T('APUESTA DESDE')}<br /><b style={{ color: '#ddd', fontSize: 12 }}>{fmt(mesa.apuestaDesde)}</b></>
            )}
          </div>
          <button
            onClick={apagada ? undefined : onEntrar}
            disabled={apagada}
            style={{
              fontFamily: 'Georgia, serif', fontSize: 13, fontWeight: 700, letterSpacing: 2,
              padding: '10px 22px', borderRadius: 6,
              cursor: apagada ? 'default' : 'pointer',
              color: apagada ? '#777' : '#1a1205',
              border: `1px solid ${apagada ? '#444' : '#8a6a1a'}`,
              background: apagada ? '#2a2a2a' : 'linear-gradient(180deg, #ffe98a, #d4a017)',
              boxShadow: apagada ? 'none' : '0 0 14px rgba(255,216,74,0.35)',
            }}
          >{apagada ? T('MUY PRONTO') : T('ENTRAR A LA MESA')}</button>
        </div>
      </div>
    );
  }

  function SalonScreen({ user, mesas, onEntrarMesa, onOpenWallet, onOpenCashier, onOpenAdmin, onLogout }) {
    // El salón muestra SOLO las mesas abiertas. Las que están cerradas existen
    // en el catálogo y el dueño las ve en su panel, pero al jugador no se le
    // anuncia lo que todavía no puede jugar: una tarjeta apagada ocupa lugar,
    // invita a tocarla y no lleva a ninguna parte.
    // Las mesas EN PRUEBAS ya vienen filtradas por el servidor: al jugador
    // común no le llegan. Si llegaron, es porque quien mira es el dueño o una
    // cuenta de prueba, y entonces las tiene que ver.
    const abiertas = (mesas || []).filter((m) => m.activo || m.en_pruebas);

    const [isMobile, setIsMobile] = useState(window.innerWidth < 700);
    useEffect(() => {
      const f = () => setIsMobile(window.innerWidth < 700);
      window.addEventListener('resize', f);
      return () => window.removeEventListener('resize', f);
    }, []);

    const botoncito = (borde, fondo, color) => ({
      padding: isMobile ? '3px 8px' : '5px 10px', borderRadius: 4,
      border: `1px solid ${borde}`, background: fondo, color,
      fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: isMobile ? 9 : 11,
      letterSpacing: 1, cursor: 'pointer',
    });

    return (
      <div style={{
        minHeight: '100vh', fontFamily: 'Georgia, serif', color: '#fff',
        background: 'radial-gradient(ellipse at 50% 0%, #2a1a08 0%, #140d04 55%, #0a0a0a 100%)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Barra superior: la marca del salón a un lado, la plata al otro */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 14px', borderBottom: '1px solid #3a2a10', background: 'rgba(0,0,0,0.35)',
        }}>
          <div style={{ lineHeight: 1 }}>
            <div style={{
              fontSize: isMobile ? 19 : 22, fontWeight: 900, letterSpacing: 2,
              background: 'linear-gradient(180deg, #fff3b0, #ffd84a 55%, #b8860b)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              textShadow: '0 0 18px rgba(255,216,74,0.25)',
            }}>⚡ VOLTIO</div>
            <div style={{ fontSize: 8, letterSpacing: 3, color: '#b88a28', marginTop: 3 }}>
              {T('SALÓN DE JUEGOS')}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 8, letterSpacing: 2, color: '#999' }}>{T('SALDO')}</div>
              <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 900 }}>{fmt(user && user.balance)}</div>
            </div>
            {onOpenWallet && (
              <button onClick={onOpenWallet}
                style={botoncito('#2a8a2a', 'rgba(42,138,42,0.25)', '#9ff0a0')}>{T('CAJA')}</button>
            )}
            {onOpenCashier && (
              <button onClick={onOpenCashier}
                style={botoncito('#8b6a20', 'rgba(0,0,0,0.4)', '#d4a94a')}>{T('BANCA')}</button>
            )}
            {onOpenAdmin && (
              <button onClick={onOpenAdmin}
                style={botoncito('#8b6a20', 'rgba(0,0,0,0.4)', '#d4a94a')}>{T('PANEL')}</button>
            )}
            {onLogout && (
              <button onClick={onLogout}
                style={botoncito('#555', 'rgba(0,0,0,0.4)', '#aaa')}>{T('SALIR')}</button>
            )}
            {/* El idioma se elige acá, que es la primera pantalla del salón. */}
            {window.UI && window.UI.Idioma && <window.UI.Idioma chico={isMobile} />}
          </div>
        </div>

        {/* Las mesas */}
        <div style={{ flex: 1, width: '100%', maxWidth: 520, margin: '0 auto', padding: '18px 16px' }}>
          {/* El saludo lleva el NOMBRE Y APELLIDO, y abajo el usuario con el
              que se entró. Dos razones: en una casa hay varios que se llaman
              igual, y sobre todo el jugador tiene que poder ver de un vistazo
              con qué cuenta está — el saldo que ve es de esa cuenta y no de
              otra. Antes el salón no lo decía en ninguna parte. */}
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 11, color: '#999', letterSpacing: 2 }}>
              {T('BIENVENIDO')}{nombreDe(user) ? `, ${nombreDe(user).toUpperCase()}` : ''}
            </div>
            {user && user.username && (
              <div style={{ fontSize: 10, color: '#b88a28', letterSpacing: 1.5, marginTop: 3 }}>
                {T('entraste como')} <b style={{ color: '#e8d9a0' }}>{user.username}</b>
              </div>
            )}
            <div style={{ fontSize: 15, color: '#e8d9a0', letterSpacing: 3, marginTop: 4 }}>
              {T('— ELEGÍ TU MESA —')}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mesas == null && (
              <div style={{ textAlign: 'center', color: '#8a7a52', fontSize: 12, padding: '24px 0' }}>
                {T('Abriendo el salón…')}
              </div>
            )}
            {mesas != null && abiertas.length === 0 && (
              <div style={{ textAlign: 'center', color: '#8a7a52', fontSize: 12, padding: '24px 0' }}>
                {T('No hay mesas abiertas en este momento. Probá de nuevo en un rato.')}
              </div>
            )}
            {abiertas.map(paraLaTarjeta).map((m) => (
              <TarjetaMesa key={m.id} mesa={m} isMobile={isMobile}
                           onEntrar={() => onEntrarMesa(m.id)} />
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: 9, color: '#666', letterSpacing: 2, padding: '10px 0 14px' }}>
          {T('VOLTIO · JUGÁ CON ENERGÍA')}
        </div>
      </div>
    );
  }

  window.SalonScreen = SalonScreen;
})();
