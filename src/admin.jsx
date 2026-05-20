// Panel de administración — expone window.AdminPanel
// Props: { user, onExit() }  — onExit vuelve al juego
(function () {
  const { useState, useEffect, useCallback, useMemo } = React;

  function AdminPanel({ user, onExit }) {
    const [users, setUsers] = useState([]);
    const [txs, setTxs] = useState([]);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState('');
    const [amount, setAmount] = useState('');
    const [note, setNote] = useState('');
    const [msg, setMsg] = useState(null); // { kind:'ok'|'err', text }
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
      try {
        const [u, t] = await Promise.all([
          window.Api.adminUsers(),
          window.Api.adminTransactions(),
        ]);
        setUsers(u.users || []);
        setTxs(t.transactions || []);
      } catch (err) {
        setMsg({ kind: 'err', text: err.message || 'Error cargando datos' });
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = useMemo(() => {
      const q = search.trim().toLowerCase();
      if (!q) return users;
      return users.filter((u) => u.username.includes(q));
    }, [users, search]);

    const deposit = async (e) => {
      e.preventDefault();
      setMsg(null);
      const target = (selected || search).trim().toLowerCase();
      const amt = Number(amount);
      if (!target) { setMsg({ kind: 'err', text: 'Elegí un usuario' }); return; }
      if (!Number.isInteger(amt) || amt <= 0) { setMsg({ kind: 'err', text: 'Monto inválido' }); return; }
      try {
        const res = await window.Api.adminDeposit(target, amt, note.trim() || undefined);
        setMsg({ kind: 'ok', text: `Cargado $${amt.toLocaleString()} a ${res.user.username}. Nuevo saldo: $${res.user.balance.toLocaleString()}` });
        setAmount(''); setNote('');
        await load();
      } catch (err) {
        setMsg({ kind: 'err', text: err.message || 'No se pudo cargar el saldo' });
      }
    };

    const card = {
      background: 'linear-gradient(180deg, #1a1410, #100a06)',
      border: '1px solid #8b6a20', borderRadius: 10, padding: 18,
    };
    const input = {
      padding: '10px 12px', borderRadius: 6, border: '1px solid #8b6a20',
      background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 15,
      fontFamily: 'Georgia, serif', outline: 'none', boxSizing: 'border-box',
    };
    const th = { textAlign: 'left', padding: '8px 10px', color: '#888', fontSize: 11, letterSpacing: 1, borderBottom: '1px solid #3a2a10' };
    const td = { padding: '8px 10px', borderBottom: '1px solid #221a0c', fontSize: 14 };

    const typeLabel = { deposit: { t: 'Carga', c: '#5ab8ff' }, bet: { t: 'Apuesta', c: '#ff9a9a' }, win: { t: 'Ganancia', c: '#7ee08a' } };

    return (
      <div style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse at center, #2a1a08 0%, #120a02 60%, #050200 100%)',
        color: '#fff', fontFamily: 'Georgia, serif', padding: '20px 16px',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {/* Header */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: '1px solid #8b6a20', paddingBottom: 14, marginBottom: 20, gap: 12, flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: 2, color: '#d4a94a' }}>
                ⚙ PANEL ADMIN
              </div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                Sesión: {user.username}
              </div>
            </div>
            <button onClick={onExit} style={{
              padding: '9px 18px', borderRadius: 6, border: '1px solid #555',
              background: 'linear-gradient(180deg, #333, #111)', color: '#ddd',
              fontFamily: 'Georgia, serif', fontWeight: 700, cursor: 'pointer', letterSpacing: 1,
            }}>← VOLVER AL JUEGO</button>
          </div>

          {msg && (
            <div style={{
              marginBottom: 16, padding: '10px 14px', borderRadius: 6, fontSize: 14,
              background: msg.kind === 'ok' ? 'rgba(46,138,46,0.2)' : 'rgba(180,16,26,0.2)',
              border: `1px solid ${msg.kind === 'ok' ? '#2a8a2a' : '#b8101a'}`,
              color: msg.kind === 'ok' ? '#9ff0a0' : '#ff9a9a',
            }}>{msg.text}</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 18, alignItems: 'start' }}>
            {/* Tabla de usuarios */}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: 1, color: '#d4a94a' }}>USUARIOS ({users.length})</div>
                <input
                  style={{ ...input, flex: 1, minWidth: 160 }}
                  placeholder="Buscar usuario..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={th}>USUARIO</th>
                      <th style={th}>SALDO</th>
                      <th style={th}>ROL</th>
                      <th style={th}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading && <tr><td style={td} colSpan={4}>Cargando…</td></tr>}
                    {!loading && filtered.length === 0 && <tr><td style={td} colSpan={4}>Sin resultados</td></tr>}
                    {filtered.map((u) => (
                      <tr key={u.id} style={{ background: selected === u.username ? 'rgba(212,169,74,0.1)' : 'transparent' }}>
                        <td style={{ ...td, fontWeight: 700 }}>{u.username}</td>
                        <td style={{ ...td, color: '#ffd84a', fontWeight: 900 }}>${u.balance.toLocaleString()}</td>
                        <td style={td}>{u.is_admin ? '👑 admin' : 'jugador'}</td>
                        <td style={td}>
                          <button onClick={() => { setSelected(u.username); setSearch(u.username); }} style={{
                            padding: '4px 10px', borderRadius: 5, border: '1px solid #8b6a20',
                            background: 'rgba(212,169,74,0.15)', color: '#d4a94a', cursor: 'pointer', fontSize: 12,
                          }}>Cargar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Formulario de carga */}
            <div style={card}>
              <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: 1, color: '#d4a94a', marginBottom: 14 }}>CARGAR SALDO</div>
              <form onSubmit={deposit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#888', letterSpacing: 1 }}>USUARIO</label>
                  <input style={{ ...input, width: '100%', marginTop: 4 }}
                    placeholder="nombre de usuario"
                    value={selected || search}
                    onChange={(e) => { setSelected(e.target.value); setSearch(e.target.value); }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#888', letterSpacing: 1 }}>MONTO</label>
                  <input style={{ ...input, width: '100%', marginTop: 4 }}
                    type="number" min="1" placeholder="500"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#888', letterSpacing: 1 }}>NOTA (opcional)</label>
                  <input style={{ ...input, width: '100%', marginTop: 4 }}
                    placeholder="motivo"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
                <button type="submit" style={{
                  padding: '12px', borderRadius: 6, border: '2px solid #2a8a2a',
                  background: 'linear-gradient(180deg, #2a8a2a, #155015)', color: '#fff',
                  fontWeight: 900, fontSize: 14, letterSpacing: 1, cursor: 'pointer', fontFamily: 'Georgia, serif',
                }}>+ CARGAR SALDO</button>
              </form>
            </div>
          </div>

          {/* Transacciones */}
          <div style={{ ...card, marginTop: 18 }}>
            <div style={{ fontSize: 15, fontWeight: 900, letterSpacing: 1, color: '#d4a94a', marginBottom: 12 }}>
              ÚLTIMAS TRANSACCIONES
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={th}>FECHA</th>
                    <th style={th}>USUARIO</th>
                    <th style={th}>TIPO</th>
                    <th style={th}>MONTO</th>
                    <th style={th}>NOTA</th>
                  </tr>
                </thead>
                <tbody>
                  {txs.length === 0 && <tr><td style={td} colSpan={5}>Sin movimientos</td></tr>}
                  {txs.map((t) => {
                    const lbl = typeLabel[t.type] || { t: t.type, c: '#aaa' };
                    return (
                      <tr key={t.id}>
                        <td style={{ ...td, color: '#888', fontSize: 12 }}>{t.created_at}</td>
                        <td style={{ ...td, fontWeight: 700 }}>{t.username}</td>
                        <td style={{ ...td, color: lbl.c, fontWeight: 700 }}>{lbl.t}</td>
                        <td style={{ ...td, color: lbl.c }}>{t.type === 'bet' ? '−' : '+'}${t.amount.toLocaleString()}</td>
                        <td style={{ ...td, color: '#aaa', fontSize: 13 }}>{t.note || ''}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  window.AdminPanel = AdminPanel;
})();
