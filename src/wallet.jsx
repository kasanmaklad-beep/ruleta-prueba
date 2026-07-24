// Billetera del jugador — expone window.WalletPanel
// Props: { user, onExit(), onLogout(), onBalance(balance) }
//
// Tres cosas: recargar (informando una transferencia ya hecha), retirar
// (queda esperando que el dueño lo apruebe) y ver el propio historial.
(function () {
  const { useState, useEffect, useCallback } = React;
  const U = window.UI;
  const { bs, fecha, styles: S, Boton, Aviso, Dato, Encabezado, Pestanas,
          Tabla, Estado, Campo, METODOS, nombreMetodo } = U;

  function WalletPanel({ user, onExit, onLogout, onBalance }) {
    const [tab, setTab] = useState('recargar');
    const [info, setInfo] = useState(null);
    const [hist, setHist] = useState(null);
    const [msg, setMsg] = useState(null);

    const cargar = useCallback(async () => {
      try {
        const [i, h] = await Promise.all([window.Api.walletInfo(), window.Api.walletHistory()]);
        setInfo(i); setHist(h);
        if (onBalance && i.user) onBalance(i.user.balance);
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
    }, [onBalance]);

    useEffect(() => { cargar(); }, [cargar]);

    useEffect(() => {
      if (msg && msg.kind === 'ok') {
        const t = setTimeout(() => setMsg(null), 9000);
        return () => clearTimeout(t);
      }
    }, [msg]);

    const pendientes = hist
      ? (hist.topups.filter((t) => t.status === 'pending').length +
         hist.withdrawals.filter((w) => w.status === 'pending').length)
      : 0;

    return (
      <div style={S.page}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <Encabezado
            titulo="💰 MI BILLETERA"
            subtitulo={user.username}
            acciones={<>
              <Boton tono="gris" onClick={onExit}>← VOLVER AL JUEGO</Boton>
              {onLogout && <Boton tono="gris" onClick={onLogout}>SALIR</Boton>}
            </>}
          />

          {info && (
            <div style={{
              ...S.card, marginBottom: 16, textAlign: 'center',
              background: 'linear-gradient(180deg, #2a2008, #140d02)',
            }}>
              <div style={{ fontSize: 12, color: '#999', letterSpacing: 2 }}>SALDO PARA JUGAR</div>
              <div style={{ fontSize: 42, fontWeight: 900, color: '#ffd84a', lineHeight: 1.2 }}>
                {bs(info.disponible)}
              </div>
              <div style={{ fontSize: 13, color: '#888' }}>bolívares</div>
              {info.user.held_balance > 0 && (
                <div style={{
                  marginTop: 10, fontSize: 13, color: '#ffa04a',
                  background: 'rgba(255,160,74,0.12)', padding: '8px 12px', borderRadius: 6,
                }}>
                  Tenés {bs(info.user.held_balance)} Bs retenidos por un retiro que está en revisión.
                </div>
              )}
            </div>
          )}

          <Pestanas
            tabs={[
              { id: 'recargar', label: 'RECARGAR' },
              { id: 'retirar', label: 'RETIRAR' },
              { id: 'movimientos', label: 'MIS MOVIMIENTOS', badge: pendientes },
            ]}
            activa={tab}
            onChange={setTab}
          />

          <Aviso msg={msg} onClose={() => setMsg(null)} />

          {!info && <div style={{ color: '#888' }}>Cargando…</div>}

          {info && tab === 'recargar' && (
            <FormRecarga info={info} setMsg={setMsg} onHecho={() => { cargar(); setTab('movimientos'); }} />
          )}
          {info && tab === 'retirar' && (
            <FormRetiro info={info} setMsg={setMsg} onHecho={() => { cargar(); setTab('movimientos'); }} />
          )}
          {info && tab === 'movimientos' && <Movimientos hist={hist} />}
        </div>
      </div>
    );
  }

  // ─────────────────────────── Recargar ───────────────────────────────────

  function FormRecarga({ info, setMsg, onHecho }) {
    const [metodo, setMetodo] = useState('pago_movil');
    const [monto, setMonto] = useState('');
    const [referencia, setReferencia] = useState('');
    const [enviando, setEnviando] = useState(false);

    const esDivisa = metodo === 'zelle' || metodo === 'binance';
    const tasa = info.limites.rate_usd;
    const mult = info.limites.monto_multiplo || 1;
    // En divisa la conversión se redondea para arriba: la diferencia la pone la casa.
    const enBs = esDivisa
      ? (mult > 1
          ? Math.ceil(Math.round((Number(monto) || 0) * tasa) / mult) * mult
          : Math.round((Number(monto) || 0) * tasa))
      : (Number(monto) || 0);
    const multiploOk = esDivisa || mult <= 1 || enBs % mult === 0;
    const datosCuenta = info.cuentas[metodo];

    const enviar = async () => {
      setEnviando(true);
      try {
        const body = esDivisa
          ? { method: metodo, amount_fx: Number(monto), reference: referencia.trim() }
          : { method: metodo, amount: Number(monto), reference: referencia.trim() };
        await window.Api.createTopup(body);
        setMsg({
          kind: 'ok',
          text: `Listo. Tu recarga de ${bs(enBs)} Bs quedó esperando revisión. Apenas verifiquemos la transferencia te acreditamos el saldo.`,
        });
        setMonto(''); setReferencia('');
        onHecho();
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
      finally { setEnviando(false); }
    };

    const listo = enBs >= info.limites.min_topup && referencia.trim().length > 0 && multiploOk;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={S.card}>
          <div style={S.titulo}>1. ELEGÍ CÓMO VAS A PAGAR</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
            {METODOS.map(([id, label]) => (
              <button
                key={id}
                onClick={() => { setMetodo(id); setMonto(''); }}
                style={{
                  padding: '12px 8px', borderRadius: 8, cursor: 'pointer',
                  fontFamily: 'Georgia, serif', fontSize: 14, fontWeight: 700,
                  border: `2px solid ${metodo === id ? U.GOLD : '#3a2a10'}`,
                  background: metodo === id ? 'rgba(212,169,74,0.18)' : 'rgba(0,0,0,0.3)',
                  color: metodo === id ? U.GOLD : '#999',
                }}
              >{label}</button>
            ))}
          </div>
        </div>

        <div style={S.card}>
          <div style={S.titulo}>2. TRANSFERÍ A ESTA CUENTA</div>
          <div style={{
            background: 'rgba(0,0,0,0.45)', border: '1px dashed #8b6a20', borderRadius: 8,
            padding: 14, fontSize: 16, color: '#7ee08a', whiteSpace: 'pre-wrap',
            fontFamily: 'monospace', lineHeight: 1.6, wordBreak: 'break-word',
          }}>
            {datosCuenta || 'El administrador todavía no cargó los datos de esta cuenta.'}
          </div>
          {esDivisa && (
            <div style={{ fontSize: 13, color: '#aaa', marginTop: 10 }}>
              Tasa de hoy: <b style={{ color: '#ffd84a' }}>{tasa} Bs por dólar</b>.
            </div>
          )}
        </div>

        <div style={S.card}>
          <div style={S.titulo}>3. CONTANOS QUÉ MANDASTE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Campo label={esDivisa ? 'CUÁNTO MANDASTE (dólares)' : 'CUÁNTO MANDASTE (bolívares)'}>
              <input style={S.input} type="number" inputMode="decimal" min="0"
                     step={esDivisa ? 'any' : mult}
                     placeholder={esDivisa ? '20' : String(Math.max(info.limites.min_topup, mult))}
                     value={monto} onChange={(e) => setMonto(e.target.value)} />
              {!esDivisa && mult > 1 && (
                <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                  En múltiplos de {bs(mult)} (ej: {bs(mult * 5)}, {bs(mult * 10)}, {bs(mult * 20)}).
                </div>
              )}
            </Campo>
            {esDivisa && enBs > 0 && (
              <div style={{ fontSize: 15, color: '#ddd' }}>
                Se te acreditarían <b style={{ color: '#ffd84a' }}>{bs(enBs)} Bs</b>.
              </div>
            )}
            {!multiploOk && enBs > 0 && (
              <div style={{ color: '#ff9a9a', fontSize: 14 }}>
                Los montos van en múltiplos de {bs(mult)}. Probá con {bs(Math.floor(enBs / mult) * mult)} o {bs((Math.floor(enBs / mult) + 1) * mult)}.
              </div>
            )}
            <Campo label="NÚMERO DE REFERENCIA">
              <input style={S.input} placeholder="el número que te dio el banco"
                     value={referencia} onChange={(e) => setReferencia(e.target.value)} />
            </Campo>
            {enBs > 0 && enBs < info.limites.min_topup && (
              <div style={{ color: '#ff9a9a', fontSize: 14 }}>
                La recarga mínima es {bs(info.limites.min_topup)} Bs.
              </div>
            )}
            <Boton tono="verde" disabled={!listo || enviando} onClick={enviar}>
              {enviando ? 'ENVIANDO...' : 'YA TRANSFERÍ, AVISAR'}
            </Boton>
            <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>
              El saldo entra cuando verificamos la transferencia en el banco. Si el número de referencia está mal,
              la recarga se rechaza.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────── Retirar ────────────────────────────────────

  function FormRetiro({ info, setMsg, onHecho }) {
    const u = info.user;
    const [monto, setMonto] = useState('');
    const [metodo, setMetodo] = useState(u.payout_method || 'pago_movil');
    // Ya cargó banco y teléfono al registrarse: se le proponen armados.
    const [destino, setDestino] = useState(
      u.payout_details || [u.bank, u.phone].filter(Boolean).join(' ') || ''
    );
    const [cedula, setCedula] = useState(u.cedula || '');
    const [enviando, setEnviando] = useState(false);

    const m = Number(monto) || 0;
    const faltaJugar = info.juego.falta;
    const mult = info.limites.monto_multiplo || 1;
    const multiploOk = mult <= 1 || m % mult === 0;

    const enviar = async () => {
      setEnviando(true);
      try {
        await window.Api.createWithdrawal({
          amount: m, method: metodo, destination: destino.trim(), cedula: cedula.trim(),
        });
        setMsg({
          kind: 'ok',
          text: `Pedido de retiro por ${bs(m)} Bs enviado. Ese saldo te queda retenido hasta que lo revisemos y te paguemos.`,
        });
        setMonto('');
        onHecho();
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
      finally { setEnviando(false); }
    };

    const listo = m >= info.limites.min_withdrawal && m <= info.disponible
      && destino.trim() && cedula.trim() && faltaJugar === 0 && multiploOk;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {faltaJugar > 0 && (
          <div style={{
            ...S.card, borderColor: '#b8101a',
            background: 'linear-gradient(180deg, #2a1010, #140606)',
          }}>
            <div style={{ color: '#ff9a9a', fontWeight: 900, marginBottom: 8 }}>
              Todavía no podés retirar
            </div>
            <div style={{ color: '#ddd', fontSize: 15, lineHeight: 1.6 }}>
              Para retirar hay que jugar al menos el {info.limites.wager_pct_required}% de lo que recargaste.
              Llevás apostado <b>{bs(info.juego.jugado)}</b> de <b>{bs(info.juego.requerido)}</b> Bs.
              Te faltan <b style={{ color: '#ffd84a' }}>{bs(faltaJugar)}</b> Bs de apuestas.
            </div>
          </div>
        )}

        <div style={S.card}>
          <div style={S.titulo}>PEDIR UN RETIRO</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Campo label="CUÁNTO QUERÉS RETIRAR (Bs)">
              <input style={S.input} type="number" inputMode="numeric" min="0" step={mult}
                     placeholder={String(info.limites.min_withdrawal)}
                     value={monto} onChange={(e) => setMonto(e.target.value)} />
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                Disponible: {bs(info.disponible)} Bs · Mínimo: {bs(info.limites.min_withdrawal)} Bs
                {mult > 1 && ` · En múltiplos de ${bs(mult)}`}
              </div>
            </Campo>

            <Campo label="CÓMO QUERÉS COBRAR">
              <select style={S.input} value={metodo} onChange={(e) => setMetodo(e.target.value)}>
                {METODOS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
              </select>
            </Campo>

            <Campo label="A DÓNDE TE LO MANDAMOS">
              <input style={S.input}
                     placeholder={metodo === 'pago_movil' ? 'banco y teléfono' : metodo === 'zelle' ? 'tu correo de Zelle' : 'número de cuenta o usuario'}
                     value={destino} onChange={(e) => setDestino(e.target.value)} />
            </Campo>

            <Campo label="TU CÉDULA">
              <input style={S.input} placeholder="V12345678" value={cedula}
                     onChange={(e) => setCedula(e.target.value)} />
            </Campo>

            {m > info.disponible && (
              <div style={{ color: '#ff9a9a', fontSize: 14 }}>
                Solo tenés {bs(info.disponible)} Bs disponibles.
              </div>
            )}
            {m > 0 && m < info.limites.min_withdrawal && (
              <div style={{ color: '#ff9a9a', fontSize: 14 }}>
                El retiro mínimo es {bs(info.limites.min_withdrawal)} Bs.
              </div>
            )}
            {m > 0 && !multiploOk && (
              <div style={{ color: '#ff9a9a', fontSize: 14 }}>
                Los retiros van en múltiplos de {bs(mult)}. Probá con {bs(Math.floor(m / mult) * mult)} o {bs((Math.floor(m / mult) + 1) * mult)}.
              </div>
            )}

            <Boton tono="verde" disabled={!listo || enviando} onClick={enviar}>
              {enviando ? 'ENVIANDO...' : 'PEDIR RETIRO'}
            </Boton>
            <div style={{ fontSize: 12, color: '#888', lineHeight: 1.5 }}>
              Al pedirlo, ese saldo te queda retenido y no lo vas a poder jugar. Si el retiro se rechaza,
              te vuelve automáticamente.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────── Movimientos ────────────────────────────────

  const TIPO = {
    deposit:  ['Recarga', '#5ab8ff', '+'],
    bet:      ['Apuesta', '#ff9a9a', '−'],
    win:      ['Premio', '#7ee08a', '+'],
    withdraw: ['Retiro', '#ffa04a', '−'],
    adjust:   ['Ajuste', '#c9a0ff', ''],
  };

  function Movimientos({ hist }) {
    if (!hist) return <div style={{ color: '#888' }}>Cargando…</div>;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {hist.withdrawals.length > 0 && (
          <div style={S.card}>
            <div style={S.titulo}>MIS RETIROS</div>
            <Tabla columnas={['FECHA', 'MONTO', 'A DÓNDE', 'ESTADO']}>
              {hist.withdrawals.map((w) => (
                <tr key={w.id}>
                  <td style={{ ...S.td, fontSize: 12, color: '#888' }}>{fecha(w.created_at)}</td>
                  <td style={{ ...S.td, fontWeight: 900, color: '#ffd84a' }}>{bs(w.amount)}</td>
                  <td style={{ ...S.td, fontSize: 13 }}>
                    {nombreMetodo(w.method)}
                    <div style={{ fontSize: 11, color: '#888' }}>{w.destination}</div>
                  </td>
                  <td style={S.td}>
                    <Estado v={w.status} />
                    {w.status === 'rejected' && w.note && (
                      <div style={{ fontSize: 11, color: '#ff9a9a', marginTop: 3 }}>{w.note}</div>
                    )}
                  </td>
                </tr>
              ))}
            </Tabla>
          </div>
        )}

        {hist.topups.length > 0 && (
          <div style={S.card}>
            <div style={S.titulo}>MIS RECARGAS PEDIDAS</div>
            <Tabla columnas={['FECHA', 'MONTO', 'REFERENCIA', 'ESTADO']}>
              {hist.topups.map((t) => (
                <tr key={t.id}>
                  <td style={{ ...S.td, fontSize: 12, color: '#888' }}>{fecha(t.created_at)}</td>
                  <td style={{ ...S.td, fontWeight: 900, color: '#ffd84a' }}>
                    {bs(t.amount)}
                    {t.currency === 'USD' && (
                      <div style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>${t.amount_fx}</div>
                    )}
                  </td>
                  <td style={{ ...S.td, fontFamily: 'monospace', fontSize: 12 }}>{t.reference}</td>
                  <td style={S.td}>
                    <Estado v={t.status} />
                    {t.status === 'rejected' && t.note && (
                      <div style={{ fontSize: 11, color: '#ff9a9a', marginTop: 3 }}>{t.note}</div>
                    )}
                  </td>
                </tr>
              ))}
            </Tabla>
          </div>
        )}

        <div style={S.card}>
          <div style={S.titulo}>TODOS MIS MOVIMIENTOS</div>
          <Tabla columnas={['FECHA', 'TIPO', 'MONTO', 'DETALLE']} vacio="Todavía no tenés movimientos">
            {hist.transactions.map((t) => {
              const [txt, color, signo] = TIPO[t.type] || [t.type, '#aaa', ''];
              return (
                <tr key={t.id}>
                  <td style={{ ...S.td, fontSize: 12, color: '#888', whiteSpace: 'nowrap' }}>{fecha(t.created_at)}</td>
                  <td style={{ ...S.td, color, fontWeight: 700 }}>{txt}</td>
                  <td style={{ ...S.td, color, whiteSpace: 'nowrap' }}>
                    {t.type === 'adjust' ? (t.amount >= 0 ? '+' : '') : signo}{bs(t.amount)}
                  </td>
                  <td style={{ ...S.td, fontSize: 12, color: '#999' }}>{t.note || ''}</td>
                </tr>
              );
            })}
          </Tabla>
        </div>
      </div>
    );
  }

  window.WalletPanel = WalletPanel;
})();
