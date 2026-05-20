// Pantalla de Login / Registro — expone window.LoginScreen
// Props: { onAuth(user) }  — se llama tras login/registro exitoso (token ya guardado)
(function () {
  const { useState } = React;

  function LoginScreen({ onAuth }) {
    const [mode, setMode] = useState('login'); // 'login' | 'register'
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const submit = async (e) => {
      e.preventDefault();
      setError('');
      const u = username.trim().toLowerCase();
      if (u.length < 3) { setError('El usuario debe tener al menos 3 caracteres'); return; }
      if (password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres'); return; }
      setLoading(true);
      try {
        const res = mode === 'login'
          ? await window.Api.login(u, password)
          : await window.Api.register(u, password);
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

    return (
      <div style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at center, #3a1f08 0%, #1a0d02 60%, #050200 100%)',
        color: '#fff', fontFamily: 'Georgia, serif',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
        <div style={{
          width: '100%', maxWidth: 380,
          background: 'linear-gradient(180deg, #2a1a08, #1a0d02)',
          border: '1px solid #8b6a20', borderRadius: 12, padding: 28,
          boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              fontSize: 24, fontWeight: 900, letterSpacing: 3, color: '#d4a94a',
              textShadow: '0 2px 4px rgba(0,0,0,0.8)',
            }}>⚡ RULETA CATATUMBO ⚡</div>
            <div style={{ fontSize: 11, letterSpacing: 2, color: '#888', marginTop: 6 }}>
              {mode === 'login' ? 'Ingresá para jugar' : 'Creá tu cuenta'}
            </div>
          </div>

          <form onSubmit={submit}>
            <input
              style={inputStyle}
              type="text"
              placeholder="Usuario"
              value={username}
              autoCapitalize="none"
              autoCorrect="off"
              onChange={(e) => setUsername(e.target.value)}
            />
            <input
              style={inputStyle}
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

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
              {loading ? '...' : (mode === 'login' ? 'ENTRAR' : 'REGISTRARME')}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: '#aaa' }}>
            {mode === 'login' ? '¿No tenés cuenta? ' : '¿Ya tenés cuenta? '}
            <a
              href="#"
              onClick={(e) => { e.preventDefault(); setError(''); setMode(mode === 'login' ? 'register' : 'login'); }}
              style={{ color: '#d4a94a', fontWeight: 700, textDecoration: 'none' }}
            >
              {mode === 'login' ? 'Registrate' : 'Iniciá sesión'}
            </a>
          </div>
        </div>
      </div>
    );
  }

  window.LoginScreen = LoginScreen;
})();
