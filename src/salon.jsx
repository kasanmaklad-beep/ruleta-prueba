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

  // La ficha del servidor, vestida para la tarjeta. El ícono, el color y las
  // dos líneas los escribe el dueño en el panel (Etapa 4); si una mesa nueva
  // vino sin ellos, igual se anuncia: el texto se arma con la ficha.
  const DORADO = '#ffd84a';

  function paraLaTarjeta(m) {
    const es21 = m.tipo === 'blackjack';
    const auto = es21 ? [
      `Blackjack · ${m.mazos} mazos`,
      `El natural paga ${m.pago_natural >= 1.5 ? '3 a 2' : '6 a 5'}`,
    ] : [
      `Ruleta ${m.doble_cero ? 'americana 0/00' : 'europea, un solo cero'} · ${m.casillas} casillas`,
      m.rayos ? 'Rayos con premios hasta 500x' : `El pleno paga ${m.pago_pleno} a 1`,
    ];
    const detalle = [m.detalle1, m.detalle2].filter(Boolean);
    return {
      id: m.id,
      nombre: (m.label || m.id).toUpperCase(),
      icono: m.icono || (es21 ? '🃏' : '🎡'),
      color: m.color || DORADO,
      // La cinta la manda el estado real: una mesa cerrada siempre se anuncia
      // como lo que viene, nunca con un título de venta.
      cinta: m.activo ? 'MESA ABIERTA' : 'PRÓXIMAMENTE',
      detalle: detalle.length ? detalle : auto,
      // La apuesta más chica que acepta la mesa: en el 21 la pone la ficha de
      // la mesa, y en la ruleta es siempre la de $1.
      apuestaDesde: m.activo ? (es21 ? (m.apuesta_min || 1) : 1) : null,
      activa: !!m.activo,
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
          background: apagada ? '#555' : 'linear-gradient(180deg, #ffe98a, #d4a017)',
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
              <>APUESTA DESDE<br /><b style={{ color: '#ddd', fontSize: 12 }}>{fmt(mesa.apuestaDesde)}</b></>
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
          >{apagada ? 'MUY PRONTO' : 'ENTRAR'}</button>
        </div>
      </div>
    );
  }

  function SalonScreen({ user, mesas, onEntrarMesa, onOpenWallet, onOpenCashier, onOpenAdmin, onLogout }) {
    // El salón muestra SOLO las mesas abiertas. Las que están cerradas existen
    // en el catálogo y el dueño las ve en su panel, pero al jugador no se le
    // anuncia lo que todavía no puede jugar: una tarjeta apagada ocupa lugar,
    // invita a tocarla y no lleva a ninguna parte.
    const abiertas = (mesas || []).filter((m) => m.activo);

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
              SALÓN DE JUEGOS
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 8, letterSpacing: 2, color: '#999' }}>SALDO</div>
              <div style={{ fontSize: isMobile ? 14 : 16, fontWeight: 900 }}>{fmt(user && user.balance)}</div>
            </div>
            {onOpenWallet && (
              <button onClick={onOpenWallet}
                style={botoncito('#2a8a2a', 'rgba(42,138,42,0.25)', '#9ff0a0')}>CAJA</button>
            )}
            {onOpenCashier && (
              <button onClick={onOpenCashier}
                style={botoncito('#8b6a20', 'rgba(0,0,0,0.4)', '#d4a94a')}>TAQUILLA</button>
            )}
            {onOpenAdmin && (
              <button onClick={onOpenAdmin}
                style={botoncito('#8b6a20', 'rgba(0,0,0,0.4)', '#d4a94a')}>PANEL</button>
            )}
            {onLogout && (
              <button onClick={onLogout}
                style={botoncito('#555', 'rgba(0,0,0,0.4)', '#aaa')}>SALIR</button>
            )}
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
              BIENVENIDO{nombreDe(user) ? `, ${nombreDe(user).toUpperCase()}` : ''}
            </div>
            {user && user.username && (
              <div style={{ fontSize: 10, color: '#b88a28', letterSpacing: 1.5, marginTop: 3 }}>
                entraste como <b style={{ color: '#e8d9a0' }}>{user.username}</b>
              </div>
            )}
            <div style={{ fontSize: 15, color: '#e8d9a0', letterSpacing: 3, marginTop: 4 }}>
              — ELEGÍ TU MESA —
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {mesas == null && (
              <div style={{ textAlign: 'center', color: '#8a7a52', fontSize: 12, padding: '24px 0' }}>
                Abriendo el salón…
              </div>
            )}
            {mesas != null && abiertas.length === 0 && (
              <div style={{ textAlign: 'center', color: '#8a7a52', fontSize: 12, padding: '24px 0' }}>
                No hay mesas abiertas en este momento. Probá de nuevo en un rato.
              </div>
            )}
            {abiertas.map(paraLaTarjeta).map((m) => (
              <TarjetaMesa key={m.id} mesa={m} isMobile={isMobile}
                           onEntrar={() => onEntrarMesa(m.id)} />
            ))}
          </div>
        </div>

        <div style={{ textAlign: 'center', fontSize: 9, color: '#666', letterSpacing: 2, padding: '10px 0 14px' }}>
          VOLTIO · JUGÁ CON ENERGÍA
        </div>
      </div>
    );
  }

  window.SalonScreen = SalonScreen;
})();
