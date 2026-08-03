// Panel del ejecutivo — expone window.ExecPanel
// Props: { user, onExit(), onLogout() }
//
// El piso del medio: matriz → EJECUTIVO → banquero → jugador.
//
// ESTO ES LA ETAPA 1 y por eso el panel MIRA y no toca: su red de banqueros y
// los jugadores de ellos. Todavía no se mueve una ficha ni existe la deuda —
// eso llega en la etapa 3. Si algún día aparece acá un botón que cambie un
// saldo de jugador, está mal: cargar y pagar es del banquero, que es quien
// pone la cara y la plata.
(function () {
  const { useState, useEffect, useCallback } = React;
  const U = window.UI;
  const { plata, fecha, styles: S, Boton, Aviso, Dato, Encabezado, Tabla, Estado } = U;

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
                  Todavía no tenés banqueros a cargo. Los asigna la matriz desde su panel:
                  pedile al dueño que te cuelgue los que vas a manejar.
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

              {/* Las fichas propias del ejecutivo: en la etapa 1 esto es
                  siempre cero, porque todavía no hay forma de asignarle. Se
                  muestra igual para que el dueño vea el lugar donde va a
                  aparecer, y para que nadie crea que se perdieron. */}
              {yo && (
                <div style={{
                  ...S.card, display: 'flex', flexWrap: 'wrap', gap: 20,
                  alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <div>
                    <div style={{ fontSize: 12, letterSpacing: 1.5, color: '#9b8fc0' }}>
                      TUS FICHAS SIN REPARTIR
                    </div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: '#c4b0ff' }}>
                      {plata(yo.credit_balance || 0)}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, color: '#8f83b0', maxWidth: 460, lineHeight: 1.6 }}>
                    Todavía no se pueden asignar ni repartir fichas: eso llega en la próxima
                    etapa, junto con la cuenta de lo que le debés a la matriz.
                    {yo.exec_limite > 0 && (
                      <> Tu techo acordado es <b style={{ color: '#c4b0ff' }}>{plata(yo.exec_limite)}</b>.</>
                    )}
                  </div>
                </div>
              )}

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
