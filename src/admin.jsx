// Panel de administración — expone window.AdminPanel
// Props: { user, onExit(), onLogout() }  — onExit vuelve al juego
//
// Pestañas: Resumen · Jugadores · Socios · Recargas · Retiros ·
//           Reportes · Configuración
(function () {
  const { useState, useEffect, useCallback, useRef } = React;
  const U = window.UI;
  const { bs, fecha, styles: S, Boton, Aviso, Dato, Encabezado, Pestanas,
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
      { id: 'socios', label: 'SOCIOS' },
      { id: 'recargas', label: 'RECARGAS', badge: pend.recargas_pendientes },
      { id: 'retiros', label: 'RETIROS', badge: pend.retiros_pendientes },
      { id: 'reportes', label: 'REPORTES' },
      { id: 'config', label: 'CONFIGURACIÓN' },
    ];

    return (
      <div style={S.page}>
        <div style={{ maxWidth: 1180, margin: '0 auto' }}>
          <Encabezado
            titulo="⚙ PANEL DEL DUEÑO"
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
                  <b>{pend.retiros_pendientes} retiro{pend.retiros_pendientes > 1 ? 's' : ''} por {bs(pend.retiros_pendientes_monto)} Bs</b>
                )}
                {' '}esperando tu respuesta.
              </span>
              {pend.recargas_pendientes > 0 && <Boton chico onClick={() => setTab('recargas')}>VER RECARGAS</Boton>}
              {pend.retiros_pendientes > 0 && <Boton chico onClick={() => setTab('retiros')}>VER RETIROS</Boton>}
            </div>
          )}

          <Pestanas tabs={tabs} activa={tab} onChange={setTab} />
          <Aviso msg={msg} onClose={() => setMsg(null)} />

          {tab === 'resumen'     && <TabResumen resumen={resumen} {...props} irA={setTab} />}
          {tab === 'jugadores'   && <TabJugadores {...props} />}
          {tab === 'socios' && <TabSocios {...props} />}
          {tab === 'recargas'    && <TabRecargas {...props} />}
          {tab === 'retiros'     && <TabRetiros {...props} />}
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
            <Dato titulo="Socios" valor={bs(t.socios)} chico />
            <Dato titulo="Saldo en manos de jugadores" valor={bs(t.saldo_jugadores)} chico color="#ffd84a"
                  detalle="lo que te podrían pedir" />
            <Dato titulo="Congelado en retiros" valor={bs(t.saldo_congelado)} chico color="#ff9a9a" />
            <Dato titulo="Cupo en la calle" valor={bs(t.cupo_en_calle)} chico
                  detalle="cupo sin usar de socios" />
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
              <option value="cashier">Socios</option>
              <option value="admin">Administradores</option>
            </select>
          </div>

          <Tabla
            columnas={['USUARIO', 'TELÉFONO', 'SALDO', 'DISPONIBLE', 'ROL', 'ESTADO', 'SOCIO', '']}
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
                  {u.role === 'admin' ? '👑 dueño' : u.role === 'cashier' ? '🎟 socio' : 'jugador'}
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
          text: `${modo === 'cargar' ? 'Cargaste' : 'Ajustaste'} ${bs(amt)} Bs a ${res.user.username}. Saldo nuevo: ${bs(res.user.balance)} Bs.`,
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
          <Campo label={modo === 'cargar' ? 'MONTO (Bs)' : 'MONTO (+ suma / − resta)'}>
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
          onHecho(`${user.username} ahora es ${rol === 'admin' ? 'dueño' : rol === 'cashier' ? 'socio' : 'jugador'}.`);
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
            <option value="cashier">Socio</option>
            <option value="admin">Dueño (acceso total)</option>
          </select>
        </Campo>
        {rol === 'cashier' && (
          <Campo label="COMISIÓN (%)">
            <input style={S.input} type="number" min="0" max="90" value={comision}
                   onChange={(e) => setComision(e.target.value)} />
            <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
              Con {comision || 0}% te paga {bs(Math.round(10000 * (1 - (Number(comision) || 0) / 100)))} Bs
              por cada 10.000 de cupo.
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
                      {d.user.cashier_username ? ` · socio: ${d.user.cashier_username}` : ''}
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

  // ═════════════════════════════ Socios ══════════════════════════════

  // Alta de un socio nuevo. No se registra solo: lo da de alta la casa.
  function FormNuevoSocio({ setMsg, onHecho }) {
    const vacio = {
      first_name: '', last_name: '', doc_type: 'V', cedula: '', phone: '',
      email: '', bank: '', username: '', password: '', commission_pct: '10',
      referral_code: '',
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
          referral_code: f.referral_code.trim() || undefined,
        });
        setMsg({
          kind: 'ok',
          text: `Socio ${res.cashier.username} creado. Su código de referencia es ${res.cashier.referral_code}. Ya le podés vender cupo.`,
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
              <div style={{ ...S.titulo, marginBottom: 4 }}>SOCIOS</div>
              <div style={{ fontSize: 12, color: '#888' }}>
                Los socios los das de alta vos, con su ficha completa. Cada uno recibe un código
                de referencia para que sus jugadores queden adjudicados a su cuenta.
              </div>
            </div>
            <Boton tono="verde" onClick={() => setAbierto(true)}>+ NUEVO SOCIO</Boton>
          </div>
        </div>
      );
    }

    return (
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ ...S.titulo, marginBottom: 0 }}>NUEVO SOCIO</div>
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
              {U.BANCOS.map((b) => <option key={b} value={b}>{b}</option>)}
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
          <Campo label="COMISIÓN (%)">
            <input style={S.input} type="number" min="0" max="90"
                   value={f.commission_pct} onChange={set('commission_pct')} required />
          </Campo>
          <Campo label="CÓDIGO (opcional)">
            <input style={{ ...S.input, textTransform: 'uppercase' }}
                   placeholder="se genera solo"
                   value={f.referral_code}
                   onChange={(e) => setF((p) => ({ ...p, referral_code: e.target.value.toUpperCase() }))} />
          </Campo>
          <div style={{ display: 'flex', alignItems: 'end' }}>
            <Boton type="submit" tono="verde" disabled={enviando} style={{ width: '100%' }}>
              {enviando ? 'CREANDO...' : 'CREAR SOCIO'}
            </Boton>
          </div>
        </form>
        <div style={{ fontSize: 12, color: '#888', marginTop: 12 }}>
          Pasale el usuario y la contraseña por un medio seguro. Él las puede cambiar después desde su panel.
        </div>
      </div>
    );
  }

  function TabSocios({ setMsg, recargarResumen }) {
    const [cashiers, setCashiers] = useState([]);
    const [ledger, setLedger] = useState([]);
    const [username, setUsername] = useState('');
    const [amount, setAmount] = useState('');
    const [pagado, setPagado] = useState('');
    const [confirmar, setConfirmar] = useState(false);
    const [enviando, setEnviando] = useState(false);

    const cargar = useCallback(async () => {
      try {
        const [c, l] = await Promise.all([
          window.Api.adminCashiers(),
          window.Api.adminCreditLedger({ limit: 40 }),
        ]);
        setCashiers(c.cashiers || []);
        setLedger(l.ledger || []);
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
    }, [setMsg]);

    useEffect(() => { cargar(); }, [cargar]);

    const elegido = cashiers.find((c) => c.username === username.trim().toLowerCase());
    const cupo = Number(amount) || 0;
    const sugerido = elegido ? Math.round(cupo * (1 - (elegido.commission_pct || 0) / 100)) : null;
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
          text: `Le vendiste ${bs(cupo)} de cupo a ${res.cashier.username}. Su comisión fue ${bs(res.comision)} Bs. Cupo total: ${bs(res.cashier.credit_balance)} Bs.`,
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
        <FormNuevoSocio setMsg={setMsg} onHecho={() => { cargar(); recargarResumen(); }} />

        <div style={S.card}>
          <div style={S.titulo}>VENDER CUPO</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
            El socio te paga primero y ahí le cargás el cupo. Nunca puede cargar más de lo que ya te pagó.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, alignItems: 'end' }}>
            <Campo label="SOCIO">
              <select style={S.input} value={username} onChange={(e) => setUsername(e.target.value)}>
                <option value="">Elegí…</option>
                {cashiers.map((c) => (
                  <option key={c.id} value={c.username}>
                    {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.username} — {c.username} ({c.commission_pct}%)
                  </option>
                ))}
              </select>
            </Campo>
            <Campo label="CUPO QUE RECIBE (Bs)">
              <input style={S.input} type="number" min="1" placeholder="10000" value={amount}
                     onChange={(e) => setAmount(e.target.value)} />
            </Campo>
            <Campo label="LO QUE TE PAGÓ (Bs)">
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
              te paga <b style={{ color: '#7ee08a' }}>{bs(cobra)}</b> Bs
              y su comisión es <b style={{ color: U.GOLD }}>{bs(cupo - cobra)}</b> Bs.
            </div>
          )}
        </div>

        <Confirmar
          abierto={confirmar}
          titulo="Confirmar venta de cupo"
          texto={`¿Ya recibiste los ${bs(cobra)} Bs de ${username}? Al confirmar le quedan ${bs(cupo)} Bs de cupo para cargar a sus jugadores.`}
          onSi={vender}
          onNo={() => setConfirmar(false)}
          textoSi="SÍ, YA COBRÉ"
        />

        <div style={S.card}>
          <div style={S.titulo}>SOCIOS ({cashiers.length})</div>
          <Tabla
            columnas={['SOCIO', 'CÓDIGO', 'CUPO SIN USAR', 'COMISIÓN', 'CUPO COMPRADO', 'TE PAGÓ', 'CARGÓ', 'SU COMISIÓN', 'AFILIADOS', 'ESTADO']}
            vacio="Todavía no tenés socios. Tocá “+ NUEVO SOCIO” arriba para dar de alta al primero."
          >
            {cashiers.map((c) => (
              <tr key={c.id}>
                <td style={{ ...S.td, fontWeight: 700 }}>
                  {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.username}
                  <div style={{ fontSize: 11, color: '#999', fontWeight: 400 }}>{c.username}</div>
                </td>
                <td style={{ ...S.td, fontFamily: 'monospace', color: U.GOLD, fontWeight: 700 }}>
                  {c.referral_code || '—'}
                </td>
                <td style={{ ...S.td, color: '#ffd84a', fontWeight: 900 }}>{bs(c.credit_balance)}</td>
                <td style={S.td}>{c.commission_pct}%</td>
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
          <Tabla columnas={['FECHA', 'SOCIO', 'MOVIMIENTO', 'CUPO', 'PAGÓ', 'JUGADOR', 'NOTA']} vacio="Sin movimientos">
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
          setMsg({ kind: 'ok', text: `Recarga aprobada. ${item.username} quedó con ${bs(res.user.balance)} Bs.` });
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
                {t.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Boton chico tono="verde" onClick={() => abrir('aprobar', t)}>APROBAR</Boton>
                    <Boton chico tono="rojo" onClick={() => abrir('rechazar', t)}>RECHAZAR</Boton>
                  </div>
                )}
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
                <Campo label="MONTO A ACREDITAR (Bs)">
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
    const [socio, setSocio] = useState('');
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
      setSocio(item.cashier_username || '');
      setNota('');
    };

    const ejecutar = async () => {
      const { tipo, item } = accion;
      setEnviando(true);
      try {
        if (tipo === 'pagar') {
          if (quienPaga === 'cashier' && !socio) {
            setMsg({ kind: 'err', text: 'Elegí qué socio lo pagó' }); setEnviando(false); return;
          }
          await window.Api.adminPayWithdrawal(item.id, quienPaga, socio || undefined, nota.trim() || undefined);
          setMsg({
            kind: 'ok',
            text: quienPaga === 'cashier'
              ? `Retiro pagado. Le repusimos ${bs(item.amount)} Bs de cupo a ${socio}.`
              : `Retiro de ${bs(item.amount)} Bs marcado como pagado.`,
          });
        } else {
          if (!nota.trim()) { setMsg({ kind: 'err', text: 'Poné el motivo del rechazo' }); setEnviando(false); return; }
          await window.Api.adminRejectWithdrawal(item.id, nota.trim());
          setMsg({ kind: 'ok', text: `Retiro rechazado. Le devolvimos ${bs(item.amount)} Bs a ${item.username}.` });
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
            RETIROS ({items.length}){total > 0 && ` — ${bs(total)} Bs por pagar`}
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
                {w.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <Boton chico tono="verde" onClick={() => abrir('pagar', w)}>PAGAR</Boton>
                    <Boton chico tono="rojo" onClick={() => abrir('rechazar', w)}>RECHAZAR</Boton>
                  </div>
                )}
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
                <div><b style={{ color: '#ffd84a', fontSize: 20 }}>{bs(accion.item.amount)} Bs</b></div>
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
                      <option value="cashier">Un socio (se le repone en cupo)</option>
                    </select>
                  </Campo>
                  {quienPaga === 'cashier' && (
                    <Campo label="SOCIO QUE PAGA">
                      <select style={S.input} value={socio} onChange={(e) => setSocio(e.target.value)}>
                        <option value="">Elegí…</option>
                        {cashiers.map((c) => (
                          <option key={c.id} value={c.username}>
                            {c.username} — cupo {bs(c.credit_balance)}
                          </option>
                        ))}
                      </select>
                      <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                        Le vamos a sumar {bs(accion.item.amount)} Bs de cupo por la plata que puso.
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

    const cargar = useCallback(async () => {
      try {
        const params = { from: desde || undefined, to: hasta || undefined };
        const [d, c, a] = await Promise.all([
          window.Api.reportDaily(params),
          window.Api.reportCashiers(params),
          window.Api.reportAlerts(),
        ]);
        setDaily(d); setCash(c); setAlerts(a);
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
    }, [desde, hasta, setMsg]);

    useEffect(() => { cargar(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const t = daily ? daily.total : null;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={S.card}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
            <Campo label="DESDE"><input style={S.input} type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></Campo>
            <Campo label="HASTA"><input style={S.input} type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></Campo>
            <Boton onClick={cargar}>VER PERÍODO</Boton>
            <div style={{ fontSize: 12, color: '#888', flex: '1 1 200px' }}>
              Sin fechas muestra los últimos 30 días. El día cierra a medianoche, hora de Venezuela.
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

        <div style={S.card}>
          <div style={S.titulo}>CIERRE DIARIO</div>
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
          <div style={S.titulo}>POR SOCIO (EN EL PERÍODO)</div>
          <Tabla columnas={['SOCIO', 'CUPO COMPRADO', 'TE PAGÓ', 'SU COMISIÓN', 'CARGÓ', 'CARGAS', 'RETIROS QUE PAGÓ', 'CUPO ACTUAL', 'JUGADORES']}
                 vacio="Sin movimientos de socios">
            {(cash ? cash.socios : []).map((c) => (
              <tr key={c.id}>
                <td style={{ ...S.td, fontWeight: 700 }}>{c.username}</td>
                <td style={S.td}>{bs(c.cupo_comprado)}</td>
                <td style={{ ...S.td, color: '#7ee08a' }}>{bs(c.pagado)}</td>
                <td style={{ ...S.td, color: U.GOLD }}>{bs(c.comision)}</td>
                <td style={S.td}>{bs(c.cargado)}</td>
                <td style={{ ...S.td, color: '#999' }}>{bs(c.cargas)}</td>
                <td style={S.td}>{bs(c.retiros_pagados)}</td>
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
    const hay = a.ganadores.length || a.poco_juego.length || a.retiros_demorados.length;
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
    { key: 'rate_usd', label: 'Tasa del dólar (Bs por $)', tipo: 'number',
      ayuda: 'Se usa para convertir Zelle y Binance a bolívares. Cada recarga guarda la tasa con la que se hizo.' },
    { key: 'max_bet_per_spin', label: 'Apuesta máxima por giro (Bs)', tipo: 'number',
      ayuda: 'Todo lo que el jugador pone en la mesa en un mismo giro no puede pasar de este número.' },
    { key: 'max_win_per_spin', label: 'Premio máximo por giro (Bs)', tipo: 'number',
      ayuda: 'El candado importante: los números Lightning pagan hasta 500x. Con este techo, un solo golpe de suerte no te vacía la caja.' },
    { key: 'monto_multiplo', label: 'Los montos van en múltiplos de (Bs)', tipo: 'number',
      ayuda: 'Recargas, retiros, cargas de taquilla y cupo se manejan en cifras redondas de este tamaño. Con 100, nadie puede pedir 1.350: pide 1.300 o 1.400. Cuando el jugador paga en dólares, la conversión se redondea para arriba y la diferencia la pone la casa. Poné 1 para desactivarlo.' },
    { key: 'min_topup', label: 'Recarga mínima (Bs)', tipo: 'number',
      ayuda: 'Por debajo de esto no se puede pedir una recarga.' },
    { key: 'min_withdrawal', label: 'Retiro mínimo (Bs)', tipo: 'number',
      ayuda: 'Evita pagar comisiones bancarias por montos ridículos.' },
    { key: 'wager_pct_required', label: 'Hay que jugar el (%) de lo recargado', tipo: 'number',
      ayuda: 'Para poder retirar. Con 50%, quien recargó 1.000 tiene que haber apostado 500. Poné 0 para desactivarlo.' },
    { key: 'registration_open', label: '¿Registro abierto? (1 = sí, 0 = no)', tipo: 'number',
      ayuda: 'Con 0, nadie puede crearse cuenta solo: las cuentas las crea el socio o vos.' },
    { key: 'bank_pago_movil', label: 'Datos de tu Pago Móvil', tipo: 'text',
      ayuda: 'Lo ve el jugador cuando elige pagar por Pago Móvil. Ej: Banco, cédula y teléfono.' },
    { key: 'bank_transferencia', label: 'Datos de tu cuenta bancaria', tipo: 'text' },
    { key: 'bank_zelle', label: 'Tu correo de Zelle', tipo: 'text' },
    { key: 'bank_binance', label: 'Tu usuario de Binance', tipo: 'text' },
  ];

  function TabConfig({ setMsg }) {
    const [vals, setVals] = useState(null);
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
      window.Api.adminGetSettings()
        .then((d) => setVals(d.settings))
        .catch((err) => setMsg({ kind: 'err', text: err.message }));
    }, [setMsg]);

    const guardar = async () => {
      setGuardando(true);
      try {
        const res = await window.Api.adminPutSettings(vals);
        setVals(res.settings);
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
        <div style={{ marginTop: 20 }}>
          <Boton tono="verde" onClick={guardar} disabled={guardando}>
            {guardando ? 'GUARDANDO...' : 'GUARDAR CONFIGURACIÓN'}
          </Boton>
        </div>
      </div>
    );
  }

  window.AdminPanel = AdminPanel;
})();
