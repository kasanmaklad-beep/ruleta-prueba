// ════════════════════════════════════════════════════════════════════════
//  LA PUERTA DE VOLTIO — la escena, sin nada de ingresar.
//
//  Todo el 3D es del navegador: perspectiva, degradados y sombras. NO hay
//  motor 3D, ni imágenes, ni audio descargado. Un three.js son entre 5 y 15
//  MB, y los jugadores de esta casa buscan wifi para no gastar sus datos.
//
//  La identidad es el Relámpago del Catatumbo, que es venezolano y ya le da
//  el nombre a la mesa insignia: es lo único de la marca que un competidor no
//  puede copiar.
//
//  Los tres arcos del fondo son DECORACIÓN, no menú: representan familias de
//  juego (ruleta · Catatumbo · 21), no mesas. Hoy hay cinco mesas. Si fueran
//  un menú habría que retocar la entrada cada vez que el dueño abre una.
//
//  Ver docs/superpowers/specs/2026-08-08-entrada-y-salon-design.md
// ════════════════════════════════════════════════════════════════════════
(function () {
  const T = window.T || ((s) => s);

  // Quien pidió no ver animaciones no las ve, y un teléfono flojo tampoco: la
  // pantalla queda igual, quieta y legible. Una entrada que se traba es una
  // entrada por la que no entra nadie.
  const SIN_MOVIMIENTO =
    (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2);

  const CLAVE_SONIDO = 'voltio_sonido';

  const Sonido = {
    // Arranca APAGADO. Quien abre la página en un sitio callado no se lleva un
    // susto, y quien la abre en el trabajo no queda en evidencia.
    prendido() {
      try { return localStorage.getItem(CLAVE_SONIDO) === '1'; } catch (e) { return false; }
    },
    // ── EL DESBLOQUEO ────────────────────────────────────────────────────
    // Safari en iPhone sólo deja empezar a sonar DENTRO del toque del dedo.
    // Una llamada que sale de un efecto de React, de un temporizador o de una
    // promesa llega tarde: el contexto de audio nace mudo y ya no se levanta
    // nunca. Por eso hay que tocarlo en el gesto mismo, aunque todavía no haya
    // nada que sonar.
    // Es lo que ya hace la mesa sin darse cuenta: chip() sale del onClick de
    // la ficha, y por eso el juego sí suena.
    desbloquear() {
      const A = window.AudioEngine;
      if (A && A.ensureCtx) { try { A.ensureCtx(); } catch (e) { /* sin audio se juega igual */ } }
    },
    alternar() {
      const nuevo = !Sonido.prendido();
      try { localStorage.setItem(CLAVE_SONIDO, nuevo ? '1' : '0'); } catch (e) { /* modo privado */ }
      // Prender el sonido es el gesto más claro que existe: se aprovecha.
      if (nuevo) Sonido.desbloquear();
      return nuevo;
    },
    // El trueno YA EXISTE y ya está sintetizado: window.AudioEngine.thunder()
    // de src/audio.jsx. No hay que escribir un sonido nuevo ni descargar nada.
    trueno() {
      if (!Sonido.prendido()) return;
      const A = window.AudioEngine;
      if (A && A.thunder) { try { A.thunder(0.8); } catch (e) { /* sin audio, se entra igual */ } }
    },
  };

  // Una sola hoja de estilos, puesta una sola vez. Va como arreglo de líneas
  // y no como texto de una pieza para que se lea sin barrer a los costados.
  const CSS = [
    '.vt-esc{position:fixed;inset:0;overflow:hidden;font-family:Georgia,serif;',
    ' background:radial-gradient(ellipse 120% 55% at 50% 78%,#16405c 0%,#0a1c2c 44%,#02050a 100%)}',
    '.vt-cielo{position:absolute;inset:0;background:',
    ' radial-gradient(ellipse 62% 22% at 30% 6%,rgba(var(--m-oro-rgb),.22),transparent 70%),',
    ' radial-gradient(ellipse 54% 20% at 76% 3%,rgba(var(--m-acento-rgb),.16),transparent 70%);',
    ' animation:vt-nube 14s ease-in-out infinite alternate}',
    '@keyframes vt-nube{from{transform:translateX(-10px)}to{transform:translateX(10px)}}',
    '.vt-rayo,.vt-destello{position:absolute;inset:0;width:100%;height:100%;opacity:0;',
    ' pointer-events:none;animation:vt-flash 7s linear infinite}',
    '.vt-destello{background:rgba(200,230,255,.16)}',
    '@keyframes vt-flash{0%,88%{opacity:0}89%{opacity:1}90.5%{opacity:.15}92%{opacity:.95}',
    ' 94%{opacity:0}96%{opacity:.5}97.5%{opacity:0}100%{opacity:0}}',
    '.vt-piso{position:absolute;left:-30%;right:-30%;bottom:0;height:340px;pointer-events:none;',
    ' background:repeating-linear-gradient(90deg,rgba(var(--m-oro-rgb),.055) 0 1px,transparent 1px 30px),',
    ' repeating-linear-gradient(0deg,rgba(var(--m-oro-rgb),.05) 0 1px,transparent 1px 30px);',
    ' transform:perspective(300px) rotateX(72deg);transform-origin:50% 100%}',
    '.vt-arcos{position:absolute;left:0;right:0;top:130px;display:flex;justify-content:center;',
    ' align-items:flex-end;gap:8px;padding:0 26px;opacity:.85;max-width:430px;margin:0 auto;',
    ' pointer-events:none}',
    '.vt-arco{flex:1;height:104px;border:1px solid rgba(var(--m-oro-rgb),.28);border-bottom:none;',
    ' border-radius:44px 44px 0 0;position:relative;',
    ' background:linear-gradient(180deg,rgba(184,31,48,.28),rgba(3,8,14,.85));',
    ' box-shadow:inset 0 0 22px rgba(var(--m-oro-rgb),.14)}',
    '.vt-arco span{position:absolute;left:0;right:0;bottom:11px;text-align:center;font-size:8px;',
    ' letter-spacing:2px;color:var(--m-oro);text-shadow:0 0 8px var(--m-oro)}',
    '.vt-arco.vt-centro{flex:1.3;height:136px;border-color:rgba(var(--m-oro-rgb),.55);',
    ' background:linear-gradient(180deg,rgba(var(--m-oro-rgb),.2),rgba(3,8,14,.9));',
    ' animation:vt-latir 3.4s ease-in-out infinite}',
    '@keyframes vt-latir{0%,100%{box-shadow:inset 0 0 28px rgba(var(--m-oro-rgb),.3),0 0 26px rgba(var(--m-oro-rgb),.16)}',
    ' 50%{box-shadow:inset 0 0 34px rgba(var(--m-oro-rgb),.5),0 0 40px rgba(var(--m-oro-rgb),.3)}}',
    '.vt-arco.vt-frio{border-color:rgba(var(--m-acento-rgb),.28);',
    ' background:linear-gradient(180deg,rgba(29,107,69,.3),rgba(3,8,14,.85))}',
    '.vt-arco.vt-frio span{color:#9fd8ff;text-shadow:0 0 8px var(--m-acento)}',
    '.vt-mesa{position:absolute;left:50%;bottom:-150px;width:340px;height:340px;border-radius:50%;',
    ' transform:translateX(-50%) perspective(460px) rotateX(70deg);border:6px solid #6b5010;',
    ' box-shadow:0 0 70px rgba(var(--m-oro-rgb),.28),inset 0 0 44px rgba(0,0,0,.85);overflow:hidden;',
    ' pointer-events:none}',
    '.vt-rueda{position:absolute;inset:0;border-radius:50%;',
    ' background:repeating-conic-gradient(#b81f30 0 18deg,#0d1116 18deg 36deg);',
    ' animation:vt-girar 46s linear infinite}',
    '@keyframes vt-girar{to{transform:rotate(360deg)}}',
    '.vt-son{position:absolute;right:10px;top:10px;font-size:20px;opacity:.75;cursor:pointer;',
    ' background:none;border:0;padding:8px;line-height:1;z-index:8}',
    // El formulario va ABAJO, no al medio. Centrado tapaba los arcos, y los
    // arcos son la mitad de la idea: son el salón que se ve al fondo desde la
    // puerta. El padding de arriba es el hueco que se les deja, y como el
    // contenedor hace scroll, el formulario largo del registro sigue entrando.
    // El formulario cuelga JUSTO DEBAJO de los arcos, no al medio ni al fondo.
    // Al medio los tapaba, y al fondo dejaba un hueco muerto en el teléfono.
    // Lo que sobra abajo no sobra: es donde se ve la ruleta.
    '.vt-frente{position:relative;z-index:5;height:100%;display:flex;flex-direction:column;',
    ' align-items:center;justify-content:flex-start;padding:286px 16px 26px;overflow-y:auto}',
    '.vt-frente>*{flex:none}',
    // En pantallas bajas (un teléfono viejo acostado, o el registro largo) los
    // arcos se achican para que el formulario no quede empujado fuera.
    '@media (max-height:640px){.vt-arcos{top:96px}.vt-arco{height:72px}',
    ' .vt-arco.vt-centro{height:96px}.vt-frente{padding-top:210px}}',
    // El botón: forma de arco + destello. Es la puerta, no un botón cualquiera.
    '.vt-btn{position:relative;width:100%;border:0;cursor:pointer;font-family:Georgia,serif;',
    ' border-radius:44px 44px 7px 7px;padding:24px 12px 14px;text-align:center;font-size:13px;',
    ' font-weight:700;letter-spacing:2.5px;overflow:hidden;color:#04240f;',
    ' background:linear-gradient(180deg,#b8ffcb 0%,#3fe07a 40%,#12a04c 100%);',
    ' box-shadow:0 3px 0 #0a5c2c,0 0 36px rgba(63,224,122,.55)}',
    '.vt-btn:disabled{filter:saturate(.4) brightness(.7);cursor:default}',
    '.vt-btn:before{content:"";position:absolute;left:50%;top:10px;transform:translateX(-50%);',
    ' width:52%;height:56px;border-radius:32px 32px 0 0;pointer-events:none;',
    ' background:linear-gradient(180deg,rgba(4,26,14,.55),rgba(4,26,14,0));',
    ' animation:vt-abrir 3.6s ease-in-out infinite}',
    '@keyframes vt-abrir{0%,100%{height:56px;opacity:.6}50%{height:17px;opacity:.15}}',
    '.vt-btn:after{content:"";position:absolute;top:0;bottom:0;width:58px;left:-80px;',
    ' pointer-events:none;',
    ' background:linear-gradient(100deg,transparent,rgba(255,255,255,.8),transparent);',
    ' animation:vt-brillo 3.6s ease-in-out infinite}',
    '@keyframes vt-brillo{0%{left:-80px}55%,100%{left:112%}}',
    // El freno: una sola regla apaga TODO el movimiento.
    '.vt-quieto .vt-cielo,.vt-quieto .vt-rayo,.vt-quieto .vt-destello,.vt-quieto .vt-rueda,',
    '.vt-quieto .vt-arco.vt-centro,.vt-quieto .vt-btn:before,.vt-quieto .vt-btn:after',
    ' {animation:none}',
    '.vt-quieto .vt-rayo{opacity:.55}',
    // ── LA CÁMARA AVANZA ─────────────────────────────────────────────────
    // Los arcos crecen y se comen la pantalla mientras el formulario se va.
    // Es lo que hace que la puerta y el salón se sientan el mismo lugar y no
    // dos pantallas distintas.
    '.vt-esc.vt-entrando .vt-arcos{animation:vt-adentro 900ms ease-in forwards}',
    '.vt-esc.vt-entrando .vt-frente{animation:vt-irse 400ms ease-out forwards}',
    '.vt-esc.vt-entrando .vt-mesa{animation:vt-abajo 900ms ease-in forwards}',
    '@keyframes vt-adentro{to{transform:scale(6);opacity:0}}',
    '@keyframes vt-irse{to{opacity:0;transform:translateY(14px)}}',
    '@keyframes vt-abajo{to{transform:translateX(-50%) perspective(460px) rotateX(70deg) scale(2.4);',
    ' opacity:0}}',
    // Con el movimiento apagado no hay avance: se apaga y ya. Quien pidió no
    // ver animaciones tampoco quiere que la pantalla se le venga encima.
    '.vt-quieto.vt-entrando .vt-arcos,.vt-quieto.vt-entrando .vt-frente,',
    '.vt-quieto.vt-entrando .vt-mesa{animation:none;opacity:0}',
  ].join('');


  // De "var(--m-oro)" a "255,216,74", para poder seguir usando rgba() con
  // transparencia. Si el color viene mal escrito, vale el de la casa: un
  // error de tipeo en la configuración no puede dejar la puerta sin color.
  function aRGB(hex, porDefecto) {
    const h = String(hex || '').trim().replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return porDefecto;
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',');
  }

  function coloresDeLaMarca() {
    const m = (window.Marca && window.Marca.get()) || {};
    return {
      '--m-oro': m.colorPrimario || 'var(--m-oro)',
      '--m-oro-rgb': aRGB(m.colorPrimario, '255,216,74'),
      '--m-acento': m.colorAcento || 'var(--m-acento)',
      '--m-acento-rgb': aRGB(m.colorAcento, '90,184,255'),
    };
  }

  function ponerEstilos() {
    if (document.getElementById('vt-css')) return;
    const s = document.createElement('style');
    s.id = 'vt-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function BotonArco({ texto, onClick, disabled, type }) {
    // El desbloqueo va en onPointerDown y no en onClick porque este botón se
    // usa también como submit del formulario: ahí el sonido lo pide un efecto
    // que corre mucho después, y para entonces el permiso ya se perdió.
    // pointerdown es lo más temprano del toque, y sirve igual para el dedo y
    // para el ratón.
    const abrirElAudio = () => { if (Sonido.prendido()) Sonido.desbloquear(); };
    return (
      <button type={type || 'button'} className="vt-btn"
              onPointerDown={abrirElAudio} onClick={onClick} disabled={disabled}>
        {texto}
      </button>
    );
  }

  function Escena({ children, entrando }) {
    const [son, setSon] = React.useState(Sonido.prendido());
    React.useEffect(ponerEstilos, []);
    // El trueno acompaña el avance. Suena sólo si el jugador prendió el
    // sonido, y el gesto que lo permite es el clic en el botón.
    React.useEffect(() => { if (entrando) Sonido.trueno(); }, [entrando]);

    return (
      <div style={coloresDeLaMarca()} className={'vt-esc'
        + (SIN_MOVIMIENTO ? ' vt-quieto' : '')
        + (entrando ? ' vt-entrando' : '')}>
        <div className="vt-cielo" />
        <div className="vt-destello" />
        <svg className="vt-rayo" viewBox="0 0 360 735" preserveAspectRatio="xMidYMin slice" aria-hidden="true">
          <path d="M206 0 L176 96 L212 90 L156 226 L182 128 L146 134 Z" fill="#fff8e0"
                style={{ filter: 'drop-shadow(0 0 14px var(--m-oro)) drop-shadow(0 0 44px rgba(var(--m-oro-rgb),.7))' }} />
          <path d="M78 12 L60 78 L84 72 L52 152" stroke="rgba(var(--m-oro-rgb),.55)" strokeWidth="2.5" fill="none"
                style={{ filter: 'drop-shadow(0 0 10px rgba(var(--m-oro-rgb),.9))' }} />
        </svg>
        <div className="vt-piso" />

        <div className="vt-arcos">
          <div className="vt-arco"><span>{T('RULETA')}</span></div>
          <div className="vt-arco vt-centro">
            <span style={{ bottom: 'auto', top: 34, fontSize: 24 }}>⚡</span>
            <span style={{ color: '#fff3c4' }}>CATATUMBO</span>
          </div>
          <div className="vt-arco vt-frio"><span>21</span></div>
        </div>

        <div className="vt-mesa"><div className="vt-rueda" /></div>

        <button className="vt-son" type="button"
                aria-label={son ? T('Apagar el sonido') : T('Prender el sonido')}
                onClick={() => setSon(Sonido.alternar())}>
          {son ? '🔊' : '🔇'}
        </button>

        <div className="vt-frente">{children}</div>
      </div>
    );
  }

  // Lo que tarda el avance, en milisegundos. Vive acá y no en login.jsx para
  // que el que cambie la animación no tenga que acordarse de cambiar la
  // espera en otro archivo.
  window.Entrada = { Escena, BotonArco, Sonido, DURACION_ENTRADA: 900 };
})();
