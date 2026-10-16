(function () {
  const R = window.R6;
  const $ = (id) => document.getElementById(id);
  const sideName = { att: 'ATACANTE', def: 'DEFENSOR' };
  const TAGS = [
    ['hb', 'Hard breach', 'hb', (o) => o.hb > 0], ['ahb', 'Anti-breach', 'ahb', (o) => o.aHB >= 2],
    ['intel', 'Intel', '', (o) => o.intel >= 2], ['aintel', 'Anti-intel', '', (o) => o.aIntel >= 2],
    ['roam', 'Roam', '', (o) => o.roam >= 2], ['anchor', 'Ancla', '', (o) => o.anchor >= 3],
    ['deny', 'Deny', '', (o) => o.deny >= 3], ['entry', 'Entry', '', (o) => o.entry >= 3],
    ['clear', 'Clear', '', (o) => o.clear >= 2], ['smoke', 'Humo', '', (o) => o.smoke >= 2],
    ['autil', 'Anti-util', '', (o) => o.aUtil >= 2], ['sup', 'Apoyo', '', (o) => o.sup >= 2],
    ['long', 'Larga dist.', '', (o) => o.long >= 2], ['flank', 'Flanco', '', (o) => o.flank >= 2],
    ['nade', 'Anti-granada', '', (o) => o.aNade >= 3], ['vis', 'Anti-vision', '', (o) => o.vis >= 3],
  ];
  const tagsOf = (o) => TAGS.filter((t) => t[3](o)).slice(0, 3);
  const byId = (id) => R.OPS.find((o) => o.id === id);
  const mapById = (id) => R.MAPS.find((m) => m.id === id);
  const ids = (arr) => arr.map((o) => o.id);

  // ---------- Efectos: sonido, banners, confeti, chispas ----------
  let sound = true, ac = null;
  function beep(f, d, type = 'square', v = 0.05, slide = 0, delay = 0) {
    if (!sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const t0 = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t0);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t0 + d);
      g.gain.setValueAtTime(v, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
      o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + d);
    } catch (e) { /* sin audio */ }
  }
  const sfx = {
    click: () => beep(620, 0.06, 'square', 0.03),
    pick: () => { beep(520, 0.07, 'square', 0.04); beep(780, 0.08, 'square', 0.04, 0, 0.06); },
    kill: () => { beep(220, 0.22, 'sawtooth', 0.07, -170); beep(90, 0.25, 'sine', 0.1); },
    plant: () => { [0, 0.18, 0.36].forEach((d) => beep(900, 0.1, 'square', 0.05, 0, d)); },
    defuse: () => { beep(500, 0.12, 'triangle', 0.07); beep(750, 0.2, 'triangle', 0.07, 0, 0.12); },
    win: () => [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.22, 'triangle', 0.07, 0, i * 0.12)),
    lose: () => [330, 262, 196].forEach((f, i) => beep(f, 0.3, 'sawtooth', 0.06, 0, i * 0.18)),
    intro: () => { beep(300, 0.15, 'square', 0.05); beep(450, 0.25, 'square', 0.05, 0, 0.18); },
    breach: () => beep(140, 0.2, 'sawtooth', 0.08, -60),
  };
  function banner(title, sub, kind) {
    const b = document.createElement('div');
    b.className = `banner ${kind || ''}`;
    b.innerHTML = `<div class="bt">${title}</div>${sub ? `<div class="bs">${sub}</div>` : ''}`;
    $('fx').appendChild(b);
    setTimeout(() => b.remove(), kind === 'win' || kind === 'lose' ? 3200 : 1700);
  }
  function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
  function confetti() {
    const cols = ['#ff8a3d', '#3da5ff', '#5ee08a', '#fff', '#ffd24a'];
    for (let i = 0; i < 70; i++) {
      const c = document.createElement('i');
      c.className = 'conf';
      c.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % cols.length]};animation-delay:${Math.random() * 0.6}s;animation-duration:${1.8 + Math.random() * 1.6}s;--dx:${(Math.random() - 0.5) * 240}px;--rot:${Math.random() * 900}deg`;
      $('fx').appendChild(c);
      setTimeout(() => c.remove(), 4200);
    }
  }
  function sparks() {
    const box = $('sparks');
    for (let i = 0; i < 34; i++) {
      const p = document.createElement('i');
      p.className = `spark${i % 3 === 0 ? ' b' : ''}`;
      p.style.cssText = `left:${Math.random() * 100}%;animation-delay:${-Math.random() * 20}s;animation-duration:${10 + Math.random() * 16}s;width:${2 + Math.random() * 3}px;height:${2 + Math.random() * 3}px`;
      box.appendChild(p);
    }
  }

  let mode = 'cpu'; // 'cpu' | 'host' | 'guest'
  let peer = null, conn = null;
  let score = { you: 0, cpu: 0, round: 0 };
  let st = null;
  let timer = null;
  const isNet = () => mode !== 'cpu';

  function renderScore() {
    $('score').innerHTML = `<span class="rd">Ronda ${Math.max(1, score.round)}</span><span class="s" style="color:var(--ok)">TU ${score.you}</span><span class="s" style="color:var(--bad)">${isNet() ? 'RIVAL' : 'CPU'} ${score.cpu}</span>`;
  }
  function mapBar(el) {
    const m = st.map;
    el.style.backgroundImage = `url(${m.img})`;
    el.innerHTML = `<div><small>MAPA ALEATORIO</small><h1>${m.name}</h1></div><div class="side ${st.side}">${sideName[st.side]}</div>`;
  }
  function show(name) {
    ['Menu', 'Draft', 'Sim'].forEach((n) => $(`screen${n}`).classList.toggle('hidden', n !== name));
    $('btnReset').classList.toggle('hidden', isNet() || name === 'Menu');
    $('btnMenu').classList.toggle('hidden', name === 'Menu');
  }
  function netStatus(html, err) {
    const el = $('netStatus');
    el.className = `netstatus${err ? ' err' : ''}`;
    el.innerHTML = html;
  }

  // ---------- Rondas ----------
  function applyRound({ side, mapId, poolIds, cpuPool }) {
    clearInterval(timer);
    score.round += 1; renderScore();
    st = {
      side, map: mapById(mapId), picks: [], tactic: side === 'att' ? 'standard' : 'balanced', site: 0, counted: false,
      pool: poolIds.map(byId), cpuPool, hostPick: null, guestPick: null,
    };
    show('Draft');
    $('screenDraft').className = `screen ${side}-side`;
    mapBar($('mapbar'));
    $('poolTitle').textContent = `Tu seleccion aleatoria (${side === 'att' ? 'atacantes' : 'defensores'})`;
    renderPool(true); renderPlan(); updateGo();
  }
  const otherSide = (s) => (s === 'att' ? 'def' : 'att');
  const nextSide = () => (score.round === 0 || !st ? (Math.random() < 0.5 ? 'att' : 'def') : otherSide(st.side));

  function newRoundCpu() {
    const side = nextSide();
    applyRound({
      side, mapId: R.sample(R.MAPS, 1, Math.random)[0].id,
      poolIds: ids(R.sample(R.OPS.filter((o) => o.side === side), 8, Math.random)),
      cpuPool: R.sample(R.OPS.filter((o) => o.side !== side), 8, Math.random),
    });
  }
  function newRoundHost() {
    const side = nextSide();
    const msg = {
      type: 'round', hostSide: side, mapId: R.sample(R.MAPS, 1, Math.random)[0].id,
      poolHost: ids(R.sample(R.OPS.filter((o) => o.side === side), 8, Math.random)),
      poolGuest: ids(R.sample(R.OPS.filter((o) => o.side !== side), 8, Math.random)),
    };
    conn.send(msg);
    applyRound({ side, mapId: msg.mapId, poolIds: msg.poolHost });
  }
  const newRound = () => (mode === 'host' ? newRoundHost() : newRoundCpu());

  // ---------- Draft ----------
  function renderPool(first) {
    const full = st.picks.length >= 5;
    $('pool').innerHTML = '';
    st.pool.forEach((o, ix) => {
      const sel = st.picks.includes(o);
      const d = document.createElement('div');
      d.className = `card${sel ? ' sel' : ''}${full && !sel ? ' dim' : ''}${first ? ' enter' : ''}`;
      d.style.setProperty('--i', ix);
      d.onmousemove = (ev) => { const r = d.getBoundingClientRect(); const x = (ev.clientX - r.left) / r.width - 0.5, y = (ev.clientY - r.top) / r.height - 0.5; d.style.setProperty('--ry', `${x * 14}deg`); d.style.setProperty('--rx', `${-y * 12}deg`); d.style.setProperty('--mx', `${(x + 0.5) * 100}%`); };
      d.onmouseleave = () => { d.style.setProperty('--ry', '0deg'); d.style.setProperty('--rx', '0deg'); };
      d.innerHTML = `<div class="tags">${tagsOf(o).map((t) => `<span class="tag ${t[2]}">${t[1]}</span>`).join('')}</div><span class="stat">AIM ${o.aim}</span><img src="${o.img}" alt=""><div class="nm">${o.name}</div>`;
      d.onclick = () => { if (st.locked) return; if (sel) { st.picks = st.picks.filter((x) => x !== o); sfx.click(); } else if (!full) { st.picks.push(o); sfx.pick(); } renderPool(); updateGo(); };
      $('pool').appendChild(d);
    });
    $('pickCount').textContent = `${st.picks.length}/5`;
    renderComp();
  }
  function renderComp() {
    const p = st.picks, s = (k) => p.reduce((a, o) => a + (o[k] || 0), 0);
    const chips = st.side === 'att'
      ? [['Hard breach', p.filter((o) => o.hb).length, (v) => v >= 1], ['Intel', s('intel'), (v) => v >= 4], ['Entry', s('entry'), (v) => v >= 5], ['Anti-utilidad', s('aUtil'), (v) => v >= 2], ['Flanco', s('flank'), () => true], ['Post-plant', s('post'), () => true]]
      : [['Anti-breach', s('aHB'), (v) => v >= 3], ['Anti-intel', s('aIntel'), (v) => v >= 3], ['Ancla', s('anchor'), (v) => v >= 6], ['Roam', s('roam'), () => true], ['Deny', s('deny'), (v) => v >= 4], ['Anti-granada', s('aNade'), () => true]];
    $('comp').innerHTML = p.length ? chips.map(([n, v, ok]) => `<span class="chip ${p.length < 5 ? '' : ok(v) ? 'good' : 'warn'}">${n}<b>${v}</b></span>`).join('') : '<span class="hint">Selecciona operadores para ver tu composicion.</span>';
  }
  function renderPlan() {
    const T = st.side === 'att' ? R.ATT_TACTICS : R.DEF_TACTICS;
    $('tactics').innerHTML = '';
    Object.entries(T).forEach(([k, v]) => {
      const b = document.createElement('button');
      b.className = `opt${st.tactic === k ? ' on' : ''}`;
      b.innerHTML = `<b>${v.name}</b><span>${v.desc}</span>`;
      b.onclick = () => { if (st.locked) return; st.tactic = k; renderPlan(); };
      $('tactics').appendChild(b);
    });
    $('siteTitle').textContent = st.side === 'att' ? 'Sitio que atacas (sin saber donde esta la bomba)' : 'Sitio que defiendes';
    $('sites').innerHTML = '';
    st.map.sites.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = `opt${st.site === i ? ' on' : ''}`; b.innerHTML = `<b>${s.name}</b>`;
      b.onclick = () => { if (st.locked) return; st.site = i; renderPlan(); };
      $('sites').appendChild(b);
    });
  }
  function updateGo() {
    const b = $('btnGo');
    if (st.locked) { b.disabled = true; return; }
    b.disabled = st.picks.length !== 5;
    b.textContent = st.picks.length === 5 ? 'Confirmar y simular' : `Elige ${5 - st.picks.length} mas`;
  }

  function go() {
    st.locked = true;
    $('btnGo').disabled = true;
    if (!isNet()) {
      $('btnGo').textContent = 'El rival esta decidiendo...';
      setTimeout(() => {
        const cpuSide = otherSide(st.side);
        const ai = R.aiDraft(cpuSide, st.cpuPool, st.map, Math.random);
        const mine = { team: st.picks, tactic: st.tactic, site: st.site };
        const rival = { side: cpuSide, team: ai.team, tactic: ai.tactic, site: ai.site };
        runAndPlay(st.side, mine, rival);
      }, 60);
      return;
    }
    const pick = { ids: ids(st.picks), tactic: st.tactic, site: st.site };
    $('btnGo').textContent = 'Esperando al rival...';
    if (mode === 'guest') conn.send({ type: 'pick', ...pick });
    else { st.hostPick = pick; tryResolve(); }
  }

  function simulateRound(att, def, a, d) {
    return R.simulate({ att, def, map: st.map, attSite: a.site, defSite: d.site, attTactic: a.tactic, defTactic: d.tactic, rng: Math.random });
  }
  function runAndPlay(mySide, mine, rival) {
    const att = mySide === 'att' ? mine.team : rival.team, def = mySide === 'att' ? rival.team : mine.team;
    const a = mySide === 'att' ? mine : rival, d = mySide === 'att' ? rival : mine;
    playback({ att, def, rival, res: simulateRound(att, def, a, d) });
  }
  // anfitrion: cuando ambos han confirmado, simula y envia el resultado
  function tryResolve() {
    if (!(st.hostPick && st.guestPick)) return;
    const hp = st.hostPick, gp = st.guestPick;
    const hostAtt = st.side === 'att';
    const attPick = hostAtt ? hp : gp, defPick = hostAtt ? gp : hp;
    const att = attPick.ids.map(byId), def = defPick.ids.map(byId);
    const res = simulateRound(att, def, attPick, defPick);
    const msg = { type: 'result', att: attPick, def: defPick, res };
    conn.send(msg);
    playNet(msg);
  }
  function playNet(msg) {
    const att = msg.att.ids.map(byId), def = msg.def.ids.map(byId);
    const rivalSide = otherSide(st.side);
    const rp = rivalSide === 'att' ? msg.att : msg.def;
    playback({ att, def, rival: { side: rivalSide, team: rp.ids.map(byId), tactic: rp.tactic, site: rp.site }, res: msg.res });
  }

  // ---------- Reproduccion ----------
  const miniCard = (o) => `<div class="mini" id="m-${o.id}"><img src="${o.img}" alt=""><span class="k" id="k-${o.id}"></span><div class="nm">${o.name}</div></div>`;
  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  function playback({ att, def, rival, res }) {
    show('Sim');
    mapBar($('mapbar2'));
    $('teamAtt').className = 'team att'; $('teamDef').className = 'team def';
    $('teamAtt').innerHTML = att.map(miniCard).join(''); $('teamDef').innerHTML = def.map(miniCard).join('');
    $('log').innerHTML = ''; $('result').classList.add('hidden');
    $('clockFill').style.width = '0'; $('clockTxt').textContent = '0:00';
    const kills = {};
    let i = 0, finished = false;
    const finish = () => { if (finished) return; finished = true; clearInterval(timer); showResult({ rival, res }); };
    const step = () => {
      if (finished) return;
      const e = res.log[i++];
      if (!e) { finish(); return; }
      const d = document.createElement('div');
      d.className = `ev ${e.type}`;
      d.innerHTML = `<span class="t">${fmt(e.t)}</span><span class="ty">${e.type}</span><span>${e.text}</span>`;
      $('log').appendChild(d); $('log').scrollTop = 1e6;
      $('clockFill').style.width = `${Math.min(100, (e.t / 225) * 100)}%`; $('clockTxt').textContent = fmt(e.t);
      [[e.victim, e.killer], [e.victim2, e.killer2]].forEach(([v, k]) => {
        if (v) { const m = $(`m-${v}`); if (m) { m.classList.add('hit'); setTimeout(() => m.classList.add('dead'), 350); } }
        if (k) {
          kills[k] = (kills[k] || 0) + 1;
          const el = $(`k-${k}`); if (el) el.textContent = `${kills[k]}K`;
          const mk = $(`m-${k}`); if (mk) { mk.classList.add('flash'); setTimeout(() => mk.classList.remove('flash'), 400); }
        }
      });
      if (e.type === 'kill') { shake($('screenSim')); sfx.kill(); const kd = document.createElement('div'); kd.className = 'killtag'; kd.textContent = e.trade ? 'TRADE' : 'ELIMINADO'; $('fx').appendChild(kd); setTimeout(() => kd.remove(), 900); d.classList.add('flashred'); }
      else if (e.type === 'plant') { banner('BOMBA PLANTADA', e.text, 'plant'); sfx.plant(); $('screenSim').classList.add('planted'); }
      else if (e.type === 'defuse') { banner('BOMBA DESACTIVADA', '', 'defuse'); sfx.defuse(); }
      else if (e.type === 'breach') sfx.breach();
      if (e.type === 'end' && e.winner) finish();
    };
    $('btnSkip').onclick = () => { while (!finished && i < res.log.length) step(); if (!finished) finish(); };
    clearInterval(timer);
    $('screenSim').classList.remove('planted');
    banner(`RONDA ${score.round}`, `${st.map.name} · ${sideName[st.side]}`, 'intro'); sfx.intro();
    setTimeout(() => { if (finished) return; timer = setInterval(step, 1100); step(); }, 1700);
  }

  function showResult({ rival, res }) {
    const youWon = res.winner === st.side;
    if (!st.counted) { if (youWon) score.you++; else score.cpu++; st.counted = true; renderScore(); }
    const T = rival.side === 'att' ? R.ATT_TACTICS : R.DEF_TACTICS;
    const el = $('result');
    el.className = `result ${res.winner}`;
    const nextBtn = mode === 'guest' ? '<button class="go" disabled>Esperando al anfitrion...</button>' : '<button class="go" id="btnNext">Siguiente ronda</button>';
    el.innerHTML = `<div class="you ${youWon ? 'w' : 'l'}">${youWon ? 'Victoria' : 'Derrota'}</div>
      <div class="big">${res.winner === 'att' ? 'Atacantes' : 'Defensores'} ganan</div>
      <div class="enemy">Rival (${rival.side === 'att' ? 'atacantes' : 'defensores'}): ${rival.team.map((o) => o.name).join(', ')}<br>Tactica: ${T[rival.tactic].name} · Sitio: ${st.map.sites[rival.site].name}${res.mvp ? `<br>MVP: ${res.mvp.name} (${res.mvp.kills} bajas)` : ''}</div>
      <h3>Por que ha ganado</h3>
      <ul>${res.reasons.map((r) => `<li class="${r.good ? 'g' : 'b'}">${r.text}</li>`).join('')}</ul>
      <div class="hint">Verde: factor a favor del ganador · Rojo: factor a favor del perdedor que no bastó.</div>
      <div style="margin-top:14px">${nextBtn}</div>`;
    el.classList.remove('hidden');
    banner(youWon ? 'VICTORIA' : 'DERROTA', res.winner === 'att' ? 'Atacantes ganan la ronda' : 'Defensores ganan la ronda', youWon ? 'win' : 'lose');
    if (youWon) { confetti(); sfx.win(); } else sfx.lose();
    const nb = $('btnNext'); if (nb) nb.onclick = newRound;
  }

  // ---------- Red (PeerJS, sin cuentas) ----------
  const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const genCode = () => Array.from({ length: 5 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('');
  const PREFIX = 'r6dsim-';

  function closeNet() { try { if (conn) conn.close(); if (peer) peer.destroy(); } catch (e) { /* ya cerrado */ } conn = null; peer = null; }
  function backToMenu(msg) {
    clearInterval(timer); closeNet(); mode = 'cpu'; st = null; score = { you: 0, cpu: 0, round: 0 };
    renderScore(); show('Menu');
    if (msg) netStatus(msg, true); else $('netStatus').classList.add('hidden');
  }
  function wireConn(c) {
    conn = c;
    c.on('data', (m) => {
      if (!m || typeof m !== 'object') return;
      if (m.type === 'round' && mode === 'guest') {
        applyRound({ side: otherSide(m.hostSide), mapId: m.mapId, poolIds: m.poolGuest });
      } else if (m.type === 'pick' && mode === 'host' && st && !st.guestPick) {
        if (!Array.isArray(m.ids) || m.ids.length !== 5 || !m.ids.every((id) => byId(id))) return;
        st.guestPick = { ids: m.ids, tactic: m.tactic, site: m.site === 1 ? 1 : 0 };
        tryResolve();
      } else if (m.type === 'result' && mode === 'guest' && st) {
        playNet(m);
      }
    });
    c.on('close', () => { if (mode !== 'cpu') backToMenu('El otro jugador se ha desconectado.'); });
  }
  function needPeer() {
    if (typeof Peer === 'undefined') { netStatus('No se pudo cargar PeerJS (¿sin internet?). El modo online no esta disponible.', true); return false; }
    return true;
  }
  function hostRoom(attempt = 0) {
    if (!needPeer()) return;
    closeNet(); mode = 'host';
    const code = genCode();
    netStatus('Creando sala...');
    peer = new Peer(PREFIX + code);
    peer.on('open', () => {
      netStatus(`Pasale este codigo a tu colega:<div class="code">${code}</div><span class="hint">Esperando a que se una... (deja esta pestaña abierta)</span>`);
    });
    peer.on('connection', (c) => {
      if (conn) { c.close(); return; }
      c.on('open', () => { wireConn(c); score = { you: 0, cpu: 0, round: 0 }; st = null; renderScore(); newRoundHost(); });
    });
    peer.on('error', (e) => {
      if (e.type === 'unavailable-id' && attempt < 4) { hostRoom(attempt + 1); return; }
      backToMenu(`Error de red: ${e.type}`);
    });
  }
  function joinRoom() {
    if (!needPeer()) return;
    const code = $('codeIn').value.trim().toUpperCase();
    if (code.length !== 5) { netStatus('El codigo tiene 5 caracteres.', true); return; }
    closeNet(); mode = 'guest';
    netStatus('Conectando...');
    peer = new Peer();
    peer.on('open', () => {
      const c = peer.connect(PREFIX + code, { reliable: true });
      const to = setTimeout(() => backToMenu('No se pudo conectar a esa sala (codigo incorrecto, sala cerrada o red restrictiva).'), 15000);
      c.on('open', () => { clearTimeout(to); score = { you: 0, cpu: 0, round: 0 }; st = null; renderScore(); wireConn(c); netStatus('Conectado. Esperando al anfitrion...'); });
    });
    peer.on('error', (e) => backToMenu(e.type === 'peer-unavailable' ? 'No existe ninguna sala con ese codigo.' : `Error de red: ${e.type}`));
  }

  // ---------- Eventos ----------
  $('btnGo').onclick = go;
  $('btnCpu').onclick = () => { closeNet(); mode = 'cpu'; score = { you: 0, cpu: 0, round: 0 }; st = null; renderScore(); newRoundCpu(); };
  $('btnHost').onclick = () => hostRoom();
  $('btnJoin').onclick = joinRoom;
  $('codeIn').addEventListener('keydown', (e) => { if (e.key === 'Enter') joinRoom(); });
  $('btnReset').onclick = () => { score = { you: 0, cpu: 0, round: 0 }; st = null; renderScore(); newRoundCpu(); };
  $('btnMenu').onclick = () => backToMenu();
  $('btnSound').onclick = () => { sound = !sound; $('btnSound').textContent = sound ? '🔊' : '🔇'; if (sound) sfx.click(); };
  document.addEventListener('click', (e) => { if (e.target.closest('.mbtn, .go, .opt, .joinrow button')) sfx.click(); }, true);
  sparks();
  renderScore();
  show('Menu');
})();
