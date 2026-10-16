// Controladores de equipo para Match: CPU (IA). El humano y el remoto se definen en ui.js / net.js.
(function (g) {
  'use strict';
  const R6 = (g.R6 = g.R6 || {});
  class CpuController {
    constructor(rng) { this.rng = rng; }
    async ask(stage, p) {
      const AI = R6.AI; const opsById = R6.opsById; const rng = this.rng;
      switch (stage) {
        case 'ban': return { ban: AI.pickBan(p.oppSide, p.targets.map((id) => opsById[id]), rng) };
        case 'pick': return { ids: AI.pickTeam(p.ctx.side, p.available.map((id) => opsById[id]), rng).map((o) => o.id) };
        case 'planDef': return AI.planDef(p.view, rng);
        case 'planAtt': return AI.planAtt(p.view, rng);
        case 'adjust': return AI.adjustAtt(p.view);
        case 'phase': return { choice: AI.decideFromView(p.view, p.side, p.phase, rng) };
        default: return {};
      }
    }
    notify() { return Promise.resolve(); }
  }
  R6.CpuController = CpuController;
})(typeof window !== 'undefined' ? window : globalThis);
