// Panel del taquillero — expone window.CashierPanel
// Props: { user, onExit(), onLogout() }
//
// Lo único que hace un taquillero: cargarle saldo a sus jugadores usando el
// cupo que ya le compró al dueño. No puede aprobar retiros ni tocar la
// configuración.
(function () {
  const { useState, useEffect, useCallback } = React;
  const U = window.UI;
  const { bs, fecha, styles: S, Boton, Aviso, Dato, Encabezado, Tabla, Confirmar, Campo } = U;

  function CashierPanel({ user, onExit, onLogout }) {
    const [data, setData] = useState(null);
    const [msg, setMsg] = useState(null);
    const [username, setUsername] = useState('');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [confirmar, setConfirmar] = useState(false);
    const [enviando, setEnviando] = useState(false);

    const cargar = useCallback(async () => {
      try { setData(await window.Api.cashierSummary()); }
      catch (err) { setMsg({ kind: 'err', text: err.message }); }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    useEffect(() => {
      if (msg && msg.kind === 'ok') {
        const t = setTimeout(() => setMsg(null), 8000);
        return () => clearTimeout(t);
      }
    }, [msg]);

    const monto = Number(amount) || 0;
    const cupo = data ? (data.cashier.credit_balance || 0) : 0;
    const esDueno = data && data.cashier.role === 'admin';
    const alcanza = esDueno || monto <= cupo;

    const cargarSaldo = async () => {
      setConfirmar(false);
      setEnviando(true);
      try {
        const res = await window.Api.cashierLoad(username.trim().toLowerCase(), monto, note.trim() || undefined);
        setMsg({
          kind: 'ok',
          text: `Listo: ${res.player.username} quedó con ${bs(res.player.balance)} Bs.` +
                (esDueno ? '' : ` Te quedan ${bs(res.credit_balance)} Bs de cupo.`),
        });
        setUsername(''); setAmount(''); setNote('');
        cargar();
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
      finally { setEnviando(false); }
    };

    const LTIPO = {
      purchase: ['Compraste cupo', '#7ee08a'],
      load: ['Cargaste a jugador', '#5ab8ff'],
      withdrawal_refill: ['Pagaste un retiro', '#ffa04a'],
      adjust: ['Ajuste del dueño', '#c9a0ff'],
    };

    return (
      <div style={S.page}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <Encabezado
            titulo="🎟 TAQUILLA"
            subtitulo={`Sesión: ${user.username}`}
            acciones={<>
              <Boton tono="gris" onClick={onExit}>← VOLVER AL JUEGO</Boton>
              {onLogout && <Boton tono="gris" onClick={onLogout}>SALIR</Boton>}
            </>}
          />

          <Aviso msg={msg} onClose={() => setMsg(null)} />

          {!data && <div style={{ color: '#888' }}>Cargando…</div>}

          {data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Cupo disponible: el número más importante de esta pantalla. */}
              <div style={{
                ...S.card,
                background: 'linear-gradient(180deg, #2a2008, #140d02)',
                textAlign: 'center', padding: '24px 16px',
              }}>
                <div style={{ fontSize: 12, color: '#999', letterSpacing: 2 }}>TU CUPO DISPONIBLE</div>
                <div style={{ fontSize: 44, fontWeight: 900, color: '#ffd84a', lineHeight: 1.2 }}>
                  {esDueno ? 'SIN LÍMITE' : bs(cupo)}
                </div>
                <div style={{ fontSize: 13, color: '#888' }}>
                  {esDueno
                    ? 'Como dueño cargás directo de la casa, sin gastar cupo.'
                    : 'Es lo máximo que podés cargarle a tus jugadores. Para más, comprale cupo al dueño.'}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
                <Dato titulo="Cargado hoy" valor={bs(data.hoy.total)} color="#7ee08a" chico />
                <Dato titulo="Cargas de hoy" valor={bs(data.hoy.cargas)} chico />
                <Dato titulo="Tus jugadores" valor={bs(data.players.length)} chico />
                <Dato titulo="Tu comisión" valor={`${data.cashier.commission_pct || 0}%`} chico
                      detalle="descuento al comprar cupo" />
              </div>

              {/* Cargar saldo */}
              <div style={S.card}>
                <div style={S.titulo}>CARGARLE SALDO A UN JUGADOR</div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
                  Confirmá que la transferencia te llegó de verdad antes de cargar. Esto descuenta de tu cupo al instante.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, alignItems: 'end' }}>
                  <Campo label="USUARIO DEL JUGADOR">
                    <input style={S.input} placeholder="como se llama en la web" value={username}
                           autoCapitalize="none" autoCorrect="off"
                           onChange={(e) => setUsername(e.target.value)} />
                  </Campo>
                  <Campo label="MONTO (Bs)">
                    <input style={S.input} type="number" min="1" inputMode="numeric" placeholder="500"
                           value={amount} onChange={(e) => setAmount(e.target.value)} />
                  </Campo>
                  <Campo label="NOTA (opcional)">
                    <input style={S.input} placeholder="ej: referencia 0234"
                           value={note} onChange={(e) => setNote(e.target.value)} />
                  </Campo>
                  <Boton tono="verde" disabled={!username.trim() || monto <= 0 || !alcanza || enviando}
                         onClick={() => setConfirmar(true)}>
                    {enviando ? '...' : '+ CARGAR SALDO'}
                  </Boton>
                </div>
                {monto > 0 && !alcanza && (
                  <div style={{ marginTop: 10, color: '#ff9a9a', fontSize: 14 }}>
                    No te alcanza el cupo: tenés {bs(cupo)} Bs y querés cargar {bs(monto)} Bs.
                  </div>
                )}
                {monto > 0 && alcanza && !esDueno && (
                  <div style={{ marginTop: 10, color: '#aaa', fontSize: 14 }}>
                    Después de esta carga te quedarían <b style={{ color: '#ffd84a' }}>{bs(cupo - monto)}</b> Bs de cupo.
                  </div>
                )}
              </div>

              <Confirmar
                abierto={confirmar}
                titulo="Confirmar carga"
                texto={`¿Cargarle ${bs(monto)} Bs a "${username.trim().toLowerCase()}"? Verificá que ya recibiste esa plata: esto no se puede deshacer solo.`}
                onSi={cargarSaldo}
                onNo={() => setConfirmar(false)}
                textoSi="SÍ, CARGAR"
              />

              {/* Mis jugadores */}
              <div style={S.card}>
                <div style={S.titulo}>TUS JUGADORES ({data.players.length})</div>
                <Tabla columnas={['JUGADOR', 'TELÉFONO', 'SALDO', 'LE CARGASTE', 'DESDE']}
                       vacio="Todavía no le cargaste a nadie. El primero que cargues queda como tuyo.">
                  {data.players.map((p) => (
                    <tr key={p.id}>
                      <td style={{ ...S.td, fontWeight: 700 }}>{p.username}</td>
                      <td style={{ ...S.td, color: '#aaa', fontSize: 13 }}>{p.phone || '—'}</td>
                      <td style={{ ...S.td, color: '#ffd84a', fontWeight: 900 }}>{bs(p.balance)}</td>
                      <td style={S.td}>{bs(p.total_recargado)}</td>
                      <td style={{ ...S.td, color: '#888', fontSize: 12 }}>{fecha(p.created_at, false)}</td>
                    </tr>
                  ))}
                </Tabla>
              </div>

              {/* Movimientos de cupo */}
              <div style={S.card}>
                <div style={S.titulo}>TUS MOVIMIENTOS</div>
                <Tabla columnas={['FECHA', 'MOVIMIENTO', 'CUPO', 'PAGASTE', 'JUGADOR', 'NOTA']} vacio="Sin movimientos">
                  {data.ledger.map((l) => {
                    const [txt, color] = LTIPO[l.type] || [l.type, '#aaa'];
                    return (
                      <tr key={l.id}>
                        <td style={{ ...S.td, fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>{fecha(l.created_at)}</td>
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
          )}
        </div>
      </div>
    );
  }

  window.CashierPanel = CashierPanel;
})();
