// ════════════════════════════════════════════════════════════════════════
//  LA PIZARRA DEL SALÓN — qué está pasando ahora en cada mesa.
//
//  Cuatro consultas AGREGADAS, no una por mesa. Con cinco mesas y un refresco
//  cada diez segundos, hacerlo mesa por mesa serían quince consultas cada diez
//  segundos por cada jugador mirando el salón; así son cuatro, y no crecen
//  cuando el dueño abra la sexta mesa.
//
//  No devuelve nombres, colores ni precios: eso ya lo trae /api/games y no
//  hace falta repetirlo cada diez segundos.
//
//  Ver docs/superpowers/specs/2026-08-08-entrada-y-salon-design.md
// ════════════════════════════════════════════════════════════════════════
import { json, requireAuth, catalogoMesas } from './lib.js';

// "Jugando" es una definición, no un hecho: acá nadie está sentado en una
// silla. La más honesta y la más barata: cuántas cuentas distintas apostaron
// en esa mesa en los últimos diez minutos. No inventa gente.
const VENTANA_MIN = 10;

// Cuántos números muestra la vitrina.
const CUANTOS = 5;

// Cuántos giros hacia atrás se mira para armar la vitrina. Es un techo para
// que la consulta no crezca con la tabla: con cinco mesas, los últimos 2000
// giros contienen de sobra los cinco de cada una. Si una mesa lleva más de
// 2000 giros sin jugarse, aparece sin números — que es la verdad.
const VENTANA_GIROS = 2000;

export async function salonVivo(request, env) {
  const auth = await requireAuth(request, env);
  if (auth.error) return auth.response;

  // Las mismas mesas que ve el salón, con la misma regla: a una mesa EN
  // PRUEBAS no se le anuncia nada al jugador común, ni siquiera un contador
  // de gente. Si se filtrara acá, el portón de la mesa en pruebas no serviría
  // de nada: cualquiera sabría que existe.
  const mesas = (await catalogoMesas(env, auth)).filter((m) => m.activo || m.en_pruebas);
  if (mesas.length === 0) return json({ mesas: [] });

  const [jugando, ultimos, rayos, manos] = await env.DB.batch([
    env.DB.prepare(
      `SELECT game_id, COUNT(DISTINCT user_id) AS n
         FROM transactions
        WHERE type = 'bet' AND source = 'game'
          AND created_at >= datetime('now', ?)
        GROUP BY game_id`
    ).bind(`-${VENTANA_MIN} minutes`),

    env.DB.prepare(
      `SELECT game_id, numero FROM (
         SELECT game_id, numero,
                ROW_NUMBER() OVER (PARTITION BY game_id ORDER BY id DESC) AS puesto
           FROM giros
          WHERE id > (SELECT COALESCE(MAX(id), 0) - ? FROM giros)
       ) WHERE puesto <= ?
       ORDER BY game_id, puesto`
    ).bind(VENTANA_GIROS, CUANTOS),

    env.DB.prepare(
      `SELECT g.game_id, g.rayo_mult,
              CAST((julianday('now') - julianday(g.created_at)) * 1440 AS INTEGER) AS hace_min
         FROM giros g
         JOIN (SELECT game_id, MAX(id) AS ultimo
                 FROM giros WHERE rayo_mult IS NOT NULL
                GROUP BY game_id) u
           ON u.ultimo = g.id`
    ),

    env.DB.prepare(
      `SELECT game_id, COUNT(*) AS n
         FROM bj_rondas WHERE estado = 'jugando' GROUP BY game_id`
    ),
  ]);

  const porMesa = (res, f) => {
    const m = new Map();
    for (const fila of (res.results || [])) m.set(fila.game_id, f(fila));
    return m;
  };

  const nJugando = porMesa(jugando, (f) => f.n);
  const nManos = porMesa(manos, (f) => f.n);
  const elRayo = porMesa(rayos, (f) => ({ mult: f.rayo_mult, hace_min: Math.max(0, f.hace_min) }));

  const tira = new Map();
  for (const f of (ultimos.results || [])) {
    if (!tira.has(f.game_id)) tira.set(f.game_id, []);
    tira.get(f.game_id).push(f.numero);
  }

  return json({
    mesas: mesas.map((m) => ({
      id: m.id,
      jugando: nJugando.get(m.id) || 0,
      // El 21 no tiene números que mostrar: muestra manos en juego.
      ultimos: m.tipo === 'blackjack' ? [] : (tira.get(m.id) || []),
      ultimo_rayo: elRayo.get(m.id) || null,
      manos_en_juego: m.tipo === 'blackjack' ? (nManos.get(m.id) || 0) : null,
    })),
  });
}
