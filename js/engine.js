// Motor de ronda por fases. Sin textos ni constantes de balance incrustados:
//  - numeros: config/balance.json, config/rules.json, config/decisions.json
//  - textos: los eventos llevan clave i18n (k) y parametros (p); la UI los traduce.
// Estado serializable (JSON). Las funciones de resolucion son puras respecto al RNG recibido.
(function (g) {
  'use strict';
  const R6 = (g.R6 = g.R6 || {});
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sig = (x) => 1 / (1 + Math.exp(-x));
  const clone = (o) => JSON.parse(JSON.stringify(o));

  let CFG = null; const OPS = {}; const MAPS = {};

  function configure({ rules, balance, decisions, operators, maps }) {
    CFG = { rules, B: balance, dec: decisions };
    Object.keys(OPS).forEach((k) => delete OPS[k]); Object.keys(MAPS).forEach((k) => delete MAPS[k]);
    operators.forEach((o) => { OPS[o.id] = o; });
    maps.forEach((m) => { MAPS[m.id] = m; });
    R6.mapsById = MAPS; R6.opsById = OPS;
  }
  const cfg = () => CFG;
  const op = (id) => OPS[id];
  const mapOf = (st) => MAPS[st.map];

  // ---------- utilidades de equipo ----------
  const alive = (team) => team.filter((m) => m.alive);
  const sum = (team, k) => team.reduce((s, m) => s + (OPS[m.id][k] || 0), 0);
  const isRoamer = (m) => m.role === 'roam' || m.role === 'hunt';
  function pickW(arr, wf, rng) {
    let tot = 0; const ws = arr.map((o) => { const w = Math.max(0.01, wf(o)); tot += w; return w; });
    let r = rng() * tot;
    for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r <= 0) return arr[i]; }
    return arr[arr.length - 1];
  }
  const ev = (st, k, p, vis) => { st.events.push({ t: Math.round(st.t), k, p: p || {}, vis: vis || 'both' }); };
  const bump = (st, key, v = 1) => { st.factors[key] = (st.factors[key] || 0) + v; };

  // ---------- estado ----------
  function newRound({ mapId, attIds, defIds, round }) {
    return {
      v: 1, map: mapId, round: round || 1, phase: 'plan', t: 0,
      att: attIds.map((id) => ({ id, alive: true, kills: 0, role: 'entry' })),
      def: defIds.map((id) => ({ id, alive: true, kills: 0, role: 'anchor' })),
      plan: { def: null, att: null },
      intel: { found: false, by: null, scouted: [], defSeen: null, reinfSeen: null },
      carry: { denyMul: 1, aHBMul: 1, setupAim: 0, splitAtt: 0 },
      infoEdge: 0, routeFit: 0, antic: 0, openings: 0, noHB: false, planted: false, plantT: null,
      postStage: 0, plantTries: 0, events: [], factors: {}, result: null,
    };
  }

  // ---------- decisiones ----------
  function groupsOf(phase, side) { return (CFG.dec[phase] && CFG.dec[phase][side]) || {}; }
  function routesAvailable(st) {
    const m = mapOf(st); const out = ['ground'];
    if (m.sites.some((s) => s.level >= CFG.B.route.highLevelMin) || m.profile.vert >= 0.5) out.push('roof');
    if (m.sites.some((s) => s.level != null && s.level <= CFG.B.route.basementLevelMax)) out.push('basement');
    return out;
  }
  function options(st, side, phase) {
    const own = alive(st[side]); const out = {};
    Object.entries(groupsOf(phase, side)).forEach(([grp, opts]) => {
      out[grp] = Object.entries(opts).filter(([, o]) => {
        const r = o.requires || {};
        if (r.minAlive && own.length < r.minAlive) return false;
        if (r.needsBreacher && !own.some((m) => OPS[m.id].hb > 0)) return false;
        if (r.route && !routesAvailable(st).includes(r.route)) return false;
        return true;
      }).map(([id]) => id);
    });
    return out;
  }
  function normalizeChoice(st, side, phase, choice) {
    const opts = options(st, side, phase); const out = {};
    Object.keys(opts).forEach((grp) => { const c = choice && choice[grp]; out[grp] = opts[grp].includes(c) ? c : opts[grp][0]; });
    return out;
  }
  function modsOf(phase, side, choice) {
    const out = {}; const groups = groupsOf(phase, side);
    Object.entries(choice || {}).forEach(([grp, id]) => {
      const o = groups[grp] && groups[grp][id]; if (!o) return;
      Object.entries(o.mods || {}).forEach(([k, v]) => { out[k] = (out[k] || 0) + v; });
    });
    return out;
  }
  function applyCarry(st, mods) {
    Object.entries(mods).forEach(([k, v]) => {
      if (!k.startsWith('carry.')) return;
      const key = k.slice(6);
      if (key.endsWith('Mul')) st.carry[key] = (st.carry[key] || 1) * v; else st.carry[key] = (st.carry[key] || 0) + v;
    });
  }

  // ---------- duelos ----------
  function laneOf(st) {
    const sp = st.plan.att && mapOf(st).spawns.find((s) => s.id === st.plan.att.spawn);
    return (sp && sp.lane) || 'front';
  }
  function duel(st, a, d, ctx) {
    const w = CFG.B.duel; const A = alive(st.att), D = alive(st.def);
    const sa = OPS[a.id], sd = OPS[d.id]; const map = mapOf(st); const c = st.carry;
    const am = ctx.am || {}, dm = ctx.dm || {};
    const denyEff = Math.max(0, sum(D, 'deny') - sum(A, 'aUtil') * w.aUtilVsDeny) * w.denyScale * c.denyMul;
    const clearEff = Math.max(0, sum(A, 'clear') - sum(D, 'aNade') * w.nadeVsClear) * w.clearScale;
    const smokeEff = Math.max(0, sum(A, 'smoke') * w.smokeScale - sum(D, 'vis') * w.visScale);
    const flankMul = c.splitAtt ? 1.8 : 1;
    const roamersAlive = D.filter(isRoamer).length;
    const flankDef = roamersAlive * w.flankDef * Math.max(0.3, 1 - sum(A, 'flank') * w.flankWatch * flankMul);
    const flankAtt = flankMul > 1 ? w.flankAtt * sum(A, 'flank') * (flankMul - 1) : 0;
    const lng = (s) => s.long * Math.max(0, map.profile.open - w.longThreshold) * w.longBonus;
    let effA = a.aimOverride != null ? a.aimOverride : sa.aim;
    effA += w.entry * sa.entry + clearEff + smokeEff + (st.noHB ? -w.noBreachPenalty : w.openingBonus * st.openings)
      + flankAtt + lng(sa) + (am.aim || 0) + (am.clear || 0) + (am.smoke || 0) + (am.flank || 0) + st.routeFit;
    let effD = sd.aim + w.anchor * sd.anchor + w.defBase + (isRoamer(d) ? 0 : c.setupAim) + denyEff + flankDef + lng(sd)
      + w.supportScale * sum(D, 'sup') + (dm.aim || 0) + (am.foeAim || 0) + st.antic;
    effA += w.supportScale * sum(A, 'sup') + (dm.foeAim || 0);
    if (st.infoEdge >= 0) effA += w.infoScale * st.infoEdge; else effD += w.infoScale * -st.infoEdge;
    effA += clamp((A.length - D.length) * w.numAdv, -w.numAdvCap, w.numAdvCap);
    effD += clamp((D.length - A.length) * w.numAdv, -w.numAdvCap, w.numAdvCap);
    if (ctx.post) { effA += w.postPlantScale * 2 * (sum(A, 'post') / Math.max(1, A.length)) + w.postPlantBase + (am.post || 0); effD -= w.postDefPenalty; }
    if (!ctx.post && st.t > w.lateTime) effA -= w.latePenalty;
    return { p: sig(w.k * (effA - effD)), effA, effD };
  }
  function kill(st, killer, victim, trade, tag) {
    victim.alive = false; killer.kills++;
    ev(st, `ev.kill.${tag}`, { killer: killer.id, victim: victim.id, trade: !!trade });
  }
  function fight(st, a, d, ctx, rng, tag) {
    const w = CFG.B.duel; const { p } = duel(st, a, d, ctx);
    const win = rng() < p;
    const tradeP = clamp(w.tradeBase + w.tradeClose * (1 - Math.abs(p - 0.5) * 2) + ((ctx.am && ctx.am.trade) || 0) + ((ctx.dm && ctx.dm.trade) || 0), 0.02, 0.6);
    const trade = rng() < tradeP;
    const [W, L] = win ? [a, d] : [d, a];
    kill(st, W, L, trade, tag);
    if (trade) { L.kills++; W.alive = false; ev(st, 'ev.kill.trade', { killer: L.id, victim: W.id }); }
    return win ? 'att' : 'def';
  }

  // ---------- fin de ronda ----------
  function finish(st, winner, reason) {
    if (st.result) return;
    st.result = { winner, reason }; st.phase = 'done';
    ev(st, 'ev.end', { winner, reason });
  }
  function checkEnd(st) {
    if (st.result) return true;
    const nA = alive(st.att).length, nD = alive(st.def).length;
    if (nA === 0 && nD === 0) finish(st, st.planted ? 'att' : 'def', st.planted ? 'plantedMutual' : 'mutual');
    else if (nD === 0) finish(st, 'att', st.planted ? 'defElimPlanted' : 'defElim');
    else if (nA === 0) finish(st, 'def', st.planted ? 'defuseNoAtt' : 'attElim');
    else if (!st.planted && st.t >= CFG.rules.timers.action) { st.factors.timeout = 1; finish(st, 'def', 'timeout'); }
    return !!st.result;
  }
  function advance(st, next) { if (!checkEnd(st)) st.phase = next; }

  // ---------- 1. preparacion: drones ----------
  function levelOf(site) { return site.level == null ? 1 : site.level; }
  function resolvePrep(st, defPlan, attPlan, rng) {
    const P = CFG.B.prep; const map = mapOf(st);
    const sites = map.sites;
    const defSite = sites.find((s) => s.id === defPlan.site) || sites[0];
    const rf = normalizeReinf(defPlan.reinf);
    st.plan.def = { site: defSite.id, reinf: rf, roles: { ...defPlan.roles } };
    st.plan.att = { spawn: attPlan.spawn, droneOrder: [...(attPlan.droneOrder || [])], roles: { ...(attPlan.roles || {}) } };
    st.def.forEach((m) => { m.role = st.plan.def.roles[m.id] || 'anchor'; });
    st.att.forEach((m) => { m.role = st.plan.att.roles[m.id] || 'entry'; });
    const D = st.def, A = st.att;
    const hunters = D.filter((m) => m.role === 'hunt').length;
    const attIntel = A.reduce((s, m) => s + OPS[m.id].intel * (m.role === 'intel' ? 1 : P.offRoleIntel), 0);
    const aIntelSum = sum(D, 'aIntel');
    const sweeps = clamp(P.baseSweeps + Math.floor(attIntel / P.intelPerSweep) - Math.floor((aIntelSum + hunters * P.hunterWeight) / P.counterPerSweep), 1, P.maxSweeps);
    const order = [];
    st.plan.att.droneOrder.forEach((id) => { if (sites.some((s) => s.id === id) && !order.includes(id)) order.push(id); });
    sites.forEach((s) => { if (!order.includes(s.id)) order.push(s.id); });
    st.t = 0; let found = false, by = null; const okOther = new Set();
    let seen = null;
    for (let i = 0; i < Math.min(sweeps, order.length) && !found; i++) {
      const siteId = order[i]; st.t += P.scoutTime;
      const isDef = siteId === defSite.id;
      const anchorsHere = isDef ? D.filter((m) => m.role === 'anchor').length : 0;
      const counter = aIntelSum * P.counterAIntel + hunters * P.counterHunter + anchorsHere * P.counterAnchor;
      const ok = rng() < sig(P.survK * (P.survBase + attIntel * P.survIntel - counter));
      st.intel.scouted.push({ site: siteId, ok });
      ev(st, ok ? 'ev.prep.scoutOk' : 'ev.prep.scoutLost', { site: siteId }, 'att');
      ev(st, ok ? 'ev.prep.droneSpotted' : 'ev.prep.droneKilled', { site: siteId }, 'def');
      if (ok && isDef) { found = true; by = 'drone'; seen = anchorsHere; }
      else if (ok) okOther.add(siteId);
    }
    if (!found && okOther.size >= sites.length - 1) { found = true; by = 'elimination'; }
    st.intel.found = found; st.intel.by = by;
    if (found) { st.intel.defSeen = seen != null ? seen : D.filter((m) => m.role === 'anchor').length; st.intel.reinfSeen = rf.site; st.intel.site = defSite.id; }
    ev(st, found ? 'ev.prep.found' : 'ev.prep.notFound', found ? { site: defSite.id, by } : {}, 'att');
    const A_ = attIntel + P.attIntelBase + (found ? P.foundBonus : 0);
    const D_ = aIntelSum * P.aIntelWeight + sum(D, 'intel') * P.defIntelWeight + hunters * P.hunterInfoWeight;
    st.infoEdge = clamp((A_ - D_) / (A_ + D_ + P.infoConst), -1, 1);
    st.factors.infoEdge = st.infoEdge; st.factors.found = found ? 1 : 0; st.factors.sweeps = sweeps;
    st.t = 0; st.phase = 'adjust';
    return st;
  }
  function normalizeReinf(r) {
    const pool = CFG.rules.reinforcements.pool; const out = {};
    CFG.rules.reinforcements.buckets.forEach((b) => { out[b] = Math.max(0, Math.floor((r && r[b]) || 0)); });
    let tot = Object.values(out).reduce((a, b) => a + b, 0);
    const keys = CFG.rules.reinforcements.buckets;
    for (let i = keys.length - 1; tot > pool && i >= 0; i = (i + keys.length - 1) % keys.length) { if (out[keys[i]] > 0) { out[keys[i]]--; tot--; } }
    return out;
  }
  // el atacante, tras el droneo, puede cambiar de spawn y reasignar roles (como en el juego)
  function setAdjust(st, adj) {
    const map = mapOf(st);
    if (adj && adj.spawn && (map.spawns.some((s) => s.id === adj.spawn))) {
      if (adj.spawn !== st.plan.att.spawn) { ev(st, 'ev.adjust.spawn', { spawn: adj.spawn }, 'att'); bump(st, 'respawn'); }
      st.plan.att.spawn = adj.spawn;
    }
    if (adj && adj.roles) { Object.assign(st.plan.att.roles, adj.roles); st.att.forEach((m) => { m.role = st.plan.att.roles[m.id] || m.role; }); }
    st.phase = 'early';
    return st;
  }

  // ---------- 2. early: control de mapa / roam ----------
  function resolveEarly(st, dec, rng) {
    const E = CFG.B.early; const lane = CFG.B.lanes[laneOf(st)];
    const ch = { att: normalizeChoice(st, 'att', 'early', dec.att), def: normalizeChoice(st, 'def', 'early', dec.def) };
    const am = modsOf('early', 'att', ch.att), dm = modsOf('early', 'def', ch.def);
    applyCarry(st, am); applyCarry(st, dm);
    st.infoEdge = clamp(st.infoEdge + (am.info || 0) + (dm.info || 0), -1, 1);
    st.t += (am.time || 0) + lane.time; st.choices = { ...(st.choices || {}), early: ch };
    ev(st, 'ev.early.start', { approach: ch.att.approach, stance: ch.def.stance });
    const roamers = alive(st.def).filter(isRoamer);
    const flankMul = st.carry.splitAtt ? 1.8 : 1;
    roamers.forEach((r) => {
      const watchers = alive(st.att); if (!watchers.length || !r.alive) return;
      const a = pickW(watchers, (o) => 1 + OPS[o.id].intel * E.watcherIntel * (o.role === 'intel' ? 1 : E.offRoleWatcher) + OPS[o.id].flank * E.watcherFlank * flankMul, rng);
      const enc = clamp((E.baseEncounter + E.perRoamer * roamers.length + lane.roamExposure) * (am.encounter || 1) * (dm.encounter || 1), 0, 0.95);
      if (rng() > enc) { ev(st, 'ev.early.noContact', { who: r.id }); return; }
      const sa = OPS[a.id], sr = OPS[r.id];
      const detect = E.detectIntel * sa.intel + E.detectInfo * Math.max(0, st.infoEdge) + E.detectFlank * sa.flank * flankMul;
      const ambush = E.ambushRoam * sr.roam + E.ambushAim * (sr.aim - 3) - (sr.roam === 0 ? E.nonRoamerPenalty : 0) + (dm.aim || 0);
      const pAtt = sig(CFG.B.duel.k * (sa.aim + detect + (am.aim || 0) - (sr.aim + ambush + (am.foeAim || 0))));
      if (rng() < pAtt) { kill(st, a, r, false, detect > 0.7 ? 'roamTracked' : 'roamAtt'); bump(st, 'roamLost'); }
      else { kill(st, r, a, false, 'roamAmbush'); bump(st, 'roamKills'); }
    });
    advance(st, 'entry');
    return st;
  }

  // ---------- 3. entry: ruta + breach ----------
  function routeFit(st, route, siteId, reinf) {
    const R = CFG.B.route; const map = mapOf(st);
    const site = map.sites.find((s) => s.id === (siteId || st.plan.def.site)); const lvl = levelOf(site);
    const lane = CFG.B.lanes[laneOf(st)]; const rf = reinf || st.plan.def.reinf; const RI = CFG.B.reinf;
    let fit = 0;
    if (route === 'ground') fit = lvl <= R.lowLevelMax ? R.ground.low : R.ground.high;
    else if (route === 'roof') fit = (lvl >= R.highLevelMin ? R.roof.high + R.roof.vertScale * map.profile.vert : R.roof.low) - rf.hatch * RI.hatchPerPoint;
    else fit = (lvl <= R.basementLevelMax ? R.basement.match : R.basement.miss) - rf.hatch * RI.hatchPerPoint;
    return fit + (lane[route] || 0);
  }
  function resolveEntry(st, dec, rng) {
    const E = CFG.B.entry; const RI = CFG.B.reinf; const map = mapOf(st);
    const ch = { att: normalizeChoice(st, 'att', 'entry', dec.att), def: normalizeChoice(st, 'def', 'entry', dec.def) };
    const am = { ...modsOf('entry', 'att', ch.att) }, dm = modsOf('entry', 'def', ch.def);
    const route = ch.att.route, method = ch.att.method, watch = ch.def.watch; const rf = st.plan.def.reinf;
    st.choices = { ...(st.choices || {}), entry: ch };
    st.routeFit = routeFit(st, route);
    st.antic = watch === 'none' ? 0 : (watch === route ? CFG.B.route.anticipateMatch : CFG.B.route.anticipateMiss);
    if (watch === route) bump(st, 'anticipated');
    bump(st, `route_${route}`); st.factors.routeFit = st.routeFit;
    ev(st, 'ev.entry.start', { route, method, stance: ch.def.stance });
    let openings = 0;
    const softF = clamp(1 - rf.site * RI.softPerPoint, RI.softMin, 1), flashF = clamp(1 - rf.entry * RI.flashPerPoint, RI.flashMin, 1);
    if (method === 'hard') {
      const hbs = alive(st.att).filter((m) => OPS[m.id].hb > 0);
      st.factors.hbAlive = hbs.length;
      if (!hbs.length) { st.noHB = true; st.t += E.noBreachTime; ev(st, 'ev.entry.noBreacher'); }
      else {
        const aHB = sum(alive(st.def).filter((m) => !isRoamer(m)), 'aHB') * st.carry.aHBMul;
        hbs.forEach((h) => {
          if (!h.alive) return;
          const pDeny = clamp((aHB * E.denyWeight) / (aHB * E.denyWeight + E.denyBase + OPS[h.id].hb), 0, E.denyCap);
          if (rng() < pDeny) {
            bump(st, 'hbDenied'); st.t += E.failTime;
            if (rng() < E.breacherDeathChance) {
              const d = pickW(alive(st.def), (o) => 1 + OPS[o.id].aHB, rng); h.alive = false; d.kills++;
              ev(st, 'ev.entry.breachKilled', { killer: d.id, victim: h.id });
            } else ev(st, 'ev.entry.breachDenied', { who: h.id });
          } else { openings++; st.t += E.openTime; ev(st, 'ev.entry.breachOk', { who: h.id }); }
        });
      }
      st.t += E.hardBreachTime;
    } else if (method === 'soft') {
      const vtl = sum(alive(st.att), 'vtl');
      openings = clamp(vtl * map.profile.vert * E.softAngle, 0, E.softAngleCap) * softF * E.softMul;
      st.t += E.softEntryTime; ev(st, 'ev.entry.softOk', { n: Math.round(openings * 10) / 10 });
    } else {
      am.clear = (am.clear || 0) * flashF; am.smoke = (am.smoke || 0) * flashF; st.t += E.flashEntryTime; ev(st, 'ev.entry.flash');
    }
    st.openings = Math.min(E.maxOpenings, openings);
    st.factors.openings = st.openings;
    st.t += dm.time || 0;
    const ctx = { am, dm };
    for (let i = 0; i < E.entryDuels && alive(st.att).length && alive(st.def).length; i++) {
      const a = pickW(alive(st.att), (o) => 1 + OPS[o.id].entry * CFG.B.site.entryPick + (o.role === 'entry' ? CFG.B.pick.entryRole : 0), rng);
      const d = pickW(alive(st.def), (o) => 1 + (isRoamer(o) ? CFG.B.site.roamerPick : OPS[o.id].anchor * CFG.B.site.anchorPick), rng);
      fight(st, a, d, ctx, rng, 'entry');
    }
    advance(st, 'site');
    return st;
  }

  // ---------- 4. site: ejecucion ----------
  function resolveSite(st, dec, rng) {
    const S = CFG.B.site; const A_ = alive(st.att);
    const ch = { att: normalizeChoice(st, 'att', 'site', dec.att), def: normalizeChoice(st, 'def', 'site', dec.def) };
    const am = modsOf('site', 'att', ch.att), dm = modsOf('site', 'def', ch.def);
    if (ch.att.style === 'split') st.carry.splitAtt = 1;
    st.choices = { ...(st.choices || {}), site: ch };
    ev(st, 'ev.site.start', { style: ch.att.style, stance: ch.def.stance });
    ev(st, 'ev.site.start', { style: ch.att.style, stance: ch.def.stance });
    st.t += dm.time || 0;
    for (let w = 0; w < S.maxWaves && alive(st.att).length && alive(st.def).length; w++) {
      st.t += S.waveTime + (am.time || 0);
      const n = Math.min(S.duelsPerWave, alive(st.att).length, alive(st.def).length);
      for (let i = 0; i < n && alive(st.att).length && alive(st.def).length; i++) {
        const a = pickW(alive(st.att), (o) => 1 + OPS[o.id].entry * S.entryPick + (OPS[o.id].aim - 3) * S.aimPick, rng);
        const d = pickW(alive(st.def), (o) => 1 + (isRoamer(o) ? S.roamerPick : OPS[o.id].anchor * S.anchorPick), rng);
        fight(st, a, d, { am, dm }, rng, 'site');
      }
      if (st.t >= CFG.rules.timers.action) break;
      const control = alive(st.att).length - alive(st.def).length;
      if (control >= 1 || alive(st.def).length <= 1) break;
    }
    void A_;
    advance(st, 'plant');
    return st;
  }

  // ---------- 5. plant ----------
  function resolvePlant(st, dec, rng) {
    const PL = CFG.B.plant; const PK = CFG.B.pick; const T = CFG.rules.timers;
    const ch = { att: normalizeChoice(st, 'att', 'plant', dec.att), def: normalizeChoice(st, 'def', 'plant', dec.def) };
    const am = modsOf('plant', 'att', ch.att), dm = modsOf('plant', 'def', ch.def);
    st.choices = { ...(st.choices || {}), plant: ch }; st.plantTries++;
    st.t += dm.time || 0;
    if (ch.att.action === 'clear') {
      st.t += am.time || 0;
      if (alive(st.att).length && alive(st.def).length) {
        const a = pickW(alive(st.att), (o) => 1 + OPS[o.id].aim * PK.plantAim, rng), d = pickW(alive(st.def), (o) => 1 + OPS[o.id].anchor * PK.plantAnchor, rng);
        fight(st, a, d, { am, dm }, rng, 'site');
      }
    }
    if (checkEnd(st)) return st;
    if (st.t >= T.action) { checkEnd(st); return st; }
    const A = alive(st.att), D = alive(st.def);
    const planter = pickW(A, (o) => 1 + OPS[o.id].post * PK.planterPost + (o.role === 'support' ? PK.planterSupport : 0), rng);
    const others = A.filter((o) => o !== planter);
    const covers = sum(others, 'post') + sum(others, 'clear') * PL.clearCover;
    // el defensor puede cortar la plantada: duelo de "first strike"
    const striker = pickW(D, (o) => 1 + OPS[o.id].aim * PK.strikeAim + OPS[o.id].anchor * PK.strikeAnchor, rng);
    const pStrike = clamp(PL.strikeBase + (dm.aim || 0) + (ch.def.stance === 'deny' ? PL.denyFirstStrike : 0) - (A.length - D.length) * PL.strikeNum, PL.strikeMin, PL.strikeMax);
    if (rng() < pStrike * PL.strikeMul && D.length) {
      kill(st, striker, planter, false, 'plantCut'); st.t += T.plant; bump(st, 'plantCut');
      if (!checkEnd(st)) st.phase = 'plant';
      return st;
    }
    const control = A.length - D.length;
    const late = st.t > T.action - PL.lateTimeLeft ? PL.latePenalty : 0;
    const pPlant = sig(PL.control * control + PL.covers * covers + PL.base + PL.extraDefenders * Math.max(0, D.length - PL.extraDefendersFrom) + late);
    if (rng() < pPlant) {
      st.planted = true; st.plantT = Math.round(st.t); st.t += T.plant; planter.role = 'planter';
      ev(st, 'ev.plant.ok', { who: planter.id, a: A.length, d: D.length }); st.phase = 'post'; bump(st, 'planted');
    } else {
      st.t += PL.failTime; ev(st, 'ev.plant.fail', { who: planter.id });
      if (!checkEnd(st)) st.phase = 'plant';
    }
    return st;
  }

  // ---------- 6. post-plant ----------
  function resolvePost(st, dec, rng) {
    const PO = CFG.B.post; const PK = CFG.B.pick; const T = CFG.rules.timers;
    const ch = { att: normalizeChoice(st, 'att', 'post', dec.att), def: normalizeChoice(st, 'def', 'post', dec.def) };
    const am = modsOf('post', 'att', ch.att), dm = modsOf('post', 'def', ch.def);
    st.choices = { ...(st.choices || {}), [`post${st.postStage}`]: ch };
    const stage = st.postStage; const from = stage === 0 ? 0 : PO.stageSplit, to = stage === 0 ? PO.stageSplit : T.postPlant;
    let pp = from;
    if (ch.att.stance === 'flank') st.carry.splitAtt = 1;
    while (pp < to && alive(st.att).length && alive(st.def).length) {
      pp += PO.wave; st.t += PO.wave;
      const a = pickW(alive(st.att), (o) => 1 + OPS[o.id].post * PK.postPost + OPS[o.id].flank * PK.postFlank, rng);
      const d = pickW(alive(st.def), (o) => 1 + OPS[o.id].aim * PK.postAim, rng);
      fight(st, a, d, { am, dm, post: true }, rng, 'post');
      if (!alive(st.att).length || !alive(st.def).length) break;
      if (pp >= PO.defuseFrom) {
        const pDef = sig(PO.defuseScale * (alive(st.def).length - alive(st.att).length) - PO.defPostCover * sum(alive(st.att), 'post') / Math.max(1, alive(st.att).length) + PO.supportDef * sum(alive(st.def), 'sup') + PO.defuseBase + (dm.defuse || 0));
        if (pp >= PO.defuseForce && rng() < pDef * PO.defuseChance) {
          const df = pickW(alive(st.def), () => 1, rng); ev(st, 'ev.post.defuse', { who: df.id }); st.factors.defused = 1; finish(st, 'def', 'defuse'); return st;
        } else if (pp >= PO.defuseForce) {
          const df = pickW(alive(st.def), () => 1, rng), a2 = pickW(alive(st.att), () => 1, rng);
          kill(st, a2, df, false, 'defuseCut');
        }
      }
    }
    if (checkEnd(st)) return st;
    if (stage === 0) { st.postStage = 1; st.phase = 'post'; return st; }
    ev(st, 'ev.post.explode'); finish(st, 'att', 'explode');
    return st;
  }

  // ---------- despachador ----------
  function resolve(st, phase, decisions, rng) {
    const dec = decisions || { att: {}, def: {} };
    switch (phase) {
      case 'early': return resolveEarly(st, dec, rng);
      case 'entry': return resolveEntry(st, dec, rng);
      case 'site': return resolveSite(st, dec, rng);
      case 'plant': return resolvePlant(st, dec, rng);
      case 'post': return resolvePost(st, dec, rng);
      default: throw new Error(`unknown phase ${phase}`);
    }
  }

  // ---------- explicacion del resultado (claves i18n) ----------
  function explain(st) {
    const X = CFG.B.explain; const f = st.factors; const win = st.result.winner; const out = []; const r = (k, p, w, forAtt) => out.push({ k, p: p || {}, w, good: (forAtt ? 'att' : 'def') === win });
    if (Math.abs(f.infoEdge || 0) > X.infoMin) r(f.infoEdge > 0 ? 'why.info.att' : 'why.info.def', { v: Math.round(Math.abs(f.infoEdge) * 100) / 100 }, Math.abs(f.infoEdge) * 3, f.infoEdge > 0);
    if (f.found === 0) r('why.notFound', {}, 1.5, false); else if (f.found === 1) r('why.found', {}, 0.8, true);
    if (st.noHB) r('why.noHB', {}, 3, false);
    else if (f.hbDenied) r('why.hbDenied', { n: f.hbDenied }, 1.2 * f.hbDenied, false);
    else if (st.openings >= X.openingsMin) r('why.openings', {}, 1.5, true);
    if (f.roamKills || f.roamLost) r('why.roam', { k: f.roamKills || 0, l: f.roamLost || 0 }, 1 + (f.roamKills || 0), (f.roamKills || 0) < (f.roamLost || 0));
    if (f.anticipated) r('why.anticipated', {}, 1.6, false);
    if (f.routeFit > X.routeGood) r('why.routeGood', {}, 1.1, true); else if (f.routeFit < X.routeBad) r('why.routeBad', {}, 1.1, false);
    if (f.respawn) r('why.respawn', {}, 0.7, true);
    if (f.plantCut) r('why.plantCut', { n: f.plantCut }, 1.4, false);
    if (f.timeout) r('why.timeout', {}, 3, false);
    if (st.planted) r('why.planted', {}, 1, true);
    if (f.defused) r('why.defused', {}, 1.2, false);
    const all = [...st.att, ...st.def].sort((a, b) => b.kills - a.kills)[0];
    if (all && all.kills >= X.mvpKills) r('why.mvp', { op: all.id, n: all.kills }, 0.9 * all.kills, st.att.includes(all));
    r('why.survivors', { a: alive(st.att).length, d: alive(st.def).length, reason: st.result.reason }, 0.5, win === 'att');
    return out.sort((a, b) => b.w - a.w).slice(0, X.maxItems);
  }

  // ---------- vista filtrada por bando (informacion oculta) ----------
  function viewFor(st, side) {
    const v = clone(st);
    const over = !!st.result;
    v.events = v.events.filter((e) => over || e.vis === 'both' || e.vis === side);
    if (!over) {
      if (side === 'att') {
        v.plan.def = null; v.def.forEach((m) => { m.role = null; });
        if (!v.intel.found) { v.intel.defSeen = null; v.intel.reinfSeen = null; v.intel.site = null; }
      } else {
        if (v.plan.att) v.plan.att = { spawn: null, droneOrder: [], roles: {} };
        v.att.forEach((m) => { m.role = null; }); v.intel = { found: false, scouted: [] };
        v.routeFit = 0; v.infoEdge = 0;
      }
    }
    return v;
  }

  R6.Engine = {
    configure, cfg, op, newRound, options, normalizeChoice, modsOf, resolve, resolvePrep, setAdjust, normalizeReinf, routesAvailable,
    explain, viewFor, routeFit, alive, sum, isRoamer, clone, clamp, sig, pickW, levelOf, laneOf, checkEnd,
  };
})(typeof window !== 'undefined' ? window : globalThis);
