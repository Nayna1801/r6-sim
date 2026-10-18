// Pantallas de decision del jugador (devuelven una Promise con la decision).
(function (g) {
  'use strict';
  const R6 = (g.R6 = g.R6 || {}); const UI = R6.UI; const { h } = UI;
  const T = (k, p) => R6.i18n.t(k, p);
  const opsOf = (ids) => ids.map((id) => R6.opsById[id]);
  const mapOfCtx = (ctx) => R6.mapsById[ctx.mapId];

  function timerBar(ctx, key, onEnd) {
    if (!ctx.timers) return { el: null, stop: () => {} };
    const total = R6.Engine.cfg().rules.timers[key];
    const fill = h('i', {}); const txt = h('span', {}, '');
    const el = h('div', { class: 'tbar' }, h('div', { class: 'bar' }, fill), txt);
    const cd = UI.countdown(total, (left) => { fill.style.width = `${(left / total) * 100}%`; txt.textContent = R6.i18n.fmtTime(Math.max(0, left)); if (left <= 5 && left > 0) UI.sfx.click(); }, onEnd);
    return { el, stop: cd.stop };
  }
  const head = (title, sub, timer) => h('div', { class: 'shead' }, h('div', {}, h('h2', {}, title), sub ? h('p', { class: 'sub' }, sub) : null), timer || null);

  // chips con los vetos en vigor (los tuyos y los que te han impuesto)
  function banChips(mine, against) {
    const row = (labelKey, ids, cls) => (ids.length ? h('div', { class: 'comp' }, h('span', { class: 'hint' }, `${T(labelKey)}: `), ids.map((id) => h('span', { class: `chip ${cls}` }, R6.i18n.opName(id)))) : null);
    return h('div', { class: 'banrows' }, row('stage.ban.active', mine || [], 'good'), row('stage.ban.against', against || [], 'warn'));
  }

  // ---------- baneo ----------
  function ban(p) {
    return new Promise((resolve) => {
      let sel = null; let tm = { stop() {} };
      const targets = opsOf(p.targets).sort((a, b) => R6.i18n.opName(a.id).localeCompare(R6.i18n.opName(b.id)));
      const grid = h('div', { class: `pool ban ${p.ctx.rivalSide}-side`, style: { '--stamp': JSON.stringify(T('ui.vetoStamp')) } }); const els = new Map();
      const ok = h('button', { class: 'go', disabled: true, onclick: () => finish(sel) }, T('stage.ban.confirm'));
      const selInfo = h('span', { class: 'selinfo' }, T('stage.ban.none'));
      const finish = (id) => { tm.stop(); resolve({ ban: id }); };
      targets.forEach((o, i) => {
        const el = UI.opCard(o, { enter: true, i, onClick: () => { sel = sel === o.id ? null : o.id; els.forEach((e, id) => e.classList.toggle('sel', id === sel)); ok.disabled = !sel; selInfo.textContent = sel ? T('stage.ban.selected', { name: R6.i18n.opName(sel) }) : T('stage.ban.none'); UI.sfx.pick(); } });
        els.set(o.id, el); grid.appendChild(el);
      });
      tm = timerBar(p.ctx, 'ban', () => finish(null));
      UI.show(h('div', { class: 'stage' }, head(T('stage.ban.title'), T('stage.ban.sub', { n: p.active.length, max: p.ctx.format.maxBansPerSide }), tm.el),
        banChips(p.active, p.against), grid, h('div', { class: 'actions' }, ok, h('button', { class: 'ghost', onclick: () => finish(null) }, T('stage.ban.skip')), selInfo)));
    });
  }

  // ---------- eleccion de operadores ----------
  function pick(p) {
    return new Promise((resolve) => {
      const all = opsOf(p.available).sort((a, b) => R6.i18n.opName(a.id).localeCompare(R6.i18n.opName(b.id)));
      let chosen = []; let q = ''; const filt = new Set(); let tm = { stop() {} };
      const grid = h('div', { class: `pool ${p.ctx.side}-side` }), slots = h('div', { class: 'slots' }), comp = h('div', {}); const els = new Map();
      const ok = h('button', { class: 'go', disabled: true, onclick: () => { tm.stop(); resolve({ ids: chosen.map((o) => o.id) }); } }, '');
      const refresh = () => {
        const full = chosen.length >= p.size;
        all.forEach((o) => {
          const el = els.get(o.id); const sel = chosen.includes(o); el.classList.toggle('sel', sel); el.classList.toggle('dim', full && !sel);
          el.classList.toggle('hidden', !((!q || R6.i18n.opName(o.id).toLowerCase().includes(q)) && [...filt].every((f) => (o[f] || 0) >= 1)));
        });
        UI.clear(slots); UI.clear(comp);
        for (let i = 0; i < p.size; i++) {
          const o = chosen[i];
          slots.appendChild(o ? h('div', { class: 'slot full', onclick: () => { chosen = chosen.filter((x) => x !== o); refresh(); } }, UI.opIcon(o), h('span', {}, R6.i18n.opName(o.id))) : h('div', { class: 'slot' }, i + 1));
        }
        comp.appendChild(UI.compChips(p.ctx.side, chosen, chosen.length === p.size));
        ok.disabled = chosen.length !== p.size; ok.textContent = chosen.length === p.size ? T('stage.pick.confirm') : T('stage.pick.need', { n: p.size - chosen.length });
      };
      all.forEach((o, i) => {
        const el = UI.opCard(o, { enter: true, i, onClick: () => { if (chosen.includes(o)) chosen = chosen.filter((x) => x !== o); else if (chosen.length < p.size) chosen.push(o); UI.sfx.pick(); refresh(); } });
        els.set(o.id, el); grid.appendChild(el);
      });
      const statFilters = p.ctx.side === 'att' ? R6.UICFG.pickFilters.att : R6.UICFG.pickFilters.def;
      tm = timerBar(p.ctx, 'pick', () => { while (chosen.length < p.size) { const c = all.find((o) => !chosen.includes(o)); chosen.push(c); } tm.stop(); resolve({ ids: chosen.map((o) => o.id) }); });
      const search = h('input', { type: 'search', class: 'search', placeholder: T('stage.pick.search'), oninput: (e) => { q = e.target.value.toLowerCase(); refresh(); } });
      const chips = h('div', { class: 'filters' }, statFilters.map((f) => h('button', { type: 'button', class: 'fchip', onclick: (e) => { if (filt.has(f)) filt.delete(f); else filt.add(f); e.currentTarget.classList.toggle('on'); refresh(); } }, T(`stat.${f}`))));
      refresh();
      UI.show(h('div', { class: 'stage' }, head(T('stage.pick.title'), p.pool ? T('stage.pick.subPool', { n: all.length }) : T('stage.pick.sub', { n: all.length }), tm.el),
        banChips(p.mine, p.against), slots, comp, h('div', { class: 'toolbar' }, search, chips), grid, h('div', { class: 'actions' }, ok)));
    });
  }

  // ---------- fila de rol por operador ----------
  function rolesTable(ops, roles, options, onChange) {
    return h('div', { class: 'roles' }, ops.map((o) => h('div', { class: 'rrow' }, UI.opIcon(o, '', true), h('b', {}, R6.i18n.opName(o.id)),
      h('div', { class: 'rtags' }, UI.roleTags(o).map((tg) => h('span', { class: `tag ${tg.cls}`, title: tg.title }, tg.label))),
      UI.segmented(options, roles[o.id], (v) => onChange(o.id, v), 'role'))));
  }

  // ---------- plan de defensa ----------
  function planDef(p) {
    return new Promise((resolve) => {
      const map = mapOfCtx(p.ctx); const R = R6.Engine.cfg().rules; const own = p.view.def.map((m) => R6.opsById[m.id]);
      let site = null; const roles = {}; own.forEach((o) => { roles[o.id] = 'anchor'; });
      const rf = { site: 5, entry: 3, hatch: 2 }; const pool = R.reinforcements.pool;
      const left = () => pool - R.reinforcements.buckets.reduce((a, b) => a + rf[b], 0);
      const hold = h('div', {}); const ok = h('button', { class: 'go', disabled: true, onclick: () => { tm.stop(); resolve({ site, reinf: { ...rf }, roles: { ...roles } }); } }, T('stage.planDef.confirm'));
      let tm = { stop() {} }; const need = h('span', { class: 'selinfo' }, '');
      const draw = () => {
        UI.clear(hold);
        hold.appendChild(h('div', { class: 'cols2' },
          h('div', {}, h('h3', {}, T('stage.planDef.site')), UI.building(map, { mode: 'select', selected: site, onPick: (id) => { site = id; UI.sfx.pick(); draw(); } }),
            h('h3', {}, T('stage.planDef.reinf', { left: left(), pool })),
            h('div', { class: 'reinf' }, R.reinforcements.buckets.map((b) => h('div', { class: 'rbox', title: T(`reinf.${b}.desc`) }, h('span', {}, T(`reinf.${b}`)), UI.stepper(rf[b], 0, rf[b] + left(), (v) => { rf[b] = v; draw(); }))))),
          h('div', {}, h('h3', {}, T('stage.planDef.roles')), rolesTable(own, roles, R.defRoles, (id, v) => { roles[id] = v; UI.sfx.click(); draw(); }))));
        ok.disabled = !site; need.textContent = site ? '' : T('stage.planDef.needSite');
      };
      tm = timerBar(p.ctx, 'prep', () => { if (!site) site = map.sites[0].id; tm.stop(); resolve({ site, reinf: { ...rf }, roles: { ...roles } }); });
      draw();
      UI.show(h('div', { class: 'stage' }, head(T('stage.planDef.title'), T('stage.planDef.sub'), tm.el), hold, h('div', { class: 'actions' }, ok, need)));
    });
  }

  // ---------- plan de ataque ----------
  function planAtt(p) {
    return new Promise((resolve) => {
      const map = mapOfCtx(p.ctx); const R = R6.Engine.cfg().rules; const B = R6.Engine.cfg().B.prep; const own = p.view.att.map((m) => R6.opsById[m.id]);
      let spawn = map.spawns[0].id; const order = []; const roles = R6.AI.attRoles(p.view);
      const intelSum = own.reduce((a, o) => a + o.intel * (roles[o.id] === 'intel' ? 1 : B.offRoleIntel), 0);
      const maxSweeps = Math.min(B.maxSweeps, B.baseSweeps + Math.floor(intelSum / B.intelPerSweep));
      const hold = h('div', {}); const ok = h('button', { class: 'go', onclick: () => { tm.stop(); resolve({ spawn, droneOrder: [...order], roles: { ...roles } }); } }, T('stage.planAtt.confirm'));
      let tm = { stop() {} };
      const draw = () => {
        UI.clear(hold);
        hold.appendChild(h('div', { class: 'cols2' },
          h('div', {}, h('h3', {}, T('stage.planAtt.spawn')), UI.spawnCards(map, { selected: spawn, onPick: (id) => { spawn = id; UI.sfx.pick(); draw(); } }),
            h('h3', {}, T('stage.planAtt.drone', { n: maxSweeps })), h('p', { class: 'hint' }, T('stage.planAtt.droneHelp')),
            UI.building(map, { mode: 'scout', order, onPick: (id) => { const i = order.indexOf(id); if (i >= 0) order.splice(i, 1); else order.push(id); UI.sfx.drone(); draw(); } })),
          h('div', {}, h('h3', {}, T('stage.planAtt.roles')), rolesTable(own, roles, R.attRoles, (id, v) => { roles[id] = v; UI.sfx.click(); draw(); }))));
      };
      tm = timerBar(p.ctx, 'prep', () => { tm.stop(); resolve({ spawn, droneOrder: [...order], roles: { ...roles } }); });
      draw();
      UI.show(h('div', { class: 'stage' }, head(T('stage.planAtt.title'), T('stage.planAtt.sub'), tm.el), hold, h('div', { class: 'actions' }, ok)));
    });
  }

  // ---------- ajuste tras el droneo (el atacante puede cambiar spawn y roles) ----------
  function adjust(p) {
    return new Promise((resolve) => {
      const map = mapOfCtx(p.ctx); const R = R6.Engine.cfg().rules; const st = p.view; const own = st.att.map((m) => R6.opsById[m.id]);
      let spawn = st.plan.att.spawn; const roles = { ...st.plan.att.roles }; const found = st.intel.found ? st.intel.site : null;
      const hold = h('div', {}); let tm = { stop() {} };
      const ok = h('button', { class: 'go', onclick: () => { tm.stop(); resolve({ spawn, roles: { ...roles } }); } }, T('stage.adjust.confirm'));
      const facts = [];
      facts.push(found ? h('li', { class: 'g' }, T('stage.adjust.found', { site: found, by: st.intel.by })) : h('li', { class: 'b' }, T('stage.adjust.notFound')));
      if (found) { facts.push(h('li', {}, T('stage.adjust.defSeen', { n: st.intel.defSeen }))); facts.push(h('li', {}, T('stage.adjust.reinfSeen', { n: st.intel.reinfSeen }))); }
      st.intel.scouted.forEach((s) => facts.push(h('li', { class: s.ok ? '' : 'b' }, T(s.ok ? 'ev.prep.scoutOk' : 'ev.prep.scoutLost', { site: s.site }))));
      const draw = () => {
        UI.clear(hold);
        hold.appendChild(h('div', { class: 'cols2' },
          h('div', {}, h('h3', {}, T('stage.adjust.intel')), h('ul', { class: 'facts' }, facts), UI.building(map, { mode: 'view', scouted: st.intel.scouted, found }),
            h('h3', {}, T('stage.adjust.spawn')), UI.spawnCards(map, { selected: spawn, onPick: (id) => { spawn = id; UI.sfx.pick(); draw(); } })),
          h('div', {}, h('h3', {}, T('stage.adjust.roles')), rolesTable(own, roles, R.attRoles, (id, v) => { roles[id] = v; draw(); }))));
      };
      tm = timerBar(p.ctx, 'prep', () => { tm.stop(); resolve({ spawn, roles: { ...roles } }); });
      draw();
      UI.show(h('div', { class: 'stage' }, head(T('stage.adjust.title'), T('stage.adjust.sub'), tm.el), hold, h('div', { class: 'actions' }, ok)));
    });
  }

  // ---------- decisiones de fase ----------
  function routeHint(view, route) {
    const found = view.intel && view.intel.found ? view.intel.site : null; if (!found) return null;
    const X = R6.Engine.cfg().B.explain; const f = R6.Engine.routeFit(view, route, found, { site: 0, entry: 0, hatch: 0 });
    return f > X.routeGood ? 'good' : f < X.routeBad ? 'bad' : 'mid';
  }
  function phase(p) {
    return new Promise((resolve) => {
      const dec = R6.Engine.cfg().dec; const { phase: ph, side } = p; const choice = {}; let tm = { stop() {} };
      Object.keys(p.options).forEach((grp) => { choice[grp] = p.options[grp][0]; });
      const ctx = p.view; const map = mapOfCtx(p.ctx);
      const body = h('div', {});
      const ok = h('button', { class: 'go', onclick: () => { tm.stop(); resolve({ choice: { ...choice } }); } }, T('stage.phase.confirm'));
      const draw = () => {
        UI.clear(body);
        Object.entries(p.options).filter(([grp]) => !grp.startsWith('act.')).forEach(([grp, ids]) => {
          body.appendChild(h('h3', {}, T(`dec.group.${ph}.${side}.${grp}`)));
          body.appendChild(h('div', { class: `dopts n${ids.length}` }, ids.map((id) => {
            const mods = dec[ph][side][grp][id].mods || {};
            const hint = grp === 'route' ? routeHint(ctx, id) : null;
            return h('button', { type: 'button', class: `dopt${choice[grp] === id ? ' on' : ''}`, onclick: () => { choice[grp] = id; UI.sfx.pick(); draw(); } },
              h('b', {}, T(`dec.${ph}.${side}.${grp}.${id}`)), h('span', { class: 'ddesc' }, T(`dec.${ph}.${side}.${grp}.${id}.desc`)),
              hint ? h('span', { class: `rhint ${hint}` }, T(`stage.phase.fit.${hint}`)) : (grp === 'route' && !(ctx.intel && ctx.intel.found) ? h('span', { class: 'rhint' }, T('stage.phase.fit.unknown')) : null),
              UI.modChips(mods));
          })));
        });
        const actGroups = Object.fromEntries(Object.entries(p.options).filter(([grp]) => grp.startsWith('act.')));
        const panel = UI.actionPanel({ phase: ph, side, foes: Math.max(0, ctx[side === 'att' ? 'def' : 'att'].filter((m) => m.alive).length - 1), groups: actGroups, choice, member: (opId) => ctx[side].find((m) => m.id === opId), onPick: (grp, optId) => { choice[grp] = optId; UI.sfx.pick(); draw(); } });
        if (panel) body.appendChild(panel);
      };
      tm = timerBar(p.ctx, 'prep', () => { tm.stop(); resolve({ choice: { ...choice } }); });
      draw();
      const clock = h('div', { class: 'pclock' }, T('stage.phase.clock', { t: R6.i18n.fmtTime(ctx.t), max: R6.i18n.fmtTime(R6.Engine.cfg().rules.timers.action) }));
      const intel = side === 'att' ? h('div', { class: 'ctxbox' }, ctx.intel.found ? T('stage.phase.intelFound', { site: ctx.intel.site }) : T('stage.phase.intelNone'), ctx.planted ? ` ${T('stage.phase.planted')}` : '') : h('div', { class: 'ctxbox' }, T('stage.phase.defCtx', { n: ctx.events.filter((e) => e.k === 'ev.prep.droneSpotted').length }));
      UI.show(h('div', { class: 'stage' }, head(T(`phase.${ph}.title`), T(`phase.${ph}.${side}.goal`), tm.el), h('div', { class: 'ctxrow' }, clock, intel),
        h('div', { class: 'cols2' }, h('div', {}, body), h('div', {}, h('h3', {}, T('stage.phase.mapTitle', { map: R6.i18n.mapName(map.id) })), UI.building(map, { mode: 'view', found: ctx.intel && ctx.intel.found ? ctx.intel.site : null, mine: ctx.plan && ctx.plan.def ? ctx.plan.def.site : null, scouted: ctx.intel ? ctx.intel.scouted : [] }))),
        h('div', { class: 'actions' }, ok)));
    });
  }

  UI.screens = { ban, pick, planDef, planAtt, adjust, phase };
})(typeof window !== 'undefined' ? window : globalThis);
