// Panel de administración — expone window.AdminPanel
// Props: { user, onExit(), onLogout() }  — onExit vuelve al juego
//
// Pestañas: Resumen · Jugadores · Banqueros · Recargas · Retiros ·
//           Mesas · Reportes · Configuración
(function () {
  const { useState, useEffect, useCallback, useRef } = React;
  const U = window.UI;
  const { bs, plata, fecha, styles: S, Boton, Aviso, Dato, Encabezado, Pestanas,
          Tabla, Estado, Confirmar, Campo, nombreMetodo, METODOS } = U;

  // ═════════════════════════════ Raíz ═════════════════════════════════════

  function AdminPanel({ user, onExit, onLogout }) {
    const [tab, setTab] = useState('resumen');
    const [msg, setMsg] = useState(null);
    const [resumen, setResumen] = useState(null);

    const cargarResumen = useCallback(async () => {
      try { setResumen(await window.Api.adminSummary()); }
      catch (err) { setMsg({ kind: 'err', text: err.message }); }
    }, []);

    useEffect(() => { cargarResumen(); }, [cargarResumen]);

    // El aviso de éxito se borra solo; el de error se queda hasta que lo cierren.
    useEffect(() => {
      if (msg && msg.kind === 'ok') {
        const t = setTimeout(() => setMsg(null), 6000);
        return () => clearTimeout(t);
      }
    }, [msg]);

    const pend = resumen ? resumen.pendientes : {};
    const props = { setMsg, recargarResumen: cargarResumen };

    const tabs = [
      { id: 'resumen', label: 'RESUMEN' },
      { id: 'jugadores', label: 'JUGADORES' },
      { id: 'socios', label: 'BANQUEROS' },
      { id: 'ejecutivos', label: 'EJECUTIVOS' },
      { id: 'recargas', label: 'RECARGAS', badge: pend.recargas_pendientes },
      { id: 'retiros', label: 'RETIROS', badge: pend.retiros_pendientes },
      { id: 'mesas', label: 'MESAS' },
      { id: 'reportes', label: 'REPORTES' },
      { id: 'config', label: 'CONFIGURACIÓN' },
    ];

    return (
      <div style={{ ...S.page, ...U.paleta('dueno') }}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <Encabezado
            titulo="⚙ PANEL MATRIZ"
            rol="dueno"
            subtitulo={`Sesión: ${user.username}`}
            acciones={<>
              <Boton tono="gris" onClick={onExit}>← VOLVER AL JUEGO</Boton>
              {onLogout && <Boton tono="gris" onClick={onLogout}>SALIR</Boton>}
            </>}
          />

          {/* Aviso permanente mientras haya cosas esperando respuesta. */}
          {resumen && (pend.recargas_pendientes > 0 || pend.retiros_pendientes > 0) && (
            <div style={{
              marginBottom: 14, padding: '12px 16px', borderRadius: 8,
              background: 'rgba(180,16,26,0.18)', border: '1px solid #b8101a',
              color: '#ffc9c9', fontSize: 15, display: 'flex',
              gap: 12, flexWrap: 'wrap', alignItems: 'center',
            }}>
              <span style={{ fontSize: 20 }}>🔔</span>
              <span>
                Tenés{' '}
                {pend.recargas_pendientes > 0 && (
                  <b>{pend.recargas_pendientes} recarga{pend.recargas_pendientes > 1 ? 's' : ''}</b>
                )}
                {pend.recargas_pendientes > 0 && pend.retiros_pendientes > 0 && ' y '}
                {pend.retiros_pendientes > 0 && (
                  <b>{pend.retiros_pendientes} retiro{pend.retiros_pendientes > 1 ? 's' : ''} por {plata(pend.retiros_pendientes_monto)}</b>
                )}
                {' '}esperando tu respuesta.
              </span>
              {pend.recargas_pendientes > 0 && <Boton chico onClick={() => setTab('recargas')}>VER RECARGAS</Boton>}
              {pend.retiros_pendientes > 0 && <Boton chico onClick={() => setTab('retiros')}>VER RETIROS</Boton>}
            </div>
          )}

          {/* Lo que está en cancha de los banqueros: informativo, lo resuelven ellos. */}
          {resumen && ((pend.recargas_banqueros || 0) > 0 || (pend.retiros_banqueros || 0) > 0) && (
            <div style={{ marginBottom: 14, fontSize: 12, color: '#998' }}>
              Además, los banqueros tienen {pend.recargas_banqueros || 0} recarga(s) y {pend.retiros_banqueros || 0} retiro(s)
              en su cancha — los resuelven ellos desde su banca.
            </div>
          )}

          <Pestanas tabs={tabs} activa={tab} onChange={setTab} />
          <Aviso msg={msg} onClose={() => setMsg(null)} />

          {tab === 'resumen'     && <TabResumen resumen={resumen} {...props} irA={setTab} />}
          {tab === 'jugadores'   && <TabJugadores {...props} />}
          {tab === 'socios' && <TabBanqueros {...props} />}
          {tab === 'ejecutivos' && <TabEjecutivos {...props} />}
          {tab === 'recargas'    && <TabRecargas {...props} />}
          {tab === 'retiros'     && <TabRetiros {...props} />}
          {tab === 'mesas'       && <TabMesas {...props} />}
          {tab === 'reportes'    && <TabReportes {...props} />}
          {tab === 'config'      && <TabConfig {...props} />}
        </div>
      </div>
    );
  }

  // ═════════════════════════════ Resumen ══════════════════════════════════

  function TabResumen({ resumen, irA }) {
    const [movs, setMovs] = useState([]);

    useEffect(() => {
      window.Api.adminTransactions({ limit: 25 })
        .then((d) => setMovs(d.transactions || []))
        .catch(() => {});
    }, []);

    if (!resumen) return <div style={{ color: '#888' }}>Cargando…</div>;
    const h = resumen.hoy;
    const t = resumen.totales;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={S.card}>
          <div style={S.titulo}>HOY ({resumen.fecha})</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <Dato titulo="Entró en recargas" valor={bs(h.recargas)} color="#7ee08a" />
            <Dato titulo="Salió en retiros" valor={bs(h.retiros)} color="#ff9a9a" />
            <Dato titulo="Caja del día" valor={bs(h.caja)} color={h.caja >= 0 ? '#7ee08a' : '#ff9a9a'}
                  detalle="recargas − retiros" />
            <Dato titulo="Se apostó" valor={bs(h.apostado)} />
            <Dato titulo="Se pagó en premios" valor={bs(h.premios)} />
            <Dato titulo="Ganancia del juego" valor={bs(h.juego)} color={h.juego >= 0 ? '#ffd84a' : '#ff9a9a'}
                  detalle="apostado − premios" />
            <Dato titulo="Giros" valor={bs(h.giros)} chico />
            <Dato titulo="Jugadores activos" valor={bs(h.jugadores)} chico />
          </div>
        </div>

        <div style={S.card}>
          <div style={S.titulo}>EL NEGOCIO EN NÚMEROS</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            <Dato titulo="Jugadores" valor={bs(t.jugadores)} chico />
            <Dato titulo="Banqueros" valor={bs(t.banqueros)} chico />
            <Dato titulo="Saldo en manos de jugadores" valor={bs(t.saldo_jugadores)} chico color="#ffd84a"
                  detalle="lo que te podrían pedir" />
            <Dato titulo="Congelado en retiros" valor={bs(t.saldo_congelado)} chico color="#ff9a9a" />
            <Dato titulo="Cupo en la calle" valor={bs(t.cupo_en_calle)} chico
                  detalle="cupo sin usar de banqueros" />
          </div>
        </div>

        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ ...S.titulo, marginBottom: 0 }}>ÚLTIMOS MOVIMIENTOS</div>
            <Boton chico tono="gris" onClick={() => irA('reportes')}>VER REPORTES</Boton>
          </div>
          <TablaMovimientos movs={movs} />
        </div>
      </div>
    );
  }

  const TIPO = {
    deposit:  { t: 'Recarga', c: '#5ab8ff', signo: '+' },
    bet:      { t: 'Apuesta', c: '#ff9a9a', signo: '−' },
    win:      { t: 'Premio', c: '#7ee08a', signo: '+' },
    withdraw: { t: 'Retiro', c: '#ffa04a', signo: '−' },
    adjust:   { t: 'Ajuste', c: '#c9a0ff', signo: '' },
  };

  function TablaMovimientos({ movs }) {
    return (
      <Tabla columnas={['FECHA', 'USUARIO', 'TIPO', 'MONTO', 'DETALLE']} vacio="Sin movimientos">
        {movs.map((m) => {
          const l = TIPO[m.type] || { t: m.type, c: '#aaa', signo: '' };
          return (
            <tr key={m.id}>
              <td style={{ ...S.td, color: '#888', fontSize: 12, whiteSpace: 'nowrap' }}>{fecha(m.created_at)}</td>
              <td style={{ ...S.td, fontWeight: 700 }}>{m.username}</td>
              <td style={{ ...S.td, color: l.c, fontWeight: 700 }}>{l.t}</td>
              <td style={{ ...S.td, color: l.c, whiteSpace: 'nowrap' }}>
                {m.type === 'adjust' ? (m.amount >= 0 ? '+' : '') : l.signo}{bs(m.amount)}
              </td>
              <td style={{ ...S.td, color: '#999', fontSize: 12 }}>{m.note || ''}</td>
            </tr>
          );
        })}
      </Tabla>
    );
  }

  // ═════════════════════════════ Jugadores ════════════════════════════════

  function TabJugadores({ setMsg, recargarResumen }) {
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [rol, setRol] = useState('');
    const [cargando, setCargando] = useState(true);
    const [detalle, setDetalle] = useState(null);
    const [accion, setAccion] = useState(null);  // { tipo, user }
    const buscarRef = useRef(null);

    const cargar = useCallback(async (q, r) => {
      setCargando(true);
      try {
        const d = await window.Api.adminUsers({ search: q, role: r });
        setUsers(d.users || []);
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
      finally { setCargando(false); }
    }, [setMsg]);

    useEffect(() => { cargar('', ''); }, [cargar]);

    // La búsqueda espera a que el usuario deje de escribir.
    useEffect(() => {
      clearTimeout(buscarRef.current);
      buscarRef.current = setTimeout(() => cargar(search, rol), 300);
      return () => clearTimeout(buscarRef.current);
    }, [search, rol, cargar]);

    const refrescar = () => { cargar(search, rol); recargarResumen(); };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormCargaSaldo setMsg={setMsg} onHecho={refrescar} />

        <div style={S.card}>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ ...S.titulo, marginBottom: 0, flex: '1 1 160px' }}>USUARIOS ({users.length})</div>
            <input
              style={{ ...S.input, flex: '2 1 200px' }}
              placeholder="Buscar por usuario, teléfono o cédula…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select style={{ ...S.input, flex: '0 1 150px' }} value={rol} onChange={(e) => setRol(e.target.value)}>
              <option value="">Todos los roles</option>
              <option value="player">Jugadores</option>
              <option value="cashier">Banqueros</option>
              <option value="admin">Administradores</option>
            </select>
          </div>

          <Tabla
            columnas={['USUARIO', 'TELÉFONO', 'SALDO', 'DISPONIBLE', 'ROL', 'ESTADO', 'BANQUERO', '']}
            vacio={cargando ? 'Cargando…' : 'Sin resultados'}
          >
            {users.map((u) => (
              <tr key={u.id}>
                <td style={{ ...S.td, fontWeight: 700 }}>
                  {u.username}
                  {(u.first_name || u.last_name) && (
                    <div style={{ fontSize: 11, color: '#999', fontWeight: 400 }}>
                      {[u.first_name, u.last_name].filter(Boolean).join(' ')}
                    </div>
                  )}
                </td>
                <td style={{ ...S.td, color: '#aaa', fontSize: 13 }}>
                  {u.phone || '—'}
                  {u.cedula && <div style={{ fontSize: 11, color: '#777' }}>{u.cedula}</div>}
                </td>
                <td style={{ ...S.td, color: '#ffd84a', fontWeight: 900 }}>{bs(u.balance)}</td>
                <td style={{ ...S.td, color: u.held_balance ? '#ffa04a' : '#888' }}>
                  {bs(u.balance - u.held_balance)}
                  {u.held_balance > 0 && <span style={{ fontSize: 11 }}> ({bs(u.held_balance)} ret.)</span>}
                </td>
                <td style={{ ...S.td, fontSize: 13 }}>
                  {u.role === 'admin' ? '👑 dueño'
                    : u.role === 'exec' ? '◆ ejecutivo'
                    : u.role === 'cashier' ? '🎟 banquero' : 'jugador'}
                  {u.role === 'cashier' && (
                    <div style={{ fontSize: 11, color: '#888' }}>
                      cupo {bs(u.credit_balance)} · {u.commission_pct}%
                    </div>
                  )}
                </td>
                <td style={S.td}><Estado v={u.status} /></td>
                <td style={{ ...S.td, color: '#999', fontSize: 12 }}>{u.cashier_username || '—'}</td>
                <td style={S.td}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Boton chico tono="gris" onClick={() => setDetalle(u.id)}>VER</Boton>
                    <Boton chico onClick={() => setAccion({ tipo: 'rol', user: u })}>ROL</Boton>
                    <Boton chico tono={u.status === 'blocked' ? 'verde' : 'rojo'}
                           onClick={() => setAccion({ tipo: 'estado', user: u })}>
                      {u.status === 'blocked' ? 'ACTIVAR' : 'BLOQUEAR'}
                    </Boton>
                    <Boton chico tono="gris" onClick={() => setAccion({ tipo: 'clave', user: u })}>CLAVE</Boton>
                  </div>
                </td>
              </tr>
            ))}
          </Tabla>
        </div>

        {detalle && <DetalleJugador id={detalle} onCerrar={() => setDetalle(null)} />}
        {accion && (
          <AccionUsuario
            accion={accion}
            onCerrar={() => setAccion(null)}
            onHecho={(texto) => { setAccion(null); setMsg({ kind: 'ok', text: texto }); refrescar(); }}
            onError={(texto) => setMsg({ kind: 'err', text: texto })}
          />
        )}
      </div>
    );
  }

  // Carga manual y ajuste de saldo, en una sola tarjeta.
  function FormCargaSaldo({ setMsg, onHecho }) {
    const [modo, setModo] = useState('cargar'); // cargar | ajustar
    const [username, setUsername] = useState('');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [enviando, setEnviando] = useState(false);

    const enviar = async (e) => {
      e.preventDefault();
      const amt = Number(amount);
      if (!username.trim()) { setMsg({ kind: 'err', text: 'Escribí el usuario' }); return; }
      if (!Number.isInteger(amt) || amt === 0) { setMsg({ kind: 'err', text: 'Monto inválido' }); return; }
      if (modo === 'cargar' && amt < 0) { setMsg({ kind: 'err', text: 'Para restar saldo usá "Ajustar"' }); return; }
      setEnviando(true);
      try {
        const res = modo === 'cargar'
          ? await window.Api.adminDeposit(username.trim().toLowerCase(), amt, note.trim() || undefined)
          : await window.Api.adminAdjust(username.trim().toLowerCase(), amt, note.trim());
        setMsg({
          kind: 'ok',
          text: `${modo === 'cargar' ? 'Cargaste' : 'Ajustaste'} ${plata(amt)} a ${res.user.username}. Saldo nuevo: ${plata(res.user.balance)}.`,
        });
        setAmount(''); setNote('');
        onHecho();
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
      finally { setEnviando(false); }
    };

    return (
      <div style={S.card}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ ...S.titulo, marginBottom: 0 }}>
            {modo === 'cargar' ? 'CARGAR SALDO A MANO' : 'AJUSTAR SALDO (CORREGIR ERROR)'}
          </div>
          <Boton chico tono="gris" onClick={() => setModo(modo === 'cargar' ? 'ajustar' : 'cargar')}>
            {modo === 'cargar' ? 'CAMBIAR A AJUSTE' : 'CAMBIAR A CARGA'}
          </Boton>
        </div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
          {modo === 'cargar'
            ? 'Suma saldo y cuenta como recarga en los reportes. Es plata que entró.'
            : 'Suma o resta (poné un número negativo para restar). NO cuenta como recarga: se usa para corregir errores y siempre pide motivo.'}
        </div>
        <form onSubmit={enviar} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, alignItems: 'end' }}>
          <Campo label="USUARIO">
            <input style={S.input} placeholder="nombre de usuario" value={username}
                   onChange={(e) => setUsername(e.target.value)} />
          </Campo>
          <Campo label={modo === 'cargar' ? `MONTO (${U.simbolo()})` : 'MONTO (+ suma / − resta)'}>
            <input style={S.input} type="number" placeholder={modo === 'cargar' ? '500' : '-100'}
                   value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Campo>
          <Campo label={modo === 'cargar' ? 'NOTA (opcional)' : 'MOTIVO (obligatorio)'}>
            <input style={S.input} placeholder={modo === 'cargar' ? 'motivo' : 'por qué se corrige'}
                   value={note} onChange={(e) => setNote(e.target.value)} />
          </Campo>
          <Boton type="submit" tono={modo === 'cargar' ? 'verde' : 'oro'} disabled={enviando}>
            {enviando ? '...' : modo === 'cargar' ? '+ CARGAR SALDO' : 'APLICAR AJUSTE'}
          </Boton>
        </form>
      </div>
    );
  }

  // Cambios de rol, bloqueo y contraseña, en una ventana chica.
  function AccionUsuario({ accion, onCerrar, onHecho, onError }) {
    const { tipo, user } = accion;
    const [rol, setRol] = useState(user.role);
    const [comision, setComision] = useState(user.commission_pct || 0);
    const [clave, setClave] = useState('');
    const [enviando, setEnviando] = useState(false);

    const ejecutar = async () => {
      setEnviando(true);
      try {
        if (tipo === 'rol') {
          await window.Api.adminSetRole(user.id, rol, Number(comision));
          const NOMBRE = { admin: 'dueño', exec: 'ejecutivo', cashier: 'banquero', player: 'jugador' };
          onHecho(`${user.username} ahora es ${NOMBRE[rol] || rol}.`);
        } else if (tipo === 'estado') {
          const nuevo = user.status === 'blocked' ? 'active' : 'blocked';
          await window.Api.adminSetStatus(user.id, nuevo);
          onHecho(`${user.username} quedó ${nuevo === 'blocked' ? 'bloqueado' : 'activo'}.`);
        } else {
          if (clave.length < 6) { onError('La contraseña debe tener al menos 6 caracteres'); setEnviando(false); return; }
          await window.Api.adminResetPassword(user.id, clave);
          onHecho(`Contraseña de ${user.username} cambiada. Pasásela por un medio seguro.`);
        }
      } catch (err) { onError(err.message); setEnviando(false); }
    };

    const cuerpo = tipo === 'rol' ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Campo label="ROL">
          <select style={S.input} value={rol} onChange={(e) => setRol(e.target.value)}>
            <option value="player">Jugador</option>
            <option value="cashier">Banquero</option>
            <option value="exec">Ejecutivo (maneja banqueros)</option>
            <option value="admin">Dueño (acceso total)</option>
          </select>
        </Campo>
        {(rol === 'cashier' || rol === 'exec') && (
          <Campo label="PAGA EL (%) DE LAS FICHAS">
            <input style={S.input} type="number" min="1" max="100" value={comision}
                   onChange={(e) => setComision(e.target.value)} />
            <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
              Con {comision || 0}% te paga {plata(Math.round(10000 * ((Number(comision) || 0) / 100)))}
              por cada 10.000 de fichas. Lo típico es 20.
            </div>
          </Campo>
        )}
      </div>
    ) : tipo === 'clave' ? (
      <Campo label="CONTRASEÑA NUEVA">
        <input style={S.input} type="text" placeholder="mínimo 6 caracteres" value={clave}
               onChange={(e) => setClave(e.target.value)} />
      </Campo>
    ) : (
      <div style={{ color: '#ddd', fontSize: 15 }}>
        {user.status === 'blocked'
          ? `${user.username} va a poder entrar y jugar de nuevo.`
          : `${user.username} no va a poder entrar ni jugar. Su saldo queda intacto.`}
      </div>
    );

    return (
      <div onClick={onCerrar} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}>
        <div onClick={(e) => e.stopPropagation()} style={{ ...S.card, maxWidth: 420, width: '100%' }}>
          <div style={S.titulo}>
            {tipo === 'rol' ? 'CAMBIAR ROL' : tipo === 'clave' ? 'NUEVA CONTRASEÑA' : 'CAMBIAR ESTADO'} — {user.username}
          </div>
          {cuerpo}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
            <Boton tono="gris" onClick={onCerrar}>CANCELAR</Boton>
            <Boton tono="verde" onClick={ejecutar} disabled={enviando}>
              {enviando ? '...' : 'GUARDAR'}
            </Boton>
          </div>
        </div>
      </div>
    );
  }

  // Historial completo de un jugador.
  function DetalleJugador({ id, onCerrar }) {
    const [d, setD] = useState(null);
    const [err, setErr] = useState(null);

    useEffect(() => {
      window.Api.reportPlayer(id).then(setD).catch((e) => setErr(e.message));
    }, [id]);

    return (
      <div onClick={onCerrar} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 999,
        overflowY: 'auto', padding: 16,
      }}>
        <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ ...S.card, marginBottom: 14 }}>
            {err && <div style={{ color: '#ff9a9a' }}>{err}</div>}
            {!d && !err && <div style={{ color: '#888' }}>Cargando…</div>}
            {d && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: U.GOLD }}>
                      {[d.user.first_name, d.user.last_name].filter(Boolean).join(' ') || d.user.username}
                    </div>
                    <div style={{ fontSize: 12, color: '#aaa' }}>
                      usuario: <b>{d.user.username}</b>
                      {d.user.cedula ? ` · CI ${d.user.cedula}` : ''}
                      {d.user.phone ? ` · ${d.user.phone}` : ''}
                    </div>
                    <div style={{ fontSize: 12, color: '#888' }}>
                      {d.user.bank || 'sin banco'}
                      {d.user.email ? ` · ${d.user.email}` : ''}
                      {d.user.cashier_username ? ` · banquero: ${d.user.cashier_username}` : ''}
                      {' · desde '}{fecha(d.user.created_at, false)}
                    </div>
                  </div>
                  <Boton tono="gris" onClick={onCerrar}>CERRAR</Boton>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginBottom: 16 }}>
                  <Dato chico titulo="Saldo" valor={bs(d.user.balance)} color="#ffd84a" />
                  <Dato chico titulo="Congelado" valor={bs(d.user.held_balance)} color="#ffa04a" />
                  <Dato chico titulo="Recargó" valor={bs(d.resumen.recargas)} color="#7ee08a" />
                  <Dato chico titulo="Retiró" valor={bs(d.resumen.retiros)} color="#ff9a9a" />
                  <Dato chico titulo="Apostó" valor={bs(d.resumen.apostado)} />
                  <Dato chico titulo="Ganó en premios" valor={bs(d.resumen.premios)} />
                  <Dato chico titulo="Le ganaste" valor={bs(d.resumen.juego)}
                        color={d.resumen.juego >= 0 ? '#7ee08a' : '#ff9a9a'}
                        detalle={d.resumen.juego >= 0 ? 'a favor de la casa' : 'te viene ganando'} />
                  <Dato chico titulo="Giros" valor={bs(d.resumen.giros)} />
                </div>

                {d.withdrawals.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={S.titulo}>RETIROS</div>
                    <Tabla columnas={['FECHA', 'MONTO', 'MÉTODO', 'DESTINO', 'ESTADO']}>
                      {d.withdrawals.map((w) => (
                        <tr key={w.id}>
                          <td style={{ ...S.td, fontSize: 12, color: '#888' }}>{fecha(w.created_at)}</td>
                          <td style={{ ...S.td, fontWeight: 700 }}>{bs(w.amount)}</td>
                          <td style={S.td}>{nombreMetodo(w.method)}</td>
                          <td style={{ ...S.td, fontSize: 12 }}>{w.destination}</td>
                          <td style={S.td}><Estado v={w.status} /></td>
                        </tr>
                      ))}
                    </Tabla>
                  </div>
                )}

                {d.topups.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={S.titulo}>RECARGAS PEDIDAS POR LA WEB</div>
                    <Tabla columnas={['FECHA', 'MONTO', 'MÉTODO', 'REFERENCIA', 'ESTADO']}>
                      {d.topups.map((t) => (
                        <tr key={t.id}>
                          <td style={{ ...S.td, fontSize: 12, color: '#888' }}>{fecha(t.created_at)}</td>
                          <td style={{ ...S.td, fontWeight: 700 }}>
                            {bs(t.amount)}
                            {t.currency === 'USD' && <span style={{ fontSize: 11, color: '#888' }}> (${t.amount_fx})</span>}
                          </td>
                          <td style={S.td}>{nombreMetodo(t.method)}</td>
                          <td style={{ ...S.td, fontSize: 12 }}>{t.reference}</td>
                          <td style={S.td}><Estado v={t.status} /></td>
                        </tr>
                      ))}
                    </Tabla>
                  </div>
                )}

                <div style={S.titulo}>MOVIMIENTOS</div>
                <TablaMovimientos movs={d.transactions.map((t) => ({ ...t, username: d.user.username }))} />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═════════════════════════════ Banqueros ══════════════════════════════

  // Alta de un banquero nuevo. No se registra solo: lo da de alta la casa.
  function FormNuevoBanquero({ setMsg, onHecho }) {
    const vacio = {
      first_name: '', last_name: '', doc_type: 'V', cedula: '', phone: '',
      email: '', bank: '', username: '', password: '', commission_pct: '20',
      risk_share_pct: '0', referral_code: '',
    };
    const [f, setF] = useState(vacio);
    const [abierto, setAbierto] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));

    const crear = async (e) => {
      e.preventDefault();
      setEnviando(true);
      try {
        const res = await window.Api.adminCreateCashier({
          ...f,
          commission_pct: Number(f.commission_pct),
          risk_share_pct: Number(f.risk_share_pct) || 0,
          referral_code: f.referral_code.trim() || undefined,
        });
        setMsg({
          kind: 'ok',
          text: `Banquero ${res.cashier.username} creado. Su código de referencia es ${res.cashier.referral_code}. Ya le podés vender fichas.`,
        });
        setF(vacio); setAbierto(false);
        onHecho();
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
      finally { setEnviando(false); }
    };

    if (!abierto) {
      return (
        <div style={S.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ ...S.titulo, marginBottom: 4 }}>BANQUEROS</div>
              <div style={{ fontSize: 12, color: '#888' }}>
                Los banqueros los das de alta vos, con su ficha completa. Cada uno recibe un código
                de referencia para que sus jugadores queden adjudicados a su cuenta.
              </div>
            </div>
            <Boton tono="verde" onClick={() => setAbierto(true)}>+ NUEVO BANQUERO</Boton>
          </div>
        </div>
      );
    }

    return (
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ ...S.titulo, marginBottom: 0 }}>NUEVO BANQUERO</div>
          <Boton chico tono="gris" onClick={() => setAbierto(false)}>CANCELAR</Boton>
        </div>
        <form onSubmit={crear} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Campo label="NOMBRE">
            <input style={S.input} value={f.first_name} onChange={set('first_name')} required />
          </Campo>
          <Campo label="APELLIDO">
            <input style={S.input} value={f.last_name} onChange={set('last_name')} required />
          </Campo>
          <Campo label="DOCUMENTO">
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 6 }}>
              <select style={S.input} value={f.doc_type} onChange={set('doc_type')}>
                {U.DOCS.map(([id, label]) => <option key={id} value={id}>{id}</option>)}
              </select>
              <input style={S.input} placeholder={U.ejemploDoc(f.doc_type)}
                     value={f.cedula} onChange={set('cedula')} required />
            </div>
          </Campo>
          <Campo label="TELÉFONO">
            <input style={S.input} placeholder="04141234567" value={f.phone} onChange={set('phone')} required />
          </Campo>
          <Campo label="BANCO">
            <select style={S.input} value={f.bank} onChange={set('bank')} required>
              <option value="">Elegí…</option>
              {/* El banquero que cobra en la mano elige EFECTIVO. Va primero
                  porque hoy la casa trabaja así y es lo que va a elegir casi
                  todo el mundo. */}
              {[U.EFECTIVO, ...U.BANCOS].map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </Campo>
          <Campo label="CORREO">
            <input style={S.input} type="email" value={f.email} onChange={set('email')} required />
          </Campo>
          <Campo label="USUARIO PARA ENTRAR">
            <input style={S.input} value={f.username} onChange={set('username')} required />
          </Campo>
          <Campo label="CONTRASEÑA">
            <input style={S.input} value={f.password} onChange={set('password')}
                   placeholder="mínimo 6 caracteres" required />
          </Campo>
          <Campo label="PAGA EL (%) DE LAS FICHAS">
            <input style={S.input} type="number" min="1" max="100"
                   value={f.commission_pct} onChange={set('commission_pct')} required />
          </Campo>
          <Campo label="PARTICIP. GANANCIA (%)">
            <input style={S.input} type="number" min="0" max="30"
                   value={f.risk_share_pct} onChange={set('risk_share_pct')} />
          </Campo>
          <Campo label="CÓDIGO (opcional)">
            <input style={{ ...S.input, textTransform: 'uppercase' }}
                   placeholder="se genera solo"
                   value={f.referral_code}
                   onChange={(e) => setF((p) => ({ ...p, referral_code: e.target.value.toUpperCase() }))} />
          </Campo>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <Boton type="submit" tono="verde" disabled={enviando} style={{ width: '100%' }}>
              {enviando ? 'CREANDO...' : 'CREAR BANQUERO'}
            </Boton>
          </div>
        </form>
        <div style={{ fontSize: 12, color: '#888', marginTop: 12 }}>
          Pasale el usuario y la contraseña por un medio seguro. Él las puede cambiar después desde su panel.
          <br />“Paga el %”: lo que te paga por las fichas (típico 20). “Particip. ganancia”: solo para
          franquicias con responsabilidad compartida — el % de la ganancia del banquero que le toca a la
          casa a cambio de cubrirle las pérdidas (0 = riesgo completo del banquero; máximo 30).
        </div>
      </div>
    );
  }

  // Los ejecutivos y su cuenta con la casa: cuántas fichas tienen en la mano,
  // cuánto deben y hasta dónde se les puede estirar.
  //
  // Acá el dueño hace las dos operaciones que sólo él puede hacer: ENTREGAR
  // fichas en consignación, y registrar lo que el ejecutivo le RINDE. La
  // rendición la anota el que recibe la plata — si la anotara el ejecutivo,
  // podría bajarse la deuda solo.
  function TabEjecutivos({ setMsg, recargarResumen }) {
    const [lista, setLista] = useState([]);
    const [accion, setAccion] = useState(null); // { tipo:'fichas'|'rendicion'|'techo', e }
    const [monto, setMonto] = useState('');
    const [nota, setNota] = useState('');
    const [enviando, setEnviando] = useState(false);

    const cargar = useCallback(async () => {
      try { setLista((await window.Api.adminExecs()).ejecutivos || []); }
      catch (err) { setMsg({ kind: 'err', text: err.message }); }
    }, [setMsg]);
    useEffect(() => { cargar(); }, [cargar]);

    const ejecutar = async () => {
      const n = Number(monto);
      if (!Number.isFinite(n) || (accion.tipo !== 'techo' && n <= 0)) {
        setMsg({ kind: 'err', text: 'Poné un monto válido' }); return;
      }
      setEnviando(true);
      try {
        if (accion.tipo === 'fichas') {
          const r = await window.Api.adminAsignarFichas(accion.e.id, n, nota);
          setMsg({ kind: 'ok', text: `${accion.e.username} recibió ${plata(n)} en consignación. Ahora tiene ${plata(r.fichas)} y te debe ${plata(r.deuda)}.` });
        } else if (accion.tipo === 'rendicion') {
          const r = await window.Api.adminRendicion(accion.e.id, n, nota);
          setMsg({ kind: 'ok', text: `Rendición de ${plata(n)} anotada. ${accion.e.username} te debe ${plata(r.deuda)}.` });
        } else {
          await window.Api.adminSetExecLimite(accion.e.id, n);
          setMsg({ kind: 'ok', text: n > 0 ? `Techo de ${accion.e.username}: ${plata(n)}.` : `${accion.e.username} queda sin techo.` });
        }
        setAccion(null); setMonto(''); setNota('');
        cargar(); recargarResumen();
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
      finally { setEnviando(false); }
    };

    const TITULO = {
      fichas: 'Entregar fichas en consignación',
      rendicion: 'Anotar lo que te rindió',
      techo: 'Techo de exposición (0 = sin techo)',
    };

    return (
      <>
        <div style={S.card}>
          <div style={{ ...S.titulo, marginBottom: 4 }}>EJECUTIVOS ({lista.length})</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12, lineHeight: 1.6 }}>
            El ejecutivo recibe fichas sin pagarlas y te rinde después. Su deuda nace cuando le
            vende cupo a un banquero, que es cuando cobra. Para crear uno, cambiale el rol a
            Ejecutivo desde JUGADORES.
          </div>
          <Tabla
            columnas={['EJECUTIVO', 'BANQUEROS', 'FICHAS SIN REPARTIR', 'RINDE %', 'TE DEBE', 'TECHO', 'ACCIONES']}
            vacio="Todavía no tenés ejecutivos."
          >
            {lista.map((e) => (
              <tr key={e.id}>
                <td style={{ ...S.td, fontWeight: 700 }}>
                  {[e.first_name, e.last_name].filter(Boolean).join(' ') || e.username}
                  <div style={{ fontSize: 11, color: '#999', fontWeight: 400 }}>{e.username}</div>
                </td>
                <td style={S.td}>{e.banqueros || 0}</td>
                <td style={{ ...S.td, color: '#ffd84a', fontWeight: 900 }}>{bs(e.credit_balance)}</td>
                <td style={S.td}>{e.commission_pct || 0}%</td>
                <td style={{ ...S.td, color: e.deuda > 0 ? '#ffa04a' : '#7ee08a', fontWeight: 700 }}>
                  {bs(e.deuda || 0)}
                </td>
                <td style={S.td}>{e.exec_limite > 0 ? bs(e.exec_limite) : '—'}</td>
                <td style={S.td}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <Boton chico tono="verde" onClick={() => { setAccion({ tipo: 'fichas', e }); setMonto(''); }}>FICHAS</Boton>
                    <Boton chico onClick={() => { setAccion({ tipo: 'rendicion', e }); setMonto(''); }}>RINDIÓ</Boton>
                    <Boton chico tono="gris" onClick={() => { setAccion({ tipo: 'techo', e }); setMonto(String(e.exec_limite || 0)); }}>TECHO</Boton>
                  </div>
                </td>
              </tr>
            ))}
          </Tabla>
        </div>

        {accion && (
          <div style={S.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ ...S.titulo, marginBottom: 0 }}>
                {TITULO[accion.tipo]} — {accion.e.username}
              </div>
              <Boton chico tono="gris" onClick={() => setAccion(null)}>CANCELAR</Boton>
            </div>
            <div style={{ display: 'grid', gap: 12, alignItems: 'end', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
              <Campo label="MONTO">
                <input style={S.input} type="number" min="0" value={monto}
                       onChange={(e) => setMonto(e.target.value)} />
              </Campo>
              {accion.tipo !== 'techo' && (
                <Campo label="NOTA (opcional)">
                  <input style={S.input} value={nota} onChange={(e) => setNota(e.target.value)} />
                </Campo>
              )}
              <Boton tono="verde" disabled={enviando} onClick={ejecutar}>
                {enviando ? '...' : 'CONFIRMAR'}
              </Boton>
            </div>
            {accion.tipo === 'fichas' && (
              <div style={{ marginTop: 10, fontSize: 13, color: '#bbb', lineHeight: 1.7 }}>
                No cobrás nada ahora: se las entregás para que reparta. Te va a deber el
                {' '}{accion.e.commission_pct || 0}% de lo que le venda a sus banqueros.
              </div>
            )}
          </div>
        )}
      </>
    );
  }

  function TabBanqueros({ setMsg, recargarResumen }) {
    const [cashiers, setCashiers] = useState([]);
    const [ejecutivos, setEjecutivos] = useState([]);
    const [ledger, setLedger] = useState([]);
    const [username, setUsername] = useState('');
    const [amount, setAmount] = useState('');
    const [pagado, setPagado] = useState('');
    const [confirmar, setConfirmar] = useState(false);
    const [enviando, setEnviando] = useState(false);

    const cargar = useCallback(async () => {
      try {
        const [c, l, e] = await Promise.all([
          window.Api.adminCashiers(),
          window.Api.adminCreditLedger({ limit: 40 }),
          // Los ejecutivos, para poder colgarles banqueros. Si falla no se cae
          // la pestaña entera: sin ejecutivos, la columna queda vacía y todo
          // lo demás sigue funcionando como siempre.
          window.Api.adminExecs().catch(() => ({ ejecutivos: [] })),
        ]);
        setCashiers(c.cashiers || []);
        setLedger(l.ledger || []);
        setEjecutivos(e.ejecutivos || []);
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
    }, [setMsg]);

    // Colgar un banquero de un ejecutivo, o devolverlo a la matriz.
    const asignarEjecutivo = async (cashier, valor) => {
      try {
        await window.Api.adminSetExec(cashier.id, valor === '' ? null : Number(valor));
        const nombre = (ejecutivos.find((x) => String(x.id) === String(valor)) || {}).username;
        setMsg({ kind: 'ok', text: valor
          ? `${cashier.username} ahora responde a ${nombre}.`
          : `${cashier.username} vuelve a depender de la matriz.` });
        cargar();
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
    };

    useEffect(() => { cargar(); }, [cargar]);

    const elegido = cashiers.find((c) => c.username === username.trim().toLowerCase());
    const cupo = Number(amount) || 0;
    // El banquero paga el commission_pct% del valor de las fichas (típico: 20).
    const sugerido = elegido ? Math.round(cupo * ((elegido.commission_pct || 0) / 100)) : null;
    const cobra = pagado === '' ? sugerido : Number(pagado);

    const vender = async () => {
      setConfirmar(false);
      setEnviando(true);
      try {
        const res = await window.Api.adminSellCredit(
          username.trim().toLowerCase(), cupo, pagado === '' ? undefined : Number(pagado)
        );
        setMsg({
          kind: 'ok',
          text: `Le vendiste ${bs(cupo)} de cupo a ${res.cashier.username}. Su comisión fue ${plata(res.comision)}. Cupo total: ${plata(res.cashier.credit_balance)}.`,
        });
        setAmount(''); setPagado('');
        cargar(); recargarResumen();
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
      finally { setEnviando(false); }
    };

    const LTIPO = {
      purchase: ['Compró cupo', '#7ee08a'],
      load: ['Cargó a jugador', '#5ab8ff'],
      withdrawal_refill: ['Pagó un retiro', '#ffa04a'],
      adjust: ['Ajuste', '#c9a0ff'],
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <FormNuevoBanquero setMsg={setMsg} onHecho={() => { cargar(); recargarResumen(); }} />

        <div style={S.card}>
          <div style={S.titulo}>VENDER CUPO</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
            El banquero te paga primero y ahí le cargás el cupo. Nunca puede cargar más de lo que ya te pagó.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, alignItems: 'end' }}>
            <Campo label="BANQUERO">
              <select style={S.input} value={username} onChange={(e) => setUsername(e.target.value)}>
                <option value="">Elegí…</option>
                {cashiers.map((c) => (
                  <option key={c.id} value={c.username}>
                    {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.username} — {c.username} ({c.commission_pct}%)
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label={`CUPO QUE RECIBE (${U.simbolo()})`}>
              <input style={S.input} type="number" min="1" placeholder="10000" value={amount}
                     onChange={(e) => setAmount(e.target.value)} />
            </Campo>
            <Campo label={`LO QUE TE PAGÓ (${U.simbolo()})`}>
              <input style={S.input} type="number" min="0"
                     placeholder={sugerido != null ? String(sugerido) : 'automático'}
                     value={pagado} onChange={(e) => setPagado(e.target.value)} />
            </Campo>
            <Boton tono="verde" disabled={!elegido || cupo <= 0 || enviando}
                   onClick={() => setConfirmar(true)}>
              {enviando ? '...' : 'ENTREGAR CUPO'}
            </Boton>
          </div>
          {elegido && cupo > 0 && (
            <div style={{ marginTop: 12, fontSize: 14, color: '#ddd' }}>
              {elegido.username} recibe <b style={{ color: '#ffd84a' }}>{bs(cupo)}</b> de cupo,
              te paga <b style={{ color: '#7ee08a' }}>{plata(cobra)}</b>
              y su comisión es <b style={{ color: U.GOLD }}>{plata(cupo - cobra)}</b>.
            </div>
          )}
        </div>

        <Confirmar
          abierto={confirmar}
          titulo="Confirmar venta de cupo"
          texto={`¿Ya recibiste los ${plata(cobra)} de ${username}? Al confirmar le quedan ${plata(cupo)} de cupo para cargar a sus jugadores.`}
          onSi={vender}
          onNo={() => setConfirmar(false)}
          textoSi="SÍ, YA COBRÉ"
        />

        <div style={S.card}>
          <div style={S.titulo}>BANQUEROS ({cashiers.length})</div>
          <Tabla
            columnas={['BANQUERO', 'RESPONDE A', 'CÓDIGO', 'FICHAS SIN USAR', 'PAGA %', 'PARTICIP.', 'FICHAS COMPRADAS', 'TE PAGÓ', 'VENDIÓ', 'SU MARGEN', 'AFILIADOS', 'ESTADO']}
            vacio="Todavía no tenés banqueros. Tocá “+ NUEVO BANQUERO” arriba para dar de alta al primero."
          >
            {cashiers.map((c) => (
              <tr key={c.id}>
                <td style={{ ...S.td, fontWeight: 700 }}>
                  {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.username}
                  <div style={{ fontSize: 11, color: '#999', fontWeight: 400 }}>{c.username}</div>
                </td>
                {/* De qué ejecutivo cuelga. Vacío = de la matriz, que es
                    como estaban todos antes de que existiera esta capa. */}
                <td style={S.td}>
                  <select
                    style={{ ...S.input, padding: '4px 6px', fontSize: 12, minWidth: 120 }}
                    value={c.exec_id || ''}
                    onChange={(e) => asignarEjecutivo(c, e.target.value)}
                  >
                    <option value="">— la matriz —</option>
                    {ejecutivos.map((x) => (
                      <option key={x.id} value={x.id}>{x.username}</option>
                    ))}
                  </select>
                </td>
                <td style={{ ...S.td, fontFamily: 'monospace', color: U.GOLD, fontWeight: 700 }}>
                  {c.referral_code || '—'}
                </td>
                <td style={{ ...S.td, color: '#ffd84a', fontWeight: 900 }}>{bs(c.credit_balance)}</td>
                <td style={S.td}>{c.commission_pct}%</td>
                <td style={{ ...S.td, color: c.risk_share_pct > 0 ? '#c9a0ff' : '#666' }}>
                  {c.risk_share_pct > 0 ? `${c.risk_share_pct}%` : '—'}
                </td>
                <td style={S.td}>{bs(c.cupo_comprado)}</td>
                <td style={{ ...S.td, color: '#7ee08a' }}>{bs(c.total_pagado)}</td>
                <td style={S.td}>{bs(c.total_cargado)}</td>
                <td style={{ ...S.td, color: U.GOLD }}>{bs(c.comision_generada)}</td>
                <td style={S.td}>{bs(c.jugadores)}</td>
                <td style={S.td}><Estado v={c.status} /></td>
              </tr>
            ))}
          </Tabla>
        </div>

        <div style={S.card}>
          <div style={S.titulo}>MOVIMIENTOS DE CUPO</div>
          <Tabla columnas={['FECHA', 'BANQUERO', 'MOVIMIENTO', 'CUPO', 'PAGÓ', 'JUGADOR', 'NOTA']} vacio="Sin movimientos">
            {ledger.map((l) => {
              const [txt, color] = LTIPO[l.type] || [l.type, '#aaa'];
              return (
                <tr key={l.id}>
                  <td style={{ ...S.td, fontSize: 12, color: '#888' }}>{fecha(l.created_at)}</td>
                  <td style={{ ...S.td, fontWeight: 700 }}>{l.cashier_username}</td>
                  <td style={{ ...S.td, color }}>{txt}</td>
                  <td style={{ ...S.td, color: l.amount >= 0 ? '#7ee08a' : '#ff9a9a', fontWeight: 700 }}>
                    {l.amount >= 0 ? '+' : ''}{bs(l.amount)}
                  </td>
                  <td style={S.td}>{l.paid_amount != null ? bs(l.paid_amount) : '—'}</td>
                  <td style={{ ...S.td, color: '#aaa' }}>{l.player_username || '—'}</td>
                  <td style={{ ...S.td, fontSize: 12, color: '#999' }}>{l.note || ''}</td>
                </tr>
              );
            })}
          </Tabla>
        </div>
      </div>
    );
  }

  // ═════════════════════════════ Recargas ═════════════════════════════════

  function TabRecargas({ setMsg, recargarResumen }) {
    const [estado, setEstado] = useState('pending');
    const [items, setItems] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [accion, setAccion] = useState(null); // { tipo:'aprobar'|'rechazar', item }
    const [monto, setMonto] = useState('');
    const [nota, setNota] = useState('');
    const [enviando, setEnviando] = useState(false);

    const cargar = useCallback(async () => {
      setCargando(true);
      try { setItems((await window.Api.adminTopups(estado)).topups || []); }
      catch (err) { setMsg({ kind: 'err', text: err.message }); }
      finally { setCargando(false); }
    }, [estado, setMsg]);

    useEffect(() => { cargar(); }, [cargar]);

    const abrir = (tipo, item) => {
      setAccion({ tipo, item });
      setMonto(String(item.amount));
      setNota('');
    };

    const ejecutar = async () => {
      const { tipo, item } = accion;
      setEnviando(true);
      try {
        if (tipo === 'aprobar') {
          const res = await window.Api.adminApproveTopup(item.id, Number(monto), nota.trim() || undefined);
          setMsg({ kind: 'ok', text: `Recarga aprobada. ${item.username} quedó con ${plata(res.user.balance)}.` });
        } else {
          if (!nota.trim()) { setMsg({ kind: 'err', text: 'Poné el motivo del rechazo' }); setEnviando(false); return; }
          await window.Api.adminRejectTopup(item.id, nota.trim());
          setMsg({ kind: 'ok', text: `Recarga rechazada. ${item.username} va a ver el motivo.` });
        }
        setAccion(null);
        cargar(); recargarResumen();
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
      finally { setEnviando(false); }
    };

    return (
      <div style={S.card}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ ...S.titulo, marginBottom: 0, flex: 1 }}>RECARGAS ({items.length})</div>
          <select style={{ ...S.input, width: 180 }} value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="pending">Esperando revisión</option>
            <option value="approved">Aprobadas</option>
            <option value="rejected">Rechazadas</option>
            <option value="all">Todas</option>
          </select>
          <Boton chico tono="gris" onClick={cargar}>ACTUALIZAR</Boton>
        </div>

        <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
          Verificá la referencia en tu banco antes de aprobar. Si el monto que llegó es distinto, corregilo al aprobar.
        </div>

        <Tabla
          columnas={['FECHA', 'JUGADOR', 'MONTO', 'MÉTODO', 'REFERENCIA', 'ESTADO', '']}
          vacio={cargando ? 'Cargando…' : 'No hay recargas acá'}
        >
          {items.map((t) => (
            <tr key={t.id}>
              <td style={{ ...S.td, fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>{fecha(t.created_at)}</td>
              <td style={S.td}>
                <div style={{ fontWeight: 700 }}>{t.username}</div>
                <div style={{ fontSize: 11, color: '#888' }}>{t.phone || ''}</div>
              </td>
              <td style={{ ...S.td, color: '#ffd84a', fontWeight: 900, whiteSpace: 'nowrap' }}>
                {bs(t.amount)}
                {t.currency === 'USD' && (
                  <div style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>
                    ${t.amount_fx} × {t.rate}
                  </div>
                )}
              </td>
              <td style={S.td}>{nombreMetodo(t.method)}</td>
              <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 13 }}>{t.reference}</td>
              <td style={S.td}>
                <Estado v={t.status} />
                {t.status !== 'pending' && t.note && (
                  <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>{t.note}</div>
                )}
              </td>
              <td style={S.td}>
                {t.status === 'pending' && (t.banquero_username ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: '#c9a0ff' }}>La maneja {t.banquero_username}</span>
                    <Boton chico tono="rojo" onClick={() => abrir('rechazar', t)}>RECHAZAR</Boton>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Boton chico tono="verde" onClick={() => abrir('aprobar', t)}>APROBAR</Boton>
                    <Boton chico tono="rojo" onClick={() => abrir('rechazar', t)}>RECHAZAR</Boton>
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </Tabla>

        {accion && (
          <div onClick={() => setAccion(null)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}>
            <div onClick={(e) => e.stopPropagation()} style={{ ...S.card, maxWidth: 440, width: '100%' }}>
              <div style={S.titulo}>
                {accion.tipo === 'aprobar' ? 'APROBAR RECARGA' : 'RECHAZAR RECARGA'} — {accion.item.username}
              </div>
              <div style={{ fontSize: 13, color: '#bbb', marginBottom: 14, lineHeight: 1.6 }}>
                Referencia <b style={{ fontFamily: 'monospace' }}>{accion.item.reference}</b> por {nombreMetodo(accion.item.method)}.
                {accion.item.currency === 'USD' && ` Reportó $${accion.item.amount_fx} a tasa ${accion.item.rate}.`}
              </div>
              {accion.tipo === 'aprobar' ? (
                <Campo label={`MONTO A ACREDITAR (${U.simbolo()})`}>
                  <input style={S.input} type="number" value={monto} onChange={(e) => setMonto(e.target.value)} />
                  <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                    Si en el banco llegó otra cifra, corregila acá.
                  </div>
                </Campo>
              ) : (
                <Campo label="MOTIVO (lo ve el jugador)">
                  <input style={S.input} placeholder="ej: no aparece esa referencia en el banco"
                         value={nota} onChange={(e) => setNota(e.target.value)} />
                </Campo>
              )}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
                <Boton tono="gris" onClick={() => setAccion(null)}>CANCELAR</Boton>
                <Boton tono={accion.tipo === 'aprobar' ? 'verde' : 'rojo'} onClick={ejecutar} disabled={enviando}>
                  {enviando ? '...' : accion.tipo === 'aprobar' ? 'ACREDITAR' : 'RECHAZAR'}
                </Boton>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═════════════════════════════ Retiros ══════════════════════════════════

  function TabRetiros({ setMsg, recargarResumen }) {
    const [estado, setEstado] = useState('pending');
    const [items, setItems] = useState([]);
    const [cashiers, setCashiers] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [accion, setAccion] = useState(null); // { tipo:'pagar'|'rechazar', item }
    const [quienPaga, setQuienPaga] = useState('owner');
    const [banquero, setBanquero] = useState('');
    const [nota, setNota] = useState('');
    const [enviando, setEnviando] = useState(false);

    const cargar = useCallback(async () => {
      setCargando(true);
      try {
        const [w, c] = await Promise.all([
          window.Api.adminWithdrawals(estado),
          window.Api.adminCashiers(),
        ]);
        setItems(w.withdrawals || []);
        setCashiers(c.cashiers || []);
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
      finally { setCargando(false); }
    }, [estado, setMsg]);

    useEffect(() => { cargar(); }, [cargar]);

    const abrir = (tipo, item) => {
      setAccion({ tipo, item });
      setQuienPaga('owner');
      setBanquero(item.cashier_username || '');
      setNota('');
    };

    const ejecutar = async () => {
      const { tipo, item } = accion;
      setEnviando(true);
      try {
        if (tipo === 'pagar') {
          if (quienPaga === 'cashier' && !banquero) {
            setMsg({ kind: 'err', text: 'Elegí qué banquero lo pagó' }); setEnviando(false); return;
          }
          await window.Api.adminPayWithdrawal(item.id, quienPaga, banquero || undefined, nota.trim() || undefined);
          setMsg({
            kind: 'ok',
            text: quienPaga === 'cashier'
              ? `Retiro pagado. Le repusimos ${plata(item.amount)} de cupo a ${banquero}.`
              : `Retiro de ${plata(item.amount)} marcado como pagado.`,
          });
        } else {
          if (!nota.trim()) { setMsg({ kind: 'err', text: 'Poné el motivo del rechazo' }); setEnviando(false); return; }
          await window.Api.adminRejectWithdrawal(item.id, nota.trim());
          setMsg({ kind: 'ok', text: `Retiro rechazado. Le devolvimos ${plata(item.amount)} a ${item.username}.` });
        }
        setAccion(null);
        cargar(); recargarResumen();
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
      finally { setEnviando(false); }
    };

    const total = items.filter((i) => i.status === 'pending').reduce((s, i) => s + i.amount, 0);

    return (
      <div style={S.card}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ ...S.titulo, marginBottom: 0, flex: 1 }}>
            RETIROS ({items.length}){total > 0 && ` — ${plata(total)} por pagar`}
          </div>
          <select style={{ ...S.input, width: 180 }} value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="pending">Esperando aprobación</option>
            <option value="paid">Pagados</option>
            <option value="rejected">Rechazados</option>
            <option value="all">Todos</option>
          </select>
          <Boton chico tono="gris" onClick={cargar}>ACTUALIZAR</Boton>
        </div>

        <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
          Mientras el retiro está esperando, ese saldo le queda congelado al jugador: no lo puede jugar.
          Si rechazás, se le devuelve solo.
        </div>

        <Tabla
          columnas={['FECHA', 'JUGADOR', 'MONTO', 'PAGARLE A', 'JUGÓ / RECARGÓ', 'ESTADO', '']}
          vacio={cargando ? 'Cargando…' : 'No hay retiros acá'}
        >
          {items.map((w) => (
            <tr key={w.id}>
              <td style={{ ...S.td, fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>{fecha(w.created_at)}</td>
              <td style={S.td}>
                <div style={{ fontWeight: 700 }}>
                  {[w.first_name, w.last_name].filter(Boolean).join(' ') || w.username}
                </div>
                <div style={{ fontSize: 11, color: '#888' }}>
                  {w.username}
                  {w.cedula ? ` · CI ${w.cedula}` : ''}
                  {w.cashier_username ? ` · ${w.cashier_username}` : ''}
                </div>
              </td>
              <td style={{ ...S.td, color: '#ffd84a', fontWeight: 900 }}>{bs(w.amount)}</td>
              <td style={S.td}>
                <div style={{ fontSize: 13 }}>{nombreMetodo(w.method)}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#7ee08a' }}>{w.destination}</div>
              </td>
              <td style={{ ...S.td, fontSize: 12, color: '#aaa', whiteSpace: 'nowrap' }}>
                {bs(w.wagered_total)} / {bs(w.deposited_total)}
              </td>
              <td style={S.td}>
                <Estado v={w.status} />
                {w.status === 'paid' && (
                  <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>
                    {w.paid_by === 'cashier' ? `pagó ${w.payer_username}` : 'pagaste vos'}
                  </div>
                )}
                {w.status === 'rejected' && w.note && (
                  <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>{w.note}</div>
                )}
              </td>
              <td style={S.td}>
                {w.status === 'pending' && (w.banquero_username ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 11, color: '#c9a0ff' }}>Lo paga {w.banquero_username}</span>
                    <Boton chico tono="rojo" onClick={() => abrir('rechazar', w)}>RECHAZAR</Boton>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Boton chico tono="verde" onClick={() => abrir('pagar', w)}>PAGAR</Boton>
                    <Boton chico tono="rojo" onClick={() => abrir('rechazar', w)}>RECHAZAR</Boton>
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </Tabla>

        {accion && (
          <div onClick={() => setAccion(null)} style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}>
            <div onClick={(e) => e.stopPropagation()} style={{ ...S.card, maxWidth: 460, width: '100%' }}>
              <div style={S.titulo}>
                {accion.tipo === 'pagar' ? 'CONFIRMAR PAGO' : 'RECHAZAR RETIRO'} — {accion.item.username}
              </div>
              <div style={{
                fontSize: 15, color: '#ddd', marginBottom: 16, lineHeight: 1.6,
                background: 'rgba(0,0,0,0.35)', padding: 12, borderRadius: 6,
              }}>
                <div><b style={{ color: '#ffd84a', fontSize: 20 }}>{plata(accion.item.amount)}</b></div>
                <div>{nombreMetodo(accion.item.method)} a <b style={{ fontFamily: 'monospace' }}>{accion.item.destination}</b></div>
                {(accion.item.first_name || accion.item.last_name) && (
                  <div style={{ fontSize: 14, color: '#ddd' }}>
                    A nombre de <b>{[accion.item.first_name, accion.item.last_name].filter(Boolean).join(' ')}</b>
                  </div>
                )}
                {accion.item.cedula && <div style={{ fontSize: 13, color: '#aaa' }}>Cédula: {accion.item.cedula}</div>}
              </div>

              {accion.tipo === 'pagar' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <Campo label="¿QUIÉN PONE LA PLATA?">
                    <select style={S.input} value={quienPaga} onChange={(e) => setQuienPaga(e.target.value)}>
                      <option value="owner">Vos, desde la cuenta principal</option>
                      <option value="cashier">Un banquero (se le repone en cupo)</option>
                    </select>
                  </Campo>
                  {quienPaga === 'cashier' && (
                    <Campo label="BANQUERO QUE PAGA">
                      <select style={S.input} value={banquero} onChange={(e) => setBanquero(e.target.value)}>
                        <option value="">Elegí…</option>
                        {cashiers.map((c) => (
                          <option key={c.id} value={c.username}>
                            {c.username} — cupo {bs(c.credit_balance)}
                          </option>
                        ))}
                      </select>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                        Le vamos a sumar {plata(accion.item.amount)} de cupo por la plata que puso.
                      </div>
                    </Campo>
                  )}
                  <Campo label="NOTA (opcional)">
                    <input style={S.input} placeholder="ej: referencia del pago móvil"
                           value={nota} onChange={(e) => setNota(e.target.value)} />
                  </Campo>
                  <div style={{ fontSize: 12, color: '#ffc9c9' }}>
                    Confirmá solo después de haber hecho la transferencia de verdad.
                  </div>
                </div>
              ) : (
                <Campo label="MOTIVO (lo ve el jugador)">
                  <input style={S.input} placeholder="ej: los datos de cobro no coinciden"
                         value={nota} onChange={(e) => setNota(e.target.value)} />
                </Campo>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 18 }}>
                <Boton tono="gris" onClick={() => setAccion(null)}>CANCELAR</Boton>
                <Boton tono={accion.tipo === 'pagar' ? 'verde' : 'rojo'} onClick={ejecutar} disabled={enviando}>
                  {enviando ? '...' : accion.tipo === 'pagar' ? 'YA LE PAGUÉ' : 'RECHAZAR'}
                </Boton>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═════════════════════════════ Reportes ═════════════════════════════════

  function TabReportes({ setMsg }) {
    const [daily, setDaily] = useState(null);
    const [cash, setCash] = useState(null);
    const [alerts, setAlerts] = useState(null);
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');
    const [mesa, setMesa] = useState('todos');

    const cargar = useCallback(async () => {
      try {
        const params = { from: desde || undefined, to: hasta || undefined };
        const [d, c, a] = await Promise.all([
          window.Api.reportDaily({ ...params, game: mesa === 'todos' ? undefined : mesa }),
          window.Api.reportCashiers(params),
          window.Api.reportAlerts(),
        ]);
        setDaily(d); setCash(c); setAlerts(a);
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
    }, [desde, hasta, mesa, setMsg]);

    useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const t = daily ? daily.total : null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={S.card}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
            <Campo label="DESDE"><input style={S.input} type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Campo>
            <Campo label="HASTA"><input style={S.input} type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Campo>
            <Campo label="MESA">
              <select style={S.input} value={mesa} onChange={(e) => setMesa(e.target.value)}>
                <option value="todos">Todas las mesas</option>
                {(daily && daily.mesas ? daily.mesas : []).map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </Campo>
            <Boton onClick={cargar}>VER PERÍODO</Boton>
            <div style={{ fontSize: 12, color: '#888', flex: '1 1 200px' }}>
              Sin fechas muestra los últimos 30 días. El día cierra a medianoche, hora de Venezuela.
              {mesa !== 'todos' && ' Filtrando por una mesa, la caja queda en cero: las recargas y retiros son del salón, no de una mesa.'}
            </div>
          </div>
        </div>

        {t && (
          <div style={S.card}>
            <div style={S.titulo}>TOTAL DEL PERÍODO ({daily.from} → {daily.to})</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <Dato titulo="Entró" valor={bs(t.recargas)} color="#7ee08a" />
              <Dato titulo="Salió" valor={bs(t.retiros)} color="#ff9a9a" />
              <Dato titulo="Caja" valor={bs(t.caja)} color={t.caja >= 0 ? '#7ee08a' : '#ff9a9a'} detalle="entró − salió" />
              <Dato titulo="Se apostó" valor={bs(t.apostado)} />
              <Dato titulo="Premios pagados" valor={bs(t.premios)} />
              <Dato titulo="Ganancia del juego" valor={bs(t.juego)} color={t.juego >= 0 ? '#ffd84a' : '#ff9a9a'} />
              <Dato titulo="Giros" valor={bs(t.giros)} chico />
            </div>
          </div>
        )}

        {daily && daily.por_juego && daily.por_juego.length > 0 && (
          <div style={S.card}>
            <div style={S.titulo}>POR MESA (EN EL PERÍODO)</div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
              Con qué mesa gana el salón. Las recargas y retiros no aparecen acá: son de la
              billetera del jugador, no de una mesa en particular.
            </div>
            <Tabla columnas={['MESA', 'APOSTADO', 'PREMIOS', 'GANANCIA', '% QUE SE QUEDÓ', 'GIROS', 'JUGADORES']}
                   vacio="Todavía nadie jugó en el período">
              {daily.por_juego.map((m) => {
                const pct = m.apostado > 0 ? (m.juego / m.apostado) * 100 : null;
                return (
                  <tr key={m.game_id}>
                    <td style={{ ...S.td, fontWeight: 700 }}>{m.label}</td>
                    <td style={S.td}>{bs(m.apostado)}</td>
                    <td style={S.td}>{bs(m.premios)}</td>
                    <td style={{ ...S.td, color: m.juego >= 0 ? '#ffd84a' : '#ff9a9a', fontWeight: 900 }}>
                      {bs(m.juego)}
                    </td>
                    <td style={{ ...S.td, color: pct == null ? '#666' : pct >= 0 ? '#7ee08a' : '#ff9a9a' }}>
                      {pct == null ? '—' : `${pct.toFixed(1)}%`}
                    </td>
                    <td style={{ ...S.td, color: '#999' }}>{bs(m.giros)}</td>
                    <td style={{ ...S.td, color: '#999' }}>{bs(m.jugadores)}</td>
                  </tr>
                );
              })}
            </Tabla>
          </div>
        )}

        <div style={S.card}>
          <div style={S.titulo}>
            CIERRE DIARIO
            {daily && daily.filtro_juego && (
              <span style={{ fontSize: 12, color: '#9fd8ff', fontWeight: 400, marginLeft: 8 }}>
                · solo {(daily.mesas.find((m) => m.id === daily.filtro_juego) || {}).label || daily.filtro_juego}
              </span>
            )}
          </div>
          <Tabla columnas={['DÍA', 'RECARGAS', 'RETIROS', 'CAJA', 'APOSTADO', 'PREMIOS', 'GANANCIA', 'GIROS', 'JUGADORES']}
                 vacio="Sin movimientos en el período">
            {(daily ? daily.dias : []).map((d) => (
              <tr key={d.dia}>
                <td style={{ ...S.td, fontWeight: 700, whiteSpace: 'nowrap' }}>{d.dia}</td>
                <td style={{ ...S.td, color: '#7ee08a' }}>{bs(d.recargas)}</td>
                <td style={{ ...S.td, color: '#ff9a9a' }}>{bs(d.retiros)}</td>
                <td style={{ ...S.td, color: d.caja >= 0 ? '#7ee08a' : '#ff9a9a', fontWeight: 700 }}>{bs(d.caja)}</td>
                <td style={S.td}>{bs(d.apostado)}</td>
                <td style={S.td}>{bs(d.premios)}</td>
                <td style={{ ...S.td, color: d.juego >= 0 ? '#ffd84a' : '#ff9a9a', fontWeight: 900 }}>{bs(d.juego)}</td>
                <td style={{ ...S.td, color: '#999' }}>{bs(d.giros)}</td>
                <td style={{ ...S.td, color: '#999' }}>{bs(d.jugadores)}</td>
              </tr>
            ))}
          </Tabla>
        </div>

        <div style={S.card}>
          <div style={S.titulo}>POR BANQUERO (EN EL PERÍODO)</div>
          <Tabla columnas={['BANQUERO', 'FICHAS COMPRADAS', 'TE PAGÓ', 'VENDIÓ', 'RETIROS QUE PAGÓ', 'RESULTADO', 'PARTICIP. CASA', 'FICHAS ACTUALES', 'AFILIADOS']}
                 vacio="Sin movimientos de banqueros">
            {(cash ? cash.banqueros : []).map((c) => (
              <tr key={c.id}>
                <td style={{ ...S.td, fontWeight: 700 }}>
                  {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.username}
                  <div style={{ fontSize: 11, color: '#999', fontWeight: 400 }}>{c.username}</div>
                </td>
                <td style={S.td}>{bs(c.cupo_comprado)}</td>
                <td style={{ ...S.td, color: '#7ee08a' }}>{bs(c.pagado)}</td>
                <td style={S.td}>{bs(c.cargado)}</td>
                <td style={S.td}>{bs(c.retiros_pagados)}</td>
                <td style={{ ...S.td, color: c.resultado >= 0 ? '#7ee08a' : '#ff9a9a', fontWeight: 900 }}>
                  {bs(c.resultado)}
                  {c.resultado < 0 && c.risk_share_pct > 0 && (
                    <div style={{ fontSize: 10, color: '#c9a0ff', fontWeight: 400 }}>cubre la casa</div>
                  )}
                </td>
                <td style={{ ...S.td, color: '#c9a0ff' }}>
                  {c.risk_share_pct > 0 ? `${bs(c.participacion)} (${c.risk_share_pct}%)` : '—'}
                </td>
                <td style={{ ...S.td, color: '#ffd84a', fontWeight: 700 }}>{bs(c.credit_balance)}</td>
                <td style={{ ...S.td, color: '#999' }}>{bs(c.jugadores)}</td>
              </tr>
            ))}
          </Tabla>
        </div>

        {alerts && <Alertas a={alerts} />}
      </div>
    );
  }

  function Alertas({ a }) {
    const hay = a.ganadores.length || a.poco_juego.length || a.retiros_demorados.length
      || (a.banqueros_cupo_bajo && a.banqueros_cupo_bajo.length);
    return (
      <div style={S.card}>
        <div style={S.titulo}>🔎 ALERTAS</div>
        {!hay && <div style={{ color: '#7ee08a' }}>Todo tranquilo: no hay nada raro para mirar.</div>}

        {a.retiros_demorados.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: '#ff9a9a', fontWeight: 700, marginBottom: 6 }}>
              Retiros esperando hace más de un día
            </div>
            <Tabla columnas={['JUGADOR', 'MONTO', 'PEDIDO EL']}>
              {a.retiros_demorados.map((w) => (
                <tr key={w.id}>
                  <td style={{ ...S.td, fontWeight: 700 }}>{w.username}</td>
                  <td style={{ ...S.td, color: '#ffd84a' }}>{bs(w.amount)}</td>
                  <td style={{ ...S.td, color: '#888' }}>{fecha(w.created_at)}</td>
                </tr>
              ))}
            </Tabla>
          </div>
        )}

        {a.ganadores.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: '#ffa04a', fontWeight: 700, marginBottom: 6 }}>
              Jugadores que te vienen ganando
            </div>
            <Tabla columnas={['JUGADOR', 'APOSTÓ', 'GANÓ', 'DIFERENCIA', 'SALDO']}>
              {a.ganadores.map((g) => (
                <tr key={g.id}>
                  <td style={{ ...S.td, fontWeight: 700 }}>{g.username}</td>
                  <td style={S.td}>{bs(g.apostado)}</td>
                  <td style={S.td}>{bs(g.premios)}</td>
                  <td style={{ ...S.td, color: '#ff9a9a', fontWeight: 900 }}>+{bs(g.neto)}</td>
                  <td style={{ ...S.td, color: '#ffd84a' }}>{bs(g.balance)}</td>
                </tr>
              ))}
            </Tabla>
          </div>
        )}

        {a.banqueros_cupo_bajo && a.banqueros_cupo_bajo.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: '#ffd84a', fontWeight: 700, marginBottom: 6 }}>
              Banqueros con las fichas por agotarse (menos de {bs(a.umbral_cupo)})
            </div>
            <Tabla columnas={['BANQUERO', 'FICHAS QUE LE QUEDAN']}>
              {a.banqueros_cupo_bajo.map((s) => (
                <tr key={s.id}>
                  <td style={{ ...S.td, fontWeight: 700 }}>
                    {[s.first_name, s.last_name].filter(Boolean).join(' ') || s.username}
                    <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}> · {s.username}</span>
                  </td>
                  <td style={{ ...S.td, color: '#ffd84a', fontWeight: 900 }}>{bs(s.credit_balance)}</td>
                </tr>
              ))}
            </Tabla>
          </div>
        )}

        {a.poco_juego.length > 0 && (
          <div>
            <div style={{ color: '#c9a0ff', fontWeight: 700, marginBottom: 6 }}>
              Recargan y retiran jugando muy poco
            </div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
              Puede ser gente usándote de casa de cambio: vos pagás las comisiones bancarias de las dos puntas.
            </div>
            <Tabla columnas={['JUGADOR', 'RECARGÓ', 'JUGÓ', 'RETIRÓ']}>
              {a.poco_juego.map((p) => (
                <tr key={p.id}>
                  <td style={{ ...S.td, fontWeight: 700 }}>{p.username}</td>
                  <td style={S.td}>{bs(p.deposited_total)}</td>
                  <td style={{ ...S.td, color: '#ff9a9a' }}>{bs(p.wagered_total)}</td>
                  <td style={S.td}>{bs(p.retirado)}</td>
                </tr>
              ))}
            </Tabla>
          </div>
        )}
      </div>
    );
  }

  // ═════════════════════════════ Configuración ════════════════════════════

  const CAMPOS_CONFIG = [
    { key: 'max_bet_casilla', label: `Apuesta máxima por casilla (${U.simbolo()})`, tipo: 'number',
      ayuda: 'Lo máximo que entra en CADA posición del paño: el rojo, una docena, una línea. Puede cubrir varias casillas sin límite de total, porque eso no agrega riesgo: las que pierden pagan parte de la que gana. Lo que no puede es cargar una sola por encima de este número.' },
    { key: 'max_bet_pleno', label: `Apuesta máxima por pleno (${U.simbolo()})`, tipo: 'number',
      ayuda: 'El pleno (un número solo) lleva su propio tope, más bajo: paga 29 a 1, y si sale Lightning hasta 500 veces. Con 100 acá, el peor golpe posible paga 50.000 — que es justo el techo de premio por giro.' },
    { key: 'max_win_per_spin', label: `Premio máximo por giro (${U.simbolo()})`, tipo: 'number',
      ayuda: 'El candado importante: los números Lightning pagan hasta 500x. Con este techo, un solo golpe de suerte no te vacía la caja.' },
    { key: 'monto_multiplo', label: `Los montos van en múltiplos de (${U.simbolo()})`, tipo: 'number',
      ayuda: 'Recargas, retiros, cargas de banca y cupo se manejan en cifras redondas de este tamaño. Con 100, nadie puede pedir 1.350: pide 1.300 o 1.400. Cuando el jugador paga en dólares, la conversión se redondea para arriba y la diferencia la pone la casa. Poné 1 para desactivarlo.' },
    { key: 'min_topup', label: `Recarga mínima (${U.simbolo()})`, tipo: 'number',
      ayuda: 'Por debajo de esto no se puede pedir una recarga.' },
    { key: 'min_withdrawal', label: `Retiro mínimo (${U.simbolo()})`, tipo: 'number',
      ayuda: 'Evita pagar comisiones bancarias por montos ridículos.' },
    { key: 'wager_pct_required', label: 'Hay que jugar el (%) de lo recargado', tipo: 'number',
      ayuda: 'Para poder retirar. Con 50%, quien recargó 1.000 tiene que haber apostado 500. Poné 0 para desactivarlo.' },
    { key: 'registration_open', label: '¿Registro abierto? (1 = sí, 0 = no)', tipo: 'number',
      ayuda: 'Con 0, nadie puede crearse cuenta solo: las cuentas las crea el banquero o vos.' },
    { key: 'bank_pago_movil', label: 'Datos de tu Pago Móvil', tipo: 'text',
      ayuda: 'Lo ve el jugador cuando elige pagar por Pago Móvil. Ej: Banco, cédula y teléfono.' },
    { key: 'bank_transferencia', label: 'Datos de tu cuenta bancaria', tipo: 'text' },
    { key: 'bank_p2p', label: 'Tus datos P2P (divisas)', tipo: 'text',
      ayuda: 'Para quien te paga en divisas por P2P (Binance u otro). El monto que se registra igual es en bolívares.' },
    { key: 'cupo_alert', label: `Avisar fichas bajas del banquero (${U.simbolo()})`, tipo: 'number',
      ayuda: 'Cuando las fichas de un banquero bajan de este número, le sale un aviso en su banca y a vos en las alertas.' },
  ];

  // ═══════════════════════ Las mesas del salón ════════════════════════════
  //  Etapa 4: el dueño arma sus mesas sin tocar código. Lo que se decide acá
  //  cambia lo que el jugador ve en el salón y cómo se dibuja la ruleta.
  //
  //  La regla del pleno la hace cumplir el servidor, pero la pantalla la
  //  respeta también: al sacarle los rayos a una mesa, el pago vuelve solo a
  //  35 a 1. Un pleno de 29 sin rayos deja a la casa con más del 20%, y eso
  //  no se ve hasta que el jugador se cansa y no vuelve.
  // ═══════════════════════════════════════════════════════════════════════

  const MESA_NUEVA = {
    id: '', label: '', tipo: 'ruleta',
    rueda: 'americana', animales: false, rayos: false, pago_pleno: 35,
    activo: false, orden: 100, icono: '🎡', color: '#ffd84a',
    detalle1: '', detalle2: '',
  };

  // Los valores con los que arranca una mesa de 21: seis mazos y el natural a
  // 3 a 2, que es la mesa estándar de cualquier casino.
  const MESA_21_NUEVA = {
    id: '', label: '', tipo: 'blackjack',
    mazos: 6, pago_natural: 1.5, apuesta_min: 10, apuesta_max: 500, puestos: 1,
    activo: false, orden: 100, icono: '🃏', color: '#4fd1a5',
    detalle1: '', detalle2: '',
  };

  function TabMesas({ setMsg }) {
    const [datos, setDatos] = useState(null);
    const [editando, setEditando] = useState(null);   // ficha en edición o alta
    const [creando, setCreando] = useState(false);
    const [guardando, setGuardando] = useState(false);

    const cargar = useCallback(() => {
      window.Api.adminGames()
        .then(setDatos)
        .catch((err) => setMsg({ kind: 'err', text: err.message }));
    }, [setMsg]);

    useEffect(() => { cargar(); }, [cargar]);

    const aplicar = async (fn, exito) => {
      setGuardando(true);
      try {
        setDatos(await fn());
        setEditando(null);
        setCreando(false);
        setMsg({ kind: 'ok', text: exito });
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
      finally { setGuardando(false); }
    };

    // Una mesa tiene tres estados y el dueño los toca desde acá:
    //   CERRADA · EN PRUEBAS (sólo él y las cuentas `prueba`) · ABIERTA.
    const AVISO = {
      0: (l) => `${l} quedó cerrada: ya no se puede entrar.`,
      1: (l) => `${l} está abierta. Los jugadores ya la ven en el salón.`,
      2: (l) => `${l} quedó EN PRUEBAS: la ven y la juegan sólo vos y las cuentas `
              + `de prueba. El jugador común no la ve en el salón.`,
    };
    const cambiarEstado = (m, estado) => aplicar(
      () => window.Api.adminEstadoMesa(m.id, estado),
      AVISO[estado](m.label)
    );

    const guardar = () => {
      const m = editando;
      if (creando) return aplicar(() => window.Api.adminCreateGame(m), `Mesa "${m.label}" creada.`);
      return aplicar(() => window.Api.adminUpdateGame(m.id, m), `${m.label} guardada.`);
    };

    if (!datos) return <div style={{ color: '#888' }}>Cargando…</div>;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={S.card}>
          <div style={S.titulo}>LAS MESAS DEL SALÓN</div>
          <div style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>
            Acá se arman las mesas de VOLTIO. Lo que guardes cambia al instante lo que el
            jugador ve en el salón y cómo se dibuja la ruleta: no hay que publicar nada.
            {!datos.en_la_base && (
              <div style={{ color: '#ff9a9a', marginTop: 8 }}>
                Las mesas todavía no están en la base: se ven las de siempre, pero no se
                pueden tocar hasta correr la migración 011.
              </div>
            )}
          </div>
          {datos.en_la_base && !editando && (
            <div style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Boton onClick={() => { setEditando({ ...MESA_NUEVA }); setCreando(true); }}>
                + RULETA NUEVA
              </Boton>
              <Boton tono="gris" onClick={() => { setEditando({ ...MESA_21_NUEVA }); setCreando(true); }}>
                + MESA DE 21
              </Boton>
            </div>
          )}
        </div>

        {editando && (
          <FormularioMesa
            mesa={editando}
            setMesa={setEditando}
            creando={creando}
            ruedas={datos.ruedas}
            guardando={guardando}
            onGuardar={guardar}
            onCancelar={() => { setEditando(null); setCreando(false); }}
          />
        )}

        {datos.mesas.map((m) => (
          <FichaMesa
            key={m.id}
            m={m}
            puedeEditar={datos.en_la_base}
            onEstado={(estado) => cambiarEstado(m, estado)}
            onEditar={() => { setEditando({ ...m }); setCreando(false); }}
            guardando={guardando}
          />
        ))}
      </div>
    );
  }

  // Una mesa en la lista: cómo está armada, qué le deja a la casa y los dos
  // botones de todos los días.
  function FichaMesa({ m, onEstado, onEditar, puedeEditar, guardando }) {
    const es21 = m.tipo === 'blackjack';
    const estado = m.activo ? 1 : (m.en_pruebas ? 2 : 0);
    const CINTA = {
      0: { texto: 'CERRADA', color: '#ccc', fondo: '#444' },
      1: { texto: 'ABIERTA', color: '#0a0a0a', fondo: 'linear-gradient(180deg, #ffe98a, #d4a017)' },
      2: { texto: 'EN PRUEBAS', color: '#0a0a0a', fondo: 'linear-gradient(180deg, #9ad7ff, #2b8fd4)' },
    }[estado];
    return (
      <div style={{
        ...S.card,
        borderColor: estado === 1 ? '#8b6a20' : (estado === 2 ? '#2b6f9e' : '#333'),
        opacity: estado === 0 ? 0.75 : 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 26 }}>{m.icono || '🎡'}</div>
          <div style={{ flex: 1, minWidth: 140 }}>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: 1, color: m.color || '#ffd84a' }}>
              {m.label}
            </div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
              {es21 ? (
                <>
                  {m.id} · BLACKJACK · {m.mazos} mazos · natural {m.pago_natural >= 1.5 ? '3 a 2' : '6 a 5'}
                  {' · '}{m.puestos} {m.puestos === 1 ? 'puesto' : 'puestos'}
                </>
              ) : (
                <>
                  {m.id} · {m.rueda_label} · {m.casillas} casillas
                  {m.animales ? ' · con animales' : ' · sin animales'}
                  {m.rayos ? ' · con rayos' : ' · sin rayos'}
                </>
              )}
            </div>
          </div>
          <div style={{
            fontSize: 10, letterSpacing: 2, fontWeight: 900, padding: '4px 9px', borderRadius: 4,
            color: CINTA.color, background: CINTA.fondo,
          }}>{CINTA.texto}</div>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 10, marginTop: 12,
        }}>
          {es21 ? (
            <>
              <Dato chico titulo="Natural" valor={m.pago_natural >= 1.5 ? '3 a 2' : '6 a 5'} />
              <Dato chico titulo="Le deja la mesa" valor={`${m.ventaja_casa}%`}
                    color="#ff9a9a"
                    detalle="la ruleta deja 5,3%" />
              <Dato chico titulo="Apuesta" valor={`${m.apuesta_min}–${m.apuesta_max}`} />
              <Dato chico titulo="Manos jugadas" valor={m.rondas.toLocaleString('es-VE')} />
            </>
          ) : (
            <>
              <Dato chico titulo="Pleno" valor={`${m.pago_pleno} a 1`} />
              <Dato chico titulo="Le deja el pleno" valor={`${m.ventaja_pleno}%`}
                    color={m.ventaja_pleno >= 0 ? '#7ee08a' : '#ff9a9a'}
                    detalle={m.ventaja_pleno < 0 ? 'la casa PIERDE' : null} />
              <Dato chico titulo="Le deja el resto" valor={`${m.ventaja_resto_mesa}%`} />
              <Dato chico titulo="Rondas jugadas" valor={m.rondas.toLocaleString('es-VE')} />
            </>
          )}
        </div>

        {puedeEditar && (
          <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
            {/* Los tres estados, cada uno un botón: se ve de una cuál está puesto
                y no hay que adivinar qué hace un botón que cambia de nombre. */}
            {estado !== 1 && (
              <Boton chico tono="verde" onClick={() => onEstado(1)} disabled={guardando}>
                ABRIR AL PÚBLICO
              </Boton>
            )}
            {estado !== 2 && (
              <Boton chico tono="gris" onClick={() => onEstado(2)} disabled={guardando}>
                PONER EN PRUEBAS
              </Boton>
            )}
            {estado !== 0 && (
              <Boton chico tono="rojo" onClick={() => onEstado(0)} disabled={guardando}>
                CERRAR MESA
              </Boton>
            )}
            <Boton chico tono="gris" onClick={onEditar} disabled={guardando}>EDITAR</Boton>
            {m.rondas > 0 && (
              <div style={{ fontSize: 10, color: '#777', alignSelf: 'center' }}>
                Ya tiene historial: el id no se cambia ni se borra.
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  function FormularioMesa({ mesa, setMesa, creando, ruedas, guardando, onGuardar, onCancelar }) {
    const set = (campo, valor) => setMesa({ ...mesa, [campo]: valor });

    // Sin rayos el pleno vuelve solo a 35: es la regla del negocio, no una
    // preferencia. Con rayos se puede elegir.
    const setRayos = (v) => setMesa({ ...mesa, rayos: v, pago_pleno: v ? mesa.pago_pleno : 35 });

    const rueda = (ruedas || []).find((r) => r.id === mesa.rueda);
    const es21 = mesa.tipo === 'blackjack';

    return (
      <div style={{ ...S.card, borderColor: 'var(--acento, #d4a94a)' }}>
        <div style={S.titulo}>
          {creando ? (es21 ? 'MESA DE 21 NUEVA' : 'RULETA NUEVA') : `EDITANDO ${mesa.label.toUpperCase()}`}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {creando && (
            <div>
              <Campo label="ID (NO SE PUEDE CAMBIAR DESPUÉS)">
                <input style={S.input} value={mesa.id}
                       placeholder="europea_vip"
                       onChange={(e) => set('id', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} />
              </Campo>
              <div style={{ fontSize: 11, color: '#888', marginTop: 4, lineHeight: 1.5 }}>
                Queda escrito en cada movimiento de la mesa. Por eso no se cambia: rompería el historial.
              </div>
            </div>
          )}

          <Campo label="NOMBRE QUE VE EL JUGADOR">
            <input style={S.input} value={mesa.label} onChange={(e) => set('label', e.target.value)} />
          </Campo>

          {!es21 && (
            <Campo label="RUEDA">
              <select style={S.input} value={mesa.rueda} onChange={(e) => set('rueda', e.target.value)}>
                {(ruedas || []).map((r) => (
                  <option key={r.id} value={r.id}>{r.label} — {r.casillas} casillas</option>
                ))}
              </select>
            </Campo>
          )}

          {!es21 && (
            <Campo label="PLENO">
              <select style={S.input} value={mesa.pago_pleno}
                      onChange={(e) => set('pago_pleno', Number(e.target.value))}
                      disabled={!mesa.rayos}>
                <option value={35}>Paga 35 a 1 (mesa clásica)</option>
                {mesa.rayos && <option value={29}>Paga 29 a 1 (lo compensan los rayos)</option>}
              </select>
            </Campo>
          )}

          {es21 && (
            <>
              <Campo label="MAZOS">
                <select style={S.input} value={mesa.mazos} onChange={(e) => set('mazos', Number(e.target.value))}>
                  {[1, 2, 4, 6, 8].map((n) => (
                    <option key={n} value={n}>{n} {n === 1 ? 'mazo' : 'mazos'}{n === 6 ? ' (lo habitual)' : ''}</option>
                  ))}
                </select>
              </Campo>

              <Campo label="EL BLACKJACK NATURAL PAGA">
                <select style={S.input} value={mesa.pago_natural}
                        onChange={(e) => set('pago_natural', Number(e.target.value))}>
                  <option value={1.5}>3 a 2 — lo normal</option>
                  <option value={1.2}>6 a 5 — le deja casi 4 veces más a la casa</option>
                </select>
              </Campo>

              <Campo label="APUESTA MÍNIMA">
                <input style={S.input} type="number" value={mesa.apuesta_min}
                       onChange={(e) => set('apuesta_min', Number(e.target.value))} />
              </Campo>

              <Campo label="APUESTA MÁXIMA">
                <input style={S.input} type="number" value={mesa.apuesta_max}
                       onChange={(e) => set('apuesta_max', Number(e.target.value))} />
              </Campo>

              <Campo label="PUESTOS (MANOS A LA VEZ)">
                <select style={S.input} value={mesa.puestos} onChange={(e) => set('puestos', Number(e.target.value))}>
                  {[1, 2, 3].map((n) => (
                    <option key={n} value={n}>{n} {n === 1 ? 'puesto' : 'puestos'}</option>
                  ))}
                </select>
              </Campo>
            </>
          )}

          <Campo label="ORDEN EN EL SALÓN">
            <input style={S.input} type="number" value={mesa.orden}
                   onChange={(e) => set('orden', Number(e.target.value))} />
          </Campo>

          <Campo label="ÍCONO">
            <input style={S.input} value={mesa.icono || ''} onChange={(e) => set('icono', e.target.value)} />
          </Campo>

          <Campo label="COLOR DEL NOMBRE">
            <input style={{ ...S.input, padding: 4, height: 44 }} type="color"
                   value={mesa.color || '#ffd84a'} onChange={(e) => set('color', e.target.value)} />
          </Campo>

          <Campo label="PRIMERA LÍNEA EN LA TARJETA">
            <input style={S.input} value={mesa.detalle1 || ''} onChange={(e) => set('detalle1', e.target.value)} />
          </Campo>

          <Campo label="SEGUNDA LÍNEA">
            <input style={S.input} value={mesa.detalle2 || ''} onChange={(e) => set('detalle2', e.target.value)} />
          </Campo>
        </div>

        <div style={{ display: 'flex', gap: 18, marginTop: 14, flexWrap: 'wrap' }}>
          {!es21 && (
            <>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!mesa.animales} onChange={(e) => set('animales', e.target.checked)} />
                Con animalitos
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={!!mesa.rayos} onChange={(e) => setRayos(e.target.checked)} />
                Con rayos (Lightning)
              </label>
            </>
          )}
          {/* Tres estados, no un sí o un no. EN PRUEBAS es lo que permite tener
              una mesa nueva viva en producción, jugándose con plata de verdad,
              sin abrírsela a nadie: la ven el dueño y las cuentas `prueba`. */}
          <Campo label="ESTADO DE LA MESA">
            <select style={S.input}
                    value={mesa.activo ? 1 : (mesa.en_pruebas ? 2 : 0)}
                    onChange={(e) => {
                      const est = Number(e.target.value);
                      setMesa({ ...mesa, estado: est, activo: est === 1, en_pruebas: est === 2 });
                    }}>
              <option value={0}>Cerrada — nadie entra</option>
              <option value={2}>En pruebas — sólo el dueño y las cuentas de prueba</option>
              <option value={1}>Abierta — para todos</option>
            </select>
          </Campo>
        </div>

        <div style={{
          marginTop: 14, padding: 12, borderRadius: 8,
          background: 'rgba(0,0,0,0.35)', border: '1px solid var(--linea, #3a2a10)',
          fontSize: 12, color: '#bba876', lineHeight: 1.7,
        }}>
          {es21 ? (
            <>
              Una mesa de 21 le deja a la casa{' '}
              <b style={{ color: '#ff9a9a' }}>{mesa.pago_natural >= 1.5 ? '~0,5%' : '~1,9%'}</b>
              {' '}de lo apostado, contra el <b style={{ color: '#ffd84a' }}>5,3%</b> de una ruleta americana.
              No es un número que se ajuste con una perilla: sale de las reglas del juego.
              {mesa.pago_natural >= 1.5
                ? ' Pagar el natural 3 a 2 es lo normal y lo que el jugador espera.'
                : ' Pagando 6 a 5 la casa gana casi cuatro veces más, pero el jugador que sabe lo nota enseguida y no vuelve.'}
            </>
          ) : (
            <>
              {rueda && (
                <>Con esta rueda, el color, la docena y la línea le dejan a la casa{' '}
                <b style={{ color: '#ffd84a' }}>{rueda.ventaja_resto_mesa}%</b>.{' '}</>
              )}
              {mesa.rayos
                ? 'El pleno lo ajustan los rayos, que se configuran en CONFIGURACIÓN y valen para todo el salón.'
                : 'Sin rayos, el pleno paga 35 a 1 y le deja a la casa lo mismo que el resto de la mesa. Es lo correcto: con 29 a 1 y sin multiplicadores se quedaría con más del 20%.'}
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <Boton tono="verde" onClick={onGuardar} disabled={guardando || !mesa.label || (creando && !mesa.id)}>
            {guardando ? 'GUARDANDO…' : (creando ? 'CREAR MESA' : 'GUARDAR')}
          </Boton>
          <Boton tono="gris" onClick={onCancelar} disabled={guardando}>CANCELAR</Boton>
        </div>
      </div>
    );
  }

  function TabConfig({ setMsg }) {
    const [vals, setVals] = useState(null);
    const [ltg, setLtg] = useState(null);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
      window.Api.adminGetSettings()
        .then((d) => { setVals(d.settings); setLtg(d.lightning || null); })
        .catch((err) => setMsg({ kind: 'err', text: err.message }));
    }, [setMsg]);

    const guardar = async (extra) => {
      setGuardando(true);
      try {
        const res = await window.Api.adminPutSettings({ ...vals, ...(extra || {}) });
        setVals(res.settings);
        if (res.lightning) setLtg(res.lightning);
        setMsg({ kind: res.warning ? 'err' : 'ok', text: res.warning || 'Configuración guardada.' });
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
      finally { setGuardando(false); }
    };

    if (!vals) return <div style={{ color: '#888' }}>Cargando…</div>;

    return (
      <div style={S.card}>
        <div style={S.titulo}>CONFIGURACIÓN DEL NEGOCIO</div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 16 }}>
          Estos números mandan sobre todo el sistema. Se aplican al instante, sin volver a publicar nada.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
          {CAMPOS_CONFIG.map((c) => (
            <div key={c.key}>
              <Campo label={c.label.toUpperCase()}>
                <input
                  style={S.input}
                  type={c.tipo}
                  value={vals[c.key] != null ? vals[c.key] : ''}
                  onChange={(e) => setVals({ ...vals, [c.key]: e.target.value })}
                />
              </Campo>
              {c.ayuda && <div style={{ fontSize: 11, color: '#888', marginTop: 4, lineHeight: 1.5 }}>{c.ayuda}</div>}
            </div>
          ))}
        </div>

        {ltg && (
          <PanelRayos
            ltg={ltg}
            vals={vals}
            setVals={setVals}
            guardar={guardar}
            guardando={guardando}
          />
        )}

        <div style={{ marginTop: 20 }}>
          <Boton tono="verde" onClick={() => guardar()} disabled={guardando}>
            {guardando ? 'GUARDANDO...' : 'GUARDAR CONFIGURACIÓN'}
          </Boton>
        </div>
      </div>
    );
  }

  // ── Rayos (Lightning) ────────────────────────────────────────────────────
  // Acá se decide cuánto gana la casa en los plenos. Los multiplicadores son
  // siempre los mismos (50x…500x); lo que se ajusta es cada cuánto sale cada
  // uno. Si los grandes salen seguido, el pleno paga más de lo que recibe.
  function PanelRayos({ ltg, vals, setVals, guardar, guardando }) {
    const valores = ltg.valores || [50, 75, 100, 150, 200, 300, 400, 500];
    const pesosTxt = vals.ltg_pesos || '';
    const pesos = pesosTxt.split(',').map((x) => Number(String(x).trim()));
    const sumaPesos = pesos.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
    const [ventajaDeseada, setVentajaDeseada] = useState('');
    const [avisoVentaja, setAvisoVentaja] = useState('');

    // A partir del % que se quiere dejar a la casa, calcula qué tan seguido
    // debe salir cada multiplicador (mismo despeje que ventajaPleno, al revés).
    // Los pesos siguen una curva pareja (cada multiplicador pesa "r" veces
    // menos que el anterior); se busca la "r" que da el promedio exacto que
    // hace falta para llegar al porcentaje pedido.
    const aplicarVentajaDeseada = () => {
      const target = Number(ventajaDeseada);
      if (!Number.isFinite(target)) return;
      const min = Math.max(0, Number(vals.ltg_min) || 0);
      const max = Math.max(min, Number(vals.ltg_max) || 1);
      const rayosProm = (min + max) / 2;
      const P = Math.min(1, rayosProm / 38);
      if (P <= 0) {
        setAvisoVentaja('Poné al menos un rayo (mínimo o máximo mayor a 0) para poder calcular.');
        return;
      }

      const devuelve = 1 - target / 100;
      let multProm = (devuelve * 38 - (1 - P) * 30) / P;
      const piso = valores[0], techo = valores[valores.length - 1];
      const ventajaDe = (mp) => Math.round((1 - (1 / 38) * (P * mp + (1 - P) * 30)) * 1000) / 10;
      let aviso = '';
      if (multProm < piso) {
        multProm = piso;
        aviso = `Con estos rayos no se puede pasar de ${String(ventajaDe(piso)).replace('.', ',')}%. Quedó lo más cerca posible.`;
      }
      if (multProm > techo) {
        multProm = techo;
        aviso = `Con estos rayos no se puede bajar de ${String(ventajaDe(techo)).replace('.', ',')}%. Quedó lo más cerca posible.`;
      }

      // multProm(t) = promedio ponderado con pesos e^(t·i); crece con t.
      const multPromDeT = (t) => {
        let sw = 0, swv = 0;
        for (let i = 0; i < valores.length; i++) { const w = Math.exp(t * i); sw += w; swv += w * valores[i]; }
        return swv / sw;
      };
      let lo = -60, hi = 60;
      for (let it = 0; it < 80; it++) {
        const mid = (lo + hi) / 2;
        if (multPromDeT(mid) < multProm) lo = mid; else hi = mid;
      }
      const t = (lo + hi) / 2;
      const crudos = valores.map((_, i) => Math.exp(t * i));
      const sumaCrudos = crudos.reduce((a, b) => a + b, 0);
      const nuevosPesos = crudos.map((w) => Math.round((w / sumaCrudos) * 1000) / 10);

      setAvisoVentaja(aviso);
      setVals({ ...vals, ltg_pesos: nuevosPesos.join(',') });
      guardar({ ltg_pesos: nuevosPesos.join(',') });
    };

    // Ventaja calculada en vivo, con lo que hay escrito en pantalla.
    const calc = (() => {
      const min = Number(vals.ltg_min), max = Number(vals.ltg_max);
      if (![min, max].every(Number.isFinite) || sumaPesos <= 0 || pesos.length !== valores.length
          || pesos.some((p) => !Number.isFinite(p) || p < 0)) return null;
      const multProm = valores.reduce((a, v, i) => a + v * pesos[i], 0) / sumaPesos;
      const rayosProm = (Math.max(0, min) + Math.max(min, max)) / 2;
      const P = Math.min(1, rayosProm / 38);
      const devuelve = (1 / 38) * (P * multProm + (1 - P) * 30);
      return {
        ventaja: Math.round((1 - devuelve) * 1000) / 10,
        multProm: Math.round(multProm * 10) / 10,
        rayosProm,
      };
    })();

    const v = calc ? calc.ventaja : null;
    const color = v == null ? '#888' : v < 0 ? '#ff9a9a' : v < 3 ? '#ffd84a' : '#7ee08a';

    const aplicarPerfil = (p) => {
      const nuevos = { ...vals, ltg_pesos: p.pesos, ltg_min: '1', ltg_max: '5' };
      setVals(nuevos);
      guardar({ ltg_pesos: p.pesos, ltg_min: '1', ltg_max: '5' });
    };

    const setPeso = (i, valor) => {
      const arr = [...pesos];
      arr[i] = valor === '' ? 0 : Number(valor);
      setVals({ ...vals, ltg_pesos: arr.join(',') });
    };

    return (
      <div style={{ ...S.card, marginTop: 18, borderColor: '#5ab8ff' }}>
        <div style={{ ...S.titulo, color: '#9fd8ff' }}>⚡ RAYOS Y GANANCIA DE LA CASA</div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 14, lineHeight: 1.6 }}>
          Los rayos son lo que hace que un pleno pague hasta 500 veces. Cuanto más seguido salgan
          los multiplicadores grandes, más generoso es el juego — y menos gana la casa. El resto de
          la mesa (color, docena, línea) siempre le deja <b>5,3%</b> a la casa; acá se ajusta el pleno
          para que quede parecido.
        </div>

        {/* Resultado en vivo */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 10, marginBottom: 16,
        }}>
          <Dato titulo="Le deja a la casa (pleno)" color={color}
                valor={v == null ? '—' : `${v}%`}
                detalle={v == null ? 'revisá los pesos'
                  : v < 0 ? 'la casa PIERDE' : 'el resto de la mesa: 5,3%'} />
          <Dato chico titulo="Multiplicador promedio" valor={calc ? `${calc.multProm}x` : '—'} />
          <Dato chico titulo="Rayos por giro (promedio)" valor={calc ? calc.rayosProm : '—'} />
        </div>

        {v != null && v < 0 && (
          <div style={{
            marginBottom: 14, padding: '10px 14px', borderRadius: 6, fontSize: 14,
            background: 'rgba(180,16,26,0.2)', border: '1px solid #b8101a', color: '#ff9a9a',
          }}>
            Con estos pesos la casa <b>pierde {Math.abs(v)}%</b> de todo lo que le apuesten a un número.
            Cada {plata(100)} apostados a plenos devuelve {plata(Math.round(100 * (1 + Math.abs(v) / 100)))}.
          </div>
        )}

        {/* Perfiles listos */}
        <div style={{ fontSize: 11, color: '#999', letterSpacing: 1, marginBottom: 6 }}>PERFILES LISTOS</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
          {Object.entries(ltg.perfiles || {}).map(([id, p]) => (
            <Boton key={id} tono={id === 'equilibrado' ? 'verde' : 'oro'}
                   disabled={guardando}
                   onClick={() => aplicarPerfil(p)}>
              {p.label.toUpperCase()} — {String(p.ventaja).replace('.', ',')}%
            </Boton>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 18, lineHeight: 1.5 }}>
          <b>Equilibrado:</b> el pleno rinde igual que el resto de la mesa. Es el recomendado.
          <br /><b>Casa fuerte:</b> el pleno rinde un poco más que el resto; los premios grandes salen
          menos seguido.
        </div>

        {/* Porcentaje a mano */}
        <div style={{ fontSize: 11, color: '#999', letterSpacing: 1, marginBottom: 6 }}>
          O PONÉ VOS EL PORCENTAJE
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap', marginBottom: 8 }}>
          <Campo label="VENTAJA QUE QUERÉS DEJARLE A LA CASA (%)">
            <input
              style={{ ...S.input, maxWidth: 160 }}
              type="number" step="0.1" placeholder="ej: 15 o 2"
              value={ventajaDeseada}
              onChange={(e) => { setVentajaDeseada(e.target.value); setAvisoVentaja(''); }}
            />
          </Campo>
          <Boton tono="oro" disabled={guardando || ventajaDeseada === ''} onClick={aplicarVentajaDeseada}>
            CALCULAR Y APLICAR
          </Boton>
        </div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 8, lineHeight: 1.5 }}>
          Escribí el porcentaje que querés que le deje el pleno a la casa (puede ser 2, 15, lo que sea) y
          el sistema recalcula los 8 pesos de abajo para llegar lo más cerca posible. El resultado real
          queda mostrado arriba, en "Le deja a la casa (pleno)".
        </div>
        {avisoVentaja && (
          <div style={{
            marginBottom: 14, padding: '10px 14px', borderRadius: 6, fontSize: 13,
            background: 'rgba(255,216,74,0.1)', border: '1px solid #8a6a1a', color: '#ffd84a',
          }}>
            {avisoVentaja}
          </div>
        )}

        {/* Ajuste fino */}
        <div style={{ fontSize: 11, color: '#999', letterSpacing: 1, marginBottom: 6 }}>
          AJUSTE FINO — CADA CUÁNTO SALE CADA MULTIPLICADOR
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(88px, 1fr))', gap: 8,
        }}>
          {valores.map((val, i) => {
            const pct = sumaPesos > 0 ? (pesos[i] / sumaPesos) * 100 : 0;
            return (
              <div key={val} style={{
                background: 'rgba(0,0,0,0.3)', border: '1px solid var(--linea, #3a2a10)',
                borderRadius: 6, padding: '8px 10px',
              }}>
                <div style={{ fontSize: 13, fontWeight: 900, color: '#ffd84a' }}>{val}x</div>
                <input
                  style={{ ...S.input, padding: '6px 8px', fontSize: 14, marginTop: 4 }}
                  type="number" min="0" step="0.5"
                  value={Number.isFinite(pesos[i]) ? pesos[i] : ''}
                  onChange={(e) => setPeso(i, e.target.value)}
                />
                <div style={{ fontSize: 10, color: '#888', marginTop: 3 }}>
                  {pct.toFixed(1)}% de los rayos
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 8, lineHeight: 1.5 }}>
          Son pesos relativos, no porcentajes: si el 50x tiene 40 y el 500x tiene 1, el 50x sale
          cuarenta veces más seguido. El porcentaje de abajo se calcula solo.
        </div>

        {/* Cuántos números reciben rayo */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12, marginTop: 16,
        }}>
          <Campo label="MÍNIMO DE NÚMEROS CON RAYO">
            <input style={S.input} type="number" min="0" max="20"
                   value={vals.ltg_min}
                   onChange={(e) => setVals({ ...vals, ltg_min: e.target.value })} />
          </Campo>
          <Campo label="MÁXIMO DE NÚMEROS CON RAYO">
            <input style={S.input} type="number" min="1" max="20"
                   value={vals.ltg_max}
                   onChange={(e) => setVals({ ...vals, ltg_max: e.target.value })} />
          </Campo>
        </div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 8, lineHeight: 1.5 }}>
          Cuántos números se encienden en cada giro. Más números encendidos = más chances de que
          alguien pegue un multiplicador, o sea más generoso.
        </div>
      </div>
    );
  }

  window.AdminPanel = AdminPanel;
})();
