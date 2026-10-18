// Utilidades compartidas por las pruebas del motor: configuracion con acciones, estados de ronda controlados y generador "guionizado".
const fs = require('fs'); const path = require('path');
const S = require('./sim.js'); const { E, AI, R6, maps, operators, mkRng, playRound } = S;
const root = path.join(__dirname, '..'); const J = (f) => JSON.parse(fs.readFileSync(path.join(root, f), 'utf8'));
const base = { rules: J('config/rules.json'), balance: J('config/balance.json'), decisions: J('config/decisions.json'), gadgets: J('config/gadgets.json'), operators, maps };
const real = J('config/actions.json');

// Configura el motor con un bloque de acciones, un interruptor y ajustes de balance de acciones; devuelve el bloque usado.
function configure({ actions, enabled = true, maxActive, balance: extra }) {
  const balance = JSON.parse(JSON.stringify(base.balance)); balance.actions = { ...(balance.actions || {}), ...(extra || {}), enabled };
  const acts = actions === undefined ? undefined : JSON.parse(JSON.stringify(actions)); if (acts && maxActive != null) acts.maxActive = maxActive;
  E.configure({ ...base, balance, actions: acts }); return acts;
}
// accion sintetica para probar reglas generales sin depender de agentes concretos
const fake = (op, side, extra = {}) => ({ op, side, phases: ['entry', 'site'], uses: 1, requires: {}, tags: [], options: { off: {}, on: { do: [{ fx: 'mod', mods: { aim: 0.1 } }, { fx: 'time', s: 4 }] } }, ...extra });

// Ronda lista para la fase 'early' con las plantillas dadas; `roles` fuerza roles concretos { id: rol }.
function squadState(attIds, defIds, seed = 3, roles = {}) {
  const rng = mkRng(seed); const st = E.newRound({ mapId: maps[0].id, attIds, defIds });
  E.resolvePrep(st, AI.planDef(st, rng), AI.planAtt(st, rng), rng); E.setAdjust(st, AI.adjustAtt(st));
  [...st.att, ...st.def].forEach((m) => { if (roles[m.id]) m.role = roles[m.id]; });
  return { st, rng };
}
// rng que devuelve los valores dados en orden y luego 0.5: permite forzar el resultado de cada tirada del motor
const scripted = (values) => { let i = 0; return () => (i < values.length ? values[i++] : 0.5); };
const actKeys = (o) => Object.keys(o).filter((k) => k.startsWith('act.'));
const evs = (st, k) => st.events.filter((e) => e.k === k);

module.exports = { S, E, AI, R6, maps, operators, mkRng, playRound, base, real, configure, fake, squadState, scripted, actKeys, evs, J, root };
