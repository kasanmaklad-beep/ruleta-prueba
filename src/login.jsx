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
      const u = f.username.trim().toLowerCase();
      if (u.length < 3) { setError('El usuario debe tener al menos 3 caracteres'); return; }
      if (f.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }

      if (mode === 'register') {
        if (f.first_name.trim().length < 2) { setError('Poné tu nombre'); return; }
        if (f.last_name.trim().length < 2) { setError('Poné tu apellido'); return; }
        if (f.cedula.trim().length < 4) { setError('Poné el número de tu documento'); return; }
        if (f.phone.replace(/\D/g, '').length < 7) { setError('Poné tu teléfono: es a donde te vamos a pagar'); return; }
        if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(f.email.trim())) { setError('Poné un correo válido'); return; }
        if (!f.bank) { setError('Elegí tu banco'); return; }
      }

      setLoading(true);
      try {
        const res = mode === 'login'
          ? await window.Api.login(u, f.password)
          : await window.Api.register({
              username: u,
              password: f.password,
              first_name: f.first_name.trim(),
              last_name: f.last_name.trim(),
              doc_type: f.doc_type,
              cedula: f.cedula.trim(),
              phone: f.phone.trim(),
              email: f.email.trim(),
              bank: f.bank,
              ref: f.ref.trim(),
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
              fontSize: 24, fontWeight: 900, letterSpacing: 3, color: '#d4a94a',
              textShadow: '0 2px 4px rgba(0,0,0,0.8)',
            }}>⚡ RULETA CATATUMBO ⚡</div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: '#888', marginTop: 6 }}>
              {registro ? 'Creá tu cuenta' : 'Ingresá para jugar'}
            </div>
          </div>

          <form onSubmit={submit}>
            {registro && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <input style={inputStyle} type="text" placeholder="Nombre"
                       value={f.first_name} onChange={set('first_name')} />
                <input style={inputStyle} type="text" placeholder="Apellido"
                       value={f.last_name} onChange={set('last_name')} />
              </div>
            )}

            {registro && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 10 }}>
                  <select style={inputStyle} value={f.doc_type} onChange={set('doc_type')}>
                    {DOCS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                  </select>
                  <input style={inputStyle} type="text" inputMode={f.doc_type === 'P' || f.doc_type === 'OTRO' ? 'text' : 'numeric'}
                         placeholder={`Número (ej: ${ejemploDoc(f.doc_type)})`}
                         value={f.cedula} onChange={set('cedula')} />
                </div>
                <div style={ayuda}>Un documento, una cuenta. Solo el número: el tipo va aparte.</div>
              </>
            )}

            <input
              style={inputStyle}
              type="text"
              placeholder="Usuario"
              value={f.username}
              autoCapitalize="none"
              autoCorrect="off"
              onChange={set('username')}
            />
            <input
              style={inputStyle}
              type="password"
              placeholder="Contraseña"
              value={f.password}
              onChange={set('password')}
            />

            {registro && (
              <>
                <input style={inputStyle} type="tel" inputMode="tel"
                       placeholder="Teléfono (ej: 04141234567)"
                       value={f.phone} onChange={set('phone')} />
                <select style={{ ...inputStyle, color: f.bank ? '#fff' : '#888' }}
                        value={f.bank} onChange={set('bank')}>
                  <option value="">Tu banco…</option>
                  {BANCOS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <div style={ayuda}>
                  A este banco y teléfono te mandamos el Pago Móvil cuando retires.
                </div>
                <input style={inputStyle} type="email" inputMode="email"
                       placeholder="Correo electrónico"
                       value={f.email} onChange={set('email')} />
                <input style={{ ...inputStyle, textTransform: 'uppercase' }} type="text"
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
