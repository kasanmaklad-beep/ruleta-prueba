// Pantalla de Login / Registro — expone window.LoginScreen
// Props: { onAuth(user) }  — se llama tras login/registro exitoso (token ya guardado)
//
// El registro pide la ficha completa (nombre, apellido, cédula, teléfono,
// correo y banco) porque acá se maneja plata real: cuando alguien pide un
// retiro hay que saber a quién se le está pagando y a dónde.
(function () {
  const { useState } = React;

  const BANCOS = (window.UI && window.UI.BANCOS) || ['Otro'];
  const DOCS = (window.UI && window.UI.DOCS) || [['V', 'V — Cédula', '12345678']];
  const ejemploDoc = (window.UI && window.UI.ejemploDoc) || (() => '12345678');

  // ── Las condiciones enteras, en un panel ────────────────────────────────
  // Se usa en dos lados: el enlace del registro y la pantalla que se le pone
  // delante a quien ya tenía cuenta. Por eso vive afuera de LoginScreen.
  function PanelCondicionesTexto({ cfg }) {
    const c = (window.CONDICIONES && window.CONDICIONES.puntos(cfg)) || [];
    return (
      <>
        <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 2, color: '#d4a94a' }}>
          CONDICIONES DE VOLTIO
        </div>
        <div style={{ fontSize: 10, color: '#777', letterSpacing: 1, marginBottom: 14 }}>
          versión {(window.CONDICIONES || {}).VERSION}
        </div>
        {c.map((p, i) => (
          <div key={i} style={{ marginBottom: 13 }}>
            <div style={{ color: '#ffd84a', fontWeight: 700, fontSize: 13.5, marginBottom: 3 }}>
              {p.titulo}
            </div>
            <div style={{ color: '#d8cfae', fontSize: 13, lineHeight: 1.65 }}>{p.texto}</div>
          </div>
        ))}
      </>
    );
  }

  // ── "Aceptá para seguir" ────────────────────────────────────────────────
  // La ven las cuentas que ya existían antes de que hubiera condiciones, y
  // todos cuando cambie el texto. Es un portón: no se puede jugar sin pasar
  // por acá. Sale SALIR por si alguien no quiere aceptar — encerrar a alguien
  // en una pantalla que no acepta es peor que dejarlo ir.
  function CondicionesScreen({ user, onListo, onLogout }) {
    const [acepta, setAcepta] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [error, setError] = useState('');
    const [cfg, setCfg] = useState(null);

    React.useEffect(() => {
      if (!window.Api || !window.Api.configPublica) return;
      window.Api.configPublica().then((d) => setCfg(d && d.config)).catch(() => {});
    }, []);

    const aceptar = async () => {
      setEnviando(true);
      try {
        const r = await window.Api.aceptarCondiciones((window.CONDICIONES || {}).VERSION);
        onListo(r.user);
      } catch (err) {
        setError(err.message || 'No se pudo guardar');
        setEnviando(false);
      }
    };

    return (
      <div style={{
        minHeight: '100vh', padding: 16, color: '#fff', fontFamily: 'Georgia, serif',
        background: 'radial-gradient(ellipse at center, #3a1f08 0%, #1a0d02 60%, #050200 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ maxWidth: 520, width: '100%' }}>
          <div style={{
            background: 'linear-gradient(180deg, #1a1410, #100a06)',
            border: '1px solid #8b6a20', borderRadius: 12, padding: 18,
            maxHeight: '70vh', overflowY: 'auto',
          }}>
            <div style={{ fontSize: 12, color: '#bba876', marginBottom: 12, lineHeight: 1.6 }}>
              Hola{user && user.username ? ` ${user.username}` : ''}: pusimos por escrito las
              condiciones de la casa. Leelas y aceptalas para seguir jugando.
            </div>
            <PanelCondicionesTexto cfg={cfg} />
          </div>

          <label style={{
            display: 'flex', alignItems: 'flex-start', gap: 9, margin: '14px 2px',
            cursor: 'pointer', fontSize: 13.5, lineHeight: 1.5,
          }}>
            <input type="checkbox" checked={acepta}
                   onChange={(e) => { setAcepta(e.target.checked); setError(''); }}
                   style={{ width: 20, height: 20, flex: 'none', marginTop: 1, accentColor: '#d4a94a' }} />
            <span>{(window.CONDICIONES && window.CONDICIONES.declaracion())
              || 'Tengo 18 años cumplidos y acepto las condiciones.'}</span>
          </label>

          {error && (
            <div style={{
              background: 'rgba(180,16,26,0.25)', border: '1px solid #b8101a',
              color: '#ff9a9a', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 10,
            }}>{error}</div>
          )}

          <button
            onClick={aceptar}
            disabled={!acepta || enviando}
            style={{
              width: '100%', padding: 14, borderRadius: 8, border: '2px solid #d4a94a',
              background: 'linear-gradient(180deg, #d4a94a, #8b6a20)', color: '#1a1006',
              fontFamily: 'Georgia, serif', fontWeight: 900, fontSize: 15, letterSpacing: 2,
              cursor: (!acepta || enviando) ? 'default' : 'pointer',
              opacity: (!acepta || enviando) ? 0.5 : 1,
            }}
          >{enviando ? 'GUARDANDO...' : 'ACEPTAR Y SEGUIR'}</button>

          {onLogout && (
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <a href="#" onClick={(e) => { e.preventDefault(); onLogout(); }}
                 style={{ color: '#999', fontSize: 12.5, textDecoration: 'underline' }}>
                Salir sin aceptar
              </a>
            </div>
          )}
        </div>
      </div>
    );
  }

  function LoginScreen({ onAuth }) {
    const [mode, setMode] = useState(() =>
      new URLSearchParams(window.location.search).get('ref') ? 'register' : 'login');
    // El código de socio puede venir en el enlace que reparte el socio:
    // .../?ref=S0009 — así el jugador no tiene que escribirlo.
    const refDeLaUrl = (() => {
      try { return new URLSearchParams(window.location.search).get('ref') || ''; }
      catch (e) { return ''; }
    })();

    const [f, setF] = useState({
      username: '', password: '', first_name: '', last_name: '',
      doc_type: 'V', cedula: '', phone: '', email: '', bank: '',
      ref: refDeLaUrl.toUpperCase(),
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    // La casilla de las condiciones y el panel que las muestra enteras.
    const [acepta, setAcepta] = useState(false);
    const [verCondiciones, setVerCondiciones] = useState(false);
    // Los números de las condiciones (mínimos, cuánto hay que jugar antes de
    // retirar) salen de la configuración real de la casa, no escritos a mano:
    // si mañana el dueño los cambia en el panel, el texto cambia con ellos.
    const [cfg, setCfg] = useState(null);
    React.useEffect(() => {
      if (!window.Api || !window.Api.configPublica) return;
      window.Api.configPublica().then((d) => setCfg(d && d.config)).catch(() => {});
    }, []);

    const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

    const submit = async (e) => {
      e.preventDefault();
      setError('');

      // El autocompletado del navegador llena los campos sin avisarle a React,
      // así que al enviar se leen del formulario y no del estado: si no, un
      // usuario con la clave guardada veía "el usuario debe tener 3 caracteres"
      // con el campo lleno.
      const els = e.target.elements;
      const v = (k) => {
        const el = els[k];
        const val = el && typeof el.value === 'string' ? el.value : f[k];
        return (val == null ? '' : String(val)).trim();
      };

      const u = v('username').toLowerCase();
      const password = v('password');
      if (u.length < 3) { setError('El usuario debe tener al menos 3 caracteres'); return; }
      if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }

      if (mode === 'register') {
        if (v('first_name').length < 2) { setError('Poné tu nombre'); return; }
        if (v('last_name').length < 2) { setError('Poné tu apellido'); return; }
        if (v('cedula').length < 4) { setError('Poné el número de tu documento'); return; }
        if (v('phone').replace(/\D/g, '').length < 7) { setError('Poné tu teléfono: es a donde te vamos a pagar'); return; }
        if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(v('email'))) { setError('Poné un correo válido'); return; }
        if (!v('bank')) { setError('Elegí tu banco'); return; }
        if (!acepta) {
          setError('Para crear la cuenta hay que leer y aceptar las condiciones.');
          return;
        }
      }

      setLoading(true);
      try {
        const res = mode === 'login'
          ? await window.Api.login(u, password)
          : await window.Api.register({
              username: u,
              password,
              first_name: v('first_name'),
              last_name: v('last_name'),
              doc_type: v('doc_type') || f.doc_type,
              cedula: v('cedula'),
              phone: v('phone'),
              email: v('email'),
              bank: v('bank'),
              ref: v('ref'),
              // Qué aceptó y en qué versión. El servidor lo exige igual: la
              // casilla es para que el jugador lea, el freno está allá.
              acepta_condiciones: true,
              mayor_de_edad: true,
              condiciones_version: (window.CONDICIONES || {}).VERSION || '',
            });
        window.Api.setToken(res.token);
        onAuth(res.user);
      } catch (err) {
        setError(err.message || 'Error inesperado');
      } finally {
        setLoading(false);
      }
    };

    const inputStyle = {
      width: '100%', padding: '12px 14px', marginBottom: 12, borderRadius: 6,
      border: '1px solid #8b6a20', background: 'rgba(0,0,0,0.5)', color: '#fff',
      fontSize: 16, fontFamily: 'Georgia, serif', outline: 'none', boxSizing: 'border-box',
    };
    const ayuda = { fontSize: 11, color: '#888', marginTop: -8, marginBottom: 12, lineHeight: 1.4 };
    const registro = mode === 'register';

    // ── Las condiciones enteras ────────────────────────────────────────
    // Se abren encima de la pantalla y se cierran con un botón grande: en el
    // teléfono, un texto largo detrás de un enlace que después no se sabe
    // cerrar es peor que no mostrarlo.
    const PanelCondiciones = () => {
      return (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 999, background: 'rgba(0,0,0,0.86)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14,
        }} onClick={() => setVerCondiciones(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            maxWidth: 520, width: '100%', maxHeight: '86vh', overflowY: 'auto',
            background: 'linear-gradient(180deg, #1a1410, #100a06)',
            border: '1px solid #8b6a20', borderRadius: 12, padding: 18,
          }}>
            <PanelCondicionesTexto cfg={cfg} />
            <button type="button" onClick={() => setVerCondiciones(false)} style={{
              width: '100%', marginTop: 8, padding: 13, borderRadius: 8,
              border: '2px solid #d4a94a', background: 'linear-gradient(180deg, #d4a94a, #8b6a20)',
              color: '#1a1006', fontFamily: 'Georgia, serif', fontWeight: 900,
              fontSize: 14, letterSpacing: 2, cursor: 'pointer',
            }}>CERRAR</button>
          </div>
        </div>
      );
    };

    return (
      <div style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at center, #3a1f08 0%, #1a0d02 60%, #050200 100%)',
        color: '#fff', fontFamily: 'Georgia, serif',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
        <div style={{
          width: '100%', maxWidth: registro ? 440 : 380,
          background: 'linear-gradient(180deg, #2a1a08, #1a0d02)',
          border: '1px solid #8b6a20', borderRadius: 12, padding: 28,
          boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 22 }}>
            <div style={{
              fontSize: 26, fontWeight: 900, letterSpacing: 3,
              background: 'linear-gradient(180deg, #fff3b0, #ffd84a 55%, #b8860b)',
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              textShadow: '0 0 18px rgba(255,216,74,0.2)',
            }}>⚡ VOLTIO</div>
            <div style={{ fontSize: 9, letterSpacing: 4, color: '#b88a28', marginTop: 4 }}>
              SALÓN DE JUEGOS
            </div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: '#888', marginTop: 8 }}>
              {registro ? 'Creá tu cuenta' : 'Ingresá para jugar'}
            </div>
          </div>

          <form onSubmit={submit}>
            {registro && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input style={inputStyle} type="text" name="first_name" placeholder="Nombre"
                       value={f.first_name} onChange={set('first_name')} />
                <input style={inputStyle} type="text" name="last_name" placeholder="Apellido"
                       value={f.last_name} onChange={set('last_name')} />
              </div>
            )}

            {registro && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 10 }}>
                  <select style={inputStyle} name="doc_type" value={f.doc_type} onChange={set('doc_type')}>
                    {DOCS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                  <input style={inputStyle} type="text" name="cedula"
                         inputMode={f.doc_type === 'P' ? 'text' : 'numeric'}
                         placeholder={`Número (ej: ${ejemploDoc(f.doc_type)})`}
                         value={f.cedula} onChange={set('cedula')} />
                </div>
                <div style={ayuda}>Un documento, una cuenta. Solo el número: el tipo va aparte.</div>
              </>
            )}

            <input
              style={inputStyle}
              type="text"
              name="username"
              placeholder="Usuario"
              value={f.username}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              onChange={set('username')}
            />
            <input
              style={inputStyle}
              type="password"
              name="password"
              placeholder="Contraseña"
              value={f.password}
              autoComplete={registro ? 'new-password' : 'current-password'}
              onChange={set('password')}
            />

            {registro && (
              <>
                <input style={inputStyle} type="tel" inputMode="tel" name="phone"
                       autoComplete="tel"
                       placeholder="Teléfono (ej: 04141234567)"
                       value={f.phone} onChange={set('phone')} />
                <select style={{ ...inputStyle, color: f.bank ? '#fff' : '#888' }}
                        name="bank" value={f.bank} onChange={set('bank')}>
                  <option value="">Tu banco…</option>
                  {BANCOS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <div style={ayuda}>
                  A este banco y teléfono te mandamos el Pago Móvil cuando retires.
                </div>
                <input style={inputStyle} type="email" inputMode="email" name="email"
                       autoComplete="email"
                       placeholder="Correo electrónico"
                       value={f.email} onChange={set('email')} />
                <input style={{ ...inputStyle, textTransform: 'uppercase' }} type="text" name="ref"
                       placeholder="Código de tu socio (opcional)"
                       value={f.ref}
                       onChange={(e) => setF((p) => ({ ...p, ref: e.target.value.toUpperCase() }))} />
                <div style={ayuda}>
                  Si alguien te invitó, poné acá su código. Si entraste por su enlace, ya viene puesto.
                </div>
              </>
            )}

            {/* ── Antes de crear la cuenta ──────────────────────────────
                Tres frases, no un reglamento: lo que el jugador NECESITA
                saber antes de poner plata. Las tres son las que después
                generan reclamos si se enteran tarde. El texto completo está a
                un toque, y la casilla no se puede saltar. */}
            {registro && (
              <div style={{
                border: '1px solid #8b6a20', borderRadius: 8, padding: '12px 14px',
                background: 'rgba(0,0,0,0.35)', marginBottom: 14, fontSize: 12.5,
                color: '#d8cfae', lineHeight: 1.7,
              }}>
                <div style={{ fontSize: 11, letterSpacing: 2, color: '#d4a94a', marginBottom: 6 }}>
                  ANTES DE EMPEZAR
                </div>
                <div>· Es un <b>juego de azar</b>: podés perder lo que apostás.</div>
                <div>
                  · Para retirar hay que haber jugado el{' '}
                  <b>{cfg && cfg.wager_pct_required != null ? cfg.wager_pct_required : 25}%</b>
                  {' '}de lo que recargaste.
                </div>
                <div>· Se recarga y se cobra <b>en efectivo</b> con tu taquillero.</div>
                <a href="#"
                   onClick={(e) => { e.preventDefault(); setVerCondiciones(true); }}
                   style={{ color: '#d4a94a', fontWeight: 700, textDecoration: 'underline',
                            display: 'inline-block', marginTop: 8 }}>
                  Leer las condiciones completas
                </a>

                <label style={{
                  display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 12,
                  cursor: 'pointer', color: '#fff', fontSize: 13, lineHeight: 1.5,
                }}>
                  <input type="checkbox" checked={acepta}
                         onChange={(e) => { setAcepta(e.target.checked); setError(''); }}
                         style={{ width: 20, height: 20, flex: 'none', marginTop: 1, accentColor: '#d4a94a' }} />
                  <span>{(window.CONDICIONES && window.CONDICIONES.declaracion())
                    || 'Tengo 18 años cumplidos y acepto las condiciones.'}</span>
                </label>
              </div>
            )}

            {error && (
              <div style={{
                background: 'rgba(180,16,26,0.25)', border: '1px solid #b8101a',
                color: '#ff9a9a', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 12,
              }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={loading || (registro && !acepta)}
              style={{
                width: '100%', padding: '13px', borderRadius: 6, border: '2px solid #d4a94a',
                background: 'linear-gradient(180deg, #d4a94a, #8b6a20)', color: '#1a1006',
                fontWeight: 900, fontSize: 15, letterSpacing: 2, cursor: loading ? 'wait' : 'pointer',
                fontFamily: 'Georgia, serif',
                opacity: (loading || (registro && !acepta)) ? 0.5 : 1,
                boxShadow: '0 4px 14px rgba(212,169,74,0.4)',
              }}
            >
              {loading ? '...' : (registro ? 'REGISTRARME' : 'ENTRAR')}
            </button>
          </form>

          {verCondiciones && <PanelCondiciones />}

          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: '#aaa' }}>
            {registro ? '¿Ya tenés cuenta? ' : '¿No tenés cuenta? '}
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setError(''); setMode(registro ? 'login' : 'register'); }}
              style={{ color: '#d4a94a', fontWeight: 700, textDecoration: 'none' }}
            >
              {registro ? 'Iniciá sesión' : 'Registrate'}
            </a>
          </div>
        </div>
      </div>
    );
  }

  window.LoginScreen = LoginScreen;
  window.CondicionesScreen = CondicionesScreen;
})();
