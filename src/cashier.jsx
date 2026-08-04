// Panel del banquero — expone window.CashierPanel
// Props: { user, onExit(), onLogout() }
//
// La ventanilla del banquero: aprueba las recargas de sus afiliados (salen de
// su cupo), paga sus retiros (las fichas vuelven a su cupo), les carga saldo
// a mano y reparte su código para sumar afiliados.
(function () {
  const { useState, useEffect, useCallback } = React;
  const U = window.UI;
  const { bs, plata, fecha, styles: S, Boton, Aviso, Dato, Encabezado, Tabla, Estado,
          Confirmar, Campo, nombreMetodo } = U;

  function CashierPanel({ user, onExit, onLogout }) {
    const [data, setData] = useState(null);
    const [recargas, setRecargas] = useState([]);
    const [retiros, setRetiros] = useState([]);
    const [msg, setMsg] = useState(null);
    const [username, setUsername] = useState('');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [confirmar, setConfirmar] = useState(false);
    const [enviando, setEnviando] = useState(false);
    // Acción sobre una solicitud: { tipo: 'ap-rec'|'rej-rec'|'pago-ret'|'rej-ret', item }
    const [accion, setAccion] = useState(null);
    const [nota, setNota] = useState('');

    const cargar = useCallback(async () => {
      try {
        const [d, t, w] = await Promise.all([
          window.Api.cashierSummary(),
          window.Api.cashierTopups('pending'),
          window.Api.cashierWithdrawals('pending'),
        ]);
        setData(d);
        setRecargas(t.topups || []);
        setRetiros(w.withdrawals || []);
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
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
    const cupoBajo = data && !esDueno && cupo < (data.cupo_alert || 0);

    const cargarSaldo = async () => {
      setConfirmar(false);
      setEnviando(true);
      try {
        const res = await window.Api.cashierLoad(username.trim().toLowerCase(), monto, note.trim() || undefined);
        setMsg({
          kind: 'ok',
          text: `Listo: ${res.player.username} quedó con ${plata(res.player.balance)}.` +
                (esDueno ? '' : ` Te quedan ${plata(res.credit_balance)} de cupo.`),
        });
        setUsername(''); setAmount(''); setNote('');
        cargar();
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
      finally { setEnviando(false); }
    };

    const ejecutarAccion = async () => {
      if (!accion) return;
      setEnviando(true);
      try {
        const { tipo, item } = accion;
        if (tipo === 'ap-rec') {
          const res = await window.Api.cashierApproveTopup(item.id);
          setMsg({ kind: 'ok', text: `Recarga acreditada: ${item.username} quedó con ${plata(res.player.balance)}. Te quedan ${bs(res.credit_balance)} de cupo.` });
        } else if (tipo === 'rej-rec') {
          if (!nota.trim()) { setMsg({ kind: 'err', text: 'Poné el motivo del rechazo' }); setEnviando(false); return; }
          await window.Api.cashierRejectTopup(item.id, nota.trim());
          setMsg({ kind: 'ok', text: 'Recarga rechazada. El jugador va a ver el motivo.' });
        } else if (tipo === 'pago-ret') {
          const res = await window.Api.cashierPayWithdrawal(item.id, nota.trim() || undefined);
          setMsg({ kind: 'ok', text: `Retiro pagado. Esas fichas volvieron a la casa, no a tu cupo: te quedan ${plata(res.credit_balance)} para cargar.` });
        } else if (tipo === 'rej-ret') {
          if (!nota.trim()) { setMsg({ kind: 'err', text: 'Poné el motivo del rechazo' }); setEnviando(false); return; }
          await window.Api.cashierRejectWithdrawal(item.id, nota.trim());
          setMsg({ kind: 'ok', text: 'Retiro rechazado. El saldo le volvió al jugador.' });
        }
        setAccion(null); setNota('');
        cargar();
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
      finally { setEnviando(false); }
    };

    const LTIPO = {
      purchase: ['Compraste fichas', '#7ee08a'],
      load: ['Cargaste a jugador', '#5ab8ff'],
      withdrawal_refill: ['Pagaste un retiro (cupo devuelto)', '#ffa04a'],
      withdrawal_paid: ['Pagaste un retiro · las fichas vuelven a la casa', '#ffa04a'],
      adjust: ['Ajuste de la casa', '#c9a0ff'],
    };

    return (
      <div style={{ ...S.page, ...U.paleta('socio') }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <Encabezado
            titulo="🎟 BANCA"
            rol="socio"
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
              {/* Aviso de cupo bajo: sin fichas no puede vender. */}
              {cupoBajo && (
                <div style={{
                  padding: '12px 16px', borderRadius: 8, fontSize: 15,
                  background: 'rgba(180,16,26,0.18)', border: '1px solid #b8101a', color: '#ffc9c9',
                }}>
                  ⚠️ Te quedan <b>{plata(cupo)}</b> de fichas. Comprale a la casa antes de quedarte
                  sin poder vender.
                </div>
              )}

              {/* Cupo disponible: el número más importante de esta pantalla. */}
              <div style={{
                ...S.card,
                background: 'var(--fondo-destacado, linear-gradient(180deg, #2a2008, #140d02))',
                textAlign: 'center', padding: '24px 16px',
              }}>
                <div style={{ fontSize: 12, color: '#999', letterSpacing: 2 }}>TUS FICHAS DISPONIBLES</div>
                <div style={{ fontSize: 44, fontWeight: 900, color: '#ffd84a', lineHeight: 1.2 }}>
                  {esDueno ? 'SIN LÍMITE' : bs(cupo)}
                </div>
                <div style={{ fontSize: 13, color: '#888' }}>
                  {esDueno
                    ? 'Como dueño cargás directo de la casa, sin gastar fichas.'
                    : 'Es lo máximo que podés venderle a tus jugadores. Las fichas no se devuelven a la casa: se revenden.'}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                <Dato titulo="Recargas por aprobar" valor={bs(data.pendientes.recargas)} chico
                      color={data.pendientes.recargas > 0 ? '#ffd84a' : undefined} />
                <Dato titulo="Retiros por pagar" valor={bs(data.pendientes.retiros)} chico
                      color={data.pendientes.retiros > 0 ? '#ff9a9a' : undefined}
                      detalle={data.pendientes.retiros > 0 ? `${plata(data.pendientes.retiros_monto)}` : undefined} />
                <Dato titulo="Vendido hoy" valor={bs(data.hoy.total)} color="#7ee08a" chico />
                <Dato titulo="Tus afiliados" valor={bs(data.players.length)} chico />
              </div>

              {/* Código de referencia: lo que reparte para sumar afiliados. */}
              {data.cashier.referral_code && (
                <CodigoDeReferencia codigo={data.cashier.referral_code} setMsg={setMsg} />
              )}

              {/* Recargas por aprobar */}
              <div style={S.card}>
                <div style={S.titulo}>RECARGAS POR APROBAR ({recargas.length})</div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
                  Tu afiliado dice que te pagó. Verificá la referencia en tu cuenta antes de aprobar:
                  al aprobar, las fichas salen de tu cupo y entran a su saldo.
                </div>
                <Tabla columnas={['FECHA', 'JUGADOR', 'MONTO', 'MÉTODO', 'REFERENCIA', '']}
                       vacio="Nadie está esperando una recarga.">
                  {recargas.map((t) => (
                    <tr key={t.id}>
                      <td style={{ ...S.td, fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>{fecha(t.created_at)}</td>
                      <td style={S.td}>
                        <div style={{ fontWeight: 700 }}>
                          {[t.first_name, t.last_name].filter(Boolean).join(' ') || t.username}
                        </div>
                        <div style={{ fontSize: 11, color: '#888' }}>{t.username}</div>
                      </td>
                      <td style={{ ...S.td, color: '#ffd84a', fontWeight: 900 }}>{bs(t.amount)}</td>
                      <td style={S.td}>{nombreMetodo(t.method)}</td>
                      <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 13 }}>{t.reference}</td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Boton chico tono="verde" onClick={() => { setAccion({ tipo: 'ap-rec', item: t }); setNota(''); }}>APROBAR</Boton>
                          <Boton chico tono="rojo" onClick={() => { setAccion({ tipo: 'rej-rec', item: t }); setNota(''); }}>RECHAZAR</Boton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </Tabla>
              </div>

              {/* Retiros por pagar */}
              <div style={S.card}>
                <div style={S.titulo}>RETIROS POR PAGAR ({retiros.length})</div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
                  Le pagás de tu bolsillo a donde diga, y esas fichas vuelven a tu cupo para revenderlas.
                  Mientras espera, el saldo del jugador está congelado.
                </div>
                <Tabla columnas={['FECHA', 'JUGADOR', 'MONTO', 'PAGARLE A', '']}
                       vacio="Nadie está esperando un retiro.">
                  {retiros.map((w) => (
                    <tr key={w.id}>
                      <td style={{ ...S.td, fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>{fecha(w.created_at)}</td>
                      <td style={S.td}>
                        <div style={{ fontWeight: 700 }}>
                          {[w.first_name, w.last_name].filter(Boolean).join(' ') || w.username}
                        </div>
                        <div style={{ fontSize: 11, color: '#888' }}>
                          {w.username}{w.cedula ? ` · ${w.cedula}` : ''}
                        </div>
                      </td>
                      <td style={{ ...S.td, color: '#ffd84a', fontWeight: 900 }}>{bs(w.amount)}</td>
                      <td style={S.td}>
                        <div style={{ fontSize: 13 }}>{nombreMetodo(w.method)}</div>
                        <div style={{ fontFamily: 'monospace', fontSize: 13, color: '#7ee08a' }}>{w.destination}</div>
                      </td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <Boton chico tono="verde" onClick={() => { setAccion({ tipo: 'pago-ret', item: w }); setNota(''); }}>PAGAR</Boton>
                          <Boton chico tono="rojo" onClick={() => { setAccion({ tipo: 'rej-ret', item: w }); setNota(''); }}>RECHAZAR</Boton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </Tabla>
              </div>

              {/* Carga a mano (el afiliado le pagó en persona, sin pasar por la web) */}
              <div style={S.card}>
                <div style={S.titulo}>CARGARLE SALDO A UN JUGADOR</div>
                <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
                  Para cuando te pagan directo (sin pedirlo por la web). Confirmá que la plata te
                  llegó antes de cargar: esto descuenta de tus fichas al instante.
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, alignItems: 'end' }}>
                  <Campo label="USUARIO DEL JUGADOR">
                    <input style={S.input} placeholder="como se llama en la web" value={username}
                           autoCapitalize="none" autoCorrect="off"
                           onChange={(e) => setUsername(e.target.value)} />
                  </Campo>
                  <Campo label={`MONTO (${U.simbolo()})`}>
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
                    No te alcanzan las fichas: tenés {bs(cupo)} y querés cargar {bs(monto)}.
                  </div>
                )}
              </div>

              <Confirmar
                abierto={confirmar}
                titulo="Confirmar carga"
                texto={`¿Cargarle ${plata(monto)} a "${username.trim().toLowerCase()}"? Verificá que ya recibiste esa plata: esto no se puede deshacer solo.`}
                onSi={cargarSaldo}
                onNo={() => setConfirmar(false)}
                textoSi="SÍ, CARGAR"
              />

              {/* Datos de cobro que ven sus afiliados */}
              {!esDueno && (
                <DatosDeCobro
                  actual={data.cashier.collect_details || data.cashier.payout_details || ''}
                  setMsg={setMsg}
                  onGuardado={cargar}
                />
              )}

              {/* Sus afiliados */}
              <div style={S.card}>
                <div style={S.titulo}>TUS AFILIADOS ({data.players.length})</div>
                <Tabla columnas={['JUGADOR', 'TELÉFONO', 'SALDO', 'LE VENDISTE', 'DESDE']}
                       vacio="Todavía no tenés afiliados. Repartí tu código o tu enlace.">
                  {data.players.map((p) => (
                    <tr key={p.id}>
                      <td style={S.td}>
                        <div style={{ fontWeight: 700 }}>
                          {[p.first_name, p.last_name].filter(Boolean).join(' ') || p.username}
                        </div>
                        <div style={{ fontSize: 11, color: '#888' }}>{p.username}</div>
                      </td>
                      <td style={{ ...S.td, color: '#aaa', fontSize: 13 }}>{p.phone || '—'}</td>
                      <td style={{ ...S.td, color: '#ffd84a', fontWeight: 900 }}>{bs(p.balance)}</td>
                      <td style={S.td}>{bs(p.total_recargado)}</td>
                      <td style={{ ...S.td, color: '#888', fontSize: 12 }}>{fecha(p.created_at, false)}</td>
                    </tr>
                  ))}
                </Tabla>
              </div>

              {/* Movimientos de fichas */}
              <div style={S.card}>
                <div style={S.titulo}>TUS MOVIMIENTOS</div>
                <Tabla columnas={['FECHA', 'MOVIMIENTO', 'FICHAS', 'PAGASTE', 'JUGADOR', 'NOTA']} vacio="Sin movimientos">
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

          {/* Ventana de acción sobre una solicitud */}
          {accion && (
            <div onClick={() => setAccion(null)} style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 999,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
            }}>
              <div onClick={(e) => e.stopPropagation()} style={{ ...S.card, maxWidth: 440, width: '100%' }}>
                <div style={S.titulo}>
                  {accion.tipo === 'ap-rec' && 'APROBAR RECARGA'}
                  {accion.tipo === 'rej-rec' && 'RECHAZAR RECARGA'}
                  {accion.tipo === 'pago-ret' && 'CONFIRMAR PAGO DEL RETIRO'}
                  {accion.tipo === 'rej-ret' && 'RECHAZAR RETIRO'}
                  {' — '}{accion.item.username}
                </div>

                <div style={{
                  fontSize: 15, color: '#ddd', marginBottom: 14, lineHeight: 1.6,
                  background: 'rgba(0,0,0,0.35)', padding: 12, borderRadius: 6,
                }}>
                  <b style={{ color: '#ffd84a', fontSize: 20 }}>{plata(accion.item.amount)}</b>
                  {accion.tipo === 'ap-rec' || accion.tipo === 'rej-rec' ? (
                    <div style={{ fontSize: 13 }}>
                      {nombreMetodo(accion.item.method)} · ref{' '}
                      <b style={{ fontFamily: 'monospace' }}>{accion.item.reference}</b>
                    </div>
                  ) : (
                    <div style={{ fontSize: 13 }}>
                      {nombreMetodo(accion.item.method)} a{' '}
                      <b style={{ fontFamily: 'monospace' }}>{accion.item.destination}</b>
                    </div>
                  )}
                </div>

                {accion.tipo === 'ap-rec' && (
                  <div style={{ fontSize: 13, color: '#ffc9c9', marginBottom: 12 }}>
                    Aprobá solo si la plata YA está en tu cuenta. Se descuentan {bs(accion.item.amount)} de tus fichas.
                  </div>
                )}
                {accion.tipo === 'pago-ret' && (
                  <div style={{ fontSize: 13, color: '#ffc9c9', marginBottom: 12 }}>
                    Confirmá solo después de haberle pagado de verdad. Ojo: <b>estas fichas
                    NO vuelven a tu cupo</b> — vuelven a la casa. Para seguir cargando saldo
                    vas a tener que comprar cupo de nuevo.
                  </div>
                )}
                {(accion.tipo === 'rej-rec' || accion.tipo === 'rej-ret') && (
                  <Campo label="MOTIVO (lo ve el jugador)">
                    <input style={S.input} placeholder="ej: no aparece esa referencia"
                           value={nota} onChange={(e) => setNota(e.target.value)} />
                  </Campo>
                )}
                {accion.tipo === 'pago-ret' && (
                  <Campo label="NOTA (opcional)">
                    <input style={S.input} placeholder="ej: referencia del pago"
                           value={nota} onChange={(e) => setNota(e.target.value)} />
                  </Campo>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
                  <Boton tono="gris" onClick={() => setAccion(null)}>CANCELAR</Boton>
                  <Boton tono={accion.tipo.startsWith('rej') ? 'rojo' : 'verde'}
                         onClick={ejecutarAccion} disabled={enviando}>
                    {enviando ? '...' :
                      accion.tipo === 'ap-rec' ? 'ACREDITAR' :
                      accion.tipo === 'pago-ret' ? 'YA LE PAGUÉ' : 'RECHAZAR'}
                  </Boton>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Datos de cobro del banquero: lo que ven sus afiliados al recargar.
  function DatosDeCobro({ actual, setMsg, onGuardado }) {
    const [texto, setTexto] = useState(actual);
    const [guardando, setGuardando] = useState(false);

    const guardar = async () => {
      setGuardando(true);
      try {
        await window.Api.cashierSetCollectInfo(texto.trim());
        setMsg({ kind: 'ok', text: 'Datos de cobro guardados. Es lo que ven tus afiliados al recargar.' });
        onGuardado();
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
      finally { setGuardando(false); }
    };

    return (
      <div style={S.card}>
        <div style={S.titulo}>TUS DATOS DE COBRO</div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
          Esto es lo que ve tu afiliado cuando quiere recargar: tu Pago Móvil, cuenta o usuario P2P.
          Escribilo como se lo dictarías por teléfono.
        </div>
        <textarea
          style={{ ...S.input, minHeight: 80, resize: 'vertical', fontFamily: 'monospace' }}
          placeholder={'Ej:\nPago Móvil: 0134 Banesco · V-12.345.678 · 0414-1234567\nP2P: usuario Binance maria_vzla'}
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <div style={{ marginTop: 10 }}>
          <Boton tono="verde" chico onClick={guardar} disabled={guardando || !texto.trim()}>
            {guardando ? '...' : 'GUARDAR DATOS'}
          </Boton>
        </div>
      </div>
    );
  }

  // Código de referencia y enlace para repartir. Quien entre por acá queda
  // adjudicado a la cuenta de este banquero.
  function CodigoDeReferencia({ codigo, setMsg }) {
    const enlace = `${window.location.origin}/?ref=${codigo}`;

    const copiar = (texto, que) => {
      const ok = () => setMsg({ kind: 'ok', text: `${que} copiado. Ya lo podés pegar donde quieras.` });
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(texto).then(ok).catch(() => {});
      } else {
        const t = document.createElement('textarea');
        t.value = texto; document.body.appendChild(t); t.select();
        try { document.execCommand('copy'); ok(); } catch (e) { /* nada */ }
        document.body.removeChild(t);
      }
    };

    return (
      <div style={{ ...S.card, background: 'linear-gradient(180deg, #12200f, #080f06)', borderColor: '#2a8a2a' }}>
        <div style={{ ...S.titulo, color: '#9ff0a0' }}>TU CÓDIGO PARA SUMAR AFILIADOS</div>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{
            fontSize: 32, fontWeight: 900, letterSpacing: 3, color: 'var(--acento, #d4a94a)',
            fontFamily: 'monospace', background: 'rgba(0,0,0,0.4)',
            padding: '8px 18px', borderRadius: 8, border: '1px dashed var(--borde, #8b6a20)',
          }}>{codigo}</div>
          <Boton chico tono="gris" onClick={() => copiar(codigo, 'El código')}>COPIAR CÓDIGO</Boton>
          <Boton chico tono="verde" onClick={() => copiar(enlace, 'El enlace')}>COPIAR ENLACE</Boton>
        </div>
        <div style={{
          marginTop: 12, fontSize: 12, color: '#9a9a9a', fontFamily: 'monospace',
          wordBreak: 'break-all', background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: 6,
        }}>{enlace}</div>
        <div style={{ fontSize: 12, color: '#888', marginTop: 10, lineHeight: 1.6 }}>
          Mandá el enlace por WhatsApp: quien se registre por ahí queda como afiliado tuyo, sin
          tener que escribir nada. Si prefieren entrar solos, que pongan el código en el registro.
        </div>
      </div>
    );
  }

  window.CashierPanel = CashierPanel;
})();
