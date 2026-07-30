// ════════════════════════════════════════════════════════════════════════
//  EL PORTÓN DE UNA MESA EN PRUEBAS (Etapa B5)
//
//    node pruebas/verificar-mesa-en-pruebas.mjs [--api=…]
//
//  Una mesa tiene tres estados: cerrada, EN PRUEBAS y abierta. El estado del
//  medio es el que permite tener una mesa nueva viva en producción, jugándose
//  con plata de verdad, sin abrírsela a nadie: la ven y la juegan sólo el
//  dueño y las cuentas de prueba de la casa.
//
//  Todo el valor de ese estado depende de que el portón cierre de verdad. Si
//  se filtra, la casa termina con jugadores reales en una mesa sin terminar, y
//  eso no se arregla pidiendo perdón. Así que se comprueba desde los dos
//  lados:
//
//   1. El salón      — la mesa NO viaja en el catálogo del jugador común, y sí
//                      viaja para el dueño y para una cuenta de prueba. No es
//                      que se esconda al dibujar: no llega al teléfono.
//   2. La dirección  — escribir la dirección de la mesa a mano no sirve. Es la
//                      puerta que siempre se olvida.
//   3. La apuesta    — el jugador común no puede apostar ni con el token en la
//                      mano. Es la única que de verdad cuida la plata: las dos
//                      de arriba son pantalla.
//   4. El probador   — y del otro lado, que el que SÍ puede entre y juegue una
//                      mano completa. Un portón que no deja pasar a nadie no
//                      sirve para probar nada.
//   5. La ruleta     — lo mismo en una mesa de ruleta: el giro se rechaza para
//                      el jugador común y se acepta para el probador. El estado
//                      es del catálogo, no del blackjack.
//   6. El salón vacío — una mesa en pruebas no cuenta como mesa abierta: no se
//                      puede dejar el salón con una sola mesa "encendida" que
//                      el jugador no ve.
//
//  Deja las dos mesas como estaban, aunque algo falle.
// ════════════════════════════════════════════════════════════════════════

const args = process.argv.slice(2);
const opt = (n, def) => {
  const a = args.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : def;
};
const API = opt('api', 'http://localhost:8787').replace(/\/$/, '');
const MESA21 = opt('mesa', 'blackjack');

let ok = 0, fail = 0;
const fallas = [];
const check = (nombre, cond, detalle) => {
  if (cond) { ok++; console.log(`   ✓ ${nombre}`); return true; }
  fail++;
  fallas.push(`${nombre}${detalle ? `\n     → ${detalle}` : ''}`);
  console.log(`   ✗ ${nombre}${detalle ? `  (${detalle})` : ''}`);
  return false;
};

async function api(ruta, { metodo = 'GET', cuerpo, token } = {}) {
  const res = await fetch(API + ruta, {
    method: metodo,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ...data };
}

// Crea una cuenta nueva y devuelve su token. El nombre decide si es probador:
// las cuentas de la casa se llaman `prueba`, `prueba2`… (ver esProbador()).
async function cuentaNueva(prefijo, ADT, saldo) {
  const sello = String(Date.now()).slice(-9) + Math.floor(Math.random() * 90 + 10);
  const username = `${prefijo}${sello}`.slice(0, 24);
  await api('/api/auth/register', { metodo: 'POST', cuerpo: {
    username, password: 'clave123', first_name: 'Porton', last_name: 'Prueba',
    cedula: sello.slice(-8), phone: '04141112233', email: `${username}@correo.com`,
    bank: '0134 - Banesco',
  } });
  const ses = await api('/api/auth/login', { metodo: 'POST', cuerpo: { username, password: 'clave123' } });
  if (!ses.token) { console.log(`No pude crear la cuenta ${username}.`); process.exit(2); }
  if (saldo) await api('/api/admin/deposit', { metodo: 'POST', token: ADT, cuerpo: { username, amount: saldo } });
  return { username, token: ses.token };
}

const estadoDe = (m) => (m.activo ? 1 : (m.en_pruebas ? 2 : 0));

async function mesasDelPanel(ADT) {
  const r = await api('/api/admin/games', { token: ADT });
  return r.mesas || [];
}

async function ponerEstado(ADT, id, estado) {
  return api(`/api/admin/games/${id}/activo`, { metodo: 'POST', token: ADT, cuerpo: { estado } });
}

// Juega una mano completa hasta que cierre. Devuelve la última respuesta.
async function manoCompleta(token, mesa, apuesta) {
  let r = await api('/api/bj/apostar', { metodo: 'POST', token, cuerpo: {
    mesa, puestos: [{ puesto: 1, apuesta }],
  } });
  let vueltas = 0;
  while (r.estado === 'jugando' && vueltas++ < 25) {
    r = await api('/api/bj/plantarse', { metodo: 'POST', token, cuerpo: { ronda: r.ronda, version: r.version } });
  }
  return r;
}

// ══════════════════════════════════════════════════════════════════════════
async function main() {
  console.log(`\n═══ EL PORTÓN DE UNA MESA EN PRUEBAS ═══  (${API})\n`);

  const adm = await api('/api/auth/login', { metodo: 'POST', cuerpo: { username: 'admin', password: '123456' } });
  if (!adm.token) { console.log('No pude entrar como admin. ¿Está levantado el servidor?'); process.exit(2); }
  const ADT = adm.token;

  const mesas = await mesasDelPanel(ADT);
  if (!mesas.length) { console.log('El panel no devolvió mesas. ¿Corriste la migración 011?'); process.exit(2); }

  const m21 = mesas.find((m) => m.id === MESA21);
  if (!m21) { console.log(`No existe la mesa "${MESA21}". ¿Corriste las migraciones 012 y 013?`); process.exit(2); }

  // Una ruleta para la prueba 5. Se elige una que NO esté abierta, para no
  // tocar una mesa donde podría haber alguien jugando.
  const ruleta = mesas.find((m) => m.tipo !== 'blackjack' && estadoDe(m) !== 1)
              || mesas.find((m) => m.tipo !== 'blackjack');

  const antes21 = estadoDe(m21);
  const antesRul = ruleta ? estadoDe(ruleta) : null;
  console.log(`Mesa "${m21.label}" estaba en estado ${antes21}`
    + (ruleta ? ` · ruleta de prueba: "${ruleta.label}" (estado ${antesRul})` : ''));

  const comun = await cuentaNueva('gente', ADT, 20000);
  const probador = await cuentaNueva('prueba', ADT, 20000);
  console.log(`Jugador común: ${comun.username} · cuenta de prueba: ${probador.username}\n`);

  try {
    // ── La mesa de 21, en pruebas ──────────────────────────────────────────
    await ponerEstado(ADT, MESA21, 2);
    console.log(`A. La mesa "${m21.label}" quedó EN PRUEBAS`);

    const enPanel = (await mesasDelPanel(ADT)).find((m) => m.id === MESA21);
    check('el panel del dueño la muestra en pruebas', estadoDe(enPanel) === 2,
          `estado leído: ${estadoDe(enPanel)}`);

    console.log('\nB. El salón: a quién le llega la mesa');
    const catComun = await api('/api/games', { token: comun.token });
    const catProb = await api('/api/games', { token: probador.token });
    const catAdm = await api('/api/games', { token: ADT });
    const hay = (c) => (c.mesas || []).some((m) => m.id === MESA21);

    check('al jugador común NO le viaja la mesa', !hay(catComun),
          'la mesa llegó en el catálogo de un jugador cualquiera');
    check('a la cuenta de prueba SÍ le viaja', hay(catProb));
    check('al dueño SÍ le viaja', hay(catAdm));
    const suya = (catProb.mesas || []).find((m) => m.id === MESA21);
    check('y le viaja marcada como en pruebas', !!suya && suya.en_pruebas === true && suya.activo === false,
          suya ? `activo=${suya.activo} en_pruebas=${suya.en_pruebas}` : 'no vino');

    console.log('\nC. La dirección escrita a mano');
    const rondaComun = await api(`/api/bj/ronda?mesa=${MESA21}`, { token: comun.token });
    check('el jugador común no puede abrir la mesa por la dirección', !!rondaComun.error,
          `contestó: ${JSON.stringify(rondaComun).slice(0, 120)}`);
    const rondaProb = await api(`/api/bj/ronda?mesa=${MESA21}`, { token: probador.token });
    check('la cuenta de prueba sí la abre', !rondaProb.error && !!rondaProb.mesa,
          rondaProb.error);

    console.log('\nD. La apuesta (lo único que cuida la plata)');
    const antesSaldo = (await api('/api/me', { token: comun.token })).balance;
    const intento = await api('/api/bj/apostar', { metodo: 'POST', token: comun.token, cuerpo: {
      mesa: MESA21, puestos: [{ puesto: 1, apuesta: m21.apuesta_min || 10 }],
    } });
    check('el jugador común no puede apostar', !!intento.error, JSON.stringify(intento).slice(0, 120));
    const despuesSaldo = (await api('/api/me', { token: comun.token })).balance;
    check('y no se le tocó un bolívar del saldo', antesSaldo === despuesSaldo,
          `${antesSaldo} → ${despuesSaldo}`);

    console.log('\nE. El probador juega de verdad');
    const mano = await manoCompleta(probador.token, MESA21, m21.apuesta_min || 10);
    check('la cuenta de prueba juega una mano completa y la mesa la cierra',
          mano.estado === 'cerrada', JSON.stringify(mano).slice(0, 140));

    // ── La misma puerta, en una ruleta ─────────────────────────────────────
    if (ruleta) {
      console.log(`\nF. La ruleta "${ruleta.label}", en pruebas`);
      await ponerEstado(ADT, ruleta.id, 2);
      const apuesta = { bets: [{ type: 'color', payload: 'red', amount: 100 }], game: ruleta.id };
      const giroComun = await api('/api/game/spin', { metodo: 'POST', token: comun.token, cuerpo: apuesta });
      check('el giro del jugador común se rechaza', !!giroComun.error, JSON.stringify(giroComun).slice(0, 120));
      const giroProb = await api('/api/game/spin', { metodo: 'POST', token: probador.token, cuerpo: apuesta });
      check('el giro de la cuenta de prueba se acepta', !giroProb.error && giroProb.resultNum !== undefined,
            JSON.stringify(giroProb).slice(0, 120));

      console.log('\nG. El salón no se queda vacío por una mesa en pruebas');
      // Se apagan todas las demás y se intenta dejar SOLO una en pruebas: el
      // servidor tiene que negarse, porque el jugador común no vería ninguna.
      const todas = await mesasDelPanel(ADT);
      const abiertas = todas.filter((m) => estadoDe(m) === 1);
      const restaurar = [];
      for (const m of abiertas) { restaurar.push([m.id, 1]); }
      let negó = false;
      if (abiertas.length === 1) {
        const r = await ponerEstado(ADT, abiertas[0].id, 2);
        negó = !!r.error;
      } else if (abiertas.length > 1) {
        // Se dejan todas cerradas menos la última, y ahí se prueba.
        for (const m of abiertas.slice(0, -1)) await ponerEstado(ADT, m.id, 0);
        const ultima = abiertas[abiertas.length - 1];
        const r = await ponerEstado(ADT, ultima.id, 2);
        negó = !!r.error;
      }
      check('no deja pasar a pruebas la última mesa abierta', negó || abiertas.length === 0,
            'dejó el salón sin ninguna mesa que el jugador pueda ver');
      for (const [id, est] of restaurar) await ponerEstado(ADT, id, est);
    }
  } finally {
    await ponerEstado(ADT, MESA21, antes21);
    if (ruleta) await ponerEstado(ADT, ruleta.id, antesRul);
    console.log(`\nLas mesas quedaron como estaban (${m21.label}: estado ${antes21}`
      + (ruleta ? `, ${ruleta.label}: estado ${antesRul}` : '') + ').');
  }

  console.log('\n─────────────────────────────────────────');
  if (fallas.length) {
    console.log('FALLAS:');
    for (const f of fallas) console.log(`  ✗ ${f}`);
  }
  console.log(`\n  ${ok} comprobaciones pasaron · ${fail} fallaron`);
  console.log(fail === 0 ? '\n  ✅ EL PORTÓN CIERRA\n' : '\n  ❌ NO USAR EL ESTADO EN PRUEBAS\n');
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(2); });
