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

  // Estadistica efectiva = base + peso * efectos de los gadgets secundarios. Idempotente: la base se guarda la primera vez (o.base)
  // y el desglose queda en o.fx[stat] = [{ gadget, v }] para que la interfaz pueda explicar de donde sale cada valor.
  function applyGadgets(operators, table, weight) {
    if (!table) return;
    const round2 = (x) => Math.round(x * 100) / 100;
    operators.forEach((o) => {
      if (!o.base) o.base = Object.fromEntries(table.stats.map((s) => [s, o[s] || 0]));
      o.fx = {};
      (o.gadgets || []).forEach((g) => {
        const eff = table.effects[g]; if (!eff) return;
        Object.entries(eff.stats).forEach(([s, v]) => { (o.fx[s] = o.fx[s] || []).push({ gadget: g, v: round2(v * weight) }); });
      });
      table.stats.forEach((s) => { o[s] = round2(o.base[s] + (o.fx[s] || []).reduce((a, x) => a + x.v, 0)); });
    });
  }

  function configure({ rules, balance, decisions, operators, maps, gadgets, actions }) {
    CFG = { rules, B: balance, dec: decisions, actions: actions || null };
    applyGadgets(operators, gadgets, balance.gadgets ? balance.gadgets.weight : 1);
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
  // bonus de equipo de las acciones (efecto 'buff'): se suman una vez al sumatorio del bando si el equipo no esta vacio
  const tb = (st, side, k) => (st.tbuff && st.tbuff[side] && st.tbuff[side][k]) || 0;
  const tsum = (st, side, team, k) => sum(team, k) + (team.length ? tb(st, side, k) : 0);
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
      phaseNo: 0, known: { att: {}, def: {} }, active: { att: [], def: [] }, act: null, tbuff: null,
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
  // ---------- acciones de agente (config/actions.json) ----------
  // Cada accion es un grupo de decision 'act.<id>' cuya primera opcion es 'off'. Con el interruptor apagado (balance.actions.enabled)
  // o sin bloque de configuracion el motor se comporta exactamente como antes.
  const other = (s2) => (s2 === 'att' ? 'def' : 'att');
  const actionsOn = () => !!(CFG.actions && CFG.B.actions && CFG.B.actions.enabled);
  const AB = () => CFG.B.actions || {};
  const actionDef = (id) => (CFG.actions && CFG.actions.actions[id]) || null;
  const isAct = (grp) => grp.startsWith('act.');
  const usesLeft = (m, id) => (m.uses && id in m.uses ? m.uses[id] : actionDef(id).uses);
  const sideOfMember = (st, m) => (st.att.includes(m) ? 'att' : 'def');
  const memberById = (st, id) => st.att.find((m) => m.id === id) || st.def.find((m) => m.id === id);
  // acciones que se ofrecen a un bando en una fase: agente vivo, rol valido y usos restantes
  function actionGroups(st, side, phase) {
    const out = {}; if (!actionsOn()) return out;
    Object.entries(CFG.actions.actions).forEach(([id, a]) => {
      if (a.side !== side || !a.phases.includes(phase)) return;
      const m = st[side].find((x) => x.id === a.op); if (!m || !m.alive || m.down) return;
      const roles = a.requires && a.requires.role; if (roles && !roles.includes(m.role)) return;
      if (usesLeft(m, id) <= 0) return;
      out[`act.${id}`] = Object.keys(a.options);
    });
    return out;
  }
  const optDo = (grp, optId) => { const a = actionDef(grp.slice(4)); const o = a && a.options[optId]; return (o && o.do) || []; };

  // ---- contrajuego: etiquetas activas del rival (acciones de esta fase + gadgets colocados antes) y estadisticas de su equipo
  function activeTags(st, side, used) {
    const tags = new Set();
    ((st.active && st.active[side]) || []).forEach((x) => x.tags.forEach((t) => tags.add(t)));
    (used || []).filter((u) => u.side === side).forEach((u) => (actionDef(u.id).tags || []).forEach((t) => tags.add(t)));
    return tags;
  }
  // multiplicador (0..) con el que una accion surte efecto; 1 = sin contrarresto
  function actionScale(st, side, id, used = []) {
    if (!actionsOn()) return 1;
    const tags = new Set(actionDef(id).tags || []); const opp = other(side); const act = activeTags(st, opp, used); let sc = 1;
    const mine = activeTags(st, side, used);   // 'suppress': mis etiquetas (p. ej. un EMP) anulan, esta fase, las etiquetas rivales indicadas (el inhibidor de Mute deja de contrarrestarme)
    (CFG.actions.suppress || []).forEach((r) => { if (mine.has(r.source)) r.tags.forEach((t) => act.delete(t)); });
    (CFG.actions.counters || []).forEach((c) => { if (act.has(c.source) && c.against.some((t) => tags.has(t))) sc *= c.scale; });
    (CFG.actions.statCounters || []).forEach((c) => { if (c.side === opp && c.against.some((t) => tags.has(t))) sc *= Math.max(c.min, 1 - c.k * tsum(st, opp, alive(st[opp]), c.stat)); });
    return sc;
  }
  // modificadores escalados: los aditivos se multiplican por la escala; los 'Mul' se acercan a 1 (1 + (v-1)*escala)
  const scaledMod = (k, v, sc) => (k.endsWith('Mul') ? 1 + (v - 1) * sc : v * sc);
  // efecto numerico de una opcion de accion (solo 'mod'; el tiempo y el resto de efectos se aplican al empezar/acabar la fase)
  function actionMods(st, grp, optId) {
    const out = {}; if (st && !(st.act && grp.slice(4) in st.act.scale)) return out;   // no usada en esta fase (o elegida con un 'when' incumplido)
    const s2 = st ? st.act.scale[grp.slice(4)] : 1;
    optDo(grp, optId).forEach((e) => { if (e.fx === 'mod') Object.entries(e.mods || {}).forEach(([k, v]) => { const x = scaledMod(k, v, s2); out[k] = k.endsWith('Mul') && k in out ? out[k] * x : x; }); });
    return out;
  }
  // descripcion estatica del efecto de una opcion (para la interfaz): modificadores sin escalar y segundos de reloj
  function actionEffect(grp, optId) {
    const out = { mods: {}, time: 0 };
    optDo(grp, optId).forEach((e) => {
      if (e.fx === 'mod') Object.entries(e.mods || {}).forEach(([k, v]) => { out.mods[k] = (out.mods[k] || 0) + v; });
      else if (e.fx === 'time') out.time += e.s;
    });
    return out;
  }

  // ---- conocimiento por enemigo (revelado) y derribados
  const isKnown = (st, bySide, id) => !!(st.known && st.known[bySide] && st.known[bySide][id] != null && st.known[bySide][id] >= st.phaseNo);
  const markKnown = (st, bySide, ids, ttl) => { ids.forEach((id) => { const cur = st.known[bySide][id]; st.known[bySide][id] = cur != null ? Math.max(cur, st.phaseNo + ttl) : st.phaseNo + ttl; }); };
  function revealEnemies(st, bySide, spec, sc, rng, srcOp) {
    const pool = alive(st[other(bySide)]); if (!pool.length) return;
    const n = spec.count === 'all' ? pool.length : Math.min(pool.length, Math.floor(spec.count * sc + rng())); if (n <= 0) return;
    const left = [...pool]; const chosen = [];
    while (chosen.length < n) { const m = pickW(left, (o) => (spec.prefer === 'roamer' && isRoamer(o) ? 10 : 1), rng); chosen.push(m); left.splice(left.indexOf(m), 1); }
    markKnown(st, bySide, chosen.map((m) => m.id), spec.ttl);
    ev(st, 'ev.act.reveal', { who: srcOp, ops: chosen.map((m) => m.id) }, bySide);
  }
  function setDown(st, killerOp, victim) {
    victim.alive = false; victim.down = true; victim.downBy = killerOp;
    ev(st, 'ev.act.down', { killer: killerOp, victim: victim.id });
  }
  function finishDown(st, killer, victim) {
    victim.down = false; delete victim.downBy; killer.kills++;
    ev(st, 'ev.kill.finish', { killer: killer.id, victim: victim.id, trade: false });
  }
  // derribo: el rival no muere, queda fuera de combate. Luego la orden condicional del agente: rematar o interrogar (r6data: 5 s, vulnerable;
  // si nadie lo sorprende se remata y todo el equipo rival queda marcado).
  function downVictim(st, killer, victim, spec, rng) {
    setDown(st, killer.id, victim);
    if (spec.then === 'finish') { finishDown(st, killer, victim); return; }
    const T = spec.then; const vSide = sideOfMember(st, victim); const others = alive(st[vSide]);
    if (!others.length) { finishDown(st, killer, victim); return; }
    ev(st, 'ev.act.interrogate.start', { who: killer.id, victim: victim.id });
    const pExposed = clamp(T.exposed.base + T.exposed.perAtt * others.length, 0, T.exposed.max);
    if (rng() < pExposed) { const striker = pickW(others, (o) => 1 + OPS[o.id].aim, rng); kill(st, striker, killer, false, 'interrogCut'); return; }
    finishDown(st, killer, victim);
    markKnown(st, other(vSide), others.map((m) => m.id), T.ttl);
    ev(st, 'ev.act.interrogate.ok', { who: killer.id, victim: victim.id, ops: others.map((m) => m.id) });
  }
  // los derribados que nadie reanimo se desangran al acabar la fase (la baja se acredita a quien los derribo)
  function settleDowns(st) {
    [...st.att, ...st.def].forEach((m) => {
      if (!m.down) return;
      m.down = false; const by = m.downBy && memberById(st, m.downBy); delete m.downBy; if (by) by.kills++;
      if (!st.result) ev(st, 'ev.act.bleed', { victim: m.id, killer: by ? by.id : null });   // tras el fin de ronda no se narra
    });
  }
  function reviveDowned(st, r, rng) {
    const downed = st[r.side].filter((m) => m.down && !m.noRevive && (r.self || m.id !== r.op));
    downed.sort((x, y) => (x.id === r.op) - (y.id === r.op));   // primero los aliados
    for (let i = 0; i < r.max && downed.length; i++) {
      const v = downed.shift();
      const foes = alive(st[other(r.side)]); const RE = AB().reviveExposed; const pExposed = foes.length ? clamp(RE.base + RE.perFoe * foes.length, 0, RE.max) : 0;
      if (rng() >= pExposed && rng() < r.scale) { v.alive = true; v.down = false; delete v.downBy; ev(st, 'ev.act.revive', { who: r.op, victim: v.id }); }
      else {
        ev(st, 'ev.act.fizzle', { who: r.op, action: r.action }, r.side);
        // mientras intentas levantarlo te pueden sorprender a ti tambien
        const who = memberById(st, r.op); if (foes.length && who && who.alive && v.id !== r.op && rng() < AB().reviverCut) kill(st, pickW(foes, (o) => 1 + OPS[o.id].aim, rng), who, false, 'reviveCut');
      }
    }
  }

  // ---- ciclo de vida de las acciones dentro de resolve()
  // acciones activas elegidas por cada bando en esta fase, ya normalizadas y con su condicion 'when' cumplida
  function usedActions(st, phase, dec) {
    const used = [];
    ['att', 'def'].forEach((side) => {
      const ch = normalizeChoice(st, side, phase, dec[side]); const opts = options(st, side, phase);
      Object.entries(ch).forEach(([grp, optId]) => {
        if (!isAct(grp) || optId === opts[grp][0]) return;
        const a = actionDef(grp.slice(4));
        if (a.when && !Object.entries(a.when).every(([g, v]) => ch[g] === v)) return;
        used.push({ side, grp, id: grp.slice(4), optId });
      });
    });
    return used;
  }
  // bonus de equipo de los gadgets colocados en fases anteriores
  function persistentBuffs(st) {
    const out = { att: {}, def: {} };
    ['att', 'def'].forEach((side) => ((st.active && st.active[side]) || []).forEach((x) => Object.entries(x.buffs || {}).forEach(([k, v]) => { out[side][k] = (out[side][k] || 0) + v; })));
    return out;
  }
  // bonus de equipo = los de gadgets persistentes + los de las acciones de esta fase (con su escala actual); los persistentes se guardan para las fases siguientes
  function applyBuffs(st, used) {
    st.tbuff = persistentBuffs(st); st.act.persist = {};
    used.forEach((u) => {
      const a = actionDef(u.id);
      optDo(u.grp, u.optId).forEach((e) => {
        if (e.fx !== 'buff') return;
        const v = e.v * st.act.scale[u.id]; st.tbuff[u.side][e.stat] = (st.tbuff[u.side][e.stat] || 0) + v;
        if (a.persist) { const p = (st.act.persist[u.id] = st.act.persist[u.id] || { buffs: {} }); p.buffs[e.stat] = (p.buffs[e.stat] || 0) + v; }
      });
    });
  }
  // al principio de la fase: escalas por contrajuego, bonus de equipo, evento de uso (solo visible para su bando) y efectos inmediatos
  function beginActions(st, used, rng) {
    st.act = { scale: {}, hunt: {}, breach: {}, revive: [], persist: {}, rng };
    // escala y bonus se afinan en dos vueltas: el anti-util de un atacante (un bonus de esta fase) tambien contrarresta a los gadgets rivales de la misma fase
    used.forEach((u) => { st.act.scale[u.id] = actionScale(st, u.side, u.id, used); });
    applyBuffs(st, used);
    used.forEach((u) => { st.act.scale[u.id] = actionScale(st, u.side, u.id, used); });
    applyBuffs(st, used);
    used.forEach((u) => {
      const a = actionDef(u.id); const sc = st.act.scale[u.id];
      ev(st, 'ev.act.used', { who: a.op, action: u.id, opt: `${u.id}.opt.${u.optId}` }, u.side);
      optDo(u.grp, u.optId).forEach((e) => {
        if (e.fx === 'time') { if (u.side === 'att') st.t += e.s; }   // el reloj de ronda corre contra el atacante; para el defensor el coste es la exposicion
        else if (e.fx === 'reveal') revealEnemies(st, u.side, e, sc, rng, a.op);
        else if (e.fx === 'ambush') st.act.hunt[a.op] = { aim: e.aim * sc, downs: !!e.downs, then: e.then };
        else if (e.fx === 'breach') { st.act.breach[a.op] = e.power * sc; if (sc < AB().fizzleBelow) ev(st, 'ev.act.fizzle', { who: a.op, action: u.id }, u.side); }
        else if (e.fx === 'revive') st.act.revive.push({ side: u.side, op: a.op, action: u.id, max: e.max, self: !!e.self, scale: sc });
        else if (e.fx === 'trapdown') {
          for (let i = 0; i < e.n; i++) { const pool = alive(st[other(u.side)]); if (pool.length && rng() < e.p * sc) setDown(st, a.op, pool[Math.floor(rng() * pool.length)]); }
        }
      });
    });
  }
  // al final de la fase: reanimaciones, desangrado, usos gastados y gadgets colocados (antes no: la accion desapareceria de las opciones mientras se resuelve)
  function endActions(st, used, rng) {
    if (st.act && !st.result) st.act.revive.forEach((r) => { const who = memberById(st, r.op); if (who && (who.alive || (r.self && who.down && !who.noRevive))) reviveDowned(st, r, rng); });
    settleDowns(st);
    used.forEach((u) => {
      const a = actionDef(u.id); const m = st[u.side].find((x) => x.id === a.op);
      m.uses = { ...(m.uses || {}), [u.id]: usesLeft(m, u.id) - 1 };
      if (a.persist) {
        const mods = {}; Object.entries(actionMods(st, u.grp, u.optId)).forEach(([k, v]) => { if (!k.startsWith('carry.')) mods[k] = v; });   // los carry ya se aplicaron una vez
        st.active[u.side].push({ id: u.id, tags: [...(a.tags || [])], buffs: (st.act.persist[u.id] || {}).buffs || {}, mods });
      }
    });
    st.act = null; st.tbuff = null;
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
    return Object.assign(out, actionGroups(st, side, phase));
  }
  function normalizeChoice(st, side, phase, choice) {
    const opts = options(st, side, phase); const out = {};
    Object.keys(opts).forEach((grp) => { const c = choice && choice[grp]; out[grp] = opts[grp].includes(c) ? c : opts[grp][0]; });
    // como mucho maxActive acciones de agente a la vez; se conservan las primeras en el orden de la configuracion
    let active = 0; const max = (CFG.actions && CFG.actions.maxActive) || 0;
    Object.keys(out).forEach((grp) => {
      if (!isAct(grp) || out[grp] === opts[grp][0]) return;
      const a = actionDef(grp.slice(4)); if (a.when && !Object.entries(a.when).every(([g, v]) => out[g] === v)) return;   // no se usara: no ocupa hueco
      if (++active > max) out[grp] = opts[grp][0];
    });
    return out;
  }
  function modsOf(phase, side, choice, st) {
    const out = {}; const groups = groupsOf(phase, side);
    if (st && st.active && st.active[side]) st.active[side].forEach((x) => Object.entries(x.mods || {}).forEach(([k, v]) => { out[k] = (out[k] || 0) + v; }));   // gadgets colocados antes
    Object.entries(choice || {}).forEach(([grp, id]) => {
      if (isAct(grp)) { Object.entries(actionMods(st, grp, id)).forEach(([k, v]) => { out[k] = k.endsWith('Mul') && k in out ? out[k] * v : (out[k] || 0) + v; }); return; }
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
    const denyEff = Math.max(0, tsum(st, 'def', D, 'deny') - tsum(st, 'att', A, 'aUtil') * w.aUtilVsDeny) * w.denyScale * c.denyMul;
    const clearEff = Math.max(0, tsum(st, 'att', A, 'clear') - tsum(st, 'def', D, 'aNade') * w.nadeVsClear) * w.clearScale;
    const smokeEff = Math.max(0, tsum(st, 'att', A, 'smoke') * w.smokeScale - tsum(st, 'def', D, 'vis') * w.visScale);
    const flankMul = c.splitAtt ? 1.8 : 1;
    const roamersAlive = D.filter(isRoamer).length;
    const flankDef = roamersAlive * w.flankDef * Math.max(0.3, 1 - tsum(st, 'att', A, 'flank') * w.flankWatch * flankMul);
    const flankAtt = flankMul > 1 ? w.flankAtt * tsum(st, 'att', A, 'flank') * (flankMul - 1) : 0;
    const lng = (s) => s.long * Math.max(0, map.profile.open - w.longThreshold) * w.longBonus;
    let effA = a.aimOverride != null ? a.aimOverride : sa.aim;
    effA += w.entry * sa.entry + clearEff + smokeEff + (st.noHB ? -w.noBreachPenalty : w.openingBonus * st.openings)
      + flankAtt + lng(sa) + (am.aim || 0) + (am.clear || 0) + (am.smoke || 0) + (am.flank || 0) + st.routeFit;
    let effD = sd.aim + w.anchor * sd.anchor + w.defBase + (isRoamer(d) ? 0 : c.setupAim) + denyEff + flankDef + lng(sd)
      + w.supportScale * tsum(st, 'def', D, 'sup') + (dm.aim || 0) + (am.foeAim || 0) + st.antic;
    effA += w.supportScale * tsum(st, 'att', A, 'sup') + (dm.foeAim || 0);
    if (st.infoEdge >= 0) effA += w.infoScale * st.infoEdge; else effD += w.infoScale * -st.infoEdge;
    if (actionsOn()) { if (isKnown(st, 'att', d.id)) effA += AB().knownBonus; if (isKnown(st, 'def', a.id)) effD += AB().knownBonus; }
    effA += clamp((A.length - D.length) * w.numAdv, -w.numAdvCap, w.numAdvCap);
    effD += clamp((D.length - A.length) * w.numAdv, -w.numAdvCap, w.numAdvCap);
    if (ctx.post) { effA += w.postPlantScale * 2 * (tsum(st, 'att', A, 'post') / Math.max(1, A.length)) + w.postPlantBase + (am.post || 0); effD -= w.postDefPenalty; }
    if (!ctx.post && st.t > w.lateTime) effA -= w.latePenalty;
    return { p: sig(w.k * (effA - effD)), effA, effD };
  }
  // un bando con un reanimador activo en la fase no pierde a sus caidos: quedan derribados y la baja se acredita si nadie los levanta
  const hasReviver = (st, victim) => !!(st.act && st.act.revive.some((r) => r.side === sideOfMember(st, victim)));
  function kill(st, killer, victim, trade, tag) {
    // en la mayoria de los casos te matan directamente: solo una parte de las bajas queda en derribo (y a un derribado aun pueden rematarlo)
    if (tag !== 'reviveCut' && tag !== 'interrogCut' && hasReviver(st, victim) && st.act.rng() < AB().downChance) { setDown(st, killer.id, victim); return; }
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
    const am = modsOf('early', 'att', ch.att, st), dm = modsOf('early', 'def', ch.def, st);
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
      const seen = actionsOn() && isKnown(st, 'att', r.id); const hunt = (st.act && st.act.hunt[r.id]) || null;
      const detect = E.detectIntel * sa.intel + E.detectInfo * Math.max(0, st.infoEdge) + E.detectFlank * (sa.flank + tb(st, 'att', 'flank')) * flankMul + (seen ? AB().knownDetect : 0);
      const ambush = E.ambushRoam * sr.roam + E.ambushAim * (sr.aim - 3) - (sr.roam === 0 ? E.nonRoamerPenalty : 0) + (dm.aim || 0) + (hunt ? hunt.aim : 0) - (seen ? AB().knownAmbush : 0);
      const pAtt = sig(CFG.B.duel.k * (sa.aim + detect + (am.aim || 0) + (dm.foeAim || 0) - (sr.aim + ambush + (am.foeAim || 0))));
      if (rng() < pAtt) { kill(st, a, r, false, detect > 0.7 ? 'roamTracked' : 'roamAtt'); bump(st, 'roamLost'); }
      else if (hunt && hunt.downs) { downVictim(st, r, a, hunt, rng); bump(st, 'roamKills'); }
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
    const am = { ...modsOf('entry', 'att', ch.att, st) }, dm = modsOf('entry', 'def', ch.def, st);
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
        const aHB = tsum(st, 'def', alive(st.def).filter((m) => !isRoamer(m)), 'aHB') * st.carry.aHBMul;
        hbs.forEach((h) => {
          if (!h.alive) return;
          const hbEff = OPS[h.id].hb + ((st.act && st.act.breach[h.id]) || 0);
          const pDeny = clamp((aHB * E.denyWeight) / (aHB * E.denyWeight + E.denyBase + hbEff), 0, E.denyCap);
          if (rng() < pDeny) {
            bump(st, 'hbDenied'); st.t += E.failTime;
            if (rng() < E.breacherDeathChance) {
              const d = pickW(alive(st.def), (o) => 1 + OPS[o.id].aHB, rng); h.alive = false; d.kills++;
              ev(st, 'ev.entry.breachKilled', { killer: d.id, victim: h.id });
            } else ev(st, 'ev.entry.breachDenied', { who: h.id });
          } else { openings += Math.min(1, OPS[h.id].hb); st.t += E.openTime; ev(st, 'ev.entry.breachOk', { who: h.id }); }
        });
      }
      st.t += E.hardBreachTime;
    } else if (method === 'soft') {
      const vtl = tsum(st, 'att', alive(st.att), 'vtl');
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
    const am = modsOf('site', 'att', ch.att, st), dm = modsOf('site', 'def', ch.def, st);
    if (ch.att.style === 'split') st.carry.splitAtt = 1;
    st.choices = { ...(st.choices || {}), site: ch };
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
    const am = modsOf('plant', 'att', ch.att, st), dm = modsOf('plant', 'def', ch.def, st);
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
    const covers = tsum(st, 'att', others, 'post') + tsum(st, 'att', others, 'clear') * PL.clearCover;
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
    const am = modsOf('post', 'att', ch.att, st), dm = modsOf('post', 'def', ch.def, st);
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
        const pDef = sig(PO.defuseScale * (alive(st.def).length - alive(st.att).length) - PO.defPostCover * tsum(st, 'att', alive(st.att), 'post') / Math.max(1, alive(st.att).length) + PO.supportDef * tsum(st, 'def', alive(st.def), 'sup') + PO.defuseBase + (dm.defuse || 0));
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
    st.phaseNo = (st.phaseNo || 0) + 1; st.act = null; st.tbuff = actionsOn() ? persistentBuffs(st) : null;
    const used = actionsOn() ? usedActions(st, phase, dec) : [];
    if (used.length) beginActions(st, used, rng);
    let res;
    switch (phase) {
      case 'early': res = resolveEarly(st, dec, rng); break;
      case 'entry': res = resolveEntry(st, dec, rng); break;
      case 'site': res = resolveSite(st, dec, rng); break;
      case 'plant': res = resolvePlant(st, dec, rng); break;
      case 'post': res = resolvePost(st, dec, rng); break;
      default: throw new Error(`unknown phase ${phase}`);
    }
    if (actionsOn()) endActions(st, used, rng);
    return res;
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
      v.tbuff = null; v.act = null;
      const opp = other(side); v.known[opp] = {}; v.active[opp] = []; v[opp].forEach((m) => { delete m.uses; delete m.downBy; });
      Object.values(v.choices || {}).forEach((c) => { delete c[opp]; });   // decisiones (y acciones) del rival
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
    explain, viewFor, routeFit, alive, sum, isRoamer, clone, clamp, sig, pickW, levelOf, laneOf, checkEnd, actionDef, usesLeft, actionEffect, actionDo: optDo, actionScale, isKnown, duel, persistentBuffs,
  };
})(typeof window !== 'undefined' ? window : globalThis);
