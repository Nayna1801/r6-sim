// Valida config/actions.json: agentes, fases, efectos, contrarrestos y opciones coherentes con el resto de la configuracion. Uso: node tools/validate_actions.js
const fs = require('fs'); const path = require('path');
const root = path.join(__dirname, '..'); const J = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const cfg = process.env.ACTIONS_FILE ? JSON.parse(fs.readFileSync(process.env.ACTIONS_FILE, 'utf8')) : J('config/actions.json');
// ACTIONS_FILE: para probar configuraciones invalidas
const ops = Object.fromEntries(J('data/operators.json').map((o) => [o.id, o]));
const dec = J('config/decisions.json'); const rules = J('config/rules.json');
const MODS = new Set(J('config/ui.json').modOrder.concat(['time', 'encounter', 'info', 'defuse', 'trade']));
const STATS = new Set(J('config/gadgets.json').stats);
const errs = []; const err = (id, msg) => errs.push(`${id}: ${msg}`);
const roles = new Set([...rules.defRoles, ...rules.attRoles]);
const sideOf = { att: 'att', def: 'def' };
const isMod = (m) => MODS.has(m) || (m.startsWith('carry.') && m.length > 6);

// Estadisticas que el motor CONSULTA en cada fase: un 'buff' a otra no tendria ningun efecto (asi se detecto el caso de Nokk).
const ORDER = ['early', 'entry', 'site', 'plant', 'post'];
const FIGHT = ['deny', 'aUtil', 'clear', 'aNade', 'smoke', 'vis', 'flank', 'sup'];
const CONSUMED = { early: ['flank'], entry: [...FIGHT, 'aHB', 'vtl'], site: FIGHT, plant: [...FIGHT, 'post'], post: [...FIGHT, 'post'] };
if (!Number.isInteger(cfg.maxActive) || cfg.maxActive < 1) err('config', 'maxActive debe ser un entero >= 1');
const bal = J('config/balance.json').actions || {};
['knownBonus', 'knownAmbush', 'knownDetect', 'fizzleBelow'].forEach((k) => { if (typeof bal[k] !== 'number') err('balance.actions', `falta el parametro numerico ${k}`); });
const allTags = new Set(cfg.tagList);

(cfg.counters || []).forEach((c, i) => {
  if (!allTags.has(c.source)) err(`counters[${i}]`, `etiqueta origen fuera de tagList: ${c.source}`);
  (c.against || []).forEach((t) => { if (!allTags.has(t)) err(`counters[${i}]`, `etiqueta destino fuera de tagList: ${t}`); });
  if (typeof c.scale !== 'number' || c.scale < 0) err(`counters[${i}]`, 'scale debe ser un numero >= 0');
});
(cfg.suppress || []).forEach((r, i) => {
  if (!allTags.has(r.source)) err(`suppress[${i}]`, `etiqueta origen fuera de tagList: ${r.source}`);
  (r.tags || []).forEach((t) => { if (!allTags.has(t)) err(`suppress[${i}]`, `etiqueta fuera de tagList: ${t}`); });
});
(cfg.statCounters || []).forEach((c, i) => {
  if (!STATS.has(c.stat)) err(`statCounters[${i}]`, `estadistica desconocida: ${c.stat}`);
  if (!sideOf[c.side]) err(`statCounters[${i}]`, `bando desconocido: ${c.side}`);
  (c.against || []).forEach((t) => { if (!allTags.has(t)) err(`statCounters[${i}]`, `etiqueta destino fuera de tagList: ${t}`); });
  if (typeof c.k !== 'number' || typeof c.min !== 'number') err(`statCounters[${i}]`, 'k y min deben ser numeros');
});

const checkDo = (id, side, k, list, a) => (list || []).forEach((e, i) => {
  // fases en las que el efecto puede tener consumidor: las de la accion y, si el gadget persiste, todas las posteriores
  const first = Math.min(...a.phases.map((p) => ORDER.indexOf(p))); const reach = a.persist ? ORDER.slice(first) : a.phases;
  const where = `${k}.do[${i}]`;
  if (!cfg.effects.includes(e.fx)) return err(id, `${where}: efecto no permitido: ${e.fx}`);
  if (e.fx === 'mod') Object.keys(e.mods || {}).forEach((m) => { if (!isMod(m)) err(id, `${where}: modificador desconocido: ${m}`); });
  if (e.fx === 'time' && typeof e.s !== 'number') err(id, `${where}: time requiere "s" numerico`);
  if (e.fx === 'time' && side === 'def') err(id, `${where}: time no tiene sentido en acciones defensivas (el reloj de ronda corre contra el atacante)`);
  if (e.fx === 'reveal') {
    if (!sideOf[e.who]) err(id, `${where}: reveal.who debe ser att o def`);
    if (!(e.count === 'all' || Number.isInteger(e.count))) err(id, `${where}: reveal.count debe ser entero o "all"`);
    if (!Number.isInteger(e.ttl) || e.ttl < 0) err(id, `${where}: reveal.ttl debe ser un entero >= 0`);
  }
  if (e.fx === 'ambush') {
    if (typeof e.aim !== 'number') err(id, `${where}: ambush requiere "aim" numerico`);
    if (e.downs && e.then !== 'finish' && !(e.then && e.then.fx === 'interrogate')) err(id, `${where}: ambush con derribo requiere then: "finish" o un interrogate`);
    if (!e.downs && e.then) err(id, `${where}: ambush sin derribo no admite then`);
    if (e.then && e.then.fx === 'interrogate') {
      const t = e.then; if (!t.exposed || !Number.isInteger(t.ttl)) err(id, `${where}: interrogate requiere exposed y ttl`);
    }
  }
  if (e.fx === 'ambush' && (!a.phases.includes('early') || a.side !== 'def')) err(id, `${where}: la emboscada solo existe en la fase early y para defensores`);
  if (e.fx === 'breach' && !a.phases.includes('entry')) err(id, `${where}: el breach solo tiene efecto en la fase entry`);
  if (e.fx === 'revive' && e.self != null && typeof e.self !== 'boolean') err(id, `${where}: revive.self debe ser booleano`);
  if (e.fx === 'mod') Object.keys(e.mods || {}).forEach((m) => { if ((m === 'info' || m.startsWith('carry.')) && !a.phases.includes('early')) err(id, `${where}: el modificador ${m} solo se aplica en la fase early`); });
  if (e.fx === 'breach' && typeof e.power !== 'number') err(id, `${where}: breach requiere "power" numerico`);
  if (e.fx === 'buff') {
    if (!STATS.has(e.stat)) err(id, `${where}: buff.stat desconocida: ${e.stat}`);
    else if (!reach.some((p) => CONSUMED[p].includes(e.stat))) err(id, `${where}: el motor no consulta la estadistica ${e.stat} en las fases ${reach.join('/')}: el bonus no tendria efecto`);
    if (typeof e.v !== 'number') err(id, `${where}: buff requiere "v" numerico`);
  }
  if (e.fx === 'trapdown') {
    if (typeof e.p !== 'number' || e.p < 0 || e.p > 1) err(id, `${where}: trapdown.p debe estar en [0,1]`);
    if (!Number.isInteger(e.n) || e.n < 1) err(id, `${where}: trapdown.n debe ser un entero >= 1`);
  }
  if (e.fx === 'revive' && !Number.isInteger(e.max)) err(id, `${where}: revive requiere "max" entero`);
});

Object.entries(cfg.actions).forEach(([id, a]) => {
  const op = ops[a.op];
  if (!op) return err(id, `agente inexistente: ${a.op}`);
  if (!id.startsWith(`${a.op}.`)) err(id, `el id debe empezar por "${a.op}."`);
  if (op.side !== a.side) err(id, `bando ${a.side} distinto del del agente (${op.side})`);
  if (!Array.isArray(a.phases) || !a.phases.length) err(id, 'sin fases');
  (a.phases || []).forEach((ph) => { if (!dec.phases.includes(ph)) err(id, `fase desconocida: ${ph}`); });
  if (!Number.isInteger(a.uses) || a.uses < 1) err(id, 'uses debe ser un entero >= 1');
  ((a.requires && a.requires.role) || []).forEach((r) => { if (!roles.has(r)) err(id, `rol desconocido: ${r}`); });
  Object.entries(a.when || {}).forEach(([grp, val]) => {
    const found = (a.phases || []).some((ph) => dec[ph] && dec[ph][a.side] && dec[ph][a.side][grp] && val in dec[ph][a.side][grp]);
    if (!found) err(id, `when.${grp}=${val} no existe como decision del bando ${a.side} en sus fases`);
  });
  if (a.persist !== undefined && typeof a.persist !== 'boolean') err(id, 'persist debe ser booleano');
  (a.tags || []).forEach((t) => { if (!allTags.has(t)) err(id, `etiqueta fuera de tagList: ${t}`); });
  const keys = Object.keys(a.options || {});
  if (keys[0] !== 'off') err(id, 'la primera opcion debe ser "off"');
  if (a.options && a.options.off && Object.keys(a.options.off).length) err(id, '"off" no puede tener efectos');
  if (keys.length < 2) err(id, 'debe tener al menos una opcion ademas de "off"');
  keys.forEach((k) => checkDo(id, a.side, k, a.options[k].do, a));
});
if (errs.length) { console.error(errs.join('\n')); process.exit(1); }
console.log(`config/actions.json valido: ${Object.keys(cfg.actions).length} acciones, ${(cfg.counters || []).length} contrarrestos, ${(cfg.statCounters || []).length} por estadistica, maxActive ${cfg.maxActive}`);
