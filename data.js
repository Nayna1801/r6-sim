// Datos de operadores y mapas. Los stats son una APROXIMACION de diseno propio (no oficial).
// Campos (0-3 salvo aim 1-5):
//  aim: punteria/frag | intel: recoge informacion | entry: entrada agresiva | hb: hard-breach (atq)
//  flank: vigila/ejecuta flancos | clear: limpia habitaciones | smoke: humo/flash (atq)
//  aUtil: rompe utilidad defensiva (atq) | deny: retrasa al atacante (def) | anchor: aguanta sitio (def)
//  roam: juega fuera del sitio (def) | aIntel: bloquea drones/info (def) | aHB: protege refuerzos (def)
//  aNade: neutraliza granadas/proyectiles (def) | vis: inmune a humo/flash (def) | sup: apoyo/curacion
//  long: gana duelos a larga distancia | vtl: juego vertical | post: control post-plant (atq)
(function (g) {
  const O = (id, name, side, s) => ({ id, name, side, aim: 3, intel: 0, entry: 0, hb: 0, flank: 0, clear: 0, smoke: 0, aUtil: 0, deny: 0, anchor: 0, roam: 0, aIntel: 0, aHB: 0, aNade: 0, vis: 0, sup: 0, long: 0, vtl: 0, post: 0, ...s, img: `assets/ops/${id}.png` });
  const OPS = [
    // ---------- ATACANTES ----------
    O('ace', 'Ace', 'att', { entry: 2, hb: 1 }),
    O('amaru', 'Amaru', 'att', { aim: 4, entry: 3, vtl: 1 }),
    O('ash', 'Ash', 'att', { aim: 4, entry: 3, vtl: 1 }),
    O('blackbeard', 'Blackbeard', 'att', { aim: 4, entry: 1, long: 1 }),
    O('blitz', 'Blitz', 'att', { entry: 3, clear: 1 }),
    O('brava', 'Brava', 'att', { intel: 1, aUtil: 2 }),
    O('buck', 'Buck', 'att', { aim: 4, entry: 2, vtl: 1 }),
    O('capitao', 'Capitão', 'att', { smoke: 1, post: 2, clear: 1, sup: 1 }),
    O('deimos', 'Deimos', 'att', { intel: 2, entry: 1 }),
    O('dokkaebi', 'Dokkaebi', 'att', { intel: 2, sup: 1 }),
    O('finka', 'Finka', 'att', { sup: 3, entry: 1 }),
    O('flores', 'Flores', 'att', { intel: 1, entry: 1, aUtil: 1, clear: 1 }),
    O('fuze', 'Fuze', 'att', { clear: 3, entry: 1, vtl: 1 }),
    O('glaz', 'Glaz', 'att', { aim: 5, long: 2, intel: 1 }),
    O('gridlock', 'Gridlock', 'att', { post: 2, flank: 2, sup: 1 }),
    O('grim', 'Grim', 'att', { intel: 3 }),
    O('hibana', 'Hibana', 'att', { hb: 1, entry: 2, vtl: 1 }),
    O('iana', 'Iana', 'att', { intel: 2, flank: 1, entry: 1 }),
    O('iq', 'IQ', 'att', { intel: 2, aUtil: 1 }),
    O('jackal', 'Jackal', 'att', { intel: 3, flank: 1 }),
    O('kali', 'Kali', 'att', { aim: 5, long: 2, aUtil: 2 }),
    O('lion', 'Lion', 'att', { intel: 3, entry: 1 }),
    O('maverick', 'Maverick', 'att', { aim: 4, hb: 1, entry: 2, vtl: 1 }),
    O('montagne', 'Montagne', 'att', { aim: 3, entry: 2, clear: 1 }),
    O('nomad', 'Nomad', 'att', { flank: 3, post: 2 }),
    O('nokk', 'Nøkk', 'att', { flank: 2, entry: 1, intel: 1 }),
    O('osa', 'Osa', 'att', { entry: 1, sup: 2, post: 1 }),
    O('ram', 'Ram', 'att', { clear: 2, entry: 1, aUtil: 1 }),
    O('rauora', 'Rauora', 'att', { entry: 2, clear: 1 }),
    O('sens', 'Sens', 'att', { smoke: 3, sup: 1 }),
    O('sledge', 'Sledge', 'att', { aim: 4, entry: 2, vtl: 1 }),
    O('thatcher', 'Thatcher', 'att', { aUtil: 3, sup: 1, entry: 1 }),
    O('thermite', 'Thermite', 'att', { hb: 1, entry: 1, vtl: 1 }),
    O('twitch', 'Twitch', 'att', { aim: 4, intel: 2, aUtil: 2 }),
    O('ying', 'Ying', 'att', { smoke: 2, clear: 2, entry: 1 }),
    O('zero', 'Zero', 'att', { aim: 4, intel: 2, aUtil: 2 }),
    O('zofia', 'Zofia', 'att', { aim: 4, clear: 2, entry: 1 }),
    // ---------- DEFENSORES ----------
    O('alibi', 'Alibi', 'def', { aIntel: 2, anchor: 1, roam: 1 }),
    O('aruni', 'Aruni', 'def', { deny: 3, anchor: 3, aIntel: 1, aHB: 1 }),
    O('azami', 'Azami', 'def', { deny: 2, anchor: 2, aHB: 1 }),
    O('bandit', 'Bandit', 'def', { aHB: 3, anchor: 2 }),
    O('castle', 'Castle', 'def', { aHB: 2, deny: 1, anchor: 3 }),
    O('caveira', 'Caveira', 'def', { aim: 4, roam: 3, intel: 1 }),
    O('clash', 'Clash', 'def', { aim: 2, deny: 2, anchor: 2 }),
    O('denari', 'Denari', 'def', { deny: 2, anchor: 2, aIntel: 1 }),
    O('doc', 'Doc', 'def', { sup: 3, anchor: 2 }),
    O('echo', 'Echo', 'def', { aIntel: 2, deny: 2, anchor: 2, intel: 1 }),
    O('ela', 'Ela', 'def', { aim: 4, deny: 2, roam: 1, anchor: 1 }),
    O('fenrir', 'Fenrir', 'def', { deny: 3, anchor: 2 }),
    O('frost', 'Frost', 'def', { deny: 3, anchor: 2 }),
    O('goyo', 'Goyo', 'def', { anchor: 3, deny: 2, aNade: 1 }),
    O('jager', 'Jäger', 'def', { aNade: 3, anchor: 2, aUtil: 0 }),
    O('kaid', 'Kaid', 'def', { aHB: 3, anchor: 3 }),
    O('kapkan', 'Kapkan', 'def', { deny: 3, anchor: 2 }),
    O('lesion', 'Lesion', 'def', { deny: 2, roam: 1, anchor: 1 }),
    O('maestro', 'Maestro', 'def', { intel: 2, anchor: 2, long: 1 }),
    O('melusi', 'Melusi', 'def', { deny: 2, anchor: 2, intel: 1 }),
    O('mira', 'Mira', 'def', { aHB: 3, anchor: 3, intel: 1 }),
    O('mozzie', 'Mozzie', 'def', { aIntel: 3, intel: 1, anchor: 1 }),
    O('mute', 'Mute', 'def', { aIntel: 2, aHB: 2, anchor: 2 }),
    O('noor', 'Noor', 'def', { intel: 2, roam: 2 }),
    O('oryx', 'Oryx', 'def', { aim: 4, roam: 3, anchor: 1 }),
    O('pulse', 'Pulse', 'def', { intel: 3, anchor: 2 }),
    O('rook', 'Rook', 'def', { sup: 2, anchor: 2 }),
    O('skopos', 'Skopós', 'def', { roam: 2, intel: 1 }),
    O('smoke', 'Smoke', 'def', { deny: 3, anchor: 2 }),
    O('solis', 'Solis', 'def', { intel: 2, anchor: 1, aUtil: 0, aIntel: 1 }),
    O('tachanka', 'Tachanka', 'def', { aim: 4, anchor: 3, deny: 1, long: 1 }),
    O('thorn', 'Thorn', 'def', { deny: 3, anchor: 2 }),
    O('thunderbird', 'Thunderbird', 'def', { sup: 2, anchor: 2 }),
    O('trapper', 'Trapper', 'def', { deny: 2, aIntel: 1, anchor: 2 }),
    O('tubarao', 'Tubarão', 'def', { deny: 2, anchor: 2, aIntel: 1 }),
    O('valkyrie', 'Valkyrie', 'def', { intel: 2, roam: 1, anchor: 1 }),
    O('vigil', 'Vigil', 'def', { aIntel: 3, roam: 2 }),
    O('wamai', 'Wamai', 'def', { aNade: 3, anchor: 2, aIntel: 0 }),
    O('warden', 'Warden', 'def', { vis: 3, anchor: 2, aim: 3 }),
  ];

  // open: lineas de vision largas | vert: verticalidad | tight: sitios cerrados
  const M = (id, name, open, vert, tight) => ({ id, name, open, vert, tight, img: `assets/maps/${id}.png` });
  const MAPS = [
    M('bank', 'Bank', .35, .7, .5), M('bartlettu', 'Bartlett U.', .5, .5, .5), M('border', 'Border', .45, .4, .5),
    M('calypsocasino', 'Calypso Casino', .5, .5, .5), M('chalet', 'Chalet', .35, .8, .45), M('clubhouse', 'Clubhouse', .3, .7, .5),
    M('coastline', 'Coastline', .55, .5, .4), M('consulate', 'Consulate', .35, .6, .5), M('district', 'District', .5, .5, .5),
    M('emeraldplains', 'Emerald Plains', .5, .6, .5), M('favela', 'Favela', .3, .8, .5), M('forttruth', 'Fort Truth', .5, .5, .5),
    M('fortress', 'Fortress', .45, .5, .5), M('herefordbase', 'Hereford Base', .35, .6, .5), M('house', 'House', .3, .8, .5),
    M('kafedostoyevsky', 'Kafe Dostoyevsky', .3, .85, .45), M('kanal', 'Kanal', .55, .4, .4), M('lair', 'Lair', .5, .6, .5),
    M('neighborhood', 'Neighborhood', .4, .6, .5), M('nighthavenlabs', 'Nighthaven Labs', .45, .5, .5), M('oregon', 'Oregon', .35, .7, .5),
    M('outback', 'Outback', .55, .4, .45), M('presidentialplane', 'Presidential Plane', .15, .5, .7), M('skyscraper', 'Skyscraper', .5, .6, .5),
    M('stadium', 'Stadium', .55, .5, .45), M('themepark', 'Theme Park', .45, .5, .45), M('tower', 'Tower', .5, .5, .5),
    M('villa', 'Villa', .4, .7, .5), M('yacht', 'Yacht', .3, .8, .6),
  ];
  // Dos sitios genericos por mapa, con sesgo estable derivado del id (no son los sitios reales).
  MAPS.forEach((m) => {
    let h = 0; for (const c of m.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const b = ((h % 21) - 10) / 100; // -0.10..0.10
    m.sites = [{ name: 'Sitio A', def: b }, { name: 'Sitio B', def: -b }];
  });

  g.R6 = g.R6 || {};
  g.R6.OPS = OPS;
  g.R6.MAPS = MAPS;
})(typeof window !== 'undefined' ? window : globalThis);
