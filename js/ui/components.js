// Componentes reutilizables: tarjetas de operador, diagrama del edificio, spawns, chips de composicion.
(function (g) {
  'use strict';
  const R6 = (g.R6 = g.R6 || {}); const UI = R6.UI; const { h } = UI;
  const T = (k, p) => R6.i18n.t(k, p);
  let UICFG = null;
  const setCfg = (c) => { UICFG = c; };

  const fmt = (v) => R6.i18n.fmtNum(v, 2);
  const opTitle = (o) => `${R6.i18n.opName(o.id)} — ${(UICFG.stats[o.side] || []).filter((k) => o[k]).map((k) => `${T(`stat.${k}`)} ${fmt(o[k])}`).join(' · ')}`;
  // Etiquetas derivadas de las estadisticas del motor (perfil en la simulacion)
  const tagsOf = (o, limit = UICFG.maxTags) => UICFG.tags.filter((tg) => (o[tg.stat] || 0) >= tg.min).slice(0, limit);
  // Etiquetas de rol de una tarjeta: especialidades oficiales del juego + marca de breacher duro
  const roleTags = (o) => {
    const out = (o.specialties || []).map((id) => ({ id, label: T(`spec.${id}`), title: T(`spec.${id}.desc`), cls: '' }));
    if ((o.hb || 0) >= 1) out.push({ id: 'hb', label: T('tag.hb'), title: T('stat.hb.desc'), cls: 'hb' });
    return out.slice(0, UICFG.maxTags);
  };

  // Pantalla de inicio de ronda: arte del mapa, ronda y bando. Se cierra sola o al tocar; devuelve una promesa.
  function splash({ mapId, side, round, ms = 2200 }) {
    const map = R6.mapsById[mapId];
    const root = h('div', { class: `splash ${side}`, role: 'presentation' },
      h('div', { class: 'sp-bg', style: { backgroundImage: map && map.img ? `url(${new URL(map.img, document.baseURI).href})` : 'none' } }),
      h('div', { class: 'sp-slash' }),
      h('div', { class: 'sp-body' },
        h('div', { class: 'sp-kicker' }, T('hud.roundBanner', { n: round })),
        h('div', { class: 'sp-map' }, R6.i18n.mapName(mapId)),
        h('div', { class: 'sp-side' }, T(`side.${side}`)),
        h('div', { class: 'sp-line' }, h('i', {}))));
    document.body.appendChild(root);
    return new Promise((resolve) => {
      let done = false;
      const end = () => { if (done) return; done = true; root.classList.add('out'); setTimeout(() => { root.remove(); resolve(); }, 380); };
      root.addEventListener('pointerdown', end);
      setTimeout(end, ms);
    });
  }

  // Ficha de agente: especialidades oficiales, habilidad, gadgets y como entra cada gadget en las cifras del motor
  function opSheet(o) {
    const prev = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    const close = () => { document.removeEventListener('keydown', onKey); ov.remove(); if (prev && prev.focus) prev.focus(); };
    const fxOf = (id) => Object.entries(o.fx || {}).flatMap(([s, arr]) => arr.filter((x) => x.gadget === id).map((x) => ({ s, v: x.v })));
    const pips = (key, v) => h('div', { class: 'rate' }, h('span', {}, T(`sheet.${key}`)),
      v == null ? h('em', {}, T('sheet.unknownRating')) : h('span', { class: 'pips', role: 'img', 'aria-label': `${v}/3` }, [1, 2, 3].map((i) => h('i', { class: i <= v ? 'on' : '' }))));
    const max = UICFG.sheetStatMax; const pct = (v) => `${Math.min(100, (v / max) * 100)}%`;
    const keys = (UICFG.stats[o.side] || []).filter((k) => k === 'aim' || (o[k] || 0) > 0);
    const rows = keys.map((k) => {
      const base = (o.base || o)[k] || 0; const parts = (o.fx && o.fx[k]) || []; const extra = parts.reduce((a, x) => a + x.v, 0);
      return h('div', { class: 'srow', title: T(`stat.${k}.desc`) }, h('span', { class: 'sl' }, T(`stat.${k}`)),
        h('div', { class: 'sbar' }, h('i', { class: 'b', style: { width: pct(base) } }), h('i', { class: 'g', style: { width: pct(extra) } })),
        h('b', {}, fmt(o[k])),
        h('span', { class: 'schips' }, base ? h('span', { class: 'gchip base' }, `${T('sheet.base')} ${fmt(base)}`) : null, parts.map((p) => h('span', { class: 'gchip' }, `${T(`gadget.${p.gadget}`)} +${fmt(p.v)}`))));
    });
    const simTags = tagsOf(o, 99);
    const ov = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', onclick: (e) => { if (e.target === ov) close(); } },
      h('div', { class: `mbox sheet ${o.side}` },
        h('div', { class: 'sheethead' }, h('img', { class: 'sportrait', src: o.img, alt: '' }),
          h('div', { class: 'sid' }, h('h2', {}, R6.i18n.opName(o.id)), h('span', { class: `hudside ${o.side}` }, T(`side.${o.side}`)), pips('health', o.health), pips('speed', o.speed)),
          h('button', { class: 'ghost sclose', type: 'button', onclick: close }, T('ui.close'))),
        h('div', { class: 'cols2' },
          h('div', {},
            h('h3', {}, T('sheet.specialties')),
            h('div', { class: 'comp specs' }, (o.specialties || []).map((id) => h('span', { class: 'chip', title: T(`spec.${id}.desc`) }, T(`spec.${id}`)))),
            h('h3', {}, T('sheet.ability')), h('div', { class: 'ability' }, h('b', {}, T(`ability.${o.ability}`)), h('p', { class: 'ddesc' }, T(`ability.${o.ability}.desc`))),
            h('h3', {}, T('sheet.gadgets')),
            h('div', { class: 'gadgets' }, (o.gadgets || []).map((id) => h('div', { class: 'gitem' }, h('b', {}, T(`gadget.${id}`)), h('span', { class: 'ddesc' }, T(`gadget.${id}.desc`)),
              h('div', { class: 'mods' }, fxOf(id).map((x) => h('span', { class: 'mchip pos' }, `${T(`stat.${x.s}`)} +${fmt(x.v)}`))))))),
          h('div', {},
            h('h3', {}, T('sheet.sim')), h('p', { class: 'hint tight' }, T('sheet.simNote')),
            simTags.length ? h('div', { class: 'comp' }, simTags.map((tg) => h('span', { class: `tag ${tg.cls || ''}` }, T(`tag.${tg.id}`)))) : null,
            rows.length ? h('div', { class: 'stats' }, rows) : h('p', { class: 'hint' }, T('sheet.noStats'))))));
    document.addEventListener('keydown', onKey);
    document.body.appendChild(ov);
    ov.querySelector('.sclose').focus();
  }

  // Panel de acciones de agente de una fase. Cada accion es un grupo 'act.<id>' del diccionario de decision (la primera opcion es 'off').
  // Una fila compacta por accion; si solo tiene una opcion ademas de 'off', ese boton hace de interruptor. Los detalles van plegados.
  // p: { groups: {grupo: [opciones]}, choice, member(opId) -> estado del agente, onPick(grupo, opcion), phase, side, foes }
  function actionPanel(p) {
    const grps = Object.keys(p.groups); if (!grps.length) return null;
    const max = R6.ACTIONS.maxActive;
    const effective = (g) => { const w = R6.ACTIONS.actions[g.slice(4)].when; return p.choice[g] !== p.groups[g][0] && (!w || Object.entries(w).every(([k, v]) => p.choice[k] === v)); };   // como el motor: una accion con 'when' incumplido no ocupa hueco
    const active = grps.filter(effective).length;
    const cards = grps.map((grp) => {
      const id = grp.slice(4); const a = R6.ACTIONS.actions[id]; const o = R6.opsById[a.op]; const sel = p.choice[grp]; const opts = p.groups[grp]; const offId = opts[0];
      const nonOff = opts.slice(1); const single = nonOff.length === 1; const left = R6.Engine.usesLeft(p.member(a.op), id);
      const chipsOf = (optId) => { const e = R6.Engine.actionEffect(grp, optId); return [UI.modChips({ ...e.mods, time: p.side === 'att' ? e.time : 0 }), fxChips(grp, optId, p.foes)]; };
      const btn = (optId, withChips = true) => {
        const off = optId === offId; const on = sel === optId; const locked = !off && sel === offId && active >= max;
        return h('button', { type: 'button', class: `aopt${on ? ' on' : ''}${off ? ' off' : ''}`, disabled: locked, onclick: () => p.onPick(grp, single && on ? offId : optId) },
          h('b', {}, off ? T('ui.actionOff') : T(`action.${id}.opt.${optId}`)),
          off || !withChips ? null : chipsOf(optId));
      };
      const whenTxt = a.when ? T('ui.actionWhen', { what: Object.entries(a.when).map(([g, v]) => T(`dec.${p.phase}.${a.side}.${g}.${v}`)).join(', ') }) : null;
      return h('div', { class: `acard${sel !== offId ? ' on' : ''}` },
        h('div', { class: 'arow' },
          h('div', { class: 'ahead' }, UI.opIcon(o, '', true),
            h('div', { class: 'atitle' }, h('b', {}, T(`action.${id}`)), h('span', { class: 'asub' }, `${R6.i18n.opName(o.id)} · ${T('ui.actionUses', { n: left })}`), single ? chipsOf(nonOff[0]) : null)),
          h('div', { class: 'aopts' }, single ? [btn(nonOff[0], false)] : opts.map((optId) => btn(optId)))),
        h('details', { class: 'adet' }, h('summary', {}, T('ui.actionDetails')),
          h('p', { class: 'ddesc' }, T(`action.${id}.desc`)),
          nonOff.map((optId) => h('p', { class: 'ddesc' }, h('b', {}, `${T(`action.${id}.opt.${optId}`)}: `), T(`action.${id}.opt.${optId}.desc`))),
          h('p', { class: 'anote warn' }, T(`action.${id}.counters`)),
          whenTxt ? h('p', { class: 'anote' }, whenTxt) : null, a.persist ? h('p', { class: 'anote' }, T('ui.actionPersist')) : null));
    });
    return h('div', { class: 'apanel' }, h('h3', {}, T('ui.actions'), ' ', h('small', { class: 'amax' }, `${active}/${max} · ${T('ui.actionsMax', { n: max })}`)), h('div', { class: 'acards' }, cards));
  }

  const EAGER_CARDS = 12; // las de la primera pantalla no esperan al lazy-load

  // Tarjeta de operador. opts: {selected, dim, onClick, badge, hidden}
  function opCard(o, opts = {}) {
    const el = h('div', { class: `card${opts.selected ? ' sel' : ''}${opts.dim ? ' dim' : ''}${opts.enter ? ' enter' : ''}`, style: { '--i': opts.i || 0 }, title: opTitle(o) },
      h('div', { class: 'tags' }, roleTags(o).map((tg) => h('span', { class: `tag ${tg.cls}`, title: tg.title }, tg.label))),
      opts.badge ? h('span', { class: 'cbadge' }, opts.badge) : null,
      h('button', { class: 'cinfo', type: 'button', 'aria-label': T('ui.info'), title: T('ui.info'), onclick: (e) => { e.stopPropagation(); opSheet(o); } }, 'i'),
      h('picture', {}, h('source', { media: '(max-width:760px)', srcset: o.imgS }),
        h('img', { src: o.img, alt: '', loading: (opts.i || 0) < EAGER_CARDS ? 'eager' : 'lazy', decoding: 'async', width: 150, height: 214 })),
      h('div', { class: 'nm' }, R6.i18n.opName(o.id), h('span', { class: 'aimv' }, `${T('ui.aimShort')} ${o.aim}`)));
    if (opts.onClick) {
      el.addEventListener('click', opts.onClick);
      el.addEventListener('mousemove', (ev) => { const r = el.getBoundingClientRect(); const x = (ev.clientX - r.left) / r.width - 0.5, y = (ev.clientY - r.top) / r.height - 0.5; el.style.setProperty('--ry', `${x * 14}deg`); el.style.setProperty('--rx', `${-y * 12}deg`); el.style.setProperty('--mx', `${(x + 0.5) * 100}%`); });
      el.addEventListener('mouseleave', () => { el.style.setProperty('--ry', '0deg'); el.style.setProperty('--rx', '0deg'); });
    }
    return el;
  }
  // Chips de composicion del equipo seleccionado
  function compChips(side, ops, complete) {
    const cc = UICFG.compChips[side];
    return h('div', { class: 'comp' }, ops.length ? cc.map((c) => {
      const v = c.count ? ops.filter((o) => o[c.stat]).length : ops.reduce((a, o) => a + (o[c.stat] || 0), 0);
      const state = !complete ? '' : (c.min == null || v >= c.min ? 'good' : 'warn');
      return h('span', { class: `chip ${state}`, title: T(`stat.${c.stat}.desc`) }, T(`stat.${c.stat}`), h('b', {}, v));
    }) : h('span', { class: 'hint' }, T('ui.compEmpty')));
  }

  // Diagrama del edificio por pisos con los sitios de bomba reales.
  // opts: {mode:'select'|'scout'|'view', selected, order:[ids], scouted:[{site,ok}], found, mine, onPick}
  function building(map, opts = {}) {
    const floors = {};
    map.sites.forEach((s) => { const key = s.floor || '?'; (floors[key] = floors[key] || { level: s.level == null ? 1 : s.level, sites: [] }).sites.push(s); });
    const list = Object.entries(floors).sort((a, b) => b[1].level - a[1].level);
    const scouted = Object.fromEntries((opts.scouted || []).map((x) => [x.site, x.ok]));
    const root = h('div', { class: `bld ${opts.mode || 'view'}` });
    list.forEach(([floor, f]) => {
      const row = h('div', { class: 'floor', 'data-level': f.level }, h('div', { class: 'flabel' }, floor), h('div', { class: 'fsites' }, f.sites.map((s) => {
        const idx = (opts.order || []).indexOf(s.id);
        const st = [];
        if (opts.selected === s.id) st.push('sel');
        if (opts.found === s.id) st.push('found');
        if (opts.mine === s.id) st.push('mine');
        if (s.id in scouted) st.push(scouted[s.id] ? 'ok' : 'lost');
        const el = h('button', { class: `site ${st.join(' ')}`, type: 'button', title: R6.i18n.siteName(s.id, map.id) },
          idx >= 0 ? h('span', { class: 'ord' }, idx + 1) : null,
          s.id in scouted ? h('span', { class: 'ico' }, scouted[s.id] ? '◉' : '✕') : null,
          opts.found === s.id ? h('span', { class: 'ico f' }, '◆') : null,
          s.rooms.map((r) => h('div', { class: 'room' }, R6.i18n.roomName(r))));
        if (opts.onPick) el.addEventListener('click', () => opts.onPick(s.id));
        return el;
      })));
      root.appendChild(row);
    });
    root.appendChild(h('div', { class: 'ground' }, h('span', {}, T('ui.groundLine'))));
    return root;
  }

  // Tarjetas de spawn de atacantes
  function spawnCards(map, opts = {}) {
    return h('div', { class: 'spawns' }, map.spawns.map((sp) => h('button', { type: 'button', class: `spawn${opts.selected === sp.id ? ' sel' : ''}`, onclick: () => opts.onPick && opts.onPick(sp.id) },
      h('b', {}, R6.i18n.spawnName(sp.id, map.id)),
      h('span', { class: 'lane' }, T(`lane.${sp.lane}`)),
      !sp.documented ? h('span', { class: 'warn', title: T('ui.spawnUndocumented') }, '⚠') : null,
      sp.entries && sp.entries.length ? h('span', { class: 'ent' }, sp.entries.join(' · ')) : null)));
  }

  // chips con los modificadores de una decision
  function modChips(mods) {
    const out = [];
    UICFG.modOrder.forEach((k) => {
      if (mods[k] == null || mods[k] === 0) return;
      const v = mods[k]; const good = k === 'foeAim' ? v < 0 : (k === 'time' ? v < 0 : v > 0);
      const txt = k === 'time' ? `${v > 0 ? '+' : ''}${v}s` : k === 'encounter' ? `×${R6.i18n.fmtNum(v, 2)}` : `${v > 0 ? '+' : ''}${R6.i18n.fmtNum(v, 2)}`;
      out.push(h('span', { class: `mchip ${good ? 'pos' : 'neg'}` }, `${T(`mod.${k}`)} ${txt}`));
    });
    Object.entries(mods).forEach(([k, v]) => { if (k.startsWith('carry.')) out.push(h('span', { class: 'mchip carry' }, `${T(k.endsWith('Mul') && v > 1 ? `mod.${k}.up` : `mod.${k}`)}${typeof v === 'number' && !k.endsWith('Mul') ? ` +${R6.i18n.fmtNum(v, 2)}` : ''}`)); });
    return h('div', { class: 'mods' }, out);
  }

  // Chips de los efectos de una accion que no son modificadores numericos: informacion, derribo, riesgo, breach, reanimacion.
  // foes = rivales vivos conocidos (para estimar la exposicion de un interrogatorio)
  function fxChips(grp, optId, foes) {
    const out = []; const chip = (txt, cls = 'pos') => out.push(h('span', { class: `mchip ${cls}` }, txt));
    R6.Engine.actionDo(grp, optId).forEach((e) => {
      if (e.fx === 'reveal') chip(e.count === 'all' ? T('ui.fx.revealAll') : T('ui.fx.reveal', { n: e.count }));
      else if (e.fx === 'ambush') {
        chip(T('ui.fx.ambush', { v: fmt(e.aim) })); if (e.downs) chip(T('ui.fx.down'));
        if (e.then && e.then.fx === 'interrogate') chip(T('ui.fx.exposure', { p: Math.round(Math.min(e.then.exposed.max, e.then.exposed.base + e.then.exposed.perAtt * foes) * 100) }), 'neg');
      } else if (e.fx === 'breach') chip(T('ui.fx.breach', { v: fmt(e.power) }));
      else if (e.fx === 'buff') chip(T('ui.fx.buff', { stat: T(`stat.${e.stat}`), v: fmt(e.v) }));
      else if (e.fx === 'trapdown') chip(T('ui.fx.trapdown', { p: Math.round(e.p * 100) }));
      else if (e.fx === 'revive') chip(T('ui.fx.revive', { n: e.max }));
    });
    return out.length ? h('div', { class: 'mods' }, out) : null;
  }

  // selector segmentado (roles por operador)
  function segmented(options, value, onChange, labelKey) {
    const root = h('div', { class: 'seg' });
    options.forEach((o) => root.appendChild(h('button', { type: 'button', class: value === o ? 'on' : '', title: T(`${labelKey}.${o}.desc`), onclick: () => { onChange(o); } }, T(`${labelKey}.${o}`))));
    return root;
  }
  // stepper numerico
  function stepper(value, min, max, onChange) {
    return h('div', { class: 'stepper' }, h('button', { type: 'button', onclick: () => value > min && onChange(value - 1) }, '−'), h('b', {}, value), h('button', { type: 'button', onclick: () => value < max && onChange(value + 1) }, '+'));
  }

  // Insignia del agente (como en el juego); cls opcional para tamanos concretos
  const opIcon = (o, cls = '', sheet = false) => h('img', { class: `opi${cls ? ` ${cls}` : ''}${sheet ? ' clickable' : ''}`, src: o.icon, alt: R6.i18n.opName(o.id), width: 96, height: 96, decoding: 'async', onclick: sheet ? () => opSheet(o) : null });

  Object.assign(UI, { setCfg, tagsOf, roleTags, fxChips, opCard, opIcon, opSheet, actionPanel, splash, compChips, building, spawnCards, modChips, segmented, stepper });
})(typeof window !== 'undefined' ? window : globalThis);
