// Utilidades de UI: creacion de DOM, sonido sintetizado, banners, confeti, avisos y cuenta atras.
(function (g) {
  'use strict';
  const R6 = (g.R6 = g.R6 || {});
  const UI = (R6.UI = R6.UI || {});

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (v === false || v == null) return;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.entries(v).forEach(([p, val]) => { if (p.startsWith('--')) el.style.setProperty(p, val); else el.style[p] = val; });
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    const add = (c) => { if (Array.isArray(c)) c.forEach(add); else if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c))); };
    kids.forEach(add);
    return el;
  }
  const $ = (id) => document.getElementById(id);
  const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  // ---------- sonido (sintetizado, sin ficheros) ----------
  let sound = true, ac = null;
  function beep(f, d, type = 'square', v = 0.05, slide = 0, delay = 0) {
    if (!sound) return;
    try {
      ac = ac || new (g.AudioContext || g.webkitAudioContext)();
      const t0 = ac.currentTime + delay, o = ac.createOscillator(), gn = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t0 + d);
      gn.gain.setValueAtTime(v, t0); gn.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(gn); gn.connect(ac.destination); o.start(t0); o.stop(t0 + d);
    } catch (e) { console.warn('audio', e); }
  }
  const sfx = {
    click: () => beep(620, 0.06, 'square', 0.03),
    pick: () => { beep(520, 0.07, 'square', 0.04); beep(780, 0.08, 'square', 0.04, 0, 0.06); },
    kill: () => { beep(220, 0.22, 'sawtooth', 0.07, -170); beep(90, 0.25, 'sine', 0.1); },
    plant: () => [0, 0.18, 0.36].forEach((d) => beep(900, 0.1, 'square', 0.05, 0, d)),
    defuse: () => { beep(500, 0.12, 'triangle', 0.07); beep(750, 0.2, 'triangle', 0.07, 0, 0.12); },
    win: () => [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.22, 'triangle', 0.07, 0, i * 0.12)),
    lose: () => [330, 262, 196].forEach((f, i) => beep(f, 0.3, 'sawtooth', 0.06, 0, i * 0.18)),
    intro: () => { beep(300, 0.15, 'square', 0.05); beep(450, 0.25, 'square', 0.05, 0, 0.18); },
    breach: () => beep(140, 0.2, 'sawtooth', 0.08, -60),
    drone: () => beep(900, 0.05, 'sine', 0.03, 300),
    alert: () => { beep(700, 0.08, 'square', 0.05); beep(520, 0.1, 'square', 0.05, 0, 0.1); },
  };
  const setSound = (on) => { sound = on; };
  const soundOn = () => sound;

  // ---------- efectos ----------
  function banner(title, sub, kind, ms) {
    const b = h('div', { class: `banner ${kind || ''}` }, h('div', { class: 'bt' }, title), sub ? h('div', { class: 'bs' }, sub) : null);
    $('fx').appendChild(b); setTimeout(() => b.remove(), ms || (kind === 'win' || kind === 'lose' ? 3200 : 1700));
  }
  function tag(text, cls, ms) { const k = h('div', { class: cls }, text); $('fx').appendChild(k); setTimeout(() => k.remove(), ms || 900); }
  function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
  function confetti() {
    const cols = ['#ff8a3d', '#3da5ff', '#5ee08a', '#fff', '#ffd24a'];
    for (let i = 0; i < 70; i++) {
      const c = h('i', { class: 'conf', style: { left: `${Math.random() * 100}%`, background: cols[i % cols.length], animationDelay: `${Math.random() * 0.6}s`, animationDuration: `${1.8 + Math.random() * 1.6}s` } });
      c.style.setProperty('--dx', `${(Math.random() - 0.5) * 240}px`); c.style.setProperty('--rot', `${Math.random() * 900}deg`);
      $('fx').appendChild(c); setTimeout(() => c.remove(), 4200);
    }
  }
  function sparks() {
    const box = $('sparks'); if (!box || box.childNodes.length) return;
    for (let i = 0; i < 34; i++) box.appendChild(h('i', { class: `spark${i % 3 === 0 ? ' b' : ''}`, style: { left: `${Math.random() * 100}%`, animationDelay: `${-Math.random() * 20}s`, animationDuration: `${10 + Math.random() * 16}s`, width: `${2 + Math.random() * 3}px`, height: `${2 + Math.random() * 3}px` } }));
  }
  function toast(msg, kind) { const t = h('div', { class: `toast ${kind || ''}` }, msg); document.body.appendChild(t); setTimeout(() => t.remove(), 8000); }

  // cuenta atras: devuelve {stop}; llama onTick(restante) y onEnd()
  function countdown(sec, onTick, onEnd) {
    let left = sec; onTick(left);
    const iv = setInterval(() => { left--; onTick(left); if (left <= 0) { clearInterval(iv); onEnd(); } }, 1000);
    return { stop: () => clearInterval(iv) };
  }

  // Respuesta al toque: onda desde el punto pulsado y vibracion breve en pantallas tactiles
  const RIPPLE_HOST = 'button:not(:disabled):not(.site), .card, .spawn, .dopt';
  function initFeedback() {
    document.addEventListener('pointerdown', (e) => {
      const el = e.target.closest(RIPPLE_HOST); if (!el) return;
      const r = el.getBoundingClientRect(); const d = Math.max(r.width, r.height) * 2;
      const rip = h('span', { class: 'rip', 'aria-hidden': 'true', style: { width: `${d}px`, height: `${d}px`, left: `${e.clientX - r.left - d / 2}px`, top: `${e.clientY - r.top - d / 2}px` } });
      el.appendChild(rip); setTimeout(() => rip.remove(), 650);
      if (e.pointerType === 'touch' && navigator.vibrate) navigator.vibrate(8);
    }, { passive: true });
  }

  Object.assign(UI, { h, $, clear, wait, sfx, initFeedback, beep, setSound, soundOn, banner, tag, shake, confetti, sparks, toast, countdown });
})(typeof window !== 'undefined' ? window : globalThis);
