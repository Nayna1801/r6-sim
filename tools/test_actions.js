// Pruebas deterministas de las acciones de agente (motor + IA). Uso: node tools/test_actions.js
// Sin dependencias: assert de Node. Sale con codigo 1 si algo falla.
const assert = require('assert'); const path = require('path');
const { E, AI, mkRng, playRound, real, configure, fake, squadState, actKeys, maps } = require('./test_util.js');

const ATT = ['finka', 'ash', 'thermite', 'glaz', 'buck']; const DEF = ['caveira', 'mute', 'pulse', 'bandit', 'doc'];

const tests = []; const test = (name, fn) => tests.push({ name, fn });

test('con el interruptor apagado no aparece ningun grupo de accion', () => {
  configure({ actions: real, enabled: false }); const { st } = squadState(ATT, DEF);
  ['early', 'entry', 'site', 'plant', 'post'].forEach((ph) => ['att', 'def'].forEach((sd) => assert.deepStrictEqual(actKeys(E.options(st, sd, ph)), [])));
});
test('sin bloque de acciones el motor funciona como antes', () => {
  configure({ actions: undefined, enabled: true }); const { st } = squadState(ATT, DEF);
  assert.deepStrictEqual(actKeys(E.options(st, 'att', 'site')), []);
});
test('la accion aparece solo para su bando, sus fases y mientras el agente vive', () => {
  configure({ actions: { maxActive: 2, actions: { 'finka.test': fake('finka', 'att') } } }); const { st } = squadState(ATT, DEF);
  assert.deepStrictEqual(actKeys(E.options(st, 'att', 'site')), ['act.finka.test']);
  assert.deepStrictEqual(actKeys(E.options(st, 'att', 'early')), [], 'fase no permitida');
  assert.deepStrictEqual(actKeys(E.options(st, 'def', 'site')), [], 'otro bando');
  st.att.find((m) => m.id === 'finka').alive = false;
  assert.deepStrictEqual(actKeys(E.options(st, 'att', 'site')), [], 'agente muerto');
});
test('la primera opcion de cada accion es "off" y las opciones invalidas se normalizan a "off"', () => {
  configure({ actions: { maxActive: 2, actions: { 'finka.test': fake('finka', 'att') } } }); const { st } = squadState(ATT, DEF);
  assert.strictEqual(E.options(st, 'att', 'site')['act.finka.test'][0], 'off');
  assert.strictEqual(E.normalizeChoice(st, 'att', 'site', { 'act.finka.test': 'inventada' })['act.finka.test'], 'off');
  assert.strictEqual(E.normalizeChoice(st, 'att', 'site', { 'act.finka.test': 'on' })['act.finka.test'], 'on');
});
test('maxActive limita las acciones activas y conserva las primeras', () => {
  const acts = { maxActive: 2, actions: { 'finka.a': fake('finka', 'att'), 'ash.b': fake('ash', 'att'), 'thermite.c': fake('thermite', 'att') } };
  configure({ actions: acts }); const { st } = squadState(ATT, DEF);
  const ch = E.normalizeChoice(st, 'att', 'site', { 'act.finka.a': 'on', 'act.ash.b': 'on', 'act.thermite.c': 'on' });
  assert.deepStrictEqual(actKeys(ch).filter((k) => ch[k] !== 'off'), ['act.finka.a', 'act.ash.b']);
  configure({ actions: acts, maxActive: 1 });
  const { st: st2 } = squadState(ATT, DEF);
  const ch2 = E.normalizeChoice(st2, 'att', 'site', { 'act.finka.a': 'on', 'act.ash.b': 'on', 'act.thermite.c': 'on' });
  assert.strictEqual(actKeys(ch2).filter((k) => ch2[k] !== 'off').length, 1);
});
test('modsOf suma los modificadores de la accion elegida; el tiempo no va ahi (se carga una vez al usarla)', () => {
  configure({ actions: { maxActive: 2, actions: { 'finka.test': fake('finka', 'att') } } });
  const on = E.modsOf('site', 'att', { style: 'methodical', 'act.finka.test': 'on' }); const off = E.modsOf('site', 'att', { style: 'methodical', 'act.finka.test': 'off' });
  assert.ok(Math.abs((on.aim || 0) - (off.aim || 0) - 0.1) < 1e-9, 'aim +0.1');
  assert.strictEqual(on.time || 0, off.time || 0, 'el tiempo de la accion no va en los modificadores');
});
test('resolve gasta un uso, emite el evento solo para su bando y la accion deja de ofrecerse', () => {
  configure({ actions: { maxActive: 2, actions: { 'finka.test': fake('finka', 'att') } } }); const { st, rng } = squadState(ATT, DEF);
  st.phase = 'entry'; const t0 = st.t; E.resolve(st, 'entry', { att: { route: 'ground', method: 'flash', 'act.finka.test': 'on' }, def: {} }, rng);
  const finka = st.att.find((m) => m.id === 'finka');
  assert.strictEqual(finka.uses['finka.test'], 0);
  const evs = st.events.filter((e) => e.k === 'ev.act.used'); assert.strictEqual(evs.length, 1);
  assert.strictEqual(evs[0].vis, 'att'); assert.strictEqual(evs[0].p.who, 'finka'); assert.strictEqual(evs[0].p.action, 'finka.test');
  assert.strictEqual(evs[0].p.opt, 'finka.test.opt.on'); assert.strictEqual(evs[0].t, Math.round(t0), 'el evento se registra al empezar la accion');
  assert.ok(st.t >= t0 + 4, 'y el tiempo de la accion se carga una vez');
  assert.deepStrictEqual(actKeys(E.options(st, 'att', 'site')), [], 'sin usos');
  assert.ok(!E.viewFor(st, 'def').events.some((e) => e.k === 'ev.act.used'), 'el defensor no ve el evento');
});
test('"off" no gasta usos ni emite evento', () => {
  configure({ actions: { maxActive: 2, actions: { 'finka.test': fake('finka', 'att') } } }); const { st, rng } = squadState(ATT, DEF);
  st.phase = 'entry'; E.resolve(st, 'entry', { att: { route: 'ground', method: 'flash' }, def: {} }, rng);
  assert.strictEqual(st.events.filter((e) => e.k === 'ev.act.used').length, 0);
  assert.deepStrictEqual(actKeys(E.options(st, 'att', 'site')), ['act.finka.test']);
});
test('con el interruptor apagado las rondas son identicas a las de un motor sin acciones', () => {
  const run = (cfg) => { configure(cfg); const rng = mkRng(77); const out = []; for (let i = 0; i < 120; i++) { const st = playRound(rng); out.push(JSON.stringify([st.result, st.events.map((e) => [e.k, e.t]), st.att.map((m) => m.alive), st.def.map((m) => m.alive)])); } return out; };
  const without = run({ actions: undefined }); const off = run({ actions: real, enabled: false });
  assert.deepStrictEqual(off, without);
});
test('la IA nunca supera maxActive ni elige opciones invalidas', () => {
  const acts = { maxActive: 1, actions: { 'finka.a': fake('finka', 'att'), 'ash.b': fake('ash', 'att'), 'thermite.c': fake('thermite', 'att') } };
  configure({ actions: acts }); const rng = mkRng(5);
  for (let i = 0; i < 25; i++) {
    const { st } = squadState(ATT, DEF, 10 + i); const opts = E.options(st, 'att', 'site'); const ch = AI.decide(st, 'att', 'site', rng);
    actKeys(opts).forEach((k) => assert.ok(opts[k].includes(ch[k]), `opcion invalida en ${k}: ${ch[k]}`));
    assert.ok(actKeys(ch).filter((k) => ch[k] !== 'off').length <= 1, 'demasiadas acciones activas');
  }
});
test('la configuracion real de acciones valida', () => {
  const { execFileSync } = require('child_process');
  execFileSync('node', [path.join(__dirname, 'validate_actions.js')], { stdio: 'pipe' });
});

let fail = 0;
tests.forEach(({ name, fn }) => { try { fn(); console.log(`ok   ${name}`); } catch (e) { fail++; console.log(`FAIL ${name}\n     ${String(e.message).split('\n')[0]}`); } });
console.log(`\n${tests.length - fail}/${tests.length} pruebas correctas`);
process.exit(fail ? 1 : 0);
