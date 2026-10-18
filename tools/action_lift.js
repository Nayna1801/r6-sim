// Calibracion de acciones de agente: empuje de cada opcion = cambio de tasa de victoria del bando que la usa al FORZAR la opcion frente a
// forzar "off", en rondas pareadas (misma semilla y plantillas, con el agente accion siempre en su equipo). Solo cuentan las rondas en las que
// la accion llego a ofrecerse. Una accion bien calibrada queda cerca de 0 (+-3 puntos); la IA luego la usa solo cuando le conviene.
// Uso: node tools/action_lift.js [rondas] [semilla] [id1,id2,...]
const { E, AI, operators, maps, mkRng, sample } = require('./sim.js'); const fs = require('fs'); const path = require('path');
const N = +process.argv[2] || 1500; const seed0 = +process.argv[3] || 5;
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'actions.json'), 'utf8'));
const ids = process.argv[4] ? process.argv[4].split(',') : Object.keys(cfg.actions);

function round(seed, actor, side, force) {
  const rng = mkRng(seed); const map = sample(maps, 1, rng)[0];
  const squad = (sd) => { const pool = operators.filter((o) => o.side === sd && o.id !== actor); return sample(pool, 5, rng).map((o) => o.id); };
  let att = squad('att'), def = squad('def');
  const mine = (side === 'att' ? att : def); mine[0] = actor;
  const st = E.newRound({ mapId: map.id, attIds: att, defIds: def });
  E.resolvePrep(st, AI.planDef(st, rng), AI.planAtt(st, rng), rng); E.setAdjust(st, AI.adjustAtt(st));
  let offered = false; let guard = 0;
  const decide = (sd, ph) => {
    const ch = AI.decide(st, sd, ph, rng, { noActs: true }); const opts = E.options(st, sd, ph);   // el resto de acciones, apagadas: se mide solo esta
    if (sd === side && force.grp in opts) { offered = true; ch[force.grp] = force.opt; Object.assign(ch, force.when || {}); }   // 'when': se fuerza tambien en la ronda sin accion, para que lo unico que cambie sea la accion
    return ch;
  };
  while (st.phase !== 'done' && guard++ < 30) { const ph = st.phase; E.resolve(st, ph, { att: decide('att', ph), def: decide('def', ph) }, rng); }
  return { win: st.result.winner === side, offered };
}

const rows = [];
for (const id of ids) {
  const a = cfg.actions[id]; const grp = `act.${id}`; const opts = Object.keys(a.options).filter((o) => o !== 'off');
  const acc = Object.fromEntries(opts.map((o) => [o, { n: 0, wOn: 0, wOff: 0, w2: 0 }]));
  for (let i = 0; i < N; i++) {
    const seed = seed0 * 100003 + i; let off = null;   // la ronda sin accion se calcula una vez y se reutiliza para todas las opciones
    for (const opt of opts) {
      const on = round(seed, a.op, a.side, { grp, opt, when: a.when }); if (!on.offered) continue;
      off = off || round(seed, a.op, a.side, { grp, opt: 'off', when: a.when });
      const r = acc[opt]; const diff = on.win - off.win; r.n++; r.wOn += on.win; r.wOff += off.win; r.w2 += diff * diff;
    }
  }
  for (const opt of opts) {
    const r = acc[opt]; const mean = r.n ? (r.wOn - r.wOff) / r.n : 0; const se = r.n > 1 ? Math.sqrt((r.w2 / r.n - mean * mean) / (r.n - 1)) : 0;
    const d = mean * 100, ci = 1.96 * se * 100; const flag = Math.abs(d) <= 3 ? 'ok' : Math.abs(d) - ci > 3 ? '!!' : '??';
    rows.push({ id, opt, n: r.n, d, ci, flag });
    console.log(`${(id + ' / ' + opt).padEnd(46)} ofrecida ${(r.n / N * 100).toFixed(0).padStart(3)}%  empuje ${d >= 0 ? '+' : ''}${d.toFixed(1)} pts (+-${ci.toFixed(1)})  ${flag}  n=${r.n}`);
  }
}
if (process.argv[5] === '--json') console.log('JSON:' + JSON.stringify(rows));
const bad = rows.filter((r) => r.flag !== 'ok');
console.log(bad.length ? `\nrevisar (|empuje| > 3): ${bad.map((r) => `${r.id}/${r.opt} ${r.flag}`).join(', ')}   (!! = seguro, ?? = dudoso por ruido)` : '\nTodas dentro de +-3 puntos.');
