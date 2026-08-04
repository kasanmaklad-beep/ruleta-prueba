// Panel del ejecutivo — expone window.ExecPanel
// Props: { user, onExit(), onLogout() }
//
// El piso del medio: matriz → EJECUTIVO → banquero → jugador.
//
// El ejecutivo ARMA su red (crea sus banqueros), la MIRA, y REPARTE las fichas
// que la casa le entregó en consignación, llevando su cuenta: cuánto le queda
// y cuánto le debe a la matriz.
//
// Si algún día aparece acá un botón que cambie el saldo de un JUGADOR, está
// mal: cargar y pagar es del banquero, que es quien pone la cara y la plata.
(function () {
  const { useState, useEffect, useCallback } = React;
  const U = window.UI;
  const { plata, fecha, styles: S, Boton, Aviso, Dato, Encabezado, Tabla, Estado, Campo,
          Confirmar } = U;

  // Alta de un banquero propio. Los mismos campos que usa la matriz, MENOS la
  // participación en la ganancia: esa es plata de la casa y la fija el dueño,
  // no el ejecutivo. El banquero nace colgado de quien lo crea.
  function FormNuevoBanquero({ setMsg, onHecho }) {
    const vacio = {
      first_name: '', last_name: '', doc_type: 'V', cedula: '', phone: '',
      email: '', bank: '', username: '', password: '', commission_pct: '20',
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
        const res = await window.Api.execCreateCashier({
          ...f,
          commission_pct: Number(f.commission_pct),
          referral_code: f.referral_code.trim() || undefined,
        });
        setMsg({
          kind: 'ok',
          text: `Banquero ${res.cashier.username} creado y colgado de vos. `
              + `Su código de referencia es ${res.cashier.referral_code}: con ese código `
              + `sus jugadores le quedan adjudicados.`,
        });
        setF(vacio); setAbierto(false);
        onHecho();
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
      finally { setEnviando(false); }
    };

    if (!abierto) {
      return (
        <div style={S.card}>
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ ...S.titulo, marginBottom: 4 }}>TU RED</div>
              <div style={{ fontSize: 12, color: '#8f83b0', lineHeight: 1.6 }}>
                Los banqueros que crees acá quedan a tu cargo. Cada uno recibe un código de
                referencia para que sus jugadores le queden adjudicados.
              </div>
            </div>
            <Boton tono="verde" onClick={() => setAbierto(true)}>+ NUEVO BANQUERO</Boton>
          </div>
        </div>
      );
    }

    return (
      <div style={S.card}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: 12,
        }}>
          <div style={{ ...S.titulo, marginBottom: 0 }}>NUEVO BANQUERO</div>
          <Boton chico tono="gris" onClick={() => setAbierto(false)}>CANCELAR</Boton>
        </div>
        <form onSubmit={crear} style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12,
        }}>
          <Campo label="NOMBRE">
            <input style={S.input} value={f.first_name} onChange={set('first_name')} required />
          </Campo>
          <Campo label="APELLIDO">
            <input style={S.input} value={f.last_name} onChange={set('last_name')} required />
          </Campo>
          <Campo label="DOCUMENTO">
            <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 6 }}>
              <select style={S.input} value={f.doc_type} onChange={set('doc_type')}>
                {U.DOCS.map(([id]) => <option key={id} value={id}>{id}</option>)}
              </select>
              <input style={S.input} placeholder={U.ejemploDoc(f.doc_type)}
                     value={f.cedula} onChange={set('cedula')} required />
            </div>
          </Campo>
          <Campo label="TELÉFONO">
            <input style={S.input} placeholder="04141234567" value={f.phone}
                   onChange={set('phone')} required />
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
          <Campo label="TE PAGA EL (%) DE LAS FICHAS">
            <input style={S.input} type="number" min="1" max="100"
                   value={f.commission_pct} onChange={set('commission_pct')} required />
            <div style={{ fontSize: 11, color: '#8f83b0', marginTop: 4, lineHeight: 1.5 }}>
              Con {f.commission_pct || 0}% te paga {plata(Math.round(10000 * ((Number(f.commission_pct) || 0) / 100)))} por
              cada 10.000 de fichas. Lo típico es 20.
            </div>
          </Campo>
          <Campo label="CÓDIGO (opcional)">
            <input style={{ ...S.input, textTransform: 'uppercase' }}
                   placeholder="se genera solo" value={f.referral_code}
                   onChange={set('referral_code')} />
          </Campo>
          <div style={{ gridColumn: '1 / -1' }}>
            <Boton tono="verde" disabled={enviando}>
              {enviando ? 'CREANDO…' : 'CREAR BANQUERO'}
            </Boton>
          </div>
        </form>
      </div>
    );
  }

  // Entregarle cupo a un banquero propio. Es la operación que mueve la plata:
  // le salen fichas al ejecutivo, le entran al banquero, el banquero le paga en
  // el acto, y al ejecutivo le nace la deuda con la casa por esas fichas.
  function FormVenderCupo({ data, setMsg, onHecho }) {
    const [username, setUsername] = useState('');
    const [amount, setAmount] = useState('');
    const [confirmar, setConfirmar] = useState(false);
    const [enviando, setEnviando] = useState(false);

    const banqueros = (data && data.banqueros) || [];
    const yo = data && data.ejecutivo;
    const cupo = Number(amount) || 0;
    const elegido = banqueros.find((b) => b.username === username);
    // Lo que le va a cobrar y lo que va a quedar debiendo por esta venta.
    const cobra = elegido ? Math.round(cupo * ((elegido.commission_pct || 0) / 100)) : 0;
    // A sueldo debe TODO lo que cobra; por comisión, su porcentaje del valor.
    // Es la misma cuenta que hace el servidor: si acá mostrara otra cosa, el
    // ejecutivo confirmaría una venta creyendo que le queda un margen que no
    // existe.
    const debera = !yo ? 0
      : yo.exec_asalariado ? cobra
      : Math.round(cupo * ((yo.commission_pct || 0) / 100));
    const alcanza = yo && cupo > 0 && cupo <= (yo.credit_balance || 0);

    const vender = async () => {
      setConfirmar(false); setEnviando(true);
      try {
        const r = await window.Api.execVender(username, cupo);
        setMsg({
          kind: 'ok',
          text: `${r.banquero} recibió ${U.plata(r.entregado)} de cupo y te pagó ${U.plata(r.cobraste)}. `
              + `Te quedan ${U.plata(r.fichas)} y le debés ${U.plata(r.deuda)} a la casa.`,
        });
        setUsername(''); setAmount('');
        onHecho();
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
      finally { setEnviando(false); }
    };

    if (!banqueros.length) return null;

    return (
      <div style={S.card}>
        <div style={S.titulo}>ENTREGAR CUPO A UN BANQUERO</div>
        <div style={{
          display: 'grid', gap: 12, alignItems: 'end',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
        }}>
          <Campo label="BANQUERO">
            <select style={S.input} value={username} onChange={(e) => setUsername(e.target.value)}>
              <option value="">Elegí…</option>
              {banqueros.map((b) => (
                <option key={b.id} value={b.username}>
                  {b.username} · paga {b.commission_pct}%
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="CUPO A ENTREGAR">
            <input style={S.input} type="number" min="0" value={amount}
                   onChange={(e) => setAmount(e.target.value)} placeholder="0" />
          </Campo>
          <Boton tono="verde" disabled={!elegido || !alcanza || enviando}
                 onClick={() => setConfirmar(true)}>
            {enviando ? '...' : 'ENTREGAR'}
          </Boton>
        </div>

        {elegido && cupo > 0 && (
          <div style={{ marginTop: 12, fontSize: 14, color: '#d8ccff', lineHeight: 1.8 }}>
            {elegido.username} recibe <b style={{ color: '#c4b0ff' }}>{U.plata(cupo)}</b> de cupo
            y te paga <b style={{ color: '#7ee08a' }}>{U.plata(cobra)}</b>.
            {' '}Vos vas a deberle <b style={{ color: '#ffa04a' }}>{U.plata(debera)}</b> a la casa
            por esas fichas, así que te {cobra - debera > 0 ? 'quedan' : 'queda'}
            {' '}<b>{U.plata(cobra - debera)}</b>
            {yo && yo.exec_asalariado ? ' (cobrás a sueldo, no por venta)' : ''}.
            {!alcanza && (
              <div style={{ color: '#ffc9c9', marginTop: 6 }}>
                No te alcanza: tenés {U.plata((yo && yo.credit_balance) || 0)} sin repartir.
              </div>
            )}
          </div>
        )}

        <Confirmar
          abierto={confirmar}
          titulo="Confirmar entrega de cupo"
          texto={`¿Ya recibiste los ${U.plata(cobra)} de ${username}? Al confirmar le quedan `
               + `${U.plata(cupo)} de cupo para cargar a sus jugadores, y vos pasás a deber `
               + `${U.plata(debera)} más a la casa.`}
          onSi={vender}
          onNo={() => setConfirmar(false)}
          textoSi="SÍ, YA COBRÉ"
        />
      </div>
    );
  }

  function ExecPanel({ user, onExit, onLogout }) {
    const [data, setData] = useState(null);
    const [jugadores, setJugadores] = useState(null);
    const [verJugadores, setVerJugadores] = useState(false);
    const [msg, setMsg] = useState(null);

    const cargar = useCallback(async () => {
      try {
        setData(await window.Api.execSummary());
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
    }, []);

    useEffect(() => { cargar(); }, [cargar]);

    // Los jugadores se piden recién cuando los quiere ver: son de sus
    // banqueros, no suyos, y pueden ser muchos. Que la pantalla abra rápido
    // importa más que tenerlos cargados de antemano.
    const abrirJugadores = useCallback(async () => {
      setVerJugadores(true);
      if (jugadores) return;
      try {
        const d = await window.Api.execPlayers();
        setJugadores(d.jugadores || []);
      } catch (err) { setMsg({ kind: 'err', text: err.message }); }
    }, [jugadores]);

    const t = (data && data.totales) || { banqueros: 0, jugadores: 0, cupo: 0, cargado: 0 };
    const yo = data && data.ejecutivo;
    const cuenta = (data && data.cuenta) || { deuda: 0, rendido: 0, vendido: 0 };

    return (
      <div style={{ ...S.page, ...U.paleta('ejecutivo') }}>
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          <Encabezado
            titulo="◆ PANEL EJECUTIVO"
            rol="ejecutivo"
            subtitulo={`Sesión: ${user.username}`}
            acciones={<>
              <Boton tono="gris" onClick={onExit}>← VOLVER AL JUEGO</Boton>
              {onLogout && <Boton tono="gris" onClick={onLogout}>SALIR</Boton>}
            </>}
          />

          <Aviso msg={msg} onClose={() => setMsg(null)} />

          {!data && !msg && <div style={{ color: '#888' }}>Cargando…</div>}

          {data && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Sin banqueros el panel se ve vacío y nadie entiende por qué.
                  Se dice qué falta y quién lo resuelve. */}
              {t.banqueros === 0 && (
                <div style={{
                  padding: '14px 16px', borderRadius: 8, fontSize: 15, lineHeight: 1.7,
                  background: 'rgba(167,139,250,0.12)', border: '1px solid #5b3fa8', color: '#d8ccff',
                }}>
                  Todavía no tenés banqueros a cargo. Creá el primero con “+ NUEVO BANQUERO”,
                  o pedile al dueño que te cuelgue alguno de los que ya existen.
                </div>
              )}

              <div style={{
                display: 'grid', gap: 12,
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
              }}>
                <Dato titulo="Banqueros a cargo" valor={t.banqueros} />
                <Dato titulo="Jugadores de la red" valor={t.jugadores} />
                <Dato titulo="Fichas en sus manos" valor={plata(t.cupo)}
                      detalle="cupo sin usar de tus banqueros" />
                <Dato titulo="Cargado a jugadores" valor={plata(t.cargado)}
                      detalle="histórico de toda tu red" />
              </div>

              {/* SU CUENTA CON LA CASA. Es lo primero que mira: cuántas
                  fichas le quedan para repartir y cuánto debe. */}
              {yo && (
                <div style={{
                  display: 'grid', gap: 12,
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                }}>
                  <Dato titulo="Fichas sin repartir" valor={plata(yo.credit_balance || 0)}
                        detalle="te las dio la casa" />
                  <Dato titulo="Le debés a la casa" valor={plata(cuenta.deuda || 0)}
                        color={cuenta.deuda > 0 ? '#ffa04a' : '#7ee08a'}
                        detalle={cuenta.asalariado
                          ? 'todo lo que cobraste'
                          : `${yo.commission_pct || 0}% de lo que vendiste`} />
                  <Dato titulo="Ya rendiste" valor={plata(cuenta.rendido || 0)} chico />
                  <Dato titulo="Cómo cobrás" chico
                        valor={cuenta.asalariado ? 'a sueldo' : `comisión ${yo.commission_pct || 0}%`}
                        detalle={cuenta.asalariado
                          ? 'lo que cobrás es de la casa'
                          : `te quedan ${U.plata(cuenta.margen || 0)} hasta ahora`} />
                  <Dato titulo="Tu techo" chico
                        valor={yo.exec_limite > 0 ? plata(yo.exec_limite) : 'sin techo'}
                        detalle={yo.exec_limite > 0 ? 'no recibís más si lo alcanzás' : null} />
                </div>
              )}

              {/* El aviso que evita el llamado telefónico: si llegó al techo, se
                  lo dice antes de que pida fichas y le digan que no. */}
              {yo && yo.exec_limite > 0 && cuenta.deuda >= yo.exec_limite && (
                <div style={{
                  padding: '12px 16px', borderRadius: 8, fontSize: 15, lineHeight: 1.7,
                  background: 'rgba(180,16,26,0.18)', border: '1px solid #b8101a', color: '#ffc9c9',
                }}>
                  Llegaste a tu techo: debés <b>{plata(cuenta.deuda)}</b> de <b>{plata(yo.exec_limite)}</b>.
                  La casa no te puede entregar más fichas hasta que rindas.
                </div>
              )}

              <FormVenderCupo data={data} setMsg={setMsg} onHecho={cargar} />

              <FormNuevoBanquero setMsg={setMsg} onHecho={cargar} />

              <div style={S.card}>
                <div style={S.titulo}>TUS BANQUEROS</div>
                <Tabla
                  columnas={['Banquero', 'Nombre', 'Teléfono', 'Estado', 'Fichas', 'Jugadores', 'Cargado', 'Desde']}
                  vacio="Ningún banquero asignado todavía."
                >
                  {(data.banqueros || []).map((b) => (
                    <tr key={b.id}>
                      <td style={S.td}><b style={{ color: '#c4b0ff' }}>{b.username}</b></td>
                      <td style={S.td}>{[b.first_name, b.last_name].filter(Boolean).join(' ') || '—'}</td>
                      <td style={S.td}>{b.phone || '—'}</td>
                      <td style={S.td}><Estado v={b.status} /></td>
                      <td style={S.td}>{plata(b.credit_balance || 0)}</td>
                      <td style={S.td}>{b.jugadores || 0}</td>
                      <td style={S.td}>{plata(b.total_cargado || 0)}</td>
                      <td style={S.td}>{fecha(b.created_at)}</td>
                    </tr>
                  ))}
                </Tabla>
              </div>

              {/* Su cuenta con la casa, movimiento por movimiento. Es lo que
                  le permite discutir un número sin depender de un papel. */}
              {!!(data.movimientos || []).length && (
                <div style={S.card}>
                  <div style={S.titulo}>TU CUENTA CON LA CASA</div>
                  <Tabla columnas={['Cuándo', 'Qué pasó', 'Fichas', 'Plata', 'Nota']} vacio="Sin movimientos.">
                    {data.movimientos.map((m) => {
                      const T = {
                        exec_assign: ['La casa te entregó fichas', '#7ee08a'],
                        exec_sale:   ['Le entregaste cupo a un banquero', '#c4b0ff'],
                        exec_settle: ['Le rendiste a la casa', '#ffa04a'],
                        exec_return: ['Devolviste fichas sin vender', '#9b8fc0'],
                      }[m.type] || [m.type, '#999'];
                      return (
                        <tr key={m.id}>
                          <td style={S.td}>{fecha(m.created_at)}</td>
                          <td style={{ ...S.td, color: T[1] }}>{T[0]}</td>
                          <td style={S.td}>{m.amount ? plata(m.amount) : '—'}</td>
                          <td style={S.td}>{m.paid_amount != null ? plata(m.paid_amount) : '—'}</td>
                          <td style={{ ...S.td, color: '#8f83b0' }}>{m.note || '—'}</td>
                        </tr>
                      );
                    })}
                  </Tabla>
                </div>
              )}

              <div style={S.card}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'center', flexWrap: 'wrap', gap: 10,
                }}>
                  <div style={S.titulo}>JUGADORES DE TU RED</div>
                  {!verJugadores && (
                    <Boton tono="gris" onClick={abrirJugadores}>VER JUGADORES</Boton>
                  )}
                </div>

                {!verJugadores ? (
                  <div style={{ color: '#8f83b0', fontSize: 14, lineHeight: 1.7 }}>
                    Son los jugadores de tus banqueros. Los ves para controlar, pero el saldo
                    se lo carga y se lo paga su banquero: acá no se toca.
                  </div>
                ) : !jugadores ? (
                  <div style={{ color: '#888' }}>Cargando…</div>
                ) : (
                  <Tabla
                    columnas={['Jugador', 'Nombre', 'Su banquero', 'Estado', 'Saldo', 'Recargado', 'Desde']}
                    vacio="Tus banqueros todavía no tienen jugadores."
                  >
                    {jugadores.map((j) => (
                      <tr key={j.id}>
                        <td style={S.td}><b>{j.username}</b></td>
                        <td style={S.td}>{[j.first_name, j.last_name].filter(Boolean).join(' ') || '—'}</td>
                        <td style={S.td}>{j.banquero}</td>
                        <td style={S.td}><Estado v={j.status} /></td>
                        <td style={S.td}>
                          {plata((j.balance || 0) - (j.held_balance || 0))}
                          {j.held_balance > 0 && (
                            <span style={{ color: '#c9a227', fontSize: 12 }}>
                              {' '}+{plata(j.held_balance)} en revisión
                            </span>
                          )}
                        </td>
                        <td style={S.td}>{plata(j.total_recargado || 0)}</td>
                        <td style={S.td}>{fecha(j.created_at)}</td>
                      </tr>
                    ))}
                  </Tabla>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    );
  }

  window.ExecPanel = ExecPanel;
})();
