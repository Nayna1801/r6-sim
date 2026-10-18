// Verifica que toda clave i18n usada (literal o derivada de config/datos) existe en todos los idiomas, y que no hay claves sin uso evidente.
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'); const J = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const files = ['js/app.js', 'js/ui/controller.js', 'js/ui/screens.js', 'js/ui/components.js', 'js/ui/core.js', 'js/net.js', 'js/engine.js'];
const need = new Set();
files.forEach((f) => { for (const m of read(f).matchAll(/\b(?:T|t)\(\s*'([\w.]+)'/g)) need.add(m[1]); });
// eventos y motivos emitidos por el motor
const eng = read('js/engine.js');
for (const m of eng.matchAll(/'((?:ev|why)\.[\w.]+)'/g)) need.add(m[1]);
for (const line0 of eng.split(String.fromCharCode(10))) { const line = line0.replace(/bump\([^)]*\)/g, ''); if (/\b(kill|fight)\(/.test(line)) for (const m of line.matchAll(/'([a-zA-Z]+)'/g)) if (!['att', 'def'].includes(m[1])) need.add(`ev.kill.${m[1]}`); }
for (const m of eng.matchAll(/finish\(st, '(\w+)', '(\w+)'\)/g)) { need.add(`reason.${m[2]}`); need.add(`enum.reason.${m[2]}`); }
for (const m of eng.matchAll(/finish\(st, (?:st\.planted \? 'att' : 'def'|[^,]+), (?:st\.planted \? '(\w+)' : '(\w+)'|'(\w+)')\)/g)) [m[1], m[2], m[3]].filter(Boolean).forEach((r) => { need.add(`reason.${r}`); need.add(`enum.reason.${r}`); });
['defElim', 'defElimPlanted', 'attElim', 'defuseNoAtt', 'mutual', 'plantedMutual', 'timeout', 'defuse', 'explode'].forEach((r) => { need.add(`reason.${r}`); need.add(`enum.reason.${r}`); });
// derivadas de config
const dec = J('config/decisions.json'), rules = J('config/rules.json'), ui = J('config/ui.json');
dec.phases.forEach((ph) => { need.add(`phase.${ph}.title`); need.add(`phase.${ph}.resolving`);
  ['att', 'def'].forEach((sd) => { need.add(`phase.${ph}.${sd}.goal`); Object.entries(dec[ph][sd]).forEach(([g, opts]) => { need.add(`dec.group.${ph}.${sd}.${g}`); Object.keys(opts).forEach((o) => { need.add(`dec.${ph}.${sd}.${g}.${o}`); need.add(`dec.${ph}.${sd}.${g}.${o}.desc`); }); }); }); });
ui.tags.forEach((t) => need.add(`tag.${t.id}`));
// datos de agentes: especialidades, gadgets y habilidad de cada uno (la ficha de agente las pide por clave derivada)
J('data/operators.json').forEach((o) => { need.add(`ability.${o.ability}`); need.add(`ability.${o.ability}.desc`); o.specialties.forEach((sp) => { need.add(`spec.${sp}`); need.add(`spec.${sp}.desc`); }); o.gadgets.forEach((gd) => { need.add(`gadget.${gd}`); need.add(`gadget.${gd}.desc`); }); });
['health', 'speed'].forEach((k) => need.add(`sheet.${k}`));
// acciones de agente: nombre, descripcion y opciones (menos 'off', que usa ui.actionOff)
Object.entries(J('config/actions.json').actions).forEach(([id, a]) => { need.add(`action.${id}`); need.add(`action.${id}.desc`); need.add(`action.${id}.counters`); Object.values(a.options).forEach((o) => (o.do || []).forEach((e) => Object.entries(e.mods || {}).forEach(([k, v]) => { if (k.endsWith('Mul') && v > 1) need.add(`mod.${k}.up`); }))); Object.keys(a.options).filter((o) => o !== 'off').forEach((o) => { need.add(`action.${id}.opt.${o}`); need.add(`action.${id}.opt.${o}.desc`); }); });
[...ui.stats.att, ...ui.stats.def, ...ui.compChips.att.map((c) => c.stat), ...ui.compChips.def.map((c) => c.stat), ...ui.pickFilters.att, ...ui.pickFilters.def].forEach((s) => { need.add(`stat.${s}`); need.add(`stat.${s}.desc`); });
[...rules.defRoles, ...rules.attRoles, 'planter'].forEach((r) => { need.add(`role.${r}`); need.add(`role.${r}.desc`); });
rules.lanes.forEach((l) => need.add(`lane.${l}`)); rules.reinforcements.buckets.forEach((b) => { need.add(`reinf.${b}`); need.add(`reinf.${b}.desc`); });
rules.draft.modes.forEach((m) => need.add(`draft.${m}`)); ['ranked', 'all', 'choose'].forEach((m) => need.add(`mapmode.${m}`));
ui.modOrder.forEach((m) => need.add(`mod.${m}`));
for (const ph of dec.phases) for (const sd of ['att', 'def']) for (const g of Object.values(dec[ph][sd])) for (const o of Object.values(g)) Object.keys(o.mods || {}).filter((k) => k.startsWith('carry.')).forEach((k) => need.add(`mod.${k}`));
['att', 'def'].forEach((s) => { need.add(`side.${s}`); need.add(`result.${s}`); need.add(`enum.side.${s}`); });
['kill', 'prep', 'early', 'entry', 'site', 'plant', 'post', 'end', 'adjust', 'act'].forEach((k) => need.add(`evtype.${k}`));
['alta','media','baja','unknown'].forEach((k) => need.add(`conf.${k}`)); need.add('ui.spawnUndocumented'); need.add('spawn.generic');
// enums de parametros de eventos
Object.values(J('config/i18n.json').paramTypes).filter((t) => t.startsWith('enum:')).forEach((t) => { /* los valores se validan abajo */ });
const langs = J('config/i18n.json').languages; let bad = 0;
const dicts = Object.fromEntries(langs.map((l) => [l, J(`locales/${l}.json`)]));
langs.forEach((l) => { const missing = [...need].filter((k) => !(k in dicts[l])); if (missing.length) { bad += missing.length; console.log(`[${l}] faltan ${missing.length}:`, missing.join(', ')); } });
const keysEq = langs.every((l) => Object.keys(dicts[l]).length === Object.keys(dicts[langs[0]]).length);
const dyn = /^(stage\.ban\.(active|against)|mapinfo\.(ranked|notRanked)|ui\.resolving|stage\.prep\.|stage\.phase\.fit\.)/;
const unused = Object.keys(dicts[langs[0]]).filter((k) => !need.has(k) && !k.startsWith('enum.') && !k.startsWith('names.') && !dyn.test(k));
console.log(`claves requeridas: ${need.size}; idiomas: ${langs.join(',')}; mismas claves en todos: ${keysEq}; sin uso aparente: ${unused.length}`); if (unused.length) console.log('  sin uso:', unused.join(', '));
process.exit(bad ? 1 : 0);
