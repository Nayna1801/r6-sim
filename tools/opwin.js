// Tasa de victoria por agente en rondas con equipos aleatorios (detecta agentes dominantes o inutiles).
// Uso: node tools/opwin.js [rondas] [semilla]      Con BAL='{"gadgets":{"weight":0}}' se mide sin el efecto de los gadgets.
const S = require('./sim.js'); const { playRound, mkRng, operators } = S;
const N = +process.argv[2] || 6000; const rng = mkRng(+process.argv[3] || 5);
const res = {}; let attWins = 0;
for (let i = 0; i < N; i++) {
  const st = playRound(rng); const w = st.result.winner; if (w === 'att') attWins++;
  [['att', st.att], ['def', st.def]].forEach(([side, team]) => team.forEach((m) => {
    const r = (res[m.id] = res[m.id] || { id: m.id, side, n: 0, win: 0 }); r.n++; if (side === w) r.win++;
  }));
}
const rows = Object.values(res).map((r) => ({ ...r, wr: r.win / r.n }));
const base = { att: attWins / N, def: 1 - attWins / N };
if (process.argv[4] === '--json') { console.log(JSON.stringify({ base, rows })); process.exit(0); }
console.log(`ataque gana ${(base.att * 100).toFixed(1)}% (${N} rondas)`);
for (const side of ['att', 'def']) {
  const list = rows.filter((r) => r.side === side).sort((a, b) => b.wr - a.wr);
  const f = (r) => `${r.id} ${(r.wr * 100).toFixed(0)}%`;
  console.log(side, 'top:', list.slice(0, 6).map(f).join(', '), '| bottom:', list.slice(-6).map(f).join(', '));
}
