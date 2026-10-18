// Controlador del jugador humano local: pantallas de decision, reproduccion de eventos, rosters, resultado de ronda.
(function (g) {
  'use strict';
  const R6 = (g.R6 = g.R6 || {}); const UI = R6.UI; const { h, $ } = UI;
  const T = (k, p) => R6.i18n.t(k, p);

  const show = (node) => { const host = $('stageHost'); UI.clear(host); host.appendChild(node); host.scrollTop = 0; };
  UI.show = show;

  class UiController {
    constructor() { this.revealed = new Set(); this.ctx = null; this.own = []; this.rival = []; this.view = null; this.endData = null; this.nextResolve = null; this.skip = false; this.onExit = () => {}; }

    // ---- ask: pantallas de decision ----
    async ask(stage, p) {
      this.ctx = p.ctx; this.hud(p.ctx); document.body.dataset.stage = stage;
      let res;
      switch (stage) {
        case 'ban': res = await UI.screens.ban(p); break;
        case 'pick': res = await UI.screens.pick(p); break;
        case 'planDef': res = await UI.screens.planDef(p); break;
        case 'planAtt': res = await UI.screens.planAtt(p); break;
        case 'adjust': res = await UI.screens.adjust(p); break;
        case 'phase': res = await UI.screens.phase(p); break;
        case 'next': return new Promise((resolve) => { this.nextResolve = resolve; if (this.endData && this.endData.pending) { this.endData.pending(); } });
        default: res = {};
      }
      this.waiting();
      return res;
    }
    waiting() { delete document.body.dataset.stage; show(h('div', { class: 'stage waiting' }, h('div', { class: 'spinner' }), h('p', {}, T('ui.waitingRival')))); }

    // ---- notify: informacion ----
    async notify(kind, p) {
      this.ctx = p.ctx; this.hud(p.ctx);
      switch (kind) {
        case 'matchStart': R6.i18n.setMap(p.ctx.mapId); $('rosterOwn').replaceChildren(); $('rosterRival').replaceChildren(); return undefined;
        case 'roundStart': return this.roundStart(p);
        case 'bans': if (p.against.length) UI.toast(T('ui.bansAgainst', { ops: p.against }), 'info'); return undefined;
        case 'squads': this.own = p.own; this.rival = p.rival; this.revealed = new Set(); this.view = null; this.drawRosters(); return undefined;
        case 'update': return this.update(p);
        case 'roundEnd': return this.roundEnd(p);
        case 'matchEnd': return this.matchEnd(p);
        default: return undefined;
      }
    }

    hud(ctx) {
      const side = ctx.side === 'att' ? 'att' : 'def';
      $('hudScore').replaceChildren(h('span', { class: 'rd' }, ctx.overtime ? T('hud.overtime', { n: ctx.round }) : T('hud.round', { n: ctx.round, half: ctx.half })), h('span', { class: 's you' }, `${T('hud.you')} ${ctx.score.you}`), h('span', { class: 's rival' }, `${T('hud.rival')} ${ctx.score.rival}`));
      $('screenGame').dataset.side = side; $('hudSide').className = `hudside ${side}`; $('hudSide').textContent = T(`side.${side}`);
      $('hudMap').textContent = `${R6.i18n.mapName(ctx.mapId)} ⓘ`; $('hudMap').onclick = () => UI.mapInfo(ctx.mapId);
    }

    async roundStart(p) {
      UI.sfx.intro(); $('log').replaceChildren(); this.endData = null; this.revealed = new Set();
      await UI.splash({ mapId: p.ctx.mapId, side: p.ctx.side, round: p.ctx.round });
    }

    // ---- rosters ----
    drawRosters() {
      const ctx = this.ctx; const v = this.view; const mine = ctx.side;
      const arr = (side, ids) => (v ? (side === 'att' ? v.att : v.def) : ids.map((id) => ({ id, alive: true, kills: 0 })));
      const card = (m, own) => {
        const o = R6.opsById[m.id]; const known = own || this.revealed.has(m.id) || (this.endData && this.endData.over);
        return h('div', { class: `mini${m.alive ? '' : ' dead'}${known ? ' clickable' : ''}`, id: `m-${m.id}`, onclick: known ? () => UI.opSheet(o) : null }, known ? UI.opIcon(o) : h('div', { class: 'unk' }, '?'),
          m.kills ? h('span', { class: 'k' }, T('ui.killsShort', { n: m.kills })) : null, !own && m.alive && v && v.known && v.known[mine] && v.known[mine][m.id] > v.phaseNo ? h('span', { class: 'loc', title: T('ui.located') }, '◎') : null,
          h('div', { class: 'nm' }, known ? R6.i18n.opName(m.id) : '—'),
          own && m.role ? h('span', { class: 'rl' }, T(`role.${m.role}`)) : null);
      };
      $('rosterOwn').replaceChildren(h('h4', {}, T('ui.yourSquad')), h('div', { class: 'mrow' }, arr(mine, this.own).map((m) => card(m, true))));
      $('rosterRival').replaceChildren(h('h4', {}, T('ui.rivalSquad')), h('div', { class: 'mrow' }, arr(mine === 'att' ? 'def' : 'att', this.rival).map((m) => card(m, false))));
    }

    // ---- reproduccion de eventos ----
    logEvent(e) {
      const kind = e.k.split('.')[1]; const el = h('div', { class: `ev ${kind}` }, h('span', { class: 't' }, R6.i18n.fmtTime(e.t)), h('span', { class: 'ty' }, T(`evtype.${kind}`)), h('span', {}, R6.i18n.fmtEvent(e)));
      $('log').appendChild(el); $('log').scrollTop = 1e6; return el;
    }
    fx(e, el, mapEls) {
      const p = e.p || {}; ['killer', 'victim', 'who'].forEach((k) => { if (p[k]) this.revealed.add(p[k]); }); (p.ops || []).forEach((id) => this.revealed.add(id));
      if (e.k.startsWith('ev.kill')) { UI.shake($('screenGame')); UI.sfx.kill(); UI.tag(e.k === 'ev.kill.trade' ? T('ui.trade') : T('ui.eliminated'), 'killtag'); el.classList.add('flashred'); const v = $(`m-${p.victim}`); if (v) v.classList.add('hit', 'dead'); const k = $(`m-${p.killer}`); if (k) { k.classList.add('flash'); setTimeout(() => k.classList.remove('flash'), 500); } }
      else if (e.k === 'ev.act.down') { UI.sfx.kill(); UI.tag(T('ui.downed'), 'killtag'); const v = $(`m-${p.victim}`); if (v) v.classList.add('hit', 'dead'); }
      else if (e.k === 'ev.act.revive') { UI.sfx.defuse(); UI.tag(T('ui.revived'), 'killtag ok'); const v = $(`m-${p.victim}`); if (v) v.classList.remove('dead', 'hit'); }
      else if (e.k === 'ev.act.interrogate.ok') { UI.banner(T('ui.revealedBanner'), R6.i18n.opName(p.who), 'intro'); UI.sfx.alert(); }
      else if (e.k === 'ev.plant.ok') { UI.banner(T('ui.planted'), '', 'plant'); UI.sfx.plant(); $('screenGame').classList.add('planted'); }
      else if (e.k === 'ev.post.defuse') { UI.banner(T('ui.defused'), '', 'defuse'); UI.sfx.defuse(); }
      else if (e.k.startsWith('ev.entry.breach')) UI.sfx.breach();
      else if (e.k === 'ev.prep.droneSpotted') UI.sfx.alert();
      else if (e.k.startsWith('ev.prep.scout')) { UI.sfx.drone(); if (mapEls) mapEls(e); }
    }

    async update(p) {
      this.view = p.view; this.skip = false;
      const map = R6.mapsById[p.ctx.mapId]; const isPrep = p.phase === 'prep';
      const scouted = []; const feed = h('div', {});
      const bld = () => UI.building(map, { mode: 'view', scouted, found: null });
      const bhost = h('div', {}, bld());
      const skipBtn = h('button', { class: 'ghost', onclick: () => { this.skip = true; } }, T('ui.skip'));
      show(h('div', { class: 'stage' }, h('div', { class: 'shead' }, h('div', {}, h('h2', {}, T(isPrep ? 'stage.prep.title' : `phase.${p.phase}.resolving`)), h('p', { class: 'sub' }, T(isPrep ? 'stage.prep.sub' : 'ui.resolving'))), skipBtn), isPrep ? bhost : h('div', { class: 'spinner' }), feed));
      $('screenGame').classList.remove('shake');
      const delay = R6.UICFG.replay;
      for (const e of p.events) {
        const el = this.logEvent(e);
        this.fx(e, el, (ev) => { scouted.push({ site: ev.p.site, ok: ev.k === 'ev.prep.scoutOk' }); UI.clear(bhost); bhost.appendChild(bld()); });
        if (isPrep) feed.appendChild(h('div', { class: 'ev' }, R6.i18n.fmtEvent(e)));
        await UI.wait(this.skip ? delay.fastMs : delay.eventMs);
      }
      this.drawRosters();
      if (isPrep && p.view.intel && p.view.intel.found) { UI.clear(bhost); bhost.appendChild(UI.building(map, { mode: 'view', scouted: p.view.intel.scouted, found: p.view.intel.site })); await UI.wait(this.skip ? 0 : 700); }
      return undefined;
    }

    // ---- resultado de ronda ----
    async roundEnd(p) {
      this.view = p.view; this.endData = { over: true, p };
      this.drawRosters();
      const youWon = p.youWon; const res = p.result; const map = R6.mapsById[p.ctx.mapId];
      $('screenGame').classList.remove('planted');
      UI.banner(youWon ? T('ui.victory') : T('ui.defeat'), T(`reason.${res.reason}`), youWon ? 'win' : 'lose'); if (youWon) { UI.confetti(); UI.sfx.win(); } else UI.sfx.lose();
      const full = h('div', { class: 'log full' }, p.events.map((e) => h('div', { class: `ev ${e.k.split('.')[1]}` }, h('span', { class: 't' }, R6.i18n.fmtTime(e.t)), h('span', { class: 'ty' }, T(`evtype.${e.k.split('.')[1]}`)), h('span', {}, R6.i18n.fmtEvent(e)))));
      const nextBtn = h('button', { class: 'go', onclick: () => { if (this.nextResolve) { this.nextResolve({}); this.nextResolve = null; this.waiting(); } } }, p.matchWinner ? T('ui.finish') : T('ui.nextRound'));
      const node = h('div', { class: `stage result ${res.winner}` }, h('div', { class: `you ${youWon ? 'w' : 'l'}` }, youWon ? T('ui.victory') : T('ui.defeat')),
        h('div', { class: 'big' }, T(`result.${res.winner}`)), h('p', { class: 'sub' }, T(`reason.${res.reason}`)),
        h('div', { class: 'cols2' }, h('div', {}, h('h3', {}, T('ui.whyTitle')), h('ul', { class: 'why' }, p.reasons.map((r) => h('li', { class: r.good ? 'g' : 'b' }, T(r.k, r.p)))), h('p', { class: 'hint' }, T('ui.whyLegend'))),
          h('div', {}, h('h3', {}, T('ui.siteReveal')), UI.building(map, { mode: 'view', found: p.view.plan && p.view.plan.def ? p.view.plan.def.site : null, scouted: p.view.intel ? p.view.intel.scouted : [] }))),
        h('details', {}, h('summary', {}, T('ui.fullLog')), full), h('div', { class: 'actions' }, nextBtn));
      show(node); this.endData.pending = null;
      return undefined;
    }

    async matchEnd(p) {
      const won = p.winner === 'you'; UI.banner(won ? T('ui.matchWon') : T('ui.matchLost'), `${p.score.A}-${p.score.B}`, won ? 'win' : 'lose', 4200); if (won) UI.confetti();
      show(h('div', { class: `stage matchend ${won ? 'w' : 'l'}` }, h('h1', {}, won ? T('ui.matchWon') : T('ui.matchLost')), h('p', { class: 'big' }, `${p.ctx.score.you} – ${p.ctx.score.rival}`), h('button', { class: 'go', onclick: () => this.onExit() }, T('ui.backToMenu'))));
      return undefined;
    }
  }
  // ficha del mapa: sitios, spawns, confianza y fuentes de los datos
  UI.mapInfo = function mapInfo(mapId) {
    const m = R6.mapsById[mapId]; if (!m) return;
    const close = () => ov.remove();
    const ov = h('div', { class: 'modal', onclick: (e) => { if (e.target === ov) close(); } }, h('div', { class: 'mbox' },
      h('div', { class: 'shead' }, h('h2', {}, R6.i18n.mapName(m.id)), h('button', { class: 'ghost', onclick: close }, T('ui.close'))),
      h('p', { class: 'sub' }, `${T(m.ranked ? 'mapinfo.ranked' : 'mapinfo.notRanked')} · ${T('mapinfo.confidence')}: ${m.confidence ? T(`conf.${m.confidence}`) : T('conf.unknown')}`),
      h('h3', {}, T('mapinfo.sites')), UI.building(m, { mode: 'view' }),
      h('h3', {}, T('mapinfo.spawns')), UI.spawnCards(m, {}), h('p', { class: 'hint' }, T('mapinfo.laneNote')),
      m.features && m.features.length ? [h('h3', {}, T('mapinfo.features')), h('p', { class: 'hint' }, T('mapinfo.rawNote')), h('ul', { class: 'facts' }, m.features.map((f) => h('li', {}, f)))] : null,
      m.notes ? [h('h3', {}, T('mapinfo.notes')), h('p', { class: 'hint' }, m.notes)] : null,
      m.sources && m.sources.length ? [h('h3', {}, T('mapinfo.sources')), h('ul', { class: 'facts' }, m.sources.map((u) => h('li', {}, h('a', { href: u, target: '_blank', rel: 'noopener noreferrer' }, u))))] : null));
    document.body.appendChild(ov);
  };
  UI.UiController = UiController;
})(typeof window !== 'undefined' ? window : globalThis);
