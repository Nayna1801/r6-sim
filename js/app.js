// Arranque: carga de datos/config, menu, y orquestacion de partidas (CPU, anfitrion, invitado).
(function (g) {
  'use strict';
  const R6 = (g.R6 = g.R6 || {}); const UI = R6.UI; const { h, $ } = UI;
  const T = (k, p) => R6.i18n.t(k, p);
  const J = async (u) => { const r = await fetch(u); if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); };

  const S = { settings: { draftMode: 'full', mapMode: 'ranked', mapId: null, timers: false }, match: null, link: null, hostSession: null, ui: null };
  try { Object.assign(S.settings, JSON.parse(localStorage.getItem('r6sim.settings') || '{}')); } catch (e) { console.warn('settings', e); }
  const saveSettings = () => { try { localStorage.setItem('r6sim.settings', JSON.stringify(S.settings)); } catch (e) { console.warn('settings', e); } };

  async function boot() {
    const [rules, balance, decisions, ai, ui, i18n, gadgets, actions, operators, maps] = await Promise.all(['rules', 'balance', 'decisions', 'ai', 'ui', 'i18n', 'gadgets', 'actions'].map((n) => J(`config/${n}.json`)).concat([J('data/operators.json'), J('data/maps.json')]));
    operators.forEach((o) => { o.img = `assets/ops/${o.id}.webp`; o.imgS = `assets/ops/s/${o.id}.webp`; o.icon = `assets/icons/${o.id}.svg`; });
    R6.Engine.configure({ rules, balance, decisions, operators, maps, gadgets, actions }); R6.GADGETS = gadgets; R6.ACTIONS = actions; R6.AI.configure(ai); R6.UI.setCfg(ui); R6.UICFG = ui; R6.RULES = rules; R6.OPERATORS = operators; R6.MAPS = maps.filter((m) => m.playable);
    await R6.i18n.init(i18n); R6.I18NCFG = i18n;
    UI.sparks(); UI.initFeedback(); buildHeader(); showMenu(); registerSw(); warmAssets();
  }

  // ---------- cache de imagenes: service worker + precarga en reposo ----------
  function registerSw() {
    if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('sw', e));
  }
  // Descarga los retratos (y luego las insignias) cuando el navegador esta ocioso; el SW los guarda para las pantallas de ban/pick.
  function warmAssets() {
    const net = navigator.connection; if (net && (net.saveData || /(^|-)2g$/.test(net.effectiveType || ''))) return;
    const small = g.matchMedia('(max-width:760px)').matches;
    const urls = R6.OPERATORS.map((o) => (small ? o.imgS : o.img)).concat(R6.OPERATORS.map((o) => o.icon));
    const idle = g.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
    const next = () => { const u = urls.shift(); if (!u) return; fetch(u).catch(() => {}).finally(() => idle(next)); };
    idle(() => { next(); next(); });
  }

  // ---------- cabecera ----------
  function buildHeader() {
    const lang = h('select', { id: 'langSel', 'aria-label': 'language', onchange: async (e) => { await R6.i18n.setLang(e.target.value); applyStatic(); if (!S.match) showMenu(); } }, R6.i18n.languages.map((l) => h('option', { value: l, selected: l === R6.i18n.lang }, l.toUpperCase())));
    $('hdrTools').replaceChildren(lang,
      h('button', { id: 'btnSound', class: 'ghost', title: T('ui.sound'), onclick: () => { UI.setSound(!UI.soundOn()); $('btnSound').textContent = UI.soundOn() ? '🔊' : '🔇'; UI.sfx.click(); } }, '🔊'),
      h('button', { id: 'btnMenu', class: 'ghost hidden', onclick: leaveMatch }, T('ui.menu')));
    applyStatic();
  }
  function applyStatic() { const m = $('btnMenu'); if (m) m.textContent = T('ui.menu'); document.title = T('app.title'); }

  function pool() { return R6.MAPS.filter((m) => (S.settings.mapMode === 'ranked' ? m.ranked : true)); }
  function chooseMap() {
    if (S.settings.mapMode === 'choose' && S.settings.mapId && R6.MAPS.some((m) => m.id === S.settings.mapId)) return S.settings.mapId;
    const p = pool(); return p[Math.floor(Math.random() * p.length)].id;
  }

  // ---------- menu ----------
  function showMenu() {
    $('screenGame').classList.add('hidden'); $('screenMenu').classList.remove('hidden'); $('btnMenu').classList.add('hidden'); $('hudBar').classList.add('hidden');
    const sel = (key, opts, labelPrefix) => h('select', { onchange: (e) => { S.settings[key] = e.target.value; saveSettings(); showMenu(); } }, opts.map((o) => h('option', { value: o, selected: String(S.settings[key]) === String(o) }, T(`${labelPrefix}.${o}`))));
    const status = h('div', { id: 'netStatus', class: 'netstatus hidden' });
    const codeIn = h('input', { id: 'codeIn', maxlength: 5, placeholder: T('menu.codePlaceholder'), autocomplete: 'off', onkeydown: (e) => { if (e.key === 'Enter') doJoin(codeIn, status); } });
    const mapSel = S.settings.mapMode === 'choose' ? h('select', { onchange: (e) => { S.settings.mapId = e.target.value; saveSettings(); } }, R6.MAPS.map((m) => h('option', { value: m.id, selected: m.id === S.settings.mapId }, R6.i18n.mapName(m.id)))) : null;
    if (S.settings.mapMode === 'choose' && !S.settings.mapId) S.settings.mapId = R6.MAPS[0].id;
    const menu = h('div', { class: 'menu' },
      h('h1', {}, 'R6 ', h('span', {}, T('app.subtitle'))), h('p', { class: 'hint' }, T('menu.tagline')),
      h('div', { class: 'settings' },
        h('label', {}, h('span', {}, T('menu.draftMode')), sel('draftMode', R6.RULES.draft.modes, 'draft')),
        h('label', {}, h('span', {}, T('menu.mapMode')), sel('mapMode', ['ranked', 'all', 'choose'], 'mapmode')), mapSel,
        h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: S.settings.timers, onchange: (e) => { S.settings.timers = e.target.checked; saveSettings(); } }), h('span', {}, T('menu.timers')))),
      h('div', { class: 'menugrid' },
        h('button', { class: 'mbtn primary', onclick: () => startCpu() }, h('b', {}, T('menu.cpu')), h('span', {}, T('menu.cpuDesc'))),
        h('button', { class: 'mbtn', onclick: () => doHost(status) }, h('b', {}, T('menu.host')), h('span', {}, T('menu.hostDesc'))),
        h('div', { class: 'mbtn join' }, h('b', {}, T('menu.join')), h('span', {}, T('menu.joinDesc')), h('div', { class: 'joinrow' }, codeIn, h('button', { onclick: () => doJoin(codeIn, status) }, T('menu.enter'))))),
      status, h('p', { class: 'foot' }, T('menu.dataNote')));
    $('screenMenu').replaceChildren(...[h('div', { class: 'hero-bg', 'aria-hidden': 'true' }), heroOp('att'), heroOp('def'), menu].filter(Boolean));
    // paralaje suave de los agentes con el puntero
    $('screenMenu').onpointermove = (e) => { const s = $('screenMenu'); s.style.setProperty('--px', (e.clientX / g.innerWidth - 0.5).toFixed(3)); s.style.setProperty('--py', (e.clientY / g.innerHeight - 0.5).toFixed(3)); };
  }

  // Agentes decorativos del menu (uno por bando, fijos durante la sesion). Solo en pantallas anchas: no se descargan en movil.
  function heroOp(side) {
    if (!g.matchMedia('(min-width:1200px)').matches) return null;
    S.hero = S.hero || {};
    if (!S.hero[side]) { const list = R6.OPERATORS.filter((o) => o.side === side); S.hero[side] = list[Math.floor(Math.random() * list.length)]; }
    const o = S.hero[side];
    return h('div', { class: `heroop ${side}`, 'aria-hidden': 'true' }, h('img', { src: o.img, alt: '', decoding: 'async' }), h('span', { class: 'heroname' }, R6.i18n.opName(o.id)));
  }
  const setStatus = (el, html, err) => { el.className = `netstatus${err ? ' err' : ''}`; el.replaceChildren(...[].concat(html)); };

  // ---------- partida ----------
  function enterGame() {
    $('screenMenu').classList.add('hidden'); $('screenGame').classList.remove('hidden'); $('btnMenu').classList.remove('hidden'); $('hudBar').classList.remove('hidden');
    $('stageHost').replaceChildren(h('div', { class: 'stage waiting' }, h('div', { class: 'spinner' })));
  }
  function leaveMatch() {
    if (S.match || S.link) { if (!g.confirm(T('ui.confirmLeave'))) return; }
    cleanup(); showMenu();
  }
  function cleanup() {
    try { if (S.link) { S.link.send({ t: 'bye' }); S.link.close(); } if (S.hostSession) S.hostSession.close(); } catch (e) { console.warn('cleanup', e); }
    S.link = null; S.hostSession = null; S.match = null; S.ui = null; $('netbar').classList.add('hidden');
  }
  const exitToMenu = (msg) => { cleanup(); showMenu(); if (msg) UI.toast(msg, 'err'); };
  function newUi() { const u = new UI.UiController(); u.onExit = () => exitToMenu(); S.ui = u; return u; }
  const silence = (ms) => { const nb = $('netbar'); if (ms > 12000) { nb.textContent = T('net.silence', { s: Math.round(ms / 1000) }); nb.classList.remove('hidden'); } else nb.classList.add('hidden'); };

  async function runMatch(controllers, settings) {
    const rng = R6.mkRng((Math.random() * 2 ** 32) >>> 0);
    const m = new R6.Match({ rules: R6.RULES, ops: R6.OPERATORS, mapId: settings.mapId, controllers, rng, draftMode: settings.draftMode, firstAttacker: Math.random() < 0.5 ? 'A' : 'B', timers: settings.timers });
    S.match = m; R6.i18n.setMap(settings.mapId);
    try { await m.run(); } catch (e) { console.error(e); if (S.match === m) exitToMenu(T('net.error', { e: e.message })); }
  }

  function startCpu() {
    enterGame(); const settings = { ...S.settings, mapId: chooseMap() };
    const rng = R6.mkRng((Math.random() * 2 ** 32) >>> 0);
    runMatch({ A: newUi(), B: new R6.CpuController(rng) }, settings);
  }

  async function doHost(status) {
    try {
      setStatus(status, T('net.creating'));
      const settings = { ...S.settings, mapId: chooseMap() };
      const hs = await R6.Net.host({ onStatus: (s) => { if (s.code) setStatus(status, [T('net.shareCode'), h('div', { class: 'code' }, s.code), h('span', { class: 'hint' }, T('net.waitGuest'))]); }, onSilence: silence });
      S.hostSession = hs;
      const link = await hs.ready; S.link = link;
      link.send({ t: 'hello', settings });
      link.onClose = () => exitToMenu(T('net.guestLeft'));
      enterGame();
      const remote = new R6.Net.RemoteController(link, { timers: settings.timers, grace: 8, rules: R6.RULES, fallback: new R6.CpuController(R6.mkRng(7)) });
      link.conn.on('close', () => remote.abort(new Error(T('net.guestLeft'))));
      await runMatch({ A: newUi(), B: remote }, settings);
    } catch (e) { console.error(e); setStatus(status, T('net.error', { e: e.type || e.message }), true); cleanup(); }
  }

  async function doJoin(codeIn, status) {
    const code = codeIn.value.trim().toUpperCase();
    if (code.length !== 5) { setStatus(status, T('net.badCode'), true); return; }
    try {
      setStatus(status, T('net.connecting'));
      const link = await R6.Net.join(code, { onSilence: silence, onClose: () => exitToMenu(T('net.hostLeft')) }); S.link = link;
      const ui = newUi();
      link.on('hello', (m) => { R6.i18n.setMap(m.settings.mapId); enterGame(); });
      let chain = Promise.resolve(); // las notificaciones (reproduccion) y peticiones se procesan en orden
      link.on('ask', (m) => { chain = chain.then(async () => { const data = await ui.ask(m.stage, m.payload); link.send({ t: 'reply', id: m.id, data }); }); });
      link.on('notify', (m) => { chain = chain.then(() => ui.notify(m.kind, m.payload)); });
      link.on('bye', () => exitToMenu(T('net.hostLeft')));
      setStatus(status, T('net.waitHost'));
    } catch (e) { console.error(e); setStatus(status, e.type === 'peer-unavailable' ? T('net.noRoom') : T('net.error', { e: e.type || e.message }), true); cleanup(); }
  }

  boot().catch((e) => { console.error(e); document.body.prepend(h('pre', { class: 'bootfail' }, `Error: ${e.message}`)); });
})(typeof window !== 'undefined' ? window : globalThis);
