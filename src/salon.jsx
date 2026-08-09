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

  // Los rojos de la ruleta. El cero y el doble cero van en verde. Es la misma
  // convención de la mesa: si el salón los pintara de otro color, el jugador
  // tendría que aprender dos idiomas para leer el mismo número.
  const ROJOS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
  function colorDeNumero(n) {
    if (n === '0' || n === '00') return { background: 'linear-gradient(180deg,#3fe07a,#12a04c)', color: '#04240f' };
    if (ROJOS.has(Number(n))) return { background: 'linear-gradient(180deg,#e0384f,#8e1526)', color: '#fff' };
    return { background: 'linear-gradient(180deg,#2b333d,#0d1116)', color: '#fff' };
  }

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
  function TarjetaMesa({ mesa, en, caliente, isMobile, onEntrar }) {
    const apagada = !mesa.activa;
    // El barrido de luz lo lleva UNA sola mesa, la de más gente: si lo
    // llevaran todas no señalaría nada.
    const esCaliente = !!caliente && caliente === mesa.id;
    // El fogonazo sólo se enciende si el rayo es RECIENTE. Uno de hace dos
    // horas destellando sería un anuncio falso.
    const tieneRayo = !!(en && en.ultimo_rayo && en.ultimo_rayo.hace_min <= 15);
    return (
      <div className={(esCaliente ? 'sl-caliente ' : '') + (tieneRayo ? 'sl-rayo' : '')} style={{
        borderRadius: 12, padding: isMobile ? 14 : 18, position: 'relative', overflow: 'hidden',
        // El borde toma el color de la mesa —el que el dueño le puso en el
        // panel— y no el dorado de casa: es lo que hace que las cinco se
        // distingan de un vistazo sin leer el nombre.
        background: 'linear-gradient(150deg, rgba(255,255,255,0.06), rgba(3,10,16,0.94))',
        border: `1px solid ${apagada ? '#3a3a3a' : (mesa.color || '#b88a28')}`,
        boxShadow: apagada ? 'none'
          : `0 6px 20px rgba(0,0,0,0.55)${esCaliente ? ', 0 0 26px rgba(255,216,74,0.14)' : ''}`,
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

        {/* ── LO QUE ESTÁ PASANDO AHORA ────────────────────────────────
            Cuánta gente hay. Si no hay nadie lo dice, apagado y sin punto:
            una vitrina que finge movimiento se nota, y se nota mal. */}
        {en && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
            {en.jugando > 0 ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 8.5,
                letterSpacing: 1.5, fontWeight: 700, color: '#9ff0a0', padding: '3px 7px',
                border: '1px solid #2a8a2a', background: 'rgba(42,138,42,0.2)', borderRadius: 3,
              }}>
                <span className="sl-pulso" />
                <b style={{ color: '#fff', fontSize: 10 }}>{en.jugando}</b> {T('JUGANDO')}
              </span>
            ) : (
              <span style={{
                fontSize: 8.5, letterSpacing: 1.5, fontWeight: 700, color: '#8b9aa6',
                padding: '3px 7px', border: '1px solid #3a4650',
                background: 'rgba(0,0,0,0.3)', borderRadius: 3,
              }}>{T('MESA LIBRE')}</span>
            )}
          </div>
        )}

        {/* Los últimos números. El rótulo NO es adorno: en este casino cada
            jugador tiene su propio giro, así que sin él la tira se lee como
            si fuera una sola ruleta girando para todos. */}
        {en && en.ultimos && en.ultimos.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9, flexWrap: 'wrap' }}>
            <small style={{ fontSize: 7.5, letterSpacing: 1.5, color: '#7f96a6' }}>
              {T('ÚLTIMOS DE LA MESA')}
            </small>
            <div style={{ display: 'flex', gap: 5 }}>
              {en.ultimos.map((n, i) => (
                <span key={i + '-' + n} className={i === 0 ? 'sl-nuevo' : ''} style={Object.assign({
                  width: 23, height: 23, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 10.5, fontWeight: 900, flex: 'none',
                }, colorDeNumero(n))}>{n}</span>
              ))}
            </div>
          </div>
        )}

        {/* El rayo: el mejor anuncio de la casa, y sale solo. */}
        {en && en.ultimo_rayo && (
          <div style={{
            fontSize: 9, letterSpacing: 0.5, color: '#ffd84a', marginTop: 9,
            textShadow: '0 0 8px rgba(255,216,74,0.6)',
          }}>
            ⚡ {T('Cayó un rayo hace {n} min y pagó {x}x',
                  { n: en.ultimo_rayo.hace_min, x: en.ultimo_rayo.mult })}
          </div>
        )}

        {/* En el 21 no hay números que mostrar: hay manos en curso. */}
        {en && en.manos_en_juego > 0 && (
          <div style={{ fontSize: 9, letterSpacing: 0.5, color: '#8ea2b0', marginTop: 9 }}>
            🃏 {T('{n} manos en juego', { n: en.manos_en_juego })}
          </div>
        )}

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

    // ── LA VITRINA ─────────────────────────────────────────────────────
    // Qué está pasando ahora en cada mesa. Se pide aparte del catálogo
    // porque se repite cada diez segundos y el catálogo no cambia nunca.
    const [vivo, setVivo] = useState({});
    useEffect(() => {
      if (!window.Api || !window.Api.salonVivo) return undefined;
      let vive = true;
      // La PRIMERA vez se pide siempre, aunque el navegador diga que la
      // pantalla está tapada: hay teléfonos que arrancan una pestaña
      // restaurada como 'hidden', y ahí el salón se quedaría en blanco hasta
      // que el jugador la tocara. El freno es para no REPETIR de fondo, no
      // para dejar la vitrina vacía.
      const traer = (siempre) => {
        // Con la pantalla tapada no se repite: si el jugador deja el teléfono
        // de lado, esto se frena solo y no le gasta datos ni le pega a la base
        // por una vitrina que nadie está mirando.
        if (!siempre && document.visibilityState !== 'visible') return;
        window.Api.salonVivo().then((d) => {
          if (!vive) return;
          const porId = {};
          for (const m of (d.mesas || [])) porId[m.id] = m;
          setVivo(porId);
        }).catch(() => { /* la vitrina es adorno: si falla, el salón se usa igual */ });
      };
      traer(true);
      const seguir = () => traer(false);
      const reloj = setInterval(seguir, 10000);
      document.addEventListener('visibilitychange', seguir);
      return () => {
        vive = false;
        clearInterval(reloj);
        document.removeEventListener('visibilitychange', seguir);
      };
    }, []);

    // La mesa con más gente. Sólo una lleva el barrido de luz: si lo llevaran
    // todas no señalaría nada. Con el salón vacío no lo lleva ninguna.
    let caliente = null;
    for (const m of abiertas) {
      const e = vivo[m.id];
      if (e && e.jugando > 0 && (!caliente || e.jugando > (vivo[caliente].jugando || 0))) caliente = m.id;
    }

    const botoncito = (borde, fondo, color) => ({
      padding: isMobile ? '3px 8px' : '5px 10px', borderRadius: 4,
      border: `1px solid ${borde}`, background: fondo, color,
      fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: isMobile ? 9 : 11,
      letterSpacing: 1, cursor: 'pointer',
    });

    return (
      <div style={{
        minHeight: '100vh', fontFamily: 'Georgia, serif', color: '#fff', position: 'relative',
        // La misma paleta que la puerta: el salón tiene que sentirse el mismo
        // lugar y no otra aplicación.
        background: 'radial-gradient(ellipse 120% 55% at 50% 84%, #16405c 0%, #0a1c2c 44%, #02050a 100%)',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* La tormenta sigue viva pero muy baja: para que la lista no quede
            plana, sin robarle atención a los datos. */}
        <div className="sl-tormenta" aria-hidden="true" />
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
              <TarjetaMesa key={m.id} mesa={m} en={vivo[m.id]} caliente={caliente}
                           isMobile={isMobile}
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

  // ── EL MOVIMIENTO DE LA VITRINA ──────────────────────────────────────
  // Una hoja sola, puesta una sola vez, con el mismo freno que la puerta:
  // quien pidió no ver animaciones no las ve, y un teléfono flojo tampoco.
  (function estilos() {
    if (document.getElementById('sl-css')) return;
    const quieto =
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);

    // El fondo de tormenta va SIEMPRE: es color, no movimiento, y sin él el
    // salón se ve de otra aplicación que la puerta.
    const fondo = [
      '.sl-tormenta{position:absolute;inset:0;pointer-events:none;background:',
      ' radial-gradient(ellipse 60% 20% at 28% 4%,rgba(255,216,74,.12),transparent 70%),',
      ' radial-gradient(ellipse 52% 18% at 78% 2%,rgba(140,200,255,.10),transparent 70%)}',
      '.sl-pulso{width:6px;height:6px;border-radius:50%;background:#3fe07a;box-shadow:0 0 8px #3fe07a}',
    ];

    const s = document.createElement('style');
    s.id = 'sl-css';
    s.textContent = quieto ? fondo.join('') : fondo.concat([
      '.sl-pulso{animation:sl-pulso 1.6s ease-in-out infinite}',
      '@keyframes sl-pulso{0%,100%{opacity:.35;transform:scale(.8)}50%{opacity:1;transform:scale(1.15)}}',
      // El número que acaba de entrar cae con un golpe de luz: es la señal de
      // que la mesa está viva AHORA y no hace una hora.
      '.sl-nuevo{animation:sl-entra .5s ease-out}',
      '@keyframes sl-entra{0%{opacity:0;transform:scale(.4)}60%{opacity:1;transform:scale(1.25)}',
      ' 100%{opacity:1;transform:scale(1)}}',
      // El barrido de la mesa caliente. Lo lleva UNA sola.
      '.sl-caliente:after{content:"";position:absolute;top:0;bottom:0;width:70px;left:-100px;',
      ' pointer-events:none;background:linear-gradient(100deg,transparent,rgba(255,216,74,.16),transparent);',
      ' animation:sl-barrido 5.5s ease-in-out infinite}',
      '@keyframes sl-barrido{0%{left:-100px}60%,100%{left:115%}}',
      // El fogonazo del rayo sobre la tarjeta.
      '.sl-rayo:before{content:"";position:absolute;inset:0;pointer-events:none;border-radius:12px;',
      ' background:radial-gradient(ellipse 80% 60% at 50% 0%,rgba(255,216,74,.4),transparent 70%);',
      ' opacity:0;animation:sl-golpe 9s ease-out infinite}',
      '@keyframes sl-golpe{0%,90%{opacity:0}91%{opacity:1}93%{opacity:.25}94.5%{opacity:.9}100%{opacity:0}}',
      '.sl-tormenta{animation:sl-nube 16s ease-in-out infinite alternate}',
      '@keyframes sl-nube{from{transform:translateX(-8px)}to{transform:translateX(8px)}}',
    ]).join('');
    document.head.appendChild(s);
  })();

  window.SalonScreen = SalonScreen;
})();
