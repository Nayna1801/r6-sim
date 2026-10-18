// Calibracion de TODAS las acciones en paralelo: reparte las acciones entre procesos que ejecutan tools/action_lift.js y junta el resultado.
// Uso: node tools/action_lift_parallel.js [rondas] [semilla] [procesos] [id1,id2,...]     (por defecto 1500 rondas, semilla 5, 12 procesos, todas)
const { spawn } = require('child_process'); const fs = require('fs'); const path = require('path');
const N = process.argv[2] || 1500; const seed = process.argv[3] || 5; const W = +process.argv[4] || 12;
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'actions.json'), 'utf8'));
const ids = process.argv[5] ? process.argv[5].split(',') : Object.keys(cfg.actions);
const chunks = Array.from({ length: Math.min(W, ids.length) }, () => []); ids.forEach((id, i) => chunks[i % chunks.length].push(id));
const rows = []; let pending = chunks.length; const t0 = Date.now();
chunks.forEach((chunk, i) => {
  const p = spawn('node', [path.join(__dirname, 'action_lift.js'), N, seed, chunk.join(','), '--json'], { stdio: ['ignore', 'pipe', 'inherit'] }); let out = '';
  p.stdout.on('data', (d) => { out += d; });
  p.on('close', (code) => {
    const line = out.split('\n').find((l) => l.startsWith('JSON:')); if (line) rows.push(...JSON.parse(line.slice(5))); else console.error(`proceso ${i} sin resultado (codigo ${code})`);
    if (--pending === 0) report();
  });
});
function report() {
  rows.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
  rows.forEach((r) => console.log(`${(r.id + ' / ' + r.opt).padEnd(48)} ${r.d >= 0 ? '+' : ''}${r.d.toFixed(1).padStart(5)} pts (+-${r.ci.toFixed(1)})  ${r.flag}  n=${r.n}`));
  const bad = rows.filter((r) => r.flag !== 'ok');
  console.log(`\n${rows.length} opciones en ${((Date.now() - t0) / 60000).toFixed(1)} min; fuera de +-3: ${bad.length} (${bad.map((r) => `${r.id}/${r.opt} ${r.flag}`).join(', ') || 'ninguna'})`);
  fs.writeFileSync(path.join(__dirname, '..', 'tools', '_action_lift_last.json'), JSON.stringify(rows, null, 1));
}
