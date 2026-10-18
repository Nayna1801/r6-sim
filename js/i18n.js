// Internacionalizacion: carga locales/<lang>.json, interpola {param} y resuelve entidades (operadores, sitios, spawns).
(function (g) {
  'use strict';
  const R6 = (g.R6 = g.R6 || {});
  const S = { cfg: null, lang: 'es', dict: {}, fb: {}, ctx: { map: null } };

  async function fetchJson(url) { const r = await fetch(url); if (!r.ok) throw new Error(`${url}: ${r.status}`); return r.json(); }

  async function init(cfg) {
    S.cfg = cfg; let saved = null;
    try { saved = localStorage.getItem('r6sim.lang'); } catch (e) { console.warn('localStorage no disponible', e); }
    const nav = (g.navigator && g.navigator.language || '').slice(0, 2);
    const pick = [saved, nav, cfg.default].find((l) => l && cfg.languages.includes(l));
    S.fb = await fetchJson(`locales/${cfg.fallback}.json`);
    await setLang(pick);
  }
  async function setLang(lang) {
    S.lang = lang; S.dict = lang === S.cfg.fallback ? S.fb : await fetchJson(`locales/${lang}.json`);
    try { localStorage.setItem('r6sim.lang', lang); } catch (e) { console.warn('localStorage no disponible', e); }
    if (g.document) g.document.documentElement.lang = lang;
  }
  const lookup = (key) => (key in S.dict ? S.dict[key] : (key in S.fb ? S.fb[key] : null));
  const has = (key) => lookup(key) !== null;

  function resolveParam(name, v) {
    const type = S.cfg.paramTypes[name];
    if (!type || type === 'raw' || v == null) return v;
    if (type === 'op') return opName(v);
    if (type === 'opList') return v.map(opName).join(', ');
    if (type === 'action') return t(`action.${v}`);
    if (type === 'site') return siteName(v);
    if (type === 'spawn') return spawnName(v);
    if (type.startsWith('enum:')) return t(`enum.${type.slice(5)}.${v}`);
    return v;
  }
  function t(key, params) {
    let s = lookup(key);
    if (s === null) { console.warn('i18n: falta la clave', key); return key; }
    if (params) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(resolveParam(k, params[k])) : m));
    return s;
  }
  // nombres de entidades: el locale puede sobreescribir (names.op.<id>, names.room.<room>); si no, el dato original
  function opName(id) { const k = `names.op.${id}`; if (has(k)) return t(k); const o = R6.opsById && R6.opsById[id]; return o ? o.name : id; }
  function roomName(room) { const k = `names.room.${room}`; return has(k) ? t(k) : room; }
  function mapName(id) { const k = `names.map.${id}`; if (has(k)) return t(k); const m = R6.mapsById && R6.mapsById[id]; return m ? m.name : id; }
  function siteName(id, mapId) {
    const m = R6.mapsById[mapId || S.ctx.map]; const s = m && m.sites.find((x) => x.id === id); if (!s) return id;
    return `${s.rooms.map(roomName).join(' / ')} (${s.floor})`;
  }
  function spawnName(id, mapId) {
    const m = R6.mapsById[mapId || S.ctx.map]; const sp = m && m.spawns.find((x) => x.id === id); if (!sp) return id;
    if (sp.name) { const k = `names.spawn.${sp.name}`; return has(k) ? t(k) : sp.name; }
    return t('spawn.generic', { n: id.replace('sp', '') });
  }
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const fmtNum = (n, d = 1) => new Intl.NumberFormat(S.lang, { maximumFractionDigits: d }).format(n);
  const setMap = (id) => { S.ctx.map = id; };
  const fmtEvent = (e) => t(e.k, e.p);

  R6.i18n = { init, setLang, t, has, opName, roomName, mapName, siteName, spawnName, fmtTime, fmtNum, fmtEvent, setMap, get lang() { return S.lang; }, get languages() { return S.cfg.languages; } };
  R6.t = t;
})(typeof window !== 'undefined' ? window : globalThis);
