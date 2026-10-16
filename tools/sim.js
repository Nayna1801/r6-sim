// Arnes de pruebas: IA contra IA en rondas completas. Uso: node tools/sim.js [N] [seed]
const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..');
const J = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
require('../js/engine.js'); require('../js/ai.js');
const R6 = globalThis.R6;
const operators = J('data/operators.json'); const maps = J('data/maps.json').filter((m) => m.playable);
const merge = (a, b) => { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k])) { a[k] = merge(a[k] || {}, b[k]); } else a[k] = b[k]; } return a; };
const balance = merge(J('config/balance.json'), process.env.BAL ? JSON.parse(process.env.BAL) : {});
R6.Engine.configure({ rules: J('config/rules.json'), balance, decisions: J('config/decisions.json'), operators, maps });
R6.AI.configure(J('config/ai.json'));
const mkRng = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const sample = (arr, n, rng) => { const c = [...arr]; const o = []; while (o.length < n && c.length) o.push(c.splice(Math.floor(rng() * c.length), 1)[0]); return o; };
const E = R6.Engine, AI = R6.AI;

function playRound(rng, opt = {}) {
  const map = opt.map || sample(maps, 1, rng)[0];
  const attIds = sample(operators.filter((o) => o.side === 'att'), 5, rng).map((o) => o.id);
  const defIds = sample(operators.filter((o) => o.side === 'def'), 5, rng).map((o) => o.id);
  const st = E.newRound({ mapId: map.id, attIds, defIds });
  E.resolvePrep(st, AI.planDef(st, rng), AI.planAtt(st, rng), rng);
  E.setAdjust(st, AI.adjustAtt(st));
  let guard = 0;
  while (st.phase !== 'done' && guard++ < 30) {
    const ph = st.phase;
    const dec = { att: AI.decide(st, 'att', ph, rng), def: AI.decide(st, 'def', ph, rng) };
    E.resolve(st, ph, dec, rng);
  }
  if (st.phase !== 'done') throw new Error('round did not finish: ' + st.phase);
  return st;
}
if (require.main === module && process.argv[2] !== '--match') {
  const N = +process.argv[2] || 300; const rng = mkRng(+process.argv[3] || 1);
  let att = 0, planted = 0, found = 0, err = 0, kills = 0; const reasons = {}; const t0 = Date.now(); let evs = 0;
  for (let i = 0; i < N; i++) {
    try {
      const st = playRound(rng); if (st.result.winner === 'att') att++; if (st.planted) planted++; if (st.intel.found) found++;
      reasons[st.result.reason] = (reasons[st.result.reason] || 0) + 1; evs += st.events.length; kills += [...st.att, ...st.def].reduce((a, m) => a + m.kills, 0); E.explain(st);
    } catch (e) { if (err++ < 3) console.log(e.stack.split('\n').slice(0, 4).join(' | ')); }
  }
  console.log({ rounds: N, attWin: +(att / N).toFixed(3), planted: +(planted / N).toFixed(3), siteFound: +(found / N).toFixed(3), errors: err, avgEvents: +(evs / N).toFixed(1), killsPerRound: +(kills / N).toFixed(2), ms: Date.now() - t0, reasons });
}
module.exports = { playRound, E, AI, R6, maps, operators, mkRng, sample };

// ---- partida completa CPU vs CPU: node tools/sim.js --match [N] ----
if (require.main === module && process.argv[2] === '--match') {
  require('../js/match.js'); require('../js/controllers.js');
  const N = +process.argv[3] || 5; const rules = J('config/rules.json'); const rng = mkRng(11);
  (async () => {
    let rounds = 0, ot = 0, ok = 0;
    for (let i = 0; i < N; i++) {
      const m = new R6.Match({ rules, ops: operators, mapId: sample(maps, 1, rng)[0].id, rng, draftMode: i % 2 ? 'pool' : 'full', firstAttacker: i % 2 ? 'B' : 'A',
        controllers: { A: new R6.CpuController(rng), B: new R6.CpuController(rng) } });
      const res = await m.run(); rounds += m.round; if (m.round > 6) ot++; ok++;
      console.log(`match ${i + 1}: ${res.score.A}-${res.score.B} en ${m.round} rondas, gana ${res.winner}`);
    }
    console.log({ matches: ok, avgRounds: rounds / ok, overtime: ot });
  })().catch((e) => { console.error(e); process.exit(1); });
}
