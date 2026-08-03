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

    // Tiempo máximo de espera. Sin esto, si el servidor deja de contestar a
    // mitad de una llamada (se cayó, se cortó la señal del teléfono) la
    // promesa queda colgada PARA SIEMPRE: el juego se queda esperando una
    // respuesta que no llega, con el cilindro girando y el sonido prendido.
    const ms = opts.timeoutMs || 0;
    const ctrl = (ms && typeof AbortController !== 'undefined') ? new AbortController() : null;
    const reloj = ctrl ? setTimeout(() => ctrl.abort(), ms) : null;

    let res;
    try {
      res = await fetch(path, {
        method: opts.method || 'GET',
        headers,
        body: opts.body ? JSON.stringify(opts.body) : undefined,
        signal: ctrl ? ctrl.signal : undefined,
      });
    } catch (e) {
      if (ctrl && ctrl.signal.aborted) {
        throw new Error('El servidor no respondió a tiempo. Probá de nuevo.');
      }
      throw new Error('No hay conexión con el servidor. Revisá tu internet.');
    } finally {
      if (reloj) clearTimeout(reloj);
    }

    let data = null;
    try { data = await res.json(); } catch (e) { /* sin cuerpo */ }

    if (!res.ok) {
      // Lo echaron: alguien entró con esta misma cuenta desde otro aparato.
      // No es un pase vencido ni una clave mal escrita, así que no alcanza con
      // devolver el error y que cada pantalla haga lo que quiera: hay que
      // soltar el pase acá mismo —si no, el juego sigue intentando con uno que
      // ya no vale— y avisarle a la aplicación para que lo lleve a la entrada
      // con el motivo escrito. Se avisa por evento y no llamando a nadie
      // porque este archivo no conoce las pantallas ni tiene que conocerlas.
      if (res.status === 401 && data && data.sesion_tomada) {
        setToken(null);
        try {
          window.dispatchEvent(new CustomEvent('voltio:sesion-tomada', {
            detail: { mensaje: data.error },
          }));
        } catch (e) { /* navegador viejo: al menos el pase ya se soltó */ }
      }
      const err = new Error((data && data.error) || ('HTTP ' + res.status));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  // Arma "?a=1&b=2" salteando lo vacío.
  function qs(params) {
    const p = new URLSearchParams();
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') p.set(k, v);
    });
    const s = p.toString();
    return s ? '?' + s : '';
  }

  const POST = (path, body) => req(path, { method: 'POST', body: body || {} });
  const PUT = (path, body) => req(path, { method: 'PUT', body: body || {} });

  window.Api = {
    getToken,
    setToken,
    logout() { setToken(null); },

    // ── Cuenta ──
    // Recibe la ficha completa: usuario, clave, nombre, apellido, cédula,
    // teléfono, correo y banco.
    register(datos) { return POST('/api/auth/register', datos); },
    login(username, password) {
      return POST('/api/auth/login', { username, password });
    },
    me() { return req('/api/me'); },
    updateProfile(data) { return PUT('/api/me', data); },
    // Cambiar la clave saca de la cuenta a cualquier otro aparato, así que el
    // servidor devuelve un pase nuevo para ESTE: hay que guardarlo o el que
    // acaba de cambiar la clave se echa a sí mismo en el movimiento siguiente.
    async changePassword(current_password, new_password) {
      const d = await POST('/api/me/password', { current_password, new_password });
      if (d && d.token) setToken(d.token);
      return d;
    },

    // ── Juego ──
    // El catálogo del salón: la ficha de cada mesa (rueda y su orden, animales,
    // rayos, pago del pleno). Con eso el cliente sabe cómo dibujarse.
    games() { return req('/api/games'); },
    // El servidor resuelve el giro completo: recibe las apuestas y devuelve
    // { resultIndex, resultNum, lightning, win, capped, winDetails, balance }.
    // `game` es la mesa del salón donde se juega: queda guardada en cada
    // movimiento para poder separar la plata por juego en los reportes.
    // El giro lleva tiempo máximo: es la única llamada que ocurre con la
    // rueda ya girando, así que si el servidor no contesta hay que cortar y
    // devolverle las fichas al jugador en vez de dejarlo esperando.
    spin(bets, game) {
      return req('/api/game/spin', {
        method: 'POST',
        body: { bets, game: game || 'catatumbo' },
        timeoutMs: 15000,
      });
    },

    // ── La mesa de 21 ──
    // La ronda vive en el servidor: acá solo se pide su estado y se le manda
    // lo que el jugador tocó. La `version` viaja en cada jugada — es lo que
    // hace que un doble toque no pida dos cartas.
    bjRonda(mesa) { return req('/api/bj/ronda' + qs({ mesa })); },
    bjApostar(mesa, puestos) { return POST('/api/bj/apostar', { mesa, puestos }); },
    // El servidor identifica la mano por la RONDA (una sola abierta por
    // jugador), no por el puesto: el turno lo lleva él.
    bjJugar(accion, ronda, version) {
      return POST(`/api/bj/${accion}`, { ronda, version });
    },

    // ── Billetera del jugador ──
    walletInfo() { return req('/api/wallet/info'); },
    walletHistory() { return req('/api/wallet/history'); },
    createTopup(data) { return POST('/api/wallet/topup', data); },
    createWithdrawal(data) { return POST('/api/wallet/withdraw', data); },

    // ── Banca del banquero ──
    cashierSummary() { return req('/api/cashier/summary'); },
    cashierLoad(username, amount, note) {
      return POST('/api/cashier/load', { username, amount, note });
    },
    cashierSetCollectInfo(details) { return PUT('/api/cashier/collect-info', { details }); },
    cashierTopups(status) { return req('/api/cashier/topups' + qs({ status })); },
    cashierApproveTopup(id, amount) {
      return POST(`/api/cashier/topups/${id}/approve`, { amount });
    },
    cashierRejectTopup(id, note) { return POST(`/api/cashier/topups/${id}/reject`, { note }); },
    cashierWithdrawals(status) { return req('/api/cashier/withdrawals' + qs({ status })); },
    cashierPayWithdrawal(id, note) {
      return POST(`/api/cashier/withdrawals/${id}/pay`, { note });
    },
    cashierRejectWithdrawal(id, note) {
      return POST(`/api/cashier/withdrawals/${id}/reject`, { note });
    },

    // ── La capa ejecutiva ──
    // El ejecutivo mira lo suyo sin parámetros. El dueño mira lo de cualquiera
    // pasando su id, porque está por encima de él.
    execSummary(exec) { return req('/api/exec/summary' + qs({ exec })); },
    execPlayers(exec) { return req('/api/exec/players' + qs({ exec })); },
    // El ejecutivo crea sus propios banqueros: nacen colgados de él.
    execCreateCashier(datos) { return POST('/api/exec/cashiers', datos); },
    adminExecs() { return req('/api/admin/execs'); },
    // Colgar un banquero de un ejecutivo. Con exec_id en null vuelve a la matriz.
    adminSetExec(cashierId, exec_id) {
      return POST(`/api/admin/cashiers/${cashierId}/exec`, { exec_id });
    },
    adminSetExecLimite(execId, exec_limite) {
      return POST(`/api/admin/execs/${execId}/limite`, { exec_limite });
    },

    // ── Panel: tablero, usuarios y movimientos ──
    adminSummary() { return req('/api/admin/summary'); },
    adminUsers(params) { return req('/api/admin/users' + qs(params)); },
    adminTransactions(params) { return req('/api/admin/transactions' + qs(params)); },
    adminDeposit(username, amount, note) {
      return POST('/api/admin/deposit', { username, amount, note });
    },
    adminAdjust(username, amount, note) {
      return POST('/api/admin/adjust', { username, amount, note });
    },
    adminSetRole(id, role, commission_pct) {
      return POST(`/api/admin/users/${id}/role`, { role, commission_pct });
    },
    adminSetStatus(id, status) { return POST(`/api/admin/users/${id}/status`, { status }); },
    adminResetPassword(id, new_password) {
      return POST(`/api/admin/users/${id}/password`, { new_password });
    },

    // ── Panel: configuración ──
    adminGetSettings() { return req('/api/admin/settings'); },
    adminPutSettings(settings) { return PUT('/api/admin/settings', { settings }); },

    // ── Panel: las mesas del salón ──
    // Las cuatro devuelven el catálogo completo ya actualizado, así el panel
    // no tiene que volver a pedirlo después de cada cambio.
    adminGames() { return req('/api/admin/games'); },
    adminCreateGame(mesa) { return POST('/api/admin/games', mesa); },
    adminUpdateGame(id, mesa) { return PUT(`/api/admin/games/${id}`, mesa); },
    // El estado de una mesa: 0 cerrada, 1 abierta, 2 en pruebas (sólo el dueño
    // y las cuentas de prueba la ven).
    // Los números de la casa sin necesidad de sesión (los usa el registro).
    configPublica() { return req('/api/config'); },
    // Aceptar las condiciones desde adentro (cuentas viejas o texto nuevo).
    aceptarCondiciones(version) {
      return POST('/api/condiciones', { acepta_condiciones: true, condiciones_version: version });
    },

    adminEstadoMesa(id, estado) { return POST(`/api/admin/games/${id}/activo`, { estado }); },

    // ── Panel: banqueros ──
    adminCashiers() { return req('/api/admin/cashiers'); },
    adminCreateCashier(datos) { return POST('/api/admin/cashiers', datos); },
    adminSetRefCode(id, referral_code) {
      return POST(`/api/admin/users/${id}/ref-code`, { referral_code });
    },
    adminSellCredit(username, amount, paid_amount, note) {
      return POST('/api/admin/cashiers/credit', { username, amount, paid_amount, note });
    },
    adminAdjustCredit(username, amount, note) {
      return POST('/api/admin/cashiers/adjust', { username, amount, note });
    },
    adminCreditLedger(params) { return req('/api/admin/credit-ledger' + qs(params)); },

    // ── Panel: recargas ──
    adminTopups(status) { return req('/api/admin/topups' + qs({ status })); },
    adminApproveTopup(id, amount, note) {
      return POST(`/api/admin/topups/${id}/approve`, { amount, note });
    },
    adminRejectTopup(id, note) { return POST(`/api/admin/topups/${id}/reject`, { note }); },

    // ── Panel: retiros ──
    adminWithdrawals(status) { return req('/api/admin/withdrawals' + qs({ status })); },
    adminPayWithdrawal(id, paid_by, payer_username, note) {
      return POST(`/api/admin/withdrawals/${id}/pay`, { paid_by, payer_username, note });
    },
    adminRejectWithdrawal(id, note) { return POST(`/api/admin/withdrawals/${id}/reject`, { note }); },

    // ── Panel: reportes ──
    reportDaily(params) { return req('/api/admin/report/daily' + qs(params)); },
    reportCashiers(params) { return req('/api/admin/report/cashiers' + qs(params)); },
    reportPlayer(id) { return req(`/api/admin/report/player/${id}`); },
    reportAlerts() { return req('/api/admin/report/alerts'); },
  };
})();
