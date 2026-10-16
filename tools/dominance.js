// Analisis de dominancia: valor medio de cada opcion de decision contra decisiones aleatorias del rival.
// Uso: node tools/dominance.js [N]
const S = require('./sim.js'); const { E, AI, R6, maps, operators, mkRng, sample } = S;
const N = +process.argv[2] || 400; const rng = mkRng(21); const dec = E.cfg().dec;
const rnd = (o) => { const c = {}; Object.keys(o).forEach((g) => { c[g] = o[g][Math.floor(rng() * o[g].length)]; }); return c; };
function build() {
  const map = sample(maps, 1, rng)[0];
  const st = E.newRound({ mapId: map.id, attIds: sample(operators.filter((o) => o.side === 'att'), 5, rng).map((o) => o.id), defIds: sample(operators.filter((o) => o.side === 'def'), 5, rng).map((o) => o.id) });
  E.resolvePrep(st, AI.planDef(st, rng), AI.planAtt(st, rng), rng); E.setAdjust(st, AI.adjustAtt(st)); return st;
}
const res = {};
for (let i = 0; i < N; i++) {
  let st = build(); let guard = 0;
  while (st.phase !== 'done' && guard++ < 20) {
    const ph = st.phase;
    for (const side of ['att', 'def']) {
      const opts = E.options(st, side, ph); const oppOpts = E.options(st, side === 'att' ? 'def' : 'att', ph);
      Object.keys(opts).forEach((g) => opts[g].forEach((o) => {
        for (let k = 0; k < 8; k++) {
          const sim = E.clone(st); const mine = { ...rnd(opts), [g]: o }; let first = true; let guard2 = 0;
          while (sim.phase !== 'done' && guard2++ < 20) {
            const p2 = sim.phase; const oa = first ? (side === 'att' ? mine : rnd(E.options(sim, 'att', p2))) : rnd(E.options(sim, 'att', p2));
            const od = first ? (side === 'def' ? mine : rnd(E.options(sim, 'def', p2))) : rnd(E.options(sim, 'def', p2));
            E.resolve(sim, p2, { att: oa, def: od }, rng); first = false;
          }
          const key = `${ph}.${side}.${g}.${o}`; const r = (res[key] = res[key] || { n: 0, win: 0 }); r.n++;
          if (sim.result && sim.result.winner === side) r.win++;
        }
      }));
    }
    E.resolve(st, ph, { att: AI.decide(st, 'att', ph, rng), def: AI.decide(st, 'def', ph, rng) }, rng);
  }
}
const groups = {}; Object.entries(res).forEach(([k, v]) => { const g = k.split('.').slice(0, 3).join('.'); (groups[g] = groups[g] || []).push([k.split('.')[3], v.win / v.n, v.n]); });
Object.entries(groups).forEach(([g, arr]) => console.log(g.padEnd(26), arr.map(([o, w, n]) => `${o}=${w.toFixed(2)}`).join('  ')));
