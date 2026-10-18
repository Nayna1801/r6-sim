// Controlador de partida (formato Ranked): bans, draft, preparacion, fases de accion, cambio de bando y prorroga.
// Es neutral respecto a quien juega: cada equipo ('A' / 'B') tiene un "controlador" con
//   ask(stage, payload) -> Promise<decision>     (peticion que requiere respuesta)
//   notify(kind, payload) -> Promise|void         (informacion para mostrar)
// Controladores: humano local (UI), CPU (IA), remoto (red). El anfitrion ejecuta el motor.
(function (g) {
  'use strict';
  const R6 = (g.R6 = g.R6 || {});
  const other = (t) => (t === 'A' ? 'B' : 'A');
  const otherSide = (s) => (s === 'att' ? 'def' : 'att');

  class Match {
    constructor({ rules, ops, mapId, controllers, rng, draftMode, firstAttacker, timers }) {
      this.rules = rules; this.ops = ops; this.mapId = mapId; this.c = controllers; this.rng = rng;
      this.draftMode = draftMode || 'full'; this.firstAttacker = firstAttacker || 'A'; this.timers = !!timers;
      this.round = 0; this.score = { A: 0, B: 0 }; this.log = [];
      this.active = { A: [], B: [] };            // bans en vigor que cada equipo impone al rival
      this.made = { A: { att: [], def: [] }, B: { att: [], def: [] } }; // bans impuestos por equipo segun su bando (para la prorroga)
      this.seen = { A: 0, B: 0 };
    }

    // ---------- formato ----------
    get F() { return this.rules.format; }
    swapsBefore(r) { const F = this.F; return (r > F.roundsPerHalf ? 1 : 0) + Math.max(0, r - (2 * F.roundsPerHalf + 1)); }
    sideOf(team, r) {
      const base = team === this.firstAttacker ? 'att' : 'def';
      return this.swapsBefore(r) % 2 === 0 ? base : otherSide(base);
    }
    isOvertime(r) { return r > 2 * this.F.roundsPerHalf; }
    winner() {
      const F = this.F; const played = this.round; const target = played > 2 * F.roundsPerHalf ? F.overtimeTarget : F.roundsToWin;
      for (const t of ['A', 'B']) if (this.score[t] >= target) return t;
      return null;
    }
    ctxFor(team) {
      const r = this.round;
      return {
        team, round: r, half: this.isOvertime(r) ? 'ot' : (r > this.F.roundsPerHalf ? 2 : 1), overtime: this.isOvertime(r),
        side: this.sideOf(team, r), rivalSide: this.sideOf(other(team), r), score: { you: this.score[team], rival: this.score[other(team)] },
        mapId: this.mapId, timers: this.timers, format: this.F, draftMode: this.draftMode,
      };
    }
    ask(team, stage, payload) { return this.c[team].ask(stage, { ...payload, ctx: this.ctxFor(team) }); }
    async notifyBoth(kind, payloadFor) { await Promise.all(['A', 'B'].map((t) => this.c[t].notify(kind, { ...payloadFor(t), ctx: this.ctxFor(t) }))); }

    async run() {
      await this.notifyBoth('matchStart', () => ({}));
      while (!this.winner()) { this.round++; await this.playRound(); }
      const w = this.winner();
      await this.notifyBoth('matchEnd', (t) => ({ winner: w === t ? 'you' : 'rival', score: this.score }));
      return { winner: w, score: { ...this.score } };
    }

    // ---------- bans ----------
    async banPhase(r) {
      const maxBans = this.F.maxBansPerSide;
      if (r === this.F.roundsPerHalf + 1) this.active = { A: [], B: [] }; // al cambiar de bando se limpian los bans
      if (this.isOvertime(r)) {
        ['A', 'B'].forEach((t) => { this.active[t] = [...this.made[t][this.sideOf(t, r)]]; });
        return;
      }
      const res = await Promise.all(['A', 'B'].map((t) => {
        const oppSide = this.sideOf(other(t), r);
        const targets = this.ops.filter((o) => o.side === oppSide && !this.active[t].includes(o.id)).map((o) => o.id);
        if (this.active[t].length >= maxBans) return Promise.resolve({ ban: null });
        return this.ask(t, 'ban', { targets, active: [...this.active[t]], against: [...this.active[other(t)]], oppSide });
      }));
      ['A', 'B'].forEach((t, i) => {
        const ban = res[i] && res[i].ban; const oppSide = this.sideOf(other(t), r);
        if (ban && this.ops.some((o) => o.id === ban && o.side === oppSide) && !this.active[t].includes(ban) && this.active[t].length < maxBans) {
          this.active[t].push(ban); this.made[t][this.sideOf(t, r)].push(ban);
        }
      });
    }

    // ---------- ronda ----------
    async playRound() {
      const r = this.round; const E = R6.Engine; const AI = R6.AI;
      await this.notifyBoth('roundStart', () => ({}));
      await this.banPhase(r);
      await this.notifyBoth('bans', (t) => ({ against: [...this.active[other(t)]], mine: [...this.active[t]] }));

      // draft: cada equipo elige 5 operadores de su bando (sin los vetados)
      const picks = await Promise.all(['A', 'B'].map((t) => {
        const side = this.sideOf(t, r);
        let avail = this.ops.filter((o) => o.side === side && !this.active[other(t)].includes(o.id));
        let pool = null;
        if (this.draftMode === 'pool') { pool = R6.sample(avail, this.rules.draft.poolSize, this.rng); avail = pool; }
        return this.ask(t, 'pick', { available: avail.map((o) => o.id), size: this.F.squad, pool: !!pool, against: [...this.active[other(t)]], mine: [...this.active[t]] }).then((res) => {
          const ids = res && Array.isArray(res.ids) ? [...new Set(res.ids)].filter((id) => avail.some((o) => o.id === id)) : [];
          return ids.length === this.F.squad ? ids : AI.pickTeam(side, avail, this.rng).map((o) => o.id);
        });
      }));
      const byTeam = { A: picks[0], B: picks[1] };
      const attTeam = this.sideOf('A', r) === 'att' ? 'A' : 'B', defTeam = other(attTeam);
      const st = E.newRound({ mapId: this.mapId, attIds: byTeam[attTeam], defIds: byTeam[defTeam], round: r });
      this.seen = { A: 0, B: 0 };
      await this.notifyBoth('squads', (t) => ({ own: byTeam[t], rival: byTeam[other(t)] }));

      // preparacion: planes simultaneos y ocultos
      const [defPlan, attPlan] = await Promise.all([
        this.ask(defTeam, 'planDef', { view: E.viewFor(st, 'def') }),
        this.ask(attTeam, 'planAtt', { view: E.viewFor(st, 'att') }),
      ]);
      E.resolvePrep(st, defPlan || {}, attPlan || {}, this.rng);
      await this.push(st, attTeam, defTeam, 'prep');
      const adj = await this.ask(attTeam, 'adjust', { view: E.viewFor(st, 'att') });
      E.setAdjust(st, adj || {});
      await this.push(st, attTeam, defTeam, 'adjusted');

      // fases de accion
      let guard = 0;
      while (st.phase !== 'done' && guard++ < 40) {
        const ph = st.phase;
        const [da, dd] = await Promise.all([
          this.ask(attTeam, 'phase', { phase: ph, side: 'att', options: E.options(st, 'att', ph), view: E.viewFor(st, 'att') }),
          this.ask(defTeam, 'phase', { phase: ph, side: 'def', options: E.options(st, 'def', ph), view: E.viewFor(st, 'def') }),
        ]);
        E.resolve(st, ph, { att: da && da.choice, def: dd && dd.choice }, this.rng);
        await this.push(st, attTeam, defTeam, ph);
      }
      if (!st.result) E.checkEnd(st);
      const winnerTeam = st.result.winner === 'att' ? attTeam : defTeam;
      this.score[winnerTeam]++;
      const reasons = E.explain(st);
      await this.notifyBoth('roundEnd', (t) => ({ result: st.result, youWon: winnerTeam === t, reasons, view: E.viewFor(st, this.sideOf(t, r)), events: st.events, score: this.ctxFor(t).score, matchWinner: this.winner() === t ? 'you' : this.winner() ? 'rival' : null }));
      await Promise.all(['A', 'B'].map((t) => this.ask(t, 'next', { matchOver: !!this.winner() })));
    }

    async push(st, attTeam, defTeam, phase) {
      const E = R6.Engine;
      await Promise.all([[attTeam, 'att'], [defTeam, 'def']].map(([t, side]) => {
        // seen cuenta sobre st.events (sin filtrar): viewFor filtra por visibilidad y al acabar la ronda lo muestra todo, lo que desfasaba el indice y repetia eventos
        const view = E.viewFor(st, side); const over = !!st.result;
        const fresh = st.events.slice(this.seen[t]).filter((e) => over || e.vis === 'both' || e.vis === side); this.seen[t] = st.events.length;
        return this.c[t].notify('update', { phase, view, events: fresh, ctx: this.ctxFor(t) });
      }));
    }
  }

  R6.Match = Match;
  R6.sample = R6.sample || function (arr, n, rng) { const c = [...arr]; const o = []; while (o.length < n && c.length) o.push(c.splice(Math.floor(rng() * c.length), 1)[0]); return o; };
  R6.mkRng = R6.mkRng || function (seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
})(typeof window !== 'undefined' ? window : globalThis);
