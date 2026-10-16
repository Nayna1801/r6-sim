// Multijugador P2P (PeerJS, sin cuentas). El anfitrion ejecuta la partida; el invitado es un cliente de UI.
// Protocolo (JSON): {t:'hello',settings} | {t:'ask',id,stage,payload} | {t:'reply',id,data} | {t:'notify',kind,payload} | {t:'ping'} | {t:'bye'}
(function (g) {
  'use strict';
  const R6 = (g.R6 = g.R6 || {});
  const PREFIX = 'r6dsim2-'; const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const genCode = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
  const timerKeyOf = (stage) => (stage === 'ban' ? 'ban' : stage === 'pick' ? 'pick' : 'prep');

  class Link {
    constructor(conn, { onClose, onSilence }) {
      this.conn = conn; this.last = Date.now(); this.handlers = {}; this.onClose = onClose; this.onSilence = onSilence;
      conn.on('data', (m) => { this.last = Date.now(); if (m && m.t === 'ping') return; if (m && this.handlers[m.t]) this.handlers[m.t](m); });
      conn.on('close', () => { this.stop(); if (this.onClose) this.onClose(); });
      conn.on('error', (e) => { console.error('conn', e); });
      this.iv = setInterval(() => { try { conn.send({ t: 'ping' }); } catch (e) { console.warn('ping', e); } this.onSilence(Date.now() - this.last); }, 3000);
    }
    on(t, fn) { this.handlers[t] = fn; }
    send(m) { this.conn.send(m); }
    stop() { clearInterval(this.iv); }
    close() { this.stop(); try { this.conn.close(); } catch (e) { console.warn('close', e); } }
  }

  // Controlador remoto (lado anfitrion): reenvia ask/notify al invitado
  class RemoteController {
    constructor(link, { timers, grace, rules, fallback }) { this.link = link; this.pending = {}; this.n = 0; this.timers = timers; this.grace = grace; this.rules = rules; this.fallback = fallback; link.on('reply', (m) => { const p = this.pending[m.id]; if (p) { delete this.pending[m.id]; clearTimeout(p.to); p.res(m.data); } }); }
    ask(stage, payload) {
      const id = ++this.n;
      return new Promise((res, rej) => {
        const p = { res, rej }; this.pending[id] = p;
        if (this.timers && stage !== 'next') {
          p.to = setTimeout(async () => { if (!this.pending[id]) return; delete this.pending[id]; console.warn('remote timeout', stage); res(await this.fallback.ask(stage, payload)); }, (this.rules.timers[timerKeyOf(stage)] + this.grace) * 1000);
        }
        try { this.link.send({ t: 'ask', id, stage, payload }); } catch (e) { delete this.pending[id]; rej(e); }
      });
    }
    notify(kind, payload) { try { this.link.send({ t: 'notify', kind, payload }); } catch (e) { console.warn('notify', e); } return Promise.resolve(); }
    abort(err) { Object.values(this.pending).forEach((p) => p.rej(err)); this.pending = {}; }
  }

  function needPeer() { if (typeof Peer === 'undefined') throw new Error('peerjs'); }

  // Anfitrion: devuelve {code, ready:Promise<{link, close}>}
  function host({ onStatus, onSilence }) {
    needPeer();
    let peer = null; let attempts = 0;
    const out = { code: null, close: () => { try { peer && peer.destroy(); } catch (e) { console.warn(e); } } };
    out.ready = new Promise((resolve, reject) => {
      const open = () => {
        const code = genCode(); out.code = code; peer = new Peer(PREFIX + code);
        peer.on('open', () => onStatus({ code }));
        peer.on('connection', (c) => {
          if (out.link) { c.close(); return; }
          c.on('open', () => { out.link = new Link(c, { onClose: () => onStatus({ closed: true }), onSilence }); resolve(out.link); });
        });
        peer.on('error', (e) => { if (e.type === 'unavailable-id' && attempts++ < 4) { open(); return; } reject(e); });
      };
      open();
    });
    return out;
  }

  // Invitado: conecta y devuelve la Link
  function join(code, { onSilence, onClose }) {
    needPeer();
    return new Promise((resolve, reject) => {
      const peer = new Peer();
      peer.on('error', (e) => reject(e));
      peer.on('open', () => {
        const c = peer.connect(PREFIX + code.toUpperCase(), { reliable: true, serialization: 'json' });
        const to = setTimeout(() => reject(new Error('timeout')), 15000);
        c.on('open', () => { clearTimeout(to); const link = new Link(c, { onClose, onSilence }); link.peer = peer; resolve(link); });
      });
    });
  }

  R6.Net = { host, join, RemoteController, Link };
})(typeof window !== 'undefined' ? window : globalThis);
