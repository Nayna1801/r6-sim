// Motor de simulacion de una ronda (bomba) + IA de draft/tactica.
// Funciona en navegador (window.R6) y en Node (globalThis.R6) para calibrar.
(function (g) {
  const R6 = (g.R6 = g.R6 || {});
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const sig = (x) => 1 / (1 + Math.exp(-x));
  const sum = (arr, k) => arr.reduce((s, o) => s + (o[k] || 0), 0);

  function mkRng(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const ATT_TACTICS = {
    standard: { name: 'Estandar', desc: 'Drones, luego entrada ordenada.', intelMul: 1, rush: 0, flankMul: 1, speed: 1 },
    rush: { name: 'Rush', desc: 'Entras antes de que terminen refuerzos y trampas. Menos info, mas riesgo.', intelMul: 0.4, rush: 1, flankMul: 0.8, speed: 1.6 },
    slow: { name: 'Info lenta', desc: 'Drones y lectura pesada. Mas info, pero te falta tiempo.', intelMul: 1.5, rush: 0, flankMul: 1, speed: 0.65 },
    split: { name: 'Dividir / flanquear', desc: 'Parte del equipo flanquea a los roamers y presiona por detras.', intelMul: 0.9, rush: 0, flankMul: 1.8, speed: 1 },
  };
  const DEF_TACTICS = {
    anchor: { name: 'Ancla total', desc: 'Todos en el sitio. Refuerzos y utilidad al maximo, sin flancos.', roamers: 0 },
    balanced: { name: 'Equilibrado', desc: 'Un roamer para desgastar, el resto ancla.', roamers: 1 },
    roam: { name: 'Roam agresivo', desc: 'Hasta 3 jugadores fuera del sitio para matar antes de la entrada.', roamers: 3 },
  };

  // Probabilidad de que A gane un duelo contra D con bonos ya calculados.
  function duelProb(effA, effD) { return sig(0.62 * (effA - effD)); }

  function simulate(cfg) {
    const { map, rng = Math.random, verbose = true } = cfg;
    const site = cfg.defSite, attSite = cfg.attSite;
    const at = ATT_TACTICS[cfg.attTactic] || ATT_TACTICS.standard;
    const dt = DEF_TACTICS[cfg.defTactic] || DEF_TACTICS.balanced;
    const A = cfg.att.map((o) => ({ ...o, alive: true, kills: 0, role: '' }));
    const D = cfg.def.map((o) => ({ ...o, alive: true, kills: 0, roamer: false }));
    const alive = (arr) => arr.filter((o) => o.alive);
    const log = [];
    let t = 0;
    const ev = (type, text, extra) => { if (verbose) log.push({ t: Math.round(t), type, text, ...extra }); };
    const why = { noHB: false, infoEdge: 0, siteMiss: false, hbAlive: 0, hbDenied: 0, openings: 0, roamKills: 0, roamLost: 0, planted: false, plantT: null, timeout: false, defused: false };
    const S = map.sites[site];

    // ---------- 1. Informacion ----------
    const attIntel = (sum(A, 'intel') * at.intelMul) + 2;
    const defCounter = sum(D, 'aIntel') * 1.2 + sum(D, 'intel') * 0.5;
    const infoEdge = clamp((attIntel - defCounter) / (attIntel + defCounter + 2), -1, 1);
    why.infoEdge = infoEdge;
    t = 8;
    ev('info', infoEdge > 0.15 ? `Fase de drones: los atacantes leen bien el edificio (${Math.round(attIntel * 10) / 10} de info vs ${Math.round(defCounter * 10) / 10} de bloqueo).`
      : infoEdge < -0.15 ? `Fase de drones: los defensores neutralizan la info (${Math.round(defCounter * 10) / 10} de bloqueo vs ${Math.round(attIntel * 10) / 10}).`
        : 'Fase de drones: informacion pareja.');

    // ---------- 2. Eleccion de sitio ----------
        if (attSite !== site) {
      why.siteMiss = true;
      const pReveal = clamp(0.2 + 0.8 * Math.max(0, infoEdge) + 0.1 * sum(A, 'intel') * at.intelMul / 5, 0.05, 0.95);
      if (rng() < pReveal) { t += 12; ev('site', `Los atacantes detectan que el objetivo esta en ${map.sites[site].name} y rotan (-12s).`); }
      else { t += 32; ev('site', `Los atacantes atacan ${map.sites[attSite].name} pero la bomba esta en ${map.sites[site].name}. Rotacion forzada (-32s).`); }
    } else { ev('site', `Ambos equipos coinciden en ${S.name}.`); }

    // ---------- 3. Roamers ----------
    const byRoam = [...D].sort((a, b) => b.roam - a.roam);
    byRoam.slice(0, dt.roamers).forEach((d) => { d.roamer = true; });
    const roamers = D.filter((d) => d.roamer);
    t += 14;
    roamers.forEach((r) => {
      const watchers = alive(A);
      if (!watchers.length) return;
      // los atacantes con intel/flank tienden a cruzarse con roamers
      const a = pickWeighted(watchers, (o) => 1 + o.intel * 0.8 + o.flank * 0.7 * at.flankMul, rng);
      const ambush = 0.6 * r.roam + 0.25 * (r.aim - 3) - 0.4 * (r.roam === 0 ? 1 : 0);
      const detect = 0.35 * a.intel + 0.4 * Math.max(0, infoEdge) + 0.25 * a.flank * at.flankMul;
      const pEnc = clamp(0.5 + 0.12 * dt.roamers, 0, 0.9);
      if (rng() > pEnc) { ev('roam', `${r.name} no encuentra a nadie y se queda fuera de posicion.`, { who: r.id }); return; }
      const pAtt = duelProb(a.aim + detect, r.aim + ambush + (S.def * 2));
      if (rng() < pAtt) { r.alive = false; a.kills++; why.roamLost++; ev('kill', `${a.name} caza a ${r.name} jugando de roamer${detect > 0.7 ? ' (lo habia rastreado)' : ''}.`, { killer: a.id, victim: r.id }); }
      else { a.alive = false; r.kills++; why.roamKills++; ev('kill', `${r.name} embosca a ${a.name} antes de la entrada${ambush > 0.8 ? ' con su juego de roam' : ''}.`, { killer: r.id, victim: a.id }); }
    });

    // ---------- 4. Breach ----------
    t += 20;
    const rest = alive(D);
    let openings = 0;
    const hbs = alive(A).filter((o) => o.hb > 0);
    why.hbAlive = hbs.length;
    if (hbs.length === 0) {
      t += 40 / at.speed; why.noHB = true;
      ev('breach', 'Sin hard-breach vivo: los atacantes solo entran por zonas sin reforzar. Pierden tiempo y angulos.');
    } else {
      const aHBsum = sum(alive(D).filter((d) => !d.roamer), 'aHB');
      const rushPen = at.rush ? 0.65 : 1;
      hbs.forEach((h) => {
        if (!h.alive) return;
        const pDeny = clamp((aHBsum * 0.9 * rushPen) / (aHBsum * 0.9 * rushPen + 1.7 + h.hb), 0, 0.85);
        if (rng() < pDeny) {
          why.hbDenied++;
          const dies = rng() < 0.4;
          t += 14;
          if (dies) { h.alive = false; const d = pickWeighted(alive(D), (o) => 1 + o.aHB, rng); d.kills++; ev('kill', `El refuerzo de ${h.name} falla: ${d.name} protege la pared y lo elimina.`, { killer: d.id, victim: h.id }); }
          else ev('breach', `${h.name} intenta abrir pero los defensores (aHB) lo frenan (-14s).`, { who: h.id });
        } else { openings++; t += 8; ev('breach', `${h.name} abre una pared reforzada.`, { who: h.id }); }
      });
    }
    // vertical / entrada blanda
    const vtl = sum(alive(A), 'vtl');
    const softAngles = Math.min(1.5, vtl * map.vert * 0.55);
    openings = Math.min(3, openings) + softAngles * 0.5;
    why.openings = openings;

    // ---------- Duelo generico ----------
    const nowA = () => alive(A).length, nowD = () => alive(D).length;
    const survivingRoamers = () => D.filter((d) => d.roamer && d.alive).length;
    const anchorBonus = dt.roamers === 0 ? 0.28 : dt.roamers === 1 ? 0.1 : 0;
    function duel(a, d, phase) {
      const post = phase === 'post';
      const nA = nowA(), nD = nowD();
      const denyEff = Math.max(0, sum(alive(D), 'deny') - sum(alive(A), 'aUtil') * 1.2) * (at.rush ? 0.07 : 0.12) * (post ? 0.4 : 1);
      const clearEff = Math.max(0, sum(alive(A), 'clear') - sum(alive(D), 'aNade') * 0.9) * 0.1;
      const smokeEff = Math.max(0, sum(alive(A), 'smoke') * 0.14 - sum(alive(D), 'vis') * 0.22);
      const flankDef = survivingRoamers() * 0.32 * Math.max(0.3, 1 - sum(alive(A), 'flank') * 0.12 * at.flankMul);
      const flankAtt = at.flankMul > 1 ? 0.25 * sum(alive(A), 'flank') * (at.flankMul - 1) : 0;
      const longBonus = (x) => x.long * Math.max(0, map.open - 0.4) * 1.1;
      let effA = a.aim + 0.28 * a.entry + clearEff + smokeEff + (why.noHB ? -0.6 : 0.4 * openings) + flankAtt + longBonus(a);
      let effD = d.aim + 0.25 * d.anchor + 0.05 + (d.roamer ? 0 : anchorBonus) + denyEff + flankDef + longBonus(d) + S.def * 2.2 + 0.05 * sum(alive(D), 'sup');
      effA += 0.05 * sum(alive(A), 'sup');
      if (infoEdge >= 0) effA += 1.3 * infoEdge; else effD += 1.3 * -infoEdge;
      effA += clamp((nA - nD) * 0.22, -0.7, 0.7);
      effD += clamp((nD - nA) * 0.22, -0.7, 0.7);
      if (post) { effA += 0.45 * (sum(alive(A), 'post') / Math.max(1, nA)) * 2 + 0.3; effD -= 0.1; }
      if (!post && t > 130) effA -= 0.3;
      if (a.role === 'planter') effA -= 0.2;
      return { p: duelProb(effA, effD), effA, effD };
    }
    function resolve(a, d, phase) {
      const { p } = duel(a, d, phase);
      const win = rng() < p;
      const tradeP = 0.1 + 0.08 * (1 - Math.abs(p - 0.5) * 2);
      const trade = rng() < tradeP;
      if (win) {
        d.alive = false; a.kills++;
        if (trade) { a.alive = false; d.kills++; ev('kill', `${a.name} y ${d.name} se matan mutuamente.`, { killer: a.id, victim: d.id, trade: true, killer2: d.id, victim2: a.id }); }
        else ev('kill', `${a.name} elimina a ${d.name}.`, { killer: a.id, victim: d.id, p: Math.round(p * 100) });
      } else {
        a.alive = false; d.kills++;
        if (trade) { d.alive = false; a.kills++; ev('kill', `${d.name} y ${a.name} se matan mutuamente.`, { killer: d.id, victim: a.id, trade: true, killer2: a.id, victim2: d.id }); }
        else ev('kill', `${d.name} detiene a ${a.name}.`, { killer: d.id, victim: a.id, p: Math.round((1 - p) * 100) });
      }
    }

    // ---------- 5. Ejecucion hasta plantar ----------
    let planted = false, plantAt = 0;
    const tEnd = 185;
    while (nowA() > 0 && nowD() > 0 && !planted && t < tEnd) {
      t += 13 / Math.sqrt(at.speed);
      const n = Math.min(2, nowA(), nowD());
      for (let i = 0; i < n && nowA() > 0 && nowD() > 0; i++) {
        const a = pickWeighted(alive(A), (o) => 1 + o.entry * 0.9 + (o.aim - 3) * 0.3, rng);
        const d = pickWeighted(alive(D), (o) => 1 + (o.roamer ? 0.2 : o.anchor * 0.6), rng);
        resolve(a, d, 'exec');
      }
      if (nowA() === 0 || nowD() === 0) break;
      const control = nowA() - nowD();
      if (t > tEnd - 35 || control >= 1 || nowD() <= 1) {
        const planter = pickWeighted(alive(A), (o) => 1 + o.post * 0.4, rng);
        const covers = sum(alive(A).filter((o) => o !== planter), 'post') + sum(alive(A).filter((o) => o !== planter), 'clear') * 0.3;
        const pPlant = sig(0.9 * control + 0.45 * covers + 0.5 - 0.35 * Math.max(0, nowD() - 2) + (t > tEnd - 35 ? -0.2 : 0));
        if (rng() < pPlant) { planted = true; plantAt = t + 7; t += 7; planter.role = 'planter'; ev('plant', `${planter.name} planta el desactivador (${nowA()}v${nowD()}).`, { who: planter.id }); }
        else { planter.alive = false; const d = pickWeighted(alive(D), (o) => 1 + o.aim * 0.3, rng); d.kills++; ev('kill', `${d.name} corta la plantada y elimina a ${planter.name}.`, { killer: d.id, victim: planter.id }); }
      }
    }
    why.planted = planted; why.plantT = plantAt;
    let winner = null, endReason = '';
    if (nowD() === 0 && nowA() > 0) { winner = 'att'; endReason = planted ? 'Defensores eliminados tras plantar.' : 'Defensores eliminados.'; }
    else if (nowA() === 0 && !planted) { winner = 'def'; endReason = 'Atacantes eliminados.'; }
    else if (!planted && nowA() > 0 && nowD() > 0) { winner = 'def'; endReason = 'Se agota el tiempo sin plantar.'; why.timeout = true; ev('end', 'Se agota el tiempo: los atacantes no plantan.'); }

    // ---------- 6. Post-plant ----------
    if (!winner && planted) {
      let ppT = 0;
      while (ppT < 45 && nowA() > 0 && nowD() > 0) {
        ppT += 9; t += 9;
        const a = pickWeighted(alive(A), (o) => 1 + o.post * 0.6 + o.flank * 0.4, rng);
        const d = pickWeighted(alive(D), (o) => 1 + o.aim * 0.2, rng);
        resolve(a, d, 'post');
        if (nowD() === 0 || nowA() === 0) break;
        if (ppT >= 18) {
          const pDef = sig(0.9 * (nowD() - nowA()) - 0.35 * sum(alive(A), 'post') / Math.max(1, nowA()) + 0.1 * sum(alive(D), 'sup') + 0.2);
          if (ppT >= 27 && rng() < pDef * 0.8) { const df = pickWeighted(alive(D), () => 1, rng); ev('defuse', `${df.name} desactiva la bomba.`, { who: df.id }); winner = 'def'; endReason = 'Desactivacion.'; why.defused = true; break; }
          else if (ppT >= 27) { const df = pickWeighted(alive(D), () => 1, rng); const a2 = pickWeighted(alive(A), () => 1, rng); df.alive = false; a2.kills++; ev('kill', `${a2.name} interrumpe la desactivacion de ${df.name}.`, { killer: a2.id, victim: df.id }); }
        }
      }
      if (!winner) {
        if (nowA() === 0) { winner = 'def'; endReason = 'Atacantes eliminados tras plantar: desactivacion garantizada.'; why.defused = true; ev('defuse', 'Sin atacantes vivos, los defensores desactivan la bomba.'); }
        else if (nowD() === 0) { winner = 'att'; endReason = 'Defensores eliminados con la bomba plantada.'; }
        else { winner = 'att'; endReason = 'La bomba explota.'; ev('end', 'La bomba explota.'); }
      }
    }
    if (!winner) winner = nowA() > nowD() ? 'att' : 'def';
    ev('end', `Ronda para ${winner === 'att' ? 'ATACANTES' : 'DEFENSORES'}: ${endReason}`, { winner });

    // ---------- Motivos ----------
    const reasons = explain({ winner, why, A, D, at, dt, map, S, planted, endReason });
    const survivors = { att: alive(A).map((o) => o.id), def: alive(D).map((o) => o.id) };
    const mvp = [...A, ...D].sort((x, y) => y.kills - x.kills)[0];
    return { winner, endReason, log, reasons, why, survivors, mvp: mvp && mvp.kills > 0 ? { id: mvp.id, name: mvp.name, kills: mvp.kills } : null, finalT: Math.round(t) };
  }

  function explain({ winner, why, A, D, at, dt, map, S, planted, endReason }) {
    const out = [];
    const attWon = winner === 'att';
    const f = (x) => Math.round(x * 100) / 100;
    if (Math.abs(why.infoEdge) > 0.2) {
      const favAtt = why.infoEdge > 0;
      out.push({ w: Math.abs(why.infoEdge) * 3, good: favAtt === attWon, text: favAtt ? `Ventaja de informacion para atacantes (${f(why.infoEdge)}): drones/intel por encima del bloqueo defensivo.` : `Ventaja de informacion para defensores (${f(-why.infoEdge)}): el bloqueo de drones (Mute, Mozzie, Vigil...) pesa mas que el intel atacante.` });
    }
    if (why.noHB) out.push({ w: 3, good: !attWon, text: 'Los atacantes no tenian hard-breach vivo: sin aperturas, menos angulos y mucho tiempo perdido.' });
    else if (why.hbDenied > 0) out.push({ w: 1.2 * why.hbDenied, good: !attWon, text: `${why.hbDenied} intento(s) de breach frenado(s) por los refuerzos y su proteccion (Bandit, Kaid, Mira, Mute...).` });
    else if (why.openings >= 1.5) out.push({ w: 1.5, good: attWon, text: 'Los atacantes abrieron varios angulos con el breach sin oposicion.' });
    if (why.siteMiss) out.push({ w: 1.5, good: !attWon, text: 'Los atacantes fallaron el sitio inicial y perdieron tiempo rotando.' });
    if (why.roamKills + why.roamLost >= 2 || why.roamKills >= 1) out.push({ w: 1 + why.roamKills, good: why.roamKills > why.roamLost ? !attWon : attWon, text: `Fase de roam: ${why.roamKills} baja(s) defensiva(s) vs ${why.roamLost} roamer(s) perdidos.` });
    if (why.timeout) out.push({ w: 3, good: !attWon, text: 'Se agoto el tiempo antes de plantar.' });
    if (planted) out.push({ w: 1, good: attWon, text: attWon ? 'Plantada conseguida y mantenida en post-plant.' : 'Plantada lograda pero los defensores recuperaron el sitio.' });
    const mvp = [...A, ...D].sort((x, y) => y.kills - x.kills)[0];
    if (mvp && mvp.kills >= 2) out.push({ w: 0.9 * mvp.kills, good: true, text: `${mvp.name} dominó la ronda con ${mvp.kills} bajas.` });
    const aliveA = A.filter((o) => o.alive).length, aliveD = D.filter((o) => o.alive).length;
    out.push({ w: 0.5, good: true, text: `Supervivientes: ${aliveA} atacantes, ${aliveD} defensores. ${endReason}` });
    return out.sort((a, b) => b.w - a.w).slice(0, 6);
  }

  function pickWeighted(arr, wf, rng) {
    let tot = 0; const ws = arr.map((o) => { const w = Math.max(0.01, wf(o)); tot += w; return w; });
    let r = rng() * tot;
    for (let i = 0; i < arr.length; i++) { r -= ws[i]; if (r <= 0) return arr[i]; }
    return arr[arr.length - 1];
  }

  // ---------- IA ----------
  function sample(arr, n, rng) { const c = [...arr]; const out = []; while (out.length < n && c.length) out.push(c.splice(Math.floor(rng() * c.length), 1)[0]); return out; }
  function combos(arr, k) {
    const res = [];
    (function rec(start, cur) { if (cur.length === k) { res.push([...cur]); return; } for (let i = start; i < arr.length; i++) { cur.push(arr[i]); rec(i + 1, cur); cur.pop(); } })(0, []);
    return res;
  }
  const randTactic = (obj, rng) => Object.keys(obj)[Math.floor(rng() * Object.keys(obj).length)];
  // winrate del equipo de la IA contra equipos aleatorios del rival
  function evalTeam(side, team, tactic, map, oppPool, n, rng) {
    let w = 0;
    for (let i = 0; i < n; i++) {
      const opp = sample(oppPool, 5, rng);
      const site = Math.floor(rng() * 2), oSite = Math.floor(rng() * 2);
      const r = side === 'att'
        ? simulate({ att: team, def: opp, map, defSite: oSite, attSite: site, attTactic: tactic, defTactic: randTactic(DEF_TACTICS, rng), rng, verbose: false })
        : simulate({ att: opp, def: team, map, defSite: site, attSite: oSite, attTactic: randTactic(ATT_TACTICS, rng), defTactic: tactic, rng, verbose: false });
      if (r.winner === side) w++;
    }
    return w / n;
  }
  function aiDraft(side, pool, map, rng = Math.random) {
    const oppPool = R6.OPS.filter((o) => o.side !== side);
    const cs = combos(pool, 5);
    let best = null;
    const tactics = Object.keys(side === 'att' ? ATT_TACTICS : DEF_TACTICS);
    cs.forEach((team) => {
      const tac = tactics[Math.floor(rng() * tactics.length)];
      const wr = evalTeam(side, team, tac, map, oppPool, 22, rng);
      if (!best || wr > best.wr) best = { team, wr };
    });
    let bestT = null;
    tactics.forEach((tac) => { const wr = evalTeam(side, best.team, tac, map, oppPool, 40, rng); if (!bestT || wr > bestT.wr) bestT = { tac, wr }; });
    const site = Math.floor(rng() * 2);
    return { team: best.team, tactic: bestT.tac, site, est: bestT.wr };
  }

  R6.ATT_TACTICS = ATT_TACTICS; R6.DEF_TACTICS = DEF_TACTICS;
  R6.simulate = simulate; R6.aiDraft = aiDraft; R6.mkRng = mkRng; R6.sample = sample;
})(typeof window !== 'undefined' ? window : globalThis);
