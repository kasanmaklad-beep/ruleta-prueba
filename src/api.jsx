// Cliente HTTP de la API — expone window.Api (sin JSX, se compila igual)
(function () {
  const TOKEN_KEY = 'ruleta_token';

  function getToken() { return localStorage.getItem(TOKEN_KEY); }
  function setToken(t) {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }

  async function req(path, opts) {
    opts = opts || {};
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    const tk = getToken();
    if (tk) headers['Authorization'] = 'Bearer ' + tk;

    const res = await fetch(path, {
      method: opts.method || 'GET',
      headers,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });

    let data = null;
    try { data = await res.json(); } catch (e) { /* sin cuerpo */ }

    if (!res.ok) {
      const err = new Error((data && data.error) || ('HTTP ' + res.status));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  window.Api = {
    getToken,
    setToken,
    logout() { setToken(null); },

    register(username, password) {
      return req('/api/auth/register', { method: 'POST', body: { username, password } });
    },
    login(username, password) {
      return req('/api/auth/login', { method: 'POST', body: { username, password } });
    },
    me() { return req('/api/me'); },

    bet(amount, note) { return req('/api/game/bet', { method: 'POST', body: { amount, note } }); },
    win(amount, note) { return req('/api/game/win', { method: 'POST', body: { amount, note } }); },

    adminUsers() { return req('/api/admin/users'); },
    adminTransactions() { return req('/api/admin/transactions'); },
    adminDeposit(username, amount, note) {
      return req('/api/admin/deposit', { method: 'POST', body: { username, amount, note } });
    },
  };
})();
