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
  function decide(st, side, phase, rng) {
    const eng = E(); const opts = eng.options(st, side, phase);
    const fixed = heuristicGroups(st, side, phase);
    const free = {}; Object.keys(opts).forEach((k) => { if (!(k in fixed)) free[k] = opts[k]; });
    const cands = combos(free).map((c) => ({ ...c, ...fixed }));
    if (cands.length === 1 || rng() < AI.noise) return cands[Math.floor(rng() * cands.length)];
    const oppSide = other(side); const oppOpts = eng.options(st, oppSide, phase);
    let best = null;
    cands.forEach((c) => {
      let tot = 0;
      for (let i = 0; i < AI.sims; i++) {
        const sim = eng.clone(st); const oc = randomChoice(oppOpts, rng);
        eng.resolve(sim, phase, side === 'att' ? { att: c, def: oc } : { att: oc, def: c }, rng);
        tot += value(sim, side);
      }
      const m = tot / AI.sims; if (!best || m > best.m) best = { m, c };
    });
    return best.c;
  }

  R6.AI = { configure, planDef, planAtt, adjustAtt, decide, attRoles, other };
})(typeof window !== 'undefined' ? window : globalThis);
