// F2: uso real de las acciones por la IA y estabilidad del win-rate. IA contra IA en rondas completas.
// Por accion: rondas en que es utilizable (cumple su condicion `when`), % de esas en que la IA la activa, y victoria de su bando al usarla vs al no usarla.
// Uso: node tools/action_usage.js [rondas] [semilla]      Con BAL='{"actions":{"enabled":false}}' mide la referencia sin acciones.
const { playRound, AI, E, mkRng } = require('./sim.js');
const N = +process.argv[2] || 3000; const rng = mkRng(+process.argv[3] || 1);
const stat = {}; const decide = AI.decide; let roundUse = {}; let attWin = 0, err = 0; const t0 = Date.now();
AI.decide = (st, side, phase, r, flags) => {
  const ch = decide(st, side, phase, r, flags); const opts = E.options(st, side, phase);
  for (const g of Object.keys(opts).filter((k) => k.startsWith('act.'))) {
    const def = E.actionDef(g.slice(4)); if (def.when && !Object.entries(def.when).every(([k, v]) => ch[k] === v)) continue;   // condicion no cumplida: no era utilizable
    const u = (roundUse[g] = roundUse[g] || { side, used: false }); if (ch[g] && ch[g] !== opts[g][0]) u.used = true;
  }
  return ch;
};
for (let i = 0; i < N; i++) {
  roundUse = {};
  try {
    const st = playRound(rng); if (st.result.winner === 'att') attWin++;
    for (const [g, u] of Object.entries(roundUse)) {
      const s = (stat[g] = stat[g] || { side: u.side, offered: 0, used: 0, winUsed: 0, winIdle: 0 }); s.offered++;
      const w = st.result.winner === u.side ? 1 : 0; if (u.used) { s.used++; s.winUsed += w; } else s.winIdle += w;
    }
  } catch (e) { if (err++ < 3) console.log(e.stack.split('\n').slice(0, 3).join(' | ')); }
}
const rows = Object.entries(stat).map(([g, s]) => ({ g, ...s, use: s.used / s.offered, d: (s.used ? s.winUsed / s.used : 0) - (s.offered > s.used ? s.winIdle / (s.offered - s.used) : 0) }));
rows.sort((a, b) => b.use - a.use);
rows.forEach((r) => console.log(`${r.g.padEnd(44)} ${r.side}  ofrecida ${String(r.offered).padStart(4)}  uso ${(r.use * 100).toFixed(0).padStart(3)}%  victoria usada-vs-no ${r.d >= 0 ? '+' : ''}${(r.d * 100).toFixed(1)}`));
const always = rows.filter((r) => r.offered >= 30 && r.use > 0.9);
console.log(`\nrondas ${N}  attWin ${(attWin / N * 100).toFixed(1)}%  errores ${err}  ${((Date.now() - t0) / 1000).toFixed(0)}s  acciones usadas >90%: ${always.map((r) => r.g).join(', ') || 'ninguna'}`);
