# Autoria de locales (parte A): app, menu, red, ui, stats, tags, roles, mods. Genera diccionarios; gen_locales.py los une.
ES = {}; EN = {}


def add(k, es, en):
    ES[k] = es; EN[k] = en


add('app.title', 'R6 Draft Sim', 'R6 Draft Sim')
add('app.subtitle', 'DRAFT SIM', 'DRAFT SIM')
add('menu.tagline', 'Draft, bans, droneo, refuerzos y fases de accion por turnos: decide tu plan y el motor resuelve cada fase.', 'Draft, bans, droning, reinforcements and turn-based action phases: set your plan and the engine resolves each phase.')
add('menu.draftMode', 'Draft', 'Draft')
add('draft.full', 'Todos los operadores (con bans)', 'All operators (with bans)')
add('draft.pool', 'Pool aleatorio de 8', 'Random pool of 8')
add('menu.mapMode', 'Mapa', 'Map')
add('mapmode.ranked', 'Aleatorio (pool Ranked)', 'Random (Ranked pool)')
add('mapmode.all', 'Aleatorio (todos)', 'Random (all)')
add('mapmode.choose', 'Elegir mapa', 'Choose map')
add('menu.timers', 'Temporizadores', 'Timers')
add('menu.cpu', 'Jugar vs CPU', 'Play vs CPU')
add('menu.cpuDesc', 'Partida completa contra el motor de decisiones.', 'Full match against the decision engine.')
add('menu.host', 'Crear sala', 'Create room')
add('menu.hostDesc', 'Genera un codigo para tu colega (P2P, sin cuentas).', 'Generates a code for your friend (P2P, no accounts).')
add('menu.join', 'Unirse a sala', 'Join room')
add('menu.joinDesc', 'Escribe el codigo de tu colega.', "Enter your friend's code.")
add('menu.enter', 'Entrar', 'Join')
add('menu.codePlaceholder', 'CODIGO', 'CODE')
add('menu.dataNote', 'Datos de mapas (sitios de bomba y spawns) recopilados de fuentes publicas, con su nivel de confianza; las entradas por spawn y los efectos de cada spawn son un modelo abstracto. Los valores de operadores son aproximaciones propias.', 'Map data (bomb sites and spawns) gathered from public sources with a confidence level; spawn entries and spawn effects are an abstract model. Operator values are our own approximations.')

add('net.creating', 'Creando sala...', 'Creating room...')
add('net.shareCode', 'Pasale este codigo a tu colega:', 'Give this code to your friend:')
add('net.waitGuest', 'Esperando a que se una... (deja esta pestana abierta)', 'Waiting for them to join... (keep this tab open)')
add('net.guestLeft', 'El otro jugador se ha desconectado.', 'The other player disconnected.')
add('net.hostLeft', 'El anfitrion ha cerrado la sala.', 'The host closed the room.')
add('net.error', 'Error de red: {e}', 'Network error: {e}')
add('net.badCode', 'El codigo tiene 5 caracteres.', 'The code has 5 characters.')
add('net.connecting', 'Conectando...', 'Connecting...')
add('net.waitHost', 'Conectado. Esperando al anfitrion...', 'Connected. Waiting for the host...')
add('net.noRoom', 'No existe ninguna sala con ese codigo.', 'No room exists with that code.')
add('net.silence', 'Sin senal del rival desde hace {s} s. Si no vuelve, pulsa Menu.', 'No signal from the rival for {s} s. If they do not return, press Menu.')

for k, es, en in [
    ('ui.sound', 'Sonido', 'Sound'), ('ui.menu', 'Menu', 'Menu'), ('ui.confirmLeave', '¿Abandonar la partida?', 'Leave the match?'),
    ('ui.waitingRival', 'Esperando al rival...', 'Waiting for the rival...'),
    ('ui.bansAgainst', 'Operadores vetados contra ti: {ops}', 'Operators banned against you: {ops}'),
    ('ui.skip', 'Saltar', 'Skip'), ('ui.resolving', 'Resolviendo la fase...', 'Resolving the phase...'),
    ('ui.trade', 'TRADE', 'TRADE'), ('ui.eliminated', 'ELIMINADO', 'ELIMINATED'), ('ui.vetoStamp', 'VETO', 'BAN'),
    ('ui.planted', 'BOMBA PLANTADA', 'DEFUSER PLANTED'), ('ui.defused', 'BOMBA DESACTIVADA', 'DEFUSED'),
    ('ui.victory', 'VICTORIA', 'VICTORY'), ('ui.defeat', 'DERROTA', 'DEFEAT'),
    ('ui.nextRound', 'Siguiente ronda', 'Next round'), ('ui.finish', 'Finalizar partida', 'Finish match'),
    ('ui.whyTitle', 'Por que ha ganado', 'Why they won'),
    ('ui.whyLegend', 'Verde: factor a favor del ganador · Rojo: factor a favor del perdedor que no bastó.', "Green: factor in the winner's favour · Red: factor in the loser's favour that was not enough."),
    ('ui.siteReveal', 'El sitio de bomba y el droneo', 'Bomb site and drone sweep'),
    ('ui.fullLog', 'Registro completo de la ronda (con informacion oculta)', 'Full round log (including hidden information)'),
    ('ui.matchWon', 'PARTIDA GANADA', 'MATCH WON'), ('ui.matchLost', 'PARTIDA PERDIDA', 'MATCH LOST'),
    ('ui.backToMenu', 'Volver al menu', 'Back to menu'),
    ('ui.yourSquad', 'Tu equipo', 'Your squad'), ('ui.rivalSquad', 'Equipo rival', 'Rival squad'),
    ('ui.compEmpty', 'Selecciona operadores para ver tu composicion.', 'Select operators to see your composition.'),
    ('ui.groundLine', 'Planta baja / exterior', 'Ground level / exterior'),
    ('ui.spawnUndocumented', 'Spawn sin documentar en las fuentes publicas (modelo generico).', 'Spawn not documented in public sources (generic model).'),
]:
    add(k, es, en)
add('hud.round', 'Ronda {n} · mitad {half}', 'Round {n} · half {half}')
add('hud.overtime', 'Prorroga · ronda {n}', 'Overtime · round {n}')
add('hud.roundBanner', 'RONDA {n}', 'ROUND {n}')
add('hud.you', 'TU', 'YOU')
add('hud.rival', 'RIVAL', 'RIVAL')
add('side.att', 'ATACANTE', 'ATTACKER')
add('side.def', 'DEFENSOR', 'DEFENDER')
add('spawn.generic', 'Spawn {n} (sin documentar)', 'Spawn {n} (undocumented)')

ST = {
    'aim': ('Punteria', 'Aim', 'Habilidad base en duelos.', 'Base dueling skill.'),
    'intel': ('Intel', 'Intel', 'Reune informacion (drones, camaras, rastreo).', 'Gathers information (drones, cameras, tracking).'),
    'entry': ('Entrada', 'Entry', 'Fuerza de entrada agresiva.', 'Aggressive entry strength.'),
    'hb': ('Hard breach', 'Hard breach', 'Puede abrir paredes reforzadas.', 'Can open reinforced walls.'),
    'flank': ('Flanco', 'Flank', 'Vigila o ejecuta flancos.', 'Watches or executes flanks.'),
    'clear': ('Clear', 'Clear', 'Limpia habitaciones con utilidad.', 'Clears rooms with utility.'),
    'smoke': ('Humo', 'Smoke', 'Humo/flash para entrar.', 'Smoke/flash to enter.'),
    'aUtil': ('Anti-util', 'Anti-util', 'Rompe la utilidad defensiva.', 'Breaks defender utility.'),
    'sup': ('Apoyo', 'Support', 'Curacion o apoyo al equipo.', 'Healing or team support.'),
    'post': ('Post-plant', 'Post-plant', 'Control tras plantar.', 'Control after planting.'),
    'long': ('Larga dist.', 'Long range', 'Gana duelos a larga distancia.', 'Wins long-range duels.'),
    'vtl': ('Vertical', 'Vertical', 'Juego vertical (suelos/techos).', 'Vertical play (floors/ceilings).'),
    'anchor': ('Ancla', 'Anchor', 'Aguanta el sitio.', 'Holds the site.'),
    'deny': ('Deny', 'Deny', 'Retrasa al atacante con trampas.', 'Delays attackers with traps.'),
    'roam': ('Roam', 'Roam', 'Juega fuera del sitio.', 'Plays away from the site.'),
    'aIntel': ('Anti-intel', 'Anti-intel', 'Bloquea drones e informacion.', 'Blocks drones and information.'),
    'aHB': ('Anti-breach', 'Anti-breach', 'Protege los refuerzos del breach.', 'Protects reinforcements from breaching.'),
    'aNade': ('Anti-granada', 'Anti-nade', 'Neutraliza granadas y proyectiles.', 'Neutralises grenades and projectiles.'),
    'vis': ('Anti-vision', 'Anti-vision', 'Inmune a humo/flash.', 'Immune to smoke/flash.'),
}
for k, (es, en, de, dn) in ST.items():
    add(f'stat.{k}', es, en); add(f'stat.{k}.desc', de, dn)
TG = {'hb': ('Hard breach', 'Hard breach'), 'ahb': ('Anti-breach', 'Anti-breach'), 'intel': ('Intel', 'Intel'), 'aintel': ('Anti-intel', 'Anti-intel'), 'roam': ('Roam', 'Roam'), 'anchor': ('Ancla', 'Anchor'), 'deny': ('Deny', 'Deny'), 'entry': ('Entry', 'Entry'), 'clear': ('Clear', 'Clear'), 'smoke': ('Humo', 'Smoke'), 'autil': ('Anti-util', 'Anti-util'), 'sup': ('Apoyo', 'Support'), 'long': ('Larga', 'Long'), 'flank': ('Flanco', 'Flank'), 'nade': ('Anti-nade', 'Anti-nade'), 'vis': ('Anti-vision', 'Anti-vision')}
for k, (es, en) in TG.items():
    add(f'tag.{k}', es, en)
RL = {
    'anchor': ('Ancla', 'Anchor', 'Se queda en el sitio con refuerzos y utilidad.', 'Stays on site with reinforcements and utility.'),
    'rotate': ('Rotacion', 'Rotate', 'Cubre rotaciones entre sitio y alrededores.', 'Covers rotations between the site and surroundings.'),
    'roam': ('Roam', 'Roam', 'Juega fuera del sitio para emboscar y flanquear.', 'Plays off-site to ambush and flank.'),
    'hunt': ('Cazadrones', 'Drone hunter', 'Sale a destruir drones durante la preparacion.', 'Goes out to destroy drones during prep.'),
    'entry': ('Entrada', 'Entry', 'Abre el camino con duelos agresivos.', 'Opens the way with aggressive duels.'),
    'breach': ('Breacher', 'Breacher', 'Prioridad: abrir paredes reforzadas.', 'Priority: open reinforced walls.'),
    'intel': ('Intel', 'Intel', 'Dedica sus drones al droneo (rinde al 100 %).', 'Dedicates their drones to the sweep (100 % effective).'),
    'flank': ('Flanco', 'Flank', 'Vigila y caza roamers por la espalda.', 'Watches and hunts roamers from behind.'),
    'planter': ('Plantador', 'Planter', 'Lleva y planta el desactivador.', 'Carries and plants the defuser.'),
    'support': ('Apoyo', 'Support', 'Cubre al plantador y cura al equipo.', 'Covers the planter and heals the team.'),
}
for k, (es, en, de, dn) in RL.items():
    add(f'role.{k}', es, en); add(f'role.{k}.desc', de, dn)
for k, es, en in [('front', 'Frontal', 'Front'), ('side', 'Lateral', 'Side'), ('rear', 'Trasero', 'Rear')]:
    add(f'lane.{k}', es, en)
add('reinf.site', 'Paredes del sitio', 'Site walls')
add('reinf.site.desc', 'Refuerzan las paredes de las salas objetivo: frenan la entrada blanda.', 'Reinforce the objective room walls: slows soft entry.')
add('reinf.entry', 'Entradas', 'Entries')
add('reinf.entry.desc', 'Puertas y ventanas perimetrales: frenan entradas con flash/humo y por planta baja.', 'Perimeter doors and windows: slows flash/smoke entries and ground routes.')
add('reinf.hatch', 'Trampillas', 'Hatches')
add('reinf.hatch.desc', 'Suelos y techos: frenan las rutas por tejado y sotano.', 'Floors and ceilings: slows roof and basement routes.')
for k, es, en in [
    ('aim', 'Punteria', 'Aim'), ('foeAim', 'Rival', 'Foe'), ('trade', 'Trades', 'Trades'), ('time', 'Tiempo', 'Time'), ('encounter', 'Encuentros', 'Encounters'),
    ('info', 'Info', 'Info'), ('clear', 'Clear', 'Clear'), ('smoke', 'Humo', 'Smoke'), ('flank', 'Flanco', 'Flank'), ('post', 'Post-plant', 'Post-plant'), ('defuse', 'Desactivar', 'Defuse'),
    ('carry.denyMul', 'Reduce el deny', 'Reduces deny'), ('carry.aHBMul', 'Reduce anti-breach', 'Reduces anti-breach'),
    ('carry.setupAim', 'Setup completo', 'Full setup'), ('carry.splitAtt', 'Equipo dividido', 'Split team'),
]:
    add(f'mod.{k}', es, en)

for k, es, en in [
    ('ui.close', 'Cerrar', 'Close'), ('stage.planDef.needSite', 'Elige un sitio de bomba para continuar', 'Choose a bomb site to continue'), ('stage.ban.none', 'Selecciona un operador para vetarlo', 'Select an operator to ban'), ('stage.ban.selected', 'Veto seleccionado: {name}', 'Selected ban: {name}'), ('stage.ban.against', 'Vetados contra ti', 'Banned against you'), ('ui.aimShort', 'AIM', 'AIM'), ('ui.killsShort', '{n}K', '{n}K'),
    ('mapinfo.ranked', 'En el pool Ranked', 'In the Ranked pool'), ('mapinfo.notRanked', 'Fuera del pool Ranked', 'Outside the Ranked pool'),
    ('mapinfo.confidence', 'Confianza de los datos', 'Data confidence'),
    ('conf.alta', 'alta', 'high'), ('conf.media', 'media', 'medium'), ('conf.baja', 'baja', 'low'), ('conf.unknown', 'sin datos', 'no data'),
    ('mapinfo.sites', 'Sitios de bomba', 'Bomb sites'), ('mapinfo.spawns', 'Spawns de atacantes', 'Attacker spawns'),
    ('mapinfo.laneNote', 'La lane (frontal/lateral/trasera) de cada spawn es un modelo abstracto propio, no un dato oficial.', 'Each spawn lane (front/side/rear) is our own abstract model, not official data.'),
    ('mapinfo.rawNote', 'Texto tal como lo recogio la investigacion (en espanol).', 'Text as recorded by the research (in Spanish).'),
    ('mapinfo.features', 'Rasgos del mapa', 'Map features'), ('mapinfo.notes', 'Notas de la investigacion', 'Research notes'), ('mapinfo.sources', 'Fuentes', 'Sources'),
]:
    add(k, es, en)
