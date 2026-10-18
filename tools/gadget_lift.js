// Calibracion de gadgets: empuje de cada gadget = cambio medio de tasa de victoria de los agentes que lo llevan (sin / con gadgets),
// descontando el cambio medio de su bando. Un gadget bien calibrado queda cerca de 0 (+-1 punto).
// Uso: node tools/gadget_lift.js [rondas] [semilla]
const { execFileSync } = require('child_process'); const path = require('path'); const fs = require('fs');
const N = process.argv[2] || 8000; const seed = process.argv[3] || 5;
const run = (w) => JSON.parse(execFileSync('node', [path.join(__dirname, 'opwin.js'), N, seed, '--json'], { env: { ...process.env, BAL: JSON.stringify({ gadgets: { weight: w } }) }, maxBuffer: 1 << 26 }).toString());
const base = run(0), withG = run(1);
const ops = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'operators.json'), 'utf8')); const byId = Object.fromEntries(ops.map((o) => [o.id, o]));
const wr = (r) => Object.fromEntries(r.rows.map((x) => [x.id, x.wr]));
const b = wr(base), g = wr(withG);
const sideShift = {}; ['att', 'def'].forEach((s) => { const ids = ops.filter((o) => o.side === s).map((o) => o.id); sideShift[s] = ids.reduce((a, i) => a + (g[i] - b[i]), 0) / ids.length; });
console.log(`ataque gana: sin ${(base.base.att * 100).toFixed(1)}% -> con ${(withG.base.att * 100).toFixed(1)}%   cambio medio por bando: att ${(sideShift.att * 100).toFixed(1)}  def ${(sideShift.def * 100).toFixed(1)}`);
const lift = {};
ops.forEach((o) => (o.gadgets || []).forEach((id) => { (lift[id] = lift[id] || []).push((g[o.id] - b[o.id] - sideShift[o.side]) * 100); }));
const rows = Object.entries(lift).map(([id, v]) => ({ id, n: v.length, m: v.reduce((a, x) => a + x, 0) / v.length })).sort((x, y) => y.m - x.m);
rows.forEach((r) => console.log(`${r.id.padEnd(22)} n=${String(r.n).padStart(2)}  ${r.m >= 0 ? '+' : ''}${r.m.toFixed(1)} pts`));
const sd = (arr) => Math.sqrt(arr.reduce((a, x) => a + x * x, 0) / arr.length);
console.log('dispersion de la tasa por agente (desv. tipica, puntos): sin', (sd(ops.map((o) => (b[o.id] - (o.side === 'att' ? base.base.att : base.base.def)) * 100))).toFixed(2), ' con', (sd(ops.map((o) => (g[o.id] - (o.side === 'att' ? withG.base.att : withG.base.def)) * 100))).toFixed(2));
if (process.argv[4] === '--movers') {
  const mv = ops.map((o) => ({ id: o.id, side: o.side, d: (g[o.id] - b[o.id] - sideShift[o.side]) * 100, g: o.gadgets.join('+') })).sort((x, y) => y.d - x.d);
  console.log('mayores subidas:', mv.slice(0, 6).map((m) => `${m.id} ${m.d.toFixed(1)}`).join(', '));
  console.log('mayores bajadas:', mv.slice(-6).map((m) => `${m.id} ${m.d.toFixed(1)}`).join(', '));
}
