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

            {error && (
              <div style={{
                background: 'rgba(180,16,26,0.25)', border: '1px solid #b8101a',
                color: '#ff9a9a', borderRadius: 6, padding: '8px 12px', fontSize: 13, marginBottom: 12,
              }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '13px', borderRadius: 6, border: '2px solid #d4a94a',
                background: 'linear-gradient(180deg, #d4a94a, #8b6a20)', color: '#1a1006',
                fontWeight: 900, fontSize: 15, letterSpacing: 2, cursor: loading ? 'wait' : 'pointer',
                fontFamily: 'Georgia, serif', opacity: loading ? 0.6 : 1,
                boxShadow: '0 4px 14px rgba(212,169,74,0.4)',
              }}
            >
              {loading ? '...' : (registro ? 'REGISTRARME' : 'ENTRAR')}
            </button>
          </form>

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
})();
