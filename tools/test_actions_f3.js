// Pruebas de F3: efectos genericos nuevos (bonus de equipo, gadgets persistentes con bonus/modificadores, supresion de gadgets rivales,
// derribo por trampa, emboscada sin derribo) con acciones sinteticas, y cobertura de la configuracion real.
// Uso: node tools/test_actions_f3.js
const assert = require('assert');
const { E, mkRng, playRound, real, configure, squadState, scripted, evs, maps, operators } = require('./test_util.js');

const ATT = ['jackal', 'ash', 'thermite', 'glaz', 'finka']; const DEF = ['frost', 'mute', 'oryx', 'bandit', 'doc'];
const act = (op, side, phases, extra = {}, doList = []) => ({ op, side, phases, uses: 1, requires: {}, tags: [], options: { off: {}, on: { do: doList } }, ...extra });
const cfg = (actions, extra = {}) => ({ maxActive: 2, actions, ...extra });
const state = (actions, seed = 3, extra = {}) => { configure({ actions: cfg(actions, extra) }); return squadState(ATT, DEF, seed, { oryx: 'roam' }); };
const dec = (att = {}, def = {}) => ({ att: { approach: 'standard', route: 'ground', method: 'flash', style: 'methodical', action: 'plant', ...att }, def: { stance: 'hold', watch: 'none', ...def } });

const tests = []; const test = (name, fn) => tests.push({ name, fn });

test('un bonus de equipo (tbuff) mejora las estadisticas del bando en los duelos', () => {
  const { st } = state({}); const a = st.att.find((m) => m.id === 'ash'); const d = st.def.find((m) => m.id === 'doc'); const ctx = { am: {}, dm: {} };
  const p0 = E.duel(st, a, d, ctx).p;
  st.tbuff = { att: { clear: 4 }, def: {} }; const p1 = E.duel(st, a, d, ctx).p; assert.ok(p1 > p0, 'clear del atacante sube su probabilidad');
  st.tbuff = { att: {}, def: { deny: 4 } }; const p2 = E.duel(st, a, d, ctx).p; assert.ok(p2 < p0, 'deny del defensor la baja');
  st.tbuff = { att: { aUtil: 4 }, def: { deny: 4 } }; const p3 = E.duel(st, a, d, ctx).p; assert.ok(p3 > p2, 'el anti-util del atacante contrarresta el deny');
});
test('buff: se aplica durante la fase, se limpia al acabar y no se gasta si no se usa', () => {
  const { st } = state({ 'glaz.b': act('glaz', 'att', ['entry'], {}, [{ fx: 'buff', stat: 'clear', v: 3 }]) });
  E.resolve(st, 'early', dec(), mkRng(1)); st.phase = 'entry';
  E.resolve(st, 'entry', dec({ 'act.glaz.b': 'on' }), mkRng(2));
  assert.strictEqual(st.tbuff, null, 'limpio al acabar'); assert.strictEqual(evs(st, 'ev.act.used').length, 1);
  assert.strictEqual(E.persistentBuffs(st).att.clear, undefined, 'no persiste si el gadget no es persistente');
});
test('gadget persistente: guarda su bonus escalado y sus modificadores (sin los carry) para las fases siguientes', () => {
  const { st } = state({ 'mute.p': act('mute', 'def', ['early'], { persist: true, tags: ['jam'] }, [{ fx: 'buff', stat: 'aNade', v: 2 }, { fx: 'mod', mods: { foeAim: -0.1, 'carry.aHBMul': 1.2 } }]) });
  const s0 = E.actionScale(st, 'def', 'mute.p');
  E.resolve(st, 'early', dec({}, { 'act.mute.p': 'on' }), mkRng(1));
  assert.strictEqual(st.active.def.length, 1); const x = st.active.def[0];
  assert.ok(Math.abs(x.buffs.aNade - 2 * s0) < 1e-9, 'bonus guardado'); assert.ok(Math.abs(x.mods.foeAim - (-0.1 * s0)) < 1e-9, 'modificador guardado');
  assert.strictEqual(x.mods['carry.aHBMul'], undefined, 'los carry se aplican una sola vez');
  assert.ok(Math.abs(E.persistentBuffs(st).def.aNade - 2 * s0) < 1e-9);
  assert.ok(Math.abs(E.modsOf('entry', 'def', {}, st).foeAim - (-0.1 * s0)) < 1e-9, 'se suma en las fases siguientes');
  assert.strictEqual(E.modsOf('entry', 'att', {}, st).foeAim, undefined, 'solo para su bando');
});
test('suppress: un EMP anula, esa fase, el inhibidor rival que contrarresta a mi carga', () => {
  const counters = [{ source: 'jam', against: ['remote_charge'], scale: 0.3 }]; const suppress = [{ source: 'emp', tags: ['jam'] }];
  const { st } = state({
    'mute.j': act('mute', 'def', ['early'], { persist: true, tags: ['jam'] }, [{ fx: 'mod', mods: { 'carry.aHBMul': 1.1 } }]),
    'thermite.c': act('thermite', 'att', ['entry'], { tags: ['remote_charge'] }, [{ fx: 'time', s: 1 }]),
    'thatcher.e': act('ash', 'att', ['entry'], { tags: ['emp'] }, []),
  }, 3, { counters, suppress, tagList: ['jam', 'remote_charge', 'emp'] });
  assert.strictEqual(E.actionScale(st, 'att', 'thermite.c'), 1);
  E.resolve(st, 'early', dec({}, { 'act.mute.j': 'on' }), mkRng(1));
  assert.ok(Math.abs(E.actionScale(st, 'att', 'thermite.c') - 0.3) < 1e-9, 'el inhibidor colocado frena la carga');
  assert.strictEqual(E.actionScale(st, 'att', 'thermite.c', [{ side: 'att', id: 'thatcher.e' }]), 1, 'con el EMP vuelve a escala 1');
});
test('trapdown: la trampa deja a atacantes derribados; se desangran al acabar la fase y la baja se acredita al dueño', () => {
  let checked = 0;
  for (let i = 0; i < 12; i++) {
    const { st } = state({ 'frost.t': act('frost', 'def', ['entry'], {}, [{ fx: 'trapdown', p: 1, n: 2 }]) }, 50 + i);
    E.resolve(st, 'early', dec(), mkRng(i)); st.phase = 'entry'; if (!st.def.find((m) => m.id === 'frost').alive) continue;   // muerta: su trampa ya no se ofrece
    E.resolve(st, 'entry', dec({}, { 'act.frost.t': 'on' }), mkRng(100 + i)); if (st.result) continue; checked++;
    assert.strictEqual(evs(st, 'ev.act.down').length, 2, 'dos derribados'); assert.strictEqual(evs(st, 'ev.act.bleed').length, 2, 'dos desangrados');
    assert.ok(st.def.find((m) => m.id === 'frost').kills >= 2, 'baja acreditada a Frost'); assert.strictEqual([...st.att, ...st.def].filter((m) => m.down).length, 0);
  }
  assert.ok(checked >= 8, `muestras ${checked}`);
});
test('trapdown con probabilidad 0 no derriba a nadie', () => {
  const { st } = state({ 'frost.t': act('frost', 'def', ['entry'], {}, [{ fx: 'trapdown', p: 0, n: 3 }]) });
  E.resolve(st, 'early', dec(), mkRng(1)); st.phase = 'entry'; E.resolve(st, 'entry', dec({}, { 'act.frost.t': 'on' }), mkRng(2));
  assert.strictEqual(evs(st, 'ev.act.down').length, 0);
});
test('emboscada sin derribo: si el roamer gana, el rival muere como siempre', () => {
  const { st } = state({ 'oryx.a': act('oryx', 'def', ['early'], { requires: { role: ['roam', 'hunt'] } }, [{ fx: 'ambush', aim: 0.35, downs: false }]) });
  E.resolve(st, 'early', dec({}, { 'act.oryx.a': 'on' }), scripted([0.1, 0.0, 0.999]));
  assert.strictEqual(evs(st, 'ev.act.down').length, 0, 'sin derribo'); assert.strictEqual(evs(st, 'ev.kill.roamAmbush').length, 1);
});
test('la configuracion real valida y cada agente tiene al menos una accion', () => {
  require('child_process').execFileSync('node', [require('path').join(__dirname, 'validate_actions.js')], { stdio: 'pipe' });
  const withAction = new Set(Object.values(real.actions).map((a) => a.op)); const missing = operators.filter((o) => !withAction.has(o.id)).map((o) => o.id);
  assert.deepStrictEqual(missing, [], `agentes sin accion: ${missing.join(', ')}`);
});
test('con la IA y la configuracion real las rondas terminan bien y las acciones se usan', () => {
  configure({ actions: real }); const rng = mkRng(77); let used = 0;
  for (let i = 0; i < 120; i++) {
    const st = playRound(rng); assert.ok(st.result); assert.strictEqual(st.tbuff, null); assert.strictEqual(st.act, null);
    assert.strictEqual([...st.att, ...st.def].filter((m) => m.down).length, 0); used += evs(st, 'ev.act.used').length;
  }
  assert.ok(used > 120, `la IA usa acciones (${used})`);
});

// ---------- correcciones de la revision de F3 ----------
const { execFileSync } = require('child_process'); const fsx = require('fs'); const pathx = require('path'); const os = require('os');
const validate = (cfgObj) => { const f = pathx.join(os.tmpdir(), `actions_${process.pid}_${Math.random().toString(36).slice(2)}.json`); fsx.writeFileSync(f, JSON.stringify(cfgObj)); try { execFileSync('node', [pathx.join(__dirname, 'validate_actions.js')], { env: { ...process.env, ACTIONS_FILE: f }, stdio: 'pipe' }); return { ok: true }; } catch (e) { return { ok: false, msg: String(e.stderr) }; } finally { fsx.unlinkSync(f); } };
const ATT1 = ['jackal', 'ash', 'thermite', 'glaz', 'finka']; const DEF1 = ['caveira', 'mute', 'pulse', 'bandit', 'doc'];
const early1 = (seed = 3) => { configure({ actions: real }); return squadState(ATT1, DEF1, seed, { caveira: 'roam' }); };
const MUT = 'act.mute.signal_disruptor', BAN = 'act.bandit.shock_wire', THE = 'act.thermite.exothermic_charge';
const mutate = (fn) => { const c = JSON.parse(JSON.stringify(real)); fn(c); return c; };

test('el validador rechaza un bonus a una estadistica que el motor no consulta en las fases de la accion', () => {
  const bad = validate(mutate((c) => { c.actions['nokk.hel_presence_reduction'].options.use.do = [{ fx: 'buff', stat: 'aHB', v: 1 }]; }));
  assert.strictEqual(bad.ok, false); assert.ok(/no consulta/.test(bad.msg), bad.msg);
  assert.strictEqual(validate(mutate((c) => { c.actions['nokk.hel_presence_reduction'].options.use.do = [{ fx: 'buff', stat: 'flank', v: 1 }]; })).ok, true);
});
test('el validador rechaza reanimar en un defensor, emboscadas fuera de early y breach fuera de entry', () => {
  assert.strictEqual(validate(mutate((c) => { c.actions['doc.stim_pistol'].options.support.do.find((e) => e.fx === 'revive').self = 'si'; })).ok, false);
  assert.strictEqual(validate(mutate((c) => { c.actions['oryx.remah_dash'].phases = ['entry']; })).ok, false);
  assert.strictEqual(validate(mutate((c) => { c.actions['hibana.x_kairos'].phases = ['site']; })).ok, false);
});
test('Finka, Doc y Thunderbird reaniman a aliados y a si mismos (como en el juego)', () => {
  ['finka.adrenal_surge', 'doc.stim_pistol', 'thunderbird.kona_station'].forEach((id) => { const k = Object.values(real.actions[id].options).flatMap((o) => o.do || []).find((e) => e.fx === 'revive'); assert.ok(k && k.self === true, id); });
});
test('con un reanimador defensor activo los defensores caen derribados en vez de morir; Doc se levanta a si mismo', () => {
  let downedDef = 0, selfRev = 0, n = 0;
  for (let i = 0; i < 300; i++) {
    configure({ actions: cfg({ 'doc.s': act('mute', 'def', ['site'], {}, [{ fx: 'revive', max: 1, self: true }]) }) }); const { st } = squadState(ATT, DEF, 2000 + i, { oryx: 'roam' }); st.phase = 'site';
    E.resolve(st, 'site', dec({}, { 'act.doc.s': 'on' }), mkRng(2500 + i)); if (st.result) continue; n++;
    downedDef += evs(st, 'ev.act.down').filter((e) => st.def.some((m) => m.id === e.p.victim)).length;
    selfRev += evs(st, 'ev.act.revive').filter((e) => e.p.victim === 'mute').length;
  }
  assert.ok(n > 100 && downedDef > 20, `muestras ${n}, defensores derribados ${downedDef}`); assert.ok(selfRev > 0, 'el reanimador se levanta a si mismo cuando no hay otro caido');
});
test('un buff de flanqueo en la fase de mapa aumenta las bajas de roamers (Nokk ya no es una accion vacia)', () => {
  const run = (opt) => {
    let kills = 0;
    for (let i = 0; i < 500; i++) {
      configure({ actions: cfg({ 'nokk.f': act('ash', 'att', ['early'], {}, [{ fx: 'buff', stat: 'flank', v: 3 }]) }) }); const { st } = squadState(ATT, DEF, 700 + i, { oryx: 'roam', frost: 'roam' });
      E.resolve(st, 'early', dec({ 'act.nokk.f': opt }), mkRng(900 + i)); kills += evs(st, 'ev.kill.roamAtt').length + evs(st, 'ev.kill.roamTracked').length;
    }
    return kills / 500;
  };
  const on = run('on'), off = run('off'); assert.ok(on > off + 0.01, `con buff ${on.toFixed(3)} vs sin ${off.toFixed(3)}`);
});
test('el foeAim defensivo cuenta en la fase de mapa (Ela ya no es una accion vacia)', () => {
  const run = (opt) => {
    let kills = 0;
    for (let i = 0; i < 500; i++) {
      configure({ actions: cfg({ 'ela.h': act('oryx', 'def', ['early'], { requires: { role: ['roam', 'hunt'] } }, [{ fx: 'mod', mods: { foeAim: -0.4 } }]) }) }); const { st } = squadState(ATT, DEF, 800 + i, { oryx: 'roam', frost: 'roam' });
      E.resolve(st, 'early', dec({}, { 'act.ela.h': opt }), mkRng(1100 + i)); kills += evs(st, 'ev.kill.roamAtt').length + evs(st, 'ev.kill.roamTracked').length;
    }
    return kills / 500;
  };
  const on = run('on'), off = run('off'); assert.ok(on < off - 0.01, `con foeAim ${on.toFixed(3)} vs sin ${off.toFixed(3)}`);
});
test('un reanimador que muere en la fase no reanima; y el aviso de neutralizado solo lo ve su bando', () => {
  let died = 0, revivedWhileDead = 0, samples = 0;
  for (let i = 0; i < 400; i++) {
    const { st } = state({ 'finka.r': act('finka', 'att', ['site'], {}, [{ fx: 'revive', max: 1 }]) }, 1200 + i); st.phase = 'site';
    const v = st.att.find((m) => m.id === 'ash'); v.alive = false; v.down = true; v.downBy = 'frost';
    E.resolve(st, 'site', dec({ 'act.finka.r': 'on' }, {}), mkRng(1500 + i)); if (st.result) continue; samples++;
    const fin = st.att.find((m) => m.id === 'finka'); if (!fin.alive) { died++; if (evs(st, 'ev.act.revive').length) revivedWhileDead++; }
  }
  assert.ok(samples > 150 && died > 10, `muestras ${samples}, finka muerta ${died}`); assert.strictEqual(revivedWhileDead, 0, 'una Finka muerta no reanima');
  const { st } = early1(); E.resolve(st, 'early', dec({}, { [MUT]: 'jam', [BAN]: 'electrify' }), mkRng(2)); st.phase = 'entry';
  E.resolve(st, 'entry', { att: { route: 'ground', method: 'hard', [THE]: 'exo' }, def: { watch: 'none', stance: 'hold' } }, mkRng(9));
  const fz = evs(st, 'ev.act.fizzle'); assert.strictEqual(fz.length, 1); assert.strictEqual(fz[0].vis, 'att'); assert.ok(!E.viewFor(st, 'def').events.some((e) => e.k === 'ev.act.fizzle'));
});
test('reanimar es arriesgado: con mas rivales vivos se levanta menos y un fallo puede costar la vida al reanimador', () => {
  const run = (balance) => {
    let revived = 0, cut = 0, tries = 0;
    for (let i = 0; i < 400; i++) {
      configure({ actions: cfg({ 'finka.r': act('finka', 'att', ['site'], {}, [{ fx: 'revive', max: 1, self: true }]) }), balance }); const { st } = squadState(ATT, DEF, 3000 + i); st.phase = 'site';
      const v = st.att.find((m) => m.id === 'ash'); v.alive = false; v.down = true; v.downBy = 'frost';
      E.resolve(st, 'site', dec({ 'act.finka.r': 'on' }, {}), mkRng(3500 + i)); if (st.result) continue; tries++;
      revived += evs(st, 'ev.act.revive').length; cut += evs(st, 'ev.kill.reviveCut').length;
    }
    return { r: revived / tries, c: cut / tries };
  };
  const calm = run({ reviveExposed: { base: 0, perFoe: 0, max: 0 }, reviverCut: 0 }), hot = run({ reviveExposed: { base: 0.2, perFoe: 0.15, max: 0.9 }, reviverCut: 0.5 });
  assert.ok(calm.r > hot.r + 0.15, `sin presion ${calm.r.toFixed(2)} vs con presion ${hot.r.toFixed(2)}`); assert.strictEqual(calm.c, 0); assert.ok(hot.c > 0.03, `reanimadores sorprendidos ${hot.c.toFixed(3)}`);
});
test('downChance 0: nadie queda derribado y el comportamiento es el de siempre (mueren directamente)', () => {
  configure({ actions: cfg({ 'doc.s': act('mute', 'def', ['site'], {}, [{ fx: 'revive', max: 1, self: true }]) }), balance: { downChance: 0 } }); const { st } = squadState(ATT, DEF, 77); st.phase = 'site';
  E.resolve(st, 'site', dec({}, { 'act.doc.s': 'on' }), mkRng(78)); assert.strictEqual(evs(st, 'ev.act.down').length, 0);
});
test('los bonus se recalculan con la escala final: el anti-util de la fase tambien debilita al gadget electronico rival', () => {
  const acts = { 'mute.p': act('mute', 'def', ['early'], { persist: true, tags: ['electronic'] }, [{ fx: 'buff', stat: 'aNade', v: 2 }]), 'dok.a': act('ash', 'att', ['early'], {}, [{ fx: 'buff', stat: 'aUtil', v: 3 }]) };
  const SC = { statCounters: [{ stat: 'aUtil', side: 'att', against: ['electronic'], k: 0.12, min: 0.25 }] };
  const { st: a } = state(acts, 31, SC); E.resolve(a, 'early', dec({}, { 'act.mute.p': 'on' }), mkRng(1));
  const { st: b } = state(acts, 31, SC); E.resolve(b, 'early', dec({ 'act.dok.a': 'on' }, { 'act.mute.p': 'on' }), mkRng(1));
  assert.ok(b.active.def[0].buffs.aNade < a.active.def[0].buffs.aNade - 0.2, `con anti-util ${b.active.def[0].buffs.aNade.toFixed(2)} vs sin ${a.active.def[0].buffs.aNade.toFixed(2)}`);
});

let fail = 0;
tests.forEach(({ name, fn }) => { try { fn(); console.log(`ok   ${name}`); } catch (e) { fail++; console.log(`FAIL ${name}\n     ${String(e.message).split('\n')[0]}`); } });
console.log(`\n${tests.length - fail}/${tests.length} pruebas correctas`);
process.exit(fail ? 1 : 0);
