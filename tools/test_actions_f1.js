// Pruebas de F1: estado derribado, revelado, contrarrestos y las acciones de Caveira, Pulse, Jackal, Mute, Thermite, Bandit y Finka.
// Uso: node tools/test_actions_f1.js     (se ejecuta con config/actions.json real)
const assert = require('assert');
const { E, AI, mkRng, playRound, real, configure, fake, squadState, scripted, actKeys, evs, maps } = require('./test_util.js');

const ATT = ['jackal', 'ash', 'thermite', 'glaz', 'finka']; const DEF = ['caveira', 'mute', 'pulse', 'bandit', 'doc'];
const CAV = 'act.caveira.silent_step', PUL = 'act.pulse.heartbeat_sensor', JAC = 'act.jackal.eyenox', MUT = 'act.mute.signal_disruptor';
const BAN = 'act.bandit.shock_wire', THE = 'act.thermite.exothermic_charge', FIN = 'act.finka.adrenal_surge';
const earlyState = (seed = 3, att = ATT) => { configure({ actions: real }); return squadState(att, DEF, seed, { caveira: 'roam' }); };
const earlyDec = (defExtra = {}, attExtra = {}) => ({ att: { approach: 'standard', ...attExtra }, def: { stance: 'hold', ...defExtra } });
const downs = (st) => [...st.att, ...st.def].filter((m) => m.down);

const tests = []; const test = (name, fn) => tests.push({ name, fn });

// ---------- Caveira: derribo, remate e interrogatorio ----------
// Orden de tiradas en resolveEarly para un roamer: [elegir observador, contacto, duelo (>=pAtt gana el roamer), exposicion, [quien sorprende]]
test('Caveira · cazar y rematar: derriba (no mata), remata y acredita la baja', () => {
  const { st } = earlyState(); const t0 = st.t; const cav = st.def.find((m) => m.id === 'caveira');
  E.resolve(st, 'early', earlyDec({ [CAV]: 'hunt_finish' }), scripted([0.1, 0.0, 0.999]));
  const dead = st.att.filter((m) => !m.alive); assert.strictEqual(dead.length, 1, 'una baja'); assert.strictEqual(dead[0].down, false, 'rematado, no derribado');
  assert.strictEqual(cav.kills, 1); assert.ok(cav.alive);
  const order = st.events.map((e) => e.k).filter((k) => ['ev.act.used', 'ev.act.down', 'ev.kill.finish'].includes(k));
  assert.deepStrictEqual(order, ['ev.act.used', 'ev.act.down', 'ev.kill.finish']);
  assert.ok(real.actions['caveira.silent_step'].options.hunt_finish.do.every((e) => e.fx !== 'time'), 'una accion defensiva no gasta el reloj de ronda');
});
test('Caveira · interrogar sin ser sorprendida: remata y revela a todos los atacantes vivos', () => {
  const { st } = earlyState(); const t0 = st.t; const cav = st.def.find((m) => m.id === 'caveira');
  E.resolve(st, 'early', earlyDec({ [CAV]: 'hunt_interrogate' }), scripted([0.1, 0.0, 0.999, 0.999]));
  assert.ok(cav.alive); assert.strictEqual(cav.kills, 1);
  const alive = st.att.filter((m) => m.alive); assert.strictEqual(alive.length, 4);
  alive.forEach((m) => assert.strictEqual(st.known.def[m.id], st.phaseNo + 2, `${m.id} conocido hasta el sitio (ttl 2)`));
  const ok = evs(st, 'ev.act.interrogate.ok'); assert.strictEqual(ok.length, 1); assert.strictEqual(ok[0].vis, 'both', 'los atacantes ven "ubicacion revelada"');
  assert.strictEqual(ok[0].p.ops.length, 4);
  assert.strictEqual(downs(st).length, 0);
});
test('Caveira · interrogar y ser sorprendida: muere, la victima queda derribada y se desangra al acabar la fase', () => {
  const { st } = earlyState(); const cav = st.def.find((m) => m.id === 'caveira');
  E.resolve(st, 'early', earlyDec({ [CAV]: 'hunt_interrogate' }), scripted([0.1, 0.0, 0.999, 0.0, 0.5]));
  assert.strictEqual(cav.alive, false); assert.strictEqual(evs(st, 'ev.kill.interrogCut').length, 1);
  assert.strictEqual(evs(st, 'ev.act.interrogate.ok').length, 0, 'sin revelado');
  assert.strictEqual(evs(st, 'ev.act.bleed').length, 1, 'la victima se desangra'); assert.strictEqual(downs(st).length, 0, 'nadie queda derribado al acabar la fase');
  assert.deepStrictEqual(Object.keys(st.known.def), [], 'no se conoce a nadie');
});
test('Caveira · si pierde el encuentro muere y no hay derribo', () => {
  const { st } = earlyState(); const cav = st.def.find((m) => m.id === 'caveira');
  E.resolve(st, 'early', earlyDec({ [CAV]: 'hunt_interrogate' }), scripted([0.1, 0.0, 0.0]));
  assert.strictEqual(cav.alive, false); assert.strictEqual(evs(st, 'ev.act.down').length, 0);
});
test('Caveira · sin contacto no hay derribo, pero la accion consume el uso', () => {
  const { st } = earlyState(); const cav = st.def.find((m) => m.id === 'caveira');
  E.resolve(st, 'early', earlyDec({ [CAV]: 'hunt_finish' }), scripted([0.1, 0.999]));
  assert.strictEqual(evs(st, 'ev.act.down').length, 0); assert.strictEqual(cav.uses['caveira.silent_step'], 0); assert.ok(cav.alive);
});
test('Caveira · solo se ofrece con rol roam o hunt', () => {
  const { st } = earlyState(); st.def.find((m) => m.id === 'caveira').role = 'anchor';
  assert.ok(!(CAV in E.options(st, 'def', 'early')));
  st.def.find((m) => m.id === 'caveira').role = 'hunt'; assert.ok(CAV in E.options(st, 'def', 'early'));
});
test('un derribado no combate ni cuenta como vivo para el fin de ronda', () => {
  const { st } = earlyState(); st.att.forEach((m) => { if (m.id !== 'ash') { m.alive = false; m.down = true; } });
  assert.strictEqual(E.alive(st.att).length, 1); st.att.find((m) => m.id === 'ash').alive = false;
  assert.strictEqual(E.checkEnd(st), true); assert.strictEqual(st.result.winner, 'def');
});

// ---------- revelado ----------
test('Jackal · rastrear revela al roamer rival con visibilidad solo para los atacantes', () => {
  const { st } = earlyState();
  E.resolve(st, 'early', earlyDec({}, { [JAC]: 'track' }), scripted([0.99]));
  assert.strictEqual(st.known.att.caveira, st.phaseNo + 1); const e = evs(st, 'ev.act.reveal'); assert.strictEqual(e.length, 1);
  assert.strictEqual(e[0].vis, 'att'); assert.deepStrictEqual(e[0].p.ops, ['caveira']);
  assert.ok(!E.viewFor(st, 'def').events.some((x) => x.k === 'ev.act.reveal'), 'el defensor no ve el revelado');
});
test('Caveira en sigilo frena el rastreo de Jackal (contrarresto por etiquetas)', () => {
  const { st } = earlyState(); E.resolve(st, 'early', earlyDec({ [CAV]: 'hunt_finish' }, { [JAC]: 'track' }), scripted([0.0]));
  assert.strictEqual(st.known.att.caveira, undefined, 'con rng 0 el rastreo (x0,5) no revela nada');
});
test('Pulse · escanear revela atacantes; el Adrenal Surge de Finka amplia el alcance', () => {
  const { st } = earlyState(); st.phase = 'site'; E.resolve(st, 'site', { att: { style: 'methodical' }, def: { stance: 'hold', [PUL]: 'scan' } }, scripted([0.0]));
  assert.strictEqual(Object.keys(st.known.def).length, 2); assert.strictEqual(evs(st, 'ev.act.reveal')[0].vis, 'def');
  const { st: s2 } = earlyState(); s2.phase = 'site'; E.resolve(s2, 'site', { att: { style: 'methodical', [FIN]: 'surge' }, def: { stance: 'hold', [PUL]: 'scan' } }, scripted([0.0]));
  assert.strictEqual(Object.keys(s2.known.def).length, 3, 'x1,5 por el surge: 3 atacantes');
});
test('el revelado caduca: conocido hasta su fase y no despues', () => {
  const { st } = earlyState(); E.resolve(st, 'early', earlyDec({}, { [JAC]: 'track' }), scripted([0.99]));
  assert.strictEqual(E.isKnown(st, 'att', 'caveira'), true); st.phaseNo += 1; assert.strictEqual(E.isKnown(st, 'att', 'caveira'), true, 'ttl 1: aun en la fase siguiente');
  st.phaseNo += 1; assert.strictEqual(E.isKnown(st, 'att', 'caveira'), false);
});
test('conocer a un rival mejora el duelo de quien lo conoce', () => {
  const { st } = earlyState(); const a = st.att.find((m) => m.id === 'ash'); const d = st.def.find((m) => m.id === 'pulse'); const ctx = { am: {}, dm: {} };
  const p0 = E.duel(st, a, d, ctx).p; st.known.att[d.id] = st.phaseNo; const p1 = E.duel(st, a, d, ctx).p; assert.ok(p1 > p0, 'el atacante que conoce al defensor gana mas');
  st.known.att = {}; st.known.def[a.id] = st.phaseNo; const p2 = E.duel(st, a, d, ctx).p; assert.ok(p2 < p0, 'el defensor que conoce al atacante gana mas');
});

// ---------- contrarrestos, gadgets persistentes ----------
test('Mute y Bandit se colocan en la fase de mapa, persisten y contrarrestan cargas y curas', () => {
  const { st } = earlyState();
  assert.strictEqual(E.actionScale(st, 'att', 'thermite.exothermic_charge'), 1);
  E.resolve(st, 'early', earlyDec({ [MUT]: 'jam', [BAN]: 'electrify' }), scripted([0.99]));
  assert.strictEqual(st.active.def.length, 2);
  assert.ok(Math.abs(E.actionScale(st, 'att', 'thermite.exothermic_charge') - 0.15) < 1e-9, 'jam x0,3 y electrificado x0,5');
  assert.ok(Math.abs(E.actionScale(st, 'att', 'finka.adrenal_surge') - 0.3) < 1e-9, 'jam x0,3 a la cura');
  assert.strictEqual(E.actionScale(st, 'def', 'pulse.heartbeat_sensor'), 1, 'no se contrarresta a si mismo');
});
test('el anti-util del equipo atacante debilita los gadgets electronicos del defensor', () => {
  const att = ['thatcher', 'twitch', 'ash', 'glaz', 'finka']; const { st } = earlyState(3, att);
  const s = E.actionScale(st, 'def', 'bandit.shock_wire'); assert.ok(s < 1 && s >= 0.25, `escala ${s}`);
  const { st: st2 } = earlyState(3, ['ash', 'glaz', 'finka', 'buck', 'thermite']); assert.strictEqual(E.actionScale(st2, 'def', 'bandit.shock_wire'), 1);
});
test('Bandit · el electrificado sube la proteccion contra el breach segun su escala', () => {
  const { st } = earlyState(); const s0 = E.actionScale(st, 'def', 'bandit.shock_wire'); const m0 = st.carry.aHBMul;
  E.resolve(st, 'early', earlyDec({ [BAN]: 'electrify' }), scripted([0.99]));
  assert.ok(Math.abs(st.carry.aHBMul - m0 * (1 + 0.4 * s0)) < 1e-9, `aHBMul ${st.carry.aHBMul}`);
});
test('Thermite · la carga exotermica abre mas paredes reforzadas y solo se usa con breach duro', () => {
  let on = 0, off = 0; const N = 500;
  for (let i = 0; i < N; i++) {
    for (const opt of ['off', 'exo']) {
      const { st } = earlyState(100 + i); const rng = mkRng(7 + i);
      E.resolve(st, 'early', earlyDec(), rng); st.phase = 'entry';
      E.resolve(st, 'entry', { att: { route: 'ground', method: 'hard', [THE]: opt }, def: { watch: 'none', stance: 'hold' } }, rng);
      if (opt === 'exo') on += st.openings; else off += st.openings;
    }
  }
  assert.ok(on / N > off / N + 0.03, `con carga ${on / N} vs sin ${off / N}`);
  const { st } = earlyState(); E.resolve(st, 'early', earlyDec(), mkRng(1)); st.phase = 'entry';
  E.resolve(st, 'entry', { att: { route: 'ground', method: 'flash', [THE]: 'exo' }, def: { watch: 'none', stance: 'hold' } }, mkRng(2));
  assert.strictEqual(evs(st, 'ev.act.used').length, 0, 'sin breach duro no se gasta'); assert.strictEqual(st.att.find((m) => m.id === 'thermite').uses, undefined);
});
test('un breach neutralizado por Mute y Bandit avisa del fallo', () => {
  const { st } = earlyState(); E.resolve(st, 'early', earlyDec({ [MUT]: 'jam', [BAN]: 'electrify' }), scripted([0.99])); st.phase = 'entry';
  E.resolve(st, 'entry', { att: { route: 'ground', method: 'hard', [THE]: 'exo' }, def: { watch: 'none', stance: 'hold' } }, mkRng(9));
  assert.strictEqual(evs(st, 'ev.act.fizzle').length, 1); assert.strictEqual(evs(st, 'ev.act.fizzle')[0].vis, 'att');   // solo lo ve el bando que lo uso
});

// ---------- Finka: revive y desangrado ----------
test('Finka · reanima a un derribado en la misma fase; si no, se desangra', () => {
  let revived = 0, tried = 0, bled = 0;
  for (let i = 0; i < 60; i++) {
    const { st } = earlyState(200 + i); configure({ actions: real, balance: { reviveExposed: { base: 0, perFoe: 0, max: 0 }, reviverCut: 0, downChance: 1 } }); st.phase = 'site'; const buck = st.att.find((m) => m.id === 'ash'); buck.alive = false; buck.down = true; buck.downBy = 'caveira';
    E.resolve(st, 'site', { att: { style: 'methodical', [FIN]: 'surge' }, def: { stance: 'hold' } }, mkRng(i)); if (st.result || !st.att.find((m) => m.id === 'finka').alive) continue; tried++;   // una Finka muerta en la fase no reanima
    if (evs(st, 'ev.act.revive').length === 1) revived++;   // con Finka activa tambien caen otros en duelos: levanta a uno (max 1)
    const { st: s2 } = earlyState(200 + i); configure({ actions: real, balance: { reviveExposed: { base: 0, perFoe: 0, max: 0 }, reviverCut: 0, downChance: 1 } }); s2.phase = 'site'; const b2 = s2.att.find((m) => m.id === 'ash'); b2.alive = false; b2.down = true; b2.downBy = 'caveira';
    E.resolve(s2, 'site', { att: { style: 'methodical' }, def: { stance: 'hold' } }, mkRng(i)); if (!b2.alive && !b2.down && evs(s2, 'ev.act.bleed').length === 1) bled++;
  }
  assert.ok(tried > 20, `muestras ${tried}`); assert.strictEqual(revived, tried, 'con escala 1 siempre reanima'); assert.ok(bled > 15, 'sin Finka se desangra');
});
test('Finka no reanima a un interrogado ni dentro del alcance de Mute (probabilidad reducida)', () => {
  const { st } = earlyState(); st.phase = 'site'; const v = st.att.find((m) => m.id === 'ash'); v.alive = false; v.down = true; v.noRevive = true;
  E.resolve(st, 'site', { att: { style: 'methodical', [FIN]: 'surge' }, def: { stance: 'hold' } }, mkRng(4)); assert.strictEqual(v.alive, false);
  let n = 0, ok = 0;
  for (let i = 0; i < 400; i++) {
    const { st: s } = earlyState(300 + i); E.resolve(s, 'early', earlyDec({ [MUT]: 'jam' }), mkRng(i)); s.phase = 'site';
    const w = s.att.find((m) => m.id === 'ash'); w.alive = false; w.down = true;
    E.resolve(s, 'site', { att: { style: 'methodical', [FIN]: 'surge' }, def: { stance: 'hold' } }, mkRng(1000 + i)); if (s.result || !s.att.find((m) => m.id === 'finka').alive) continue; n++; if (w.alive) ok++;
  }
  assert.ok(Math.abs(ok / n - 0.3) < 0.1, `tasa de revive bajo Mute ${(ok / n).toFixed(2)}`);
});

// ---------- correcciones de la revision ----------
test('Finka reanima al derribado de Caveira cuando esta expuesta, en la misma fase de mapa', () => {
  const { st } = earlyState(); configure({ actions: real, balance: { reviveExposed: { base: 0, perFoe: 0, max: 0 }, reviverCut: 0, downChance: 1 } }); const dec = earlyDec({ [CAV]: 'hunt_interrogate' }, { [FIN]: 'surge' });
  E.resolve(st, 'early', dec, scripted([0.1, 0.0, 0.999, 0.0, 0.5]));
  assert.strictEqual(evs(st, 'ev.kill.interrogCut').length, 1, 'Caveira sorprendida'); assert.strictEqual(evs(st, 'ev.act.revive').length, 1, 'Finka reanima');
  assert.strictEqual(evs(st, 'ev.act.bleed').length, 0, 'nadie se desangra'); assert.strictEqual(st.att.filter((m) => m.alive).length, 5, 'los cinco atacantes vivos');
});
test('un mod de accion no usada (when incumplido) no se aplica; si se uso, si', () => {
  configure({ actions: { maxActive: 2, actions: { 'thermite.t': fake('thermite', 'att', { phases: ['entry'], when: { method: 'hard' } }) } } });
  const { st } = squadState(ATT, DEF); const ch = { route: 'ground', method: 'flash', 'act.thermite.t': 'on' };
  assert.strictEqual(E.modsOf('entry', 'att', ch, st).aim, undefined, 'sin st.act no cuenta');
  st.act = { scale: { 'thermite.t': 1 }, hunt: {}, breach: {}, revive: [] }; assert.ok(Math.abs(E.modsOf('entry', 'att', ch, st).aim - 0.1) < 1e-9, 'usada: cuenta');
  st.act = { scale: {}, hunt: {}, breach: {}, revive: [] }; assert.strictEqual(E.modsOf('entry', 'att', ch, st).aim, undefined, 'otra accion usada, esta no');
});
test('una accion con when incumplido no ocupa hueco de maxActive', () => {
  const acts = { maxActive: 2, actions: { 'thermite.t': fake('thermite', 'att', { phases: ['entry'], when: { method: 'hard' } }), 'finka.a': fake('finka', 'att', { phases: ['entry'] }), 'ash.b': fake('ash', 'att', { phases: ['entry'] }) } };
  configure({ actions: acts }); const { st } = squadState(ATT, DEF);
  const ch = E.normalizeChoice(st, 'att', 'entry', { route: 'ground', method: 'flash', 'act.thermite.t': 'on', 'act.finka.a': 'on', 'act.ash.b': 'on' });
  assert.deepStrictEqual(actKeys(ch).filter((k) => ch[k] !== 'off').sort(), ['act.ash.b', 'act.finka.a', 'act.thermite.t'], 'las tres se conservan: la de thermite no se usara y no cuenta');
  const ch2 = E.normalizeChoice(st, 'att', 'entry', { route: 'ground', method: 'hard', 'act.thermite.t': 'on', 'act.finka.a': 'on', 'act.ash.b': 'on' });
  assert.strictEqual(actKeys(ch2).filter((k) => ch2[k] !== 'off').length, 2, 'con breach duro las tres cuentan y se limita a 2');
});
test('st.act sucio de una fase anterior no contamina la siguiente', () => {
  const { st } = earlyState(); st.act = { scale: { x: 1 }, hunt: {}, breach: { thermite: 9 }, revive: [] };
  E.resolve(st, 'early', earlyDec(), mkRng(3)); assert.strictEqual(st.act, null);
});
test('un revelado mas corto no acorta uno vigente', () => {
  const { st } = earlyState(); st.known.att.caveira = st.phaseNo + 5;
  E.resolve(st, 'early', earlyDec({}, { [JAC]: 'track' }), scripted([0.99])); assert.ok(st.known.att.caveira >= st.phaseNo + 4, `ttl ${st.known.att.caveira - st.phaseNo}`);
});
test('viewFor no incluye las decisiones del rival (ni sus acciones)', () => {
  const { st } = earlyState(); E.resolve(st, 'early', earlyDec({ [MUT]: 'jam' }), scripted([0.99]));
  const att = E.viewFor(st, 'att'); assert.ok(att.choices.early.att, 'las propias si'); assert.strictEqual(att.choices.early.def, undefined, 'las del rival no');
  const def = E.viewFor(st, 'def'); assert.strictEqual(def.choices.early.att, undefined); assert.ok(def.choices.early.def);
});

// ---------- informacion oculta, invariantes, IA ----------
test('viewFor oculta al rival los gadgets colocados, el conocimiento y los usos', () => {
  const { st } = earlyState(); E.resolve(st, 'early', earlyDec({ [MUT]: 'jam' }, { [JAC]: 'track' }), scripted([0.99]));
  const att = E.viewFor(st, 'att'); assert.deepStrictEqual(att.active.def, [], 'no ve los gadgets del defensor'); assert.deepStrictEqual(att.known.def, {});
  assert.ok(att.def.every((m) => m.uses === undefined), 'no ve los usos del rival'); assert.ok(att.att.some((m) => m.uses), 'si ve los propios');
  const def = E.viewFor(st, 'def'); assert.deepStrictEqual(def.known.att, {}, 'el defensor no sabe lo que sabe el atacante');
});
test('con la IA jugando rondas completas nunca queda nadie derribado ni se rompe nada', () => {
  configure({ actions: real }); const rng = mkRng(31); let used = 0, downEvents = 0;
  for (let i = 0; i < 150; i++) {
    const st = playRound(rng); used += evs(st, 'ev.act.used').length; downEvents += evs(st, 'ev.act.down').length;
    assert.strictEqual(downs(st).length, 0, 'sin derribados al acabar'); assert.ok(st.result);
    [...st.att, ...st.def].forEach((m) => assert.ok(!(m.alive && m.down)));
  }
  assert.ok(used > 0, 'la IA usa acciones');
});
test('la configuracion real (F1) valida', () => { require('child_process').execFileSync('node', [require('path').join(__dirname, 'validate_actions.js')], { stdio: 'pipe' }); });

let fail = 0;
tests.forEach(({ name, fn }) => { try { fn(); console.log(`ok   ${name}`); } catch (e) { fail++; console.log(`FAIL ${name}\n     ${String(e.message).split('\n')[0]}`); } });
console.log(`\n${tests.length - fail}/${tests.length} pruebas correctas`);
process.exit(fail ? 1 : 0);
