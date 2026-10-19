// IA del rival: planes y decisiones por fase evaluados con simulaciones del propio motor.
(function (g) {
  'use strict';
  const R6 = (g.R6 = g.R6 || {});
  let AI = null;
  const E = () => R6.Engine;
  const configure = (cfg) => { AI = cfg; };
  const other = (s) => (s === 'att' ? 'def' : 'att');

  function weightedIndex(ws, rng) { let r = rng() * ws.reduce((a, b) => a + b, 0); for (let i = 0; i < ws.length; i++) { r -= ws[i]; if (r <= 0) return i; } return ws.length - 1; }
  function shuffle(arr, rng) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  // ---------- planes de preparacion ----------
  function planDef(st, rng) {
    const eng = E(); const map = R6.mapsById[st.map];
    const site = map.sites[Math.floor(rng() * map.sites.length)].id;
    const sorted = [...st.def].sort((a, b) => eng.op(b.id).roam - eng.op(a.id).roam);
    const nRoam = Math.min(weightedIndex(AI.roamerWeights, rng), sorted.length - 1);
    const roles = {}; st.def.forEach((m) => { roles[m.id] = 'anchor'; });
    sorted.slice(0, nRoam).forEach((m, i) => { roles[m.id] = i === 0 && rng() < AI.huntChance ? 'hunt' : 'roam'; });
    const reinf = AI.reinfProfiles[Math.floor(rng() * AI.reinfProfiles.length)];
    return { site, reinf: { ...reinf }, roles };
  }
  function attRoles(st) {
    const eng = E(); const roles = {}; const R = AI.roles;
    const byIntel = [...st.att].sort((a, b) => eng.op(b.id).intel - eng.op(a.id).intel).slice(0, R.intelTop).filter((m) => eng.op(m.id).intel > 0).map((m) => m.id);
    st.att.forEach((m) => {
      const o = eng.op(m.id);
      roles[m.id] = o.hb > 0 ? 'breach' : byIntel.includes(m.id) ? 'intel' : o.flank >= R.flankMin ? 'flank' : o.sup >= R.supportMin ? 'support' : 'entry';
    });
    return roles;
  }
  function planAtt(st, rng) {
    const map = R6.mapsById[st.map];
    return { spawn: map.spawns[Math.floor(rng() * map.spawns.length)].id, droneOrder: shuffle(map.sites.map((s) => s.id), rng), roles: attRoles(st) };
  }
  // tras el droneo: si encontraron el sitio, elige el spawn con mejor encaje para alguna ruta
  function adjustAtt(st) {
    const eng = E(); const map = R6.mapsById[st.map];
    if (!st.intel.found || !st.intel.site) return { spawn: st.plan.att.spawn };
    let best = null;
    map.spawns.forEach((sp) => {
      const probe = { ...st, plan: { ...st.plan, att: { ...st.plan.att, spawn: sp.id } } };
      const fit = Math.max(...eng.routesAvailable(st).map((r) => eng.routeFit(probe, r, st.intel.site, { site: st.intel.reinfSeen || 0, entry: 0, hatch: 0 })));
      const time = eng.cfg().B.lanes[sp.lane].time;
      const sc = fit - time * AI.spawnTimeWeight;
      if (!best || sc > best.sc) best = { sc, spawn: sp.id };
    });
    return { spawn: best.spawn };
  }

  // ---------- decisiones por fase ----------
  function combos(opts) {
    const groups = Object.keys(opts); let out = [{}];
    groups.forEach((g2) => { const next = []; out.forEach((c) => opts[g2].forEach((o) => next.push({ ...c, [g2]: o }))); out = next; });
    return out;
  }
  function randomChoice(opts, rng) { const c = {}; Object.keys(opts).forEach((g2) => { c[g2] = opts[g2][Math.floor(rng() * opts[g2].length)]; }); return c; }
  function value(st, side) {
    const V = AI.value; const T = E().cfg().rules.timers;
    if (st.result) return st.result.winner === side ? V.win : -V.win;
    const eng = E(); const own = eng.alive(st[side]).length, opp = eng.alive(st[other(side)]).length;
    let v = V.material * (own - opp);
    if (st.planted) v += side === 'att' ? V.plantedBonus : -V.plantedBonus;
    else v += (side === 'att' ? -1 : 1) * V.timePressure * (st.t / T.action);
    return v;
  }
  // fija los grupos que la IA decide por heuristica (ruta y anticipacion) en lugar de por simulacion
  function heuristicGroups(st, side, phase) {
    const eng = E(); const fixed = {};
    if (phase !== 'entry') return fixed;
    if (side === 'def') {
      const site = st.plan.def.site; const rf = st.plan.def.reinf;
      const avail = eng.routesAvailable(st);
      const best = avail.map((r) => ({ r, f: eng.routeFit(st, r, site, rf) })).sort((a, b) => b.f - a.f)[0];
      fixed.watch = best.r;
    } else {
      const avail = eng.routesAvailable(st);
      const site = st.intel.found ? st.intel.site : null;
      if (site) fixed.route = avail.map((r) => ({ r, f: eng.routeFit(st, r, site, { site: 0, entry: 0, hatch: 0 }) })).sort((a, b) => b.f - a.f)[0].r;
      else fixed.route = avail[0];
    }
    return fixed;
  }
  // valor medio de una eleccion: AI.sims rondas simuladas contra elecciones aleatorias del rival
  function evalChoice(st, side, phase, c, oppOpts, rng) {
    const eng = E(); let tot = 0;
    for (let i = 0; i < AI.sims; i++) {
      const sim = eng.clone(st); const oc = randomChoice(oppOpts, rng);
      eng.resolve(sim, phase, side === 'att' ? { att: c, def: oc } : { att: oc, def: c }, rng);
      tot += value(sim, side);
    }
    return tot / AI.sims;
  }
  // Evaluacion pareada para las acciones de agente: todas las candidatas usan las mismas semillas (rival y azar identicos), asi la diferencia
  // entre "con accion" y "sin ella" no se pierde en el ruido de 14 simulaciones aunque el efecto sea de pocos puntos.
  const seeded = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  // Valor de una accion: se juega el resto de la ronda con elecciones al azar de ambos bandos y se cuenta quien gana (+1/-1). Mirar solo hasta
  // el final de la fase no ve el valor de trampas, gadgets persistentes o ventajas que rinden en fases posteriores.
  function evalPaired(st, side, phase, c, oppOpts, seeds) {
    const eng = E(); let tot = 0;
    seeds.forEach((sd) => {
      const r = seeded(sd); const sim = eng.clone(st); const oc = randomChoice(oppOpts, r);
      eng.resolve(sim, phase, side === 'att' ? { att: c, def: oc } : { att: oc, def: c }, r);
      let guard = 0;
      while (sim.phase !== 'done' && guard++ < 12) { const ph = sim.phase; eng.resolve(sim, ph, { att: randomChoice(eng.options(sim, 'att', ph), r), def: randomChoice(eng.options(sim, 'def', ph), r) }, r); }
      tot += sim.result ? (sim.result.winner === side ? 1 : -1) : 0;
    });
    return tot / seeds.length;
  }
  const isAct = (g2) => g2.startsWith('act.');
  // Las decisiones de equipo se eligen por simulacion entre todas las combinaciones; las acciones de agente aparte, por ascenso por
  // coordenadas (una a una, con el resto fijo), para que el coste no se dispare con el numero de agentes con accion.
  // flags.noActs: decide solo las decisiones de equipo y deja las acciones de agente en 'off' (para aislar su efecto al calibrar)
  function decide(st, side, phase, rng, flags = {}) {
    const eng = E(); const opts = eng.options(st, side, phase);
    const fixed = heuristicGroups(st, side, phase);
    const acts = flags.noActs ? [] : Object.keys(opts).filter(isAct);
    const free = {}; Object.keys(opts).forEach((k) => { if (!(k in fixed) && !isAct(k)) free[k] = opts[k]; });
    const cands = combos(free).map((c) => ({ ...c, ...fixed }));
    const off = {}; acts.forEach((k) => { off[k] = opts[k][0]; });
    if ((cands.length === 1 && !acts.length) || rng() < AI.noise) return { ...cands[Math.floor(rng() * cands.length)], ...off };
    const oppSide = other(side); const oppOpts = eng.options(st, oppSide, phase);
    let best = null;
    cands.forEach((c) => { const m = evalChoice(st, side, phase, { ...c, ...off }, oppOpts, rng); if (!best || m > best.m) best = { m, c }; });
    const choice = { ...best.c, ...off }; let active = 0;
    const seeds = Array.from({ length: AI.actSims || AI.sims }, () => Math.floor(rng() * 4294967296)); let cur = evalPaired(st, side, phase, choice, oppOpts, seeds);
    const max = (eng.cfg().actions && eng.cfg().actions.maxActive) || 0;
    const margin = AI.actionMargin || 0;
    // Se puntua cada accion contra la base y se activan las mejores (no las primeras de la lista), recomprobando la ganancia con las ya elegidas
    const scored = [];
    acts.forEach((k) => {
      const def = eng.actionDef(k.slice(4)); if (def.when && !Object.entries(def.when).every(([g2, v]) => choice[g2] === v)) return;   // no se usaria
      opts[k].slice(1).forEach((o) => scored.push({ k, o, m: evalPaired(st, side, phase, { ...choice, [k]: o }, oppOpts, seeds) }));
    });
    scored.sort((x, y) => y.m - x.m);
    scored.forEach((c) => {
      if (active >= max || choice[c.k] !== off[c.k]) return;
      const m = active ? evalPaired(st, side, phase, { ...choice, [c.k]: c.o }, oppOpts, seeds) : c.m;
      if (m > cur + margin) { choice[c.k] = c.o; cur = m; active++; }
    });
    return choice;
  }

  // ---------- draft y bans ----------
  function pickTeam(side, available, rng) {
    const P = AI.pick; const W = P.weights[side]; const chosen = []; const cur = {};
    while (chosen.length < P.size && chosen.length < available.length) {
      let best = null;
      available.filter((o) => !chosen.includes(o)).forEach((o) => {
        let sc = 0;
        Object.entries(W).forEach(([k, w]) => { sc += (w * (o[k] || 0)) / (1 + P.diminish * (cur[k] || 0)); });
        P.needs[side].forEach((n) => { if ((cur[n.stat] || 0) < n.min && (o[n.stat] || 0) > 0) sc += n.bonus; });
        sc += rng() * P.noise;
        if (!best || sc > best.sc) best = { o, sc };
      });
      chosen.push(best.o); Object.keys(W).forEach((k) => { cur[k] = (cur[k] || 0) + (best.o[k] || 0); });
    }
    return chosen;
  }
  // veta al operador rival mas valioso (con algo de ruido)
  function pickBan(side, oppAvailable, rng) {
    const W = AI.pick.weights[side]; const noise = AI.ban.noise;
    const scored = oppAvailable.map((o) => ({ o, sc: Object.entries(W).reduce((s, [k, w]) => s + w * (o[k] || 0), 0) + rng() * noise })).sort((a, b) => b.sc - a.sc);
    const top = scored.slice(0, AI.ban.top);
    return top[Math.floor(rng() * top.length)].o.id;
  }

  // Estado completo "plausible" a partir de la vista parcial de un bando (la IA no hace trampas con info oculta)
  function determinize(view, side, rng) {
    const eng = E(); const st = eng.clone(view);
    if (side === 'att') {
      const guess = planDef(st, rng);
      if (st.intel.found && st.intel.site) { guess.site = st.intel.site; guess.reinf = { ...guess.reinf, site: st.intel.reinfSeen != null ? st.intel.reinfSeen : guess.reinf.site }; }
      st.plan.def = guess; st.def.forEach((m) => { m.role = guess.roles[m.id] || 'anchor'; });
    } else {
      const guess = planAtt(st, rng);
      st.plan.att = { spawn: guess.spawn, droneOrder: [], roles: guess.roles }; st.att.forEach((m) => { m.role = guess.roles[m.id] || 'entry'; });
      st.intel = { found: false, scouted: [], by: null, defSeen: null, reinfSeen: null };
    }
    return st;
  }
  function decideFromView(view, side, phase, rng) { return decide(determinize(view, side, rng), side, phase, rng); }

  R6.AI = { determinize, decideFromView, pickTeam, pickBan, configure, planDef, planAtt, adjustAtt, decide, attRoles, other };
})(typeof window !== 'undefined' ? window : globalThis);
