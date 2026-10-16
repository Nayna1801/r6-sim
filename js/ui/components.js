// Componentes reutilizables: tarjetas de operador, diagrama del edificio, spawns, chips de composicion.
(function (g) {
  'use strict';
  const R6 = (g.R6 = g.R6 || {}); const UI = R6.UI; const { h } = UI;
  const T = (k, p) => R6.i18n.t(k, p);
  let UICFG = null;
  const setCfg = (c) => { UICFG = c; };

  const opTitle = (o) => `${R6.i18n.opName(o.id)} — ${(UICFG.stats[o.side] || []).filter((k) => o[k]).map((k) => `${T(`stat.${k}`)} ${o[k]}`).join(' · ')}`;
  const tagsOf = (o) => UICFG.tags.filter((tg) => (o[tg.stat] || 0) >= tg.min).slice(0, UICFG.maxTags);

  // Tarjeta de operador. opts: {selected, dim, onClick, badge, hidden}
  function opCard(o, opts = {}) {
    const el = h('div', { class: `card${opts.selected ? ' sel' : ''}${opts.dim ? ' dim' : ''}${opts.enter ? ' enter' : ''}`, style: { '--i': opts.i || 0 }, title: opTitle(o) },
      h('div', { class: 'tags' }, tagsOf(o).map((tg) => h('span', { class: `tag ${tg.cls || ''}` }, T(`tag.${tg.id}`)))),
      opts.badge ? h('span', { class: 'cbadge' }, opts.badge) : null,
      h('img', { src: o.img || `assets/ops/${o.id}.webp`, alt: '', loading: 'lazy', decoding: 'async', width: 150, height: 214 }),
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
    Object.entries(mods).forEach(([k, v]) => { if (k.startsWith('carry.')) out.push(h('span', { class: 'mchip carry' }, `${T(`mod.${k}`)}${typeof v === 'number' && !k.endsWith('Mul') ? ` +${R6.i18n.fmtNum(v, 2)}` : ''}`)); });
    return h('div', { class: 'mods' }, out);
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

  Object.assign(UI, { setCfg, tagsOf, opCard, compChips, building, spawnCards, modChips, segmented, stepper });
})(typeof window !== 'undefined' ? window : globalThis);
