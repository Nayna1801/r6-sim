# Autoria de locales (parte B): fases, decisiones, pantallas, eventos, enums, motivos. Usa add() de la parte A.
from gen_locales_a import add, ES, EN

PH = {'early': ('Control de mapa', 'Map control'), 'entry': ('Entrada', 'Entry'), 'site': ('Ejecucion en el sitio', 'Site execution'), 'plant': ('Plantada', 'Plant'), 'post': ('Post-plant', 'Post-plant')}
for k, (es, en) in PH.items():
    add(f'phase.{k}.title', es, en); add(f'phase.{k}.resolving', f'Resolviendo: {es}', f'Resolving: {en}')
GOAL = {
    ('early', 'att'): ('Acercate al edificio y decide cuanto tiempo inviertes en el mapa exterior.', 'Approach the building and decide how much time to spend on the exterior.'),
    ('early', 'def'): ('Decide si los roamers esperan, salen al encuentro o cazan drones.', 'Decide whether roamers wait, push out, or hunt drones.'),
    ('entry', 'att'): ('Elige por donde entras y como abres paso (breach, entrada blanda o flash).', 'Choose where you enter and how you open the way (breach, soft entry or flash).'),
    ('entry', 'def'): ('Anticipa la ruta de entrada y elige como recibirla.', 'Anticipate the entry route and choose how to receive it.'),
    ('site', 'att'): ('Elige el estilo con el que limpias el sitio.', 'Choose how you clear the site.'),
    ('site', 'def'): ('Elige como aguantas el sitio.', 'Choose how you hold the site.'),
    ('plant', 'att'): ('Planta ya o gasta tiempo limpiando antes.', 'Plant now or spend time clearing first.'),
    ('plant', 'def'): ('Decide si cortas la plantada o esperas para retomar.', 'Decide whether to cut the plant or wait to retake.'),
    ('post', 'att'): ('Posiciona a tu equipo para defender el desactivador.', 'Position your team to protect the defuser.'),
    ('post', 'def'): ('Decide como intentas desactivar la bomba.', 'Decide how you try to defuse.'),
}
for (ph, sd), (es, en) in GOAL.items():
    add(f'phase.{ph}.{sd}.goal', es, en)

D = {
    ('early', 'att', 'approach'): ('Aproximacion', 'Approach', {
        'standard': ('Estandar', 'Standard', 'Avanzas ordenado y lees el mapa.', 'Advance in order and read the map.'),
        'rush': ('Rush', 'Rush', 'Entras antes de que terminen refuerzos y trampas. Ignoras la info y expones al equipo.', 'Enter before reinforcements and traps are finished. You ignore intel and expose the team.'),
        'flank': ('Cazar roamers', 'Hunt roamers', 'Parte del equipo caza a los roamers. Mas tiempo, menos gente en la entrada.', 'Part of the team hunts roamers. More time, fewer people at the entry.')}),
    ('early', 'def', 'stance'): ('Postura', 'Stance', {
        'hold': ('Esperar', 'Hold', 'Roamers cerca del sitio. Setup completo: bonus defensivo en todo el round.', 'Roamers stay near the site. Full setup: defensive bonus all round.'),
        'contest': ('Salir al encuentro', 'Push out', 'Los roamers buscan contacto con una emboscada.', 'Roamers seek contact with an ambush.'),
        'hunt': ('Cazar drones', 'Hunt drones', 'Destruyes drones activos: el atacante pierde informacion.', 'You destroy active drones: the attacker loses information.')}),
    ('entry', 'att', 'route'): ('Ruta de entrada', 'Entry route', {
        'ground': ('Planta baja', 'Ground floor', 'Entrada por puertas y ventanas del perimetro.', 'Entry through perimeter doors and windows.'),
        'roof': ('Tejado / rapel', 'Roof / rappel', 'Rapel desde el tejado: ideal para sitios en plantas altas.', 'Rappel from the roof: ideal for upper-floor sites.'),
        'basement': ('Sotano / tunel', 'Basement / tunnel', 'Acceso por sotano o tuneles: ideal para sitios en el sotano.', 'Access through the basement or tunnels: ideal for basement sites.')}),
    ('entry', 'att', 'method'): ('Metodo de entrada', 'Entry method', {
        'hard': ('Hard breach', 'Hard breach', 'Abres paredes reforzadas con tus breachers. Los anti-breach pueden frenarte.', 'Open reinforced walls with your breachers. Anti-breach can stop you.'),
        'soft': ('Entrada blanda', 'Soft entry', 'Paredes blandas y juego vertical. Los refuerzos del sitio la frenan.', 'Soft walls and vertical play. Site reinforcements slow it.'),
        'flash': ('Flash / humo', 'Flash / smoke', 'Entras por la puerta con utilidad. Las entradas reforzadas la frenan.', 'Enter through the door with utility. Reinforced entries slow it.')}),
    ('entry', 'def', 'watch'): ('Vigilar ruta', 'Watch route', {
        'none': ('Sin pista', 'No read', 'No te comprometes con ninguna ruta.', 'You commit to no route.'),
        'ground': ('Planta baja', 'Ground floor', 'Apuestas a que entran por planta baja.', 'You bet they come through the ground floor.'),
        'roof': ('Tejado', 'Roof', 'Apuestas a que entran por el tejado.', 'You bet they come from the roof.'),
        'basement': ('Sotano', 'Basement', 'Apuestas a que entran por el sotano.', 'You bet they come from the basement.')}),
    ('entry', 'def', 'stance'): ('Postura', 'Stance', {
        'hold': ('Aguantar', 'Hold', 'Posiciones seguras dentro del sitio.', 'Safe positions inside the site.'),
        'crossfire': ('Crossfire', 'Crossfire', 'Cubres las entradas con fuego cruzado agresivo.', 'Cover the entries with aggressive crossfire.'),
        'fallback': ('Replegarse', 'Fall back', 'Cedes la entrada y te replegas: pierdes tiempo pero evitas trades.', 'Give up the entry and fall back: costs time but avoids trades.')}),
    ('site', 'att', 'style'): ('Estilo de ejecucion', 'Execution style', {
        'methodical': ('Metodico', 'Methodical', 'Utilidad primero y limpiar angulo a angulo. Lento pero seguro.', 'Utility first, clearing angle by angle. Slow but safe.'),
        'aggressive': ('Agresivo', 'Aggressive', 'Entras rapido para frags. Mas rapido, mas trades.', 'Enter fast for frags. Faster, more trades.'),
        'split': ('Dividir', 'Split', 'Dos frentes con flanqueo. Necesita al menos 3 vivos.', 'Two fronts with a flank. Needs at least 3 alive.')}),
    ('site', 'def', 'stance'): ('Postura', 'Stance', {
        'hold': ('Aguantar', 'Hold', 'Angulos seguros. Menos trades.', 'Safe angles. Fewer trades.'),
        'peek': ('Pelear angulos', 'Peek', 'Peeks agresivos para ganar duelos. Mas trades.', 'Aggressive peeks to win duels. More trades.'),
        'bait': ('Ceder y replegarse', 'Bait', 'Cedes espacio para ganar tiempo.', 'Give ground to buy time.')}),
    ('plant', 'att', 'action'): ('Accion', 'Action', {
        'plant': ('Plantar ya', 'Plant now', 'Intentas plantar inmediatamente.', 'Try to plant immediately.'),
        'clear': ('Limpiar antes', 'Clear first', 'Una oleada extra de limpieza antes de plantar.', 'One extra clearing wave before planting.')}),
    ('plant', 'def', 'stance'): ('Postura', 'Stance', {
        'deny': ('Cortar la plantada', 'Deny the plant', 'Todo al planter: gran ventaja si lo pillas.', 'All-in on the planter: big edge if you catch it.'),
        'bait': ('Dejar plantar', 'Let them plant', 'No arriesgas: preparas el retake y la desactivacion.', 'No risk: you prepare the retake and defuse.')}),
    ('post', 'att', 'stance'): ('Postura', 'Stance', {
        'hold': ('Mantener angulos', 'Hold angles', 'Cubres el desactivador con utilidad.', 'Cover the defuser with utility.'),
        'spread': ('Repartirse', 'Spread', 'Cubres todos los accesos.', 'Cover all accesses.'),
        'flank': ('Flanquear el retake', 'Flank the retake', 'Sales a por los defensores por la espalda.', 'Go after defenders from behind.')}),
    ('post', 'def', 'stance'): ('Postura', 'Stance', {
        'retake': ('Retake agresivo', 'Aggressive retake', 'Todos al sitio ya: mas duelos, mas trades.', 'Everyone to the site now: more duels, more trades.'),
        'wait': ('Esperar la ventana', 'Wait for the window', 'Esperas el momento de desactivar con menos riesgo.', 'Wait for a safer defuse window.'),
        'fake': ('Fintar la desactivacion', 'Fake the defuse', 'Finta para sacar a los atacantes de posicion.', 'Fake it to pull attackers out of position.')}),
}
for (ph, sd, grp), (ge, gn, opts) in D.items():
    add(f'dec.group.{ph}.{sd}.{grp}', ge, gn)
    for o, (es, en, de, dn) in opts.items():
        add(f'dec.{ph}.{sd}.{grp}.{o}', es, en); add(f'dec.{ph}.{sd}.{grp}.{o}.desc', de, dn)

for k, es, en in [
    ('stage.ban.title', 'Fase de bans', 'Ban phase'),
    ('stage.ban.sub', 'Veta un operador rival ({n}/{max} vetos en esta mitad). Los vetos se acumulan hasta cambiar de bando.', 'Ban a rival operator ({n}/{max} bans this half). Bans accumulate until the sides swap.'),
    ('stage.ban.active', 'Tus vetos activos', 'Your active bans'), ('stage.ban.confirm', 'Confirmar veto', 'Confirm ban'), ('stage.ban.skip', 'No vetar', 'No ban'),
    ('stage.pick.title', 'Elige tu equipo', 'Pick your squad'), ('stage.pick.sub', 'Elige 5 operadores de {n} disponibles.', 'Pick 5 operators out of {n} available.'),
    ('stage.pick.subPool', 'Elige 5 de tu pool aleatorio de {n}.', 'Pick 5 from your random pool of {n}.'),
    ('stage.pick.confirm', 'Confirmar equipo', 'Confirm squad'), ('stage.pick.need', 'Elige {n} mas', 'Pick {n} more'), ('stage.pick.search', 'Buscar operador...', 'Search operator...'),
    ('stage.planDef.title', 'Plan de defensa', 'Defence plan'),
    ('stage.planDef.sub', 'Elige el sitio de bomba, reparte los refuerzos y asigna un rol a cada operador. El rival no ve nada de esto, salvo lo que descubran sus drones.', 'Choose the bomb site, spread reinforcements and assign each operator a role. The rival sees none of this except what their drones discover.'),
    ('stage.planDef.site', 'Sitio de bomba', 'Bomb site'), ('stage.planDef.reinf', 'Refuerzos (quedan {left} de {pool})', 'Reinforcements ({left} of {pool} left)'),
    ('stage.planDef.roles', 'Roles', 'Roles'), ('stage.planDef.confirm', 'Confirmar plan', 'Confirm plan'),
    ('stage.planAtt.title', 'Plan de ataque', 'Attack plan'),
    ('stage.planAtt.sub', 'Elige spawn, el orden de los drones y los roles. Despues del droneo podras cambiar de spawn.', 'Choose a spawn, the drone order and roles. After the drone phase you can change spawn.'),
    ('stage.planAtt.spawn', 'Spawn', 'Spawn'),
    ('stage.planAtt.drone', 'Droneo: elige el orden de sitios a explorar (hasta ~{n} barridos)', 'Drone sweep: choose the order of sites to scout (up to ~{n} sweeps)'),
    ('stage.planAtt.droneHelp', 'Los defensores pueden destruir tus drones y bloquearlos; un barrido fallido no revela nada.', 'Defenders can destroy and block your drones; a failed sweep reveals nothing.'),
    ('stage.planAtt.roles', 'Roles', 'Roles'), ('stage.planAtt.confirm', 'Lanzar drones', 'Launch drones'),
    ('stage.prep.title', 'Fase de preparacion', 'Preparation phase'), ('stage.prep.sub', 'Los drones exploran el edificio...', 'Drones are scouting the building...'),
    ('stage.adjust.title', 'Tras el droneo', 'After the drone phase'),
    ('stage.adjust.sub', 'Con lo que has descubierto, puedes cambiar de spawn y de roles antes de que se bloqueen.', 'With what you found out, you can change spawn and roles before they lock.'),
    ('stage.adjust.intel', 'Informacion obtenida', 'Intel gathered'), ('stage.adjust.spawn', 'Spawn definitivo', 'Final spawn'), ('stage.adjust.roles', 'Roles', 'Roles'),
    ('stage.adjust.confirm', 'Bloquear y empezar', 'Lock in and start'),
    ('stage.adjust.found', 'Sitio localizado: {site} ({by}).', 'Site located: {site} ({by}).'),
    ('stage.adjust.notFound', 'No has localizado el sitio: tendras que adivinar la ruta.', 'You did not locate the site: you will have to guess the route.'),
    ('stage.adjust.defSeen', 'Defensores vistos cerca del sitio: {n}.', 'Defenders seen near the site: {n}.'),
    ('stage.adjust.reinfSeen', 'Refuerzos en las paredes del sitio: {n}.', 'Reinforcements on the site walls: {n}.'),
    ('stage.phase.confirm', 'Confirmar decision', 'Confirm decision'), ('stage.phase.clock', 'Reloj de accion: {t} / {max}', 'Action clock: {t} / {max}'),
    ('stage.phase.mapTitle', 'Edificio · {map}', 'Building · {map}'),
    ('stage.phase.fit.good', 'Buen encaje', 'Good fit'), ('stage.phase.fit.mid', 'Encaje neutro', 'Neutral fit'), ('stage.phase.fit.bad', 'Mal encaje', 'Poor fit'),
    ('stage.phase.fit.unknown', 'Encaje desconocido (sin sitio)', 'Fit unknown (site not found)'),
    ('stage.phase.intelFound', 'Sitio localizado: {site}', 'Site located: {site}'), ('stage.phase.intelNone', 'Sitio sin localizar', 'Site not located'),
    ('stage.phase.planted', '· Bomba plantada', '· Defuser planted'),
    ('stage.phase.defCtx', 'Drones detectados esta ronda: {n}', 'Drones detected this round: {n}'),
]:
    add(k, es, en)

for k, es, en in [('kill', 'Baja', 'Kill'), ('prep', 'Preparacion', 'Prep'), ('early', 'Mapa', 'Map'), ('entry', 'Entrada', 'Entry'), ('site', 'Sitio', 'Site'), ('plant', 'Plantada', 'Plant'), ('post', 'Post-plant', 'Post'), ('end', 'Fin', 'End'), ('adjust', 'Ajuste', 'Adjust')]:
    add(f'evtype.{k}', es, en)
EV = [
    ('ev.kill.roamTracked', '{killer} rastrea y elimina a {victim}, que jugaba de roamer.', '{killer} tracks down and eliminates roamer {victim}.'),
    ('ev.kill.roamAtt', '{killer} caza a {victim} fuera del sitio.', '{killer} catches {victim} off-site.'),
    ('ev.kill.roamAmbush', '{killer} embosca a {victim} antes de la entrada.', '{killer} ambushes {victim} before the entry.'),
    ('ev.kill.entry', '{killer} elimina a {victim} en la entrada.', '{killer} eliminates {victim} at the entry.'),
    ('ev.kill.site', '{killer} elimina a {victim} en el sitio.', '{killer} eliminates {victim} on the site.'),
    ('ev.kill.post', '{killer} elimina a {victim} durante el post-plant.', '{killer} eliminates {victim} during post-plant.'),
    ('ev.kill.plantCut', '{killer} corta la plantada y elimina a {victim}.', '{killer} cuts the plant and eliminates {victim}.'),
    ('ev.kill.defuseCut', '{killer} interrumpe la desactivacion de {victim}.', "{killer} interrupts {victim}'s defuse."),
    ('ev.kill.trade', '{killer} y {victim} se eliminan mutuamente.', '{killer} and {victim} eliminate each other.'),
    ('ev.prep.scoutOk', 'Dron explora {site} sin problemas.', 'Drone scouts {site} safely.'),
    ('ev.prep.scoutLost', 'El dron que exploraba {site} es destruido o bloqueado.', 'The drone scouting {site} is destroyed or blocked.'),
    ('ev.prep.droneSpotted', 'Dron enemigo detectado cerca de {site}.', 'Enemy drone spotted near {site}.'),
    ('ev.prep.droneKilled', 'Has destruido un dron cerca de {site}.', 'You destroyed a drone near {site}.'),
    ('ev.prep.found', 'Sitio localizado: {site} ({by}).', 'Site located: {site} ({by}).'),
    ('ev.prep.notFound', 'El droneo no ha localizado el sitio.', 'The drone sweep did not locate the site.'),
    ('ev.adjust.spawn', 'Cambias el spawn a {spawn}.', 'You change spawn to {spawn}.'),
    ('ev.early.start', 'Fase de mapa: {approach} vs {stance}.', 'Map phase: {approach} vs {stance}.'),
    ('ev.early.noContact', '{who} no encuentra a nadie y se queda fuera de posicion.', '{who} finds nobody and ends up out of position.'),
    ('ev.entry.start', 'Entrada por {route} ({method}); defensores: {stance}.', 'Entry via {route} ({method}); defenders: {stance}.'),
    ('ev.entry.noBreacher', 'Sin breacher vivo: los atacantes pierden mucho tiempo y angulos.', 'No breacher alive: attackers lose a lot of time and angles.'),
    ('ev.entry.breachKilled', 'El refuerzo falla: {killer} protege la pared y elimina a {victim}.', 'The reinforcement holds: {killer} protects the wall and eliminates {victim}.'),
    ('ev.entry.breachDenied', '{who} intenta abrir pero los anti-breach lo frenan.', '{who} tries to breach but anti-breach stops them.'),
    ('ev.entry.breachOk', '{who} abre una pared reforzada.', '{who} opens a reinforced wall.'),
    ('ev.entry.softOk', 'Entrada blanda: {n} angulos nuevos.', 'Soft entry: {n} new angles.'),
    ('ev.entry.flash', 'Entrada con flash y humo.', 'Flash and smoke entry.'),
    ('ev.site.start', 'Ejecucion del sitio: {style} vs {stance}.', 'Site execution: {style} vs {stance}.'),
    ('ev.plant.ok', '{who} planta el desactivador ({a}v{d}).', '{who} plants the defuser ({a}v{d}).'),
    ('ev.plant.fail', 'El intento de plantada de {who} fracasa.', "{who}'s plant attempt fails."),
    ('ev.post.defuse', '{who} desactiva la bomba.', '{who} defuses the bomb.'),
    ('ev.post.explode', 'La bomba explota.', 'The bomb explodes.'),
    ('ev.end', 'Fin de la ronda: {reason}.', 'Round over: {reason}.'),
]
for k, es, en in EV:
    add(k, es, en)

for k, es, en in [
    ('route.ground', 'planta baja', 'ground floor'), ('route.roof', 'tejado', 'roof'), ('route.basement', 'sotano', 'basement'),
    ('method.hard', 'hard breach', 'hard breach'), ('method.soft', 'entrada blanda', 'soft entry'), ('method.flash', 'flash/humo', 'flash/smoke'),
    ('approach.standard', 'estandar', 'standard'), ('approach.rush', 'rush', 'rush'), ('approach.flank', 'cazar roamers', 'hunt roamers'),
    ('stance.hold', 'aguantar', 'hold'), ('stance.contest', 'salir al encuentro', 'push out'), ('stance.hunt', 'cazar drones', 'hunt drones'),
    ('stance.crossfire', 'crossfire', 'crossfire'), ('stance.fallback', 'replegarse', 'fall back'), ('stance.peek', 'pelear angulos', 'peek'), ('stance.bait', 'ceder', 'bait'),
    ('stance.deny', 'cortar la plantada', 'deny the plant'), ('stance.retake', 'retake agresivo', 'aggressive retake'), ('stance.wait', 'esperar la ventana', 'wait for the window'), ('stance.fake', 'fintar', 'fake'),
    ('style.methodical', 'metodico', 'methodical'), ('style.aggressive', 'agresivo', 'aggressive'), ('style.split', 'dividir', 'split'),
    ('foundBy.drone', 'por dron', 'by drone'), ('foundBy.elimination', 'por descarte', 'by elimination'),
    ('side.att', 'Atacantes', 'Attackers'), ('side.def', 'Defensores', 'Defenders'),
    ('reason.defElim', 'defensores eliminados', 'defenders eliminated'),
    ('reason.defElimPlanted', 'defensores eliminados con la bomba plantada', 'defenders eliminated with the bomb planted'),
    ('reason.attElim', 'atacantes eliminados', 'attackers eliminated'),
    ('reason.defuseNoAtt', 'sin atacantes vivos: desactivacion garantizada', 'no attackers alive: defuse guaranteed'),
    ('reason.mutual', 'eliminacion mutua sin plantar', 'mutual elimination without a plant'),
    ('reason.plantedMutual', 'eliminacion mutua con la bomba plantada', 'mutual elimination with the bomb planted'),
    ('reason.timeout', 'se agota el tiempo sin plantar', 'time runs out without a plant'),
    ('reason.defuse', 'bomba desactivada', 'bomb defused'), ('reason.explode', 'la bomba explota', 'the bomb explodes'),
]:
    add(f'enum.{k}', es, en)
for k in ['defElim', 'defElimPlanted', 'attElim', 'defuseNoAtt', 'mutual', 'plantedMutual', 'timeout', 'defuse', 'explode']:
    add(f'reason.{k}', ES[f'enum.reason.{k}'], EN[f'enum.reason.{k}'])
add('result.att', 'Los atacantes ganan', 'Attackers win')
add('result.def', 'Los defensores ganan', 'Defenders win')

for k, es, en in [
    ('why.info.att', 'Ventaja de informacion para los atacantes ({v}): el droneo y el intel superaron el bloqueo defensivo.', 'Information edge for attackers ({v}): drones and intel beat the defensive blocking.'),
    ('why.info.def', 'Ventaja de informacion para los defensores ({v}): el bloqueo de drones y la info defensiva pesaron mas.', 'Information edge for defenders ({v}): drone blocking and defensive intel outweighed the attackers.'),
    ('why.notFound', 'Los atacantes no localizaron el sitio en el droneo y tuvieron que adivinar la ruta.', 'Attackers did not locate the site during the drone phase and had to guess the route.'),
    ('why.found', 'Los atacantes localizaron el sitio en la preparacion.', 'Attackers located the site during preparation.'),
    ('why.noHB', 'Los atacantes no tenian hard-breach vivo o disponible: sin aperturas, menos angulos y mucho tiempo perdido.', 'Attackers had no hard breach alive or available: no openings, fewer angles and lots of lost time.'),
    ('why.hbDenied', '{n} intento(s) de breach frenado(s) por los refuerzos y la proteccion anti-breach.', '{n} breach attempt(s) stopped by reinforcements and anti-breach protection.'),
    ('why.openings', 'Los atacantes abrieron varios angulos sin oposicion.', 'Attackers opened several angles unopposed.'),
    ('why.roam', 'Fase de roam: {k} baja(s) defensivas frente a {l} roamer(s) perdidos.', 'Roam phase: {k} defender kill(s) against {l} roamer(s) lost.'),
    ('why.anticipated', 'Los defensores anticiparon la ruta de entrada y recibieron a los atacantes en crossfire.', 'Defenders anticipated the entry route and caught the attackers in a crossfire.'),
    ('why.routeGood', 'La ruta de entrada encajaba bien con la planta del sitio.', 'The entry route suited the site floor well.'),
    ('why.routeBad', 'La ruta de entrada encajaba mal con la planta del sitio.', 'The entry route suited the site floor poorly.'),
    ('why.respawn', 'Los atacantes cambiaron de spawn tras el droneo para encajar con el sitio.', 'Attackers changed spawn after the drone phase to fit the site.'),
    ('why.plantCut', 'Los defensores cortaron {n} intento(s) de plantada.', 'Defenders cut {n} plant attempt(s).'),
    ('why.timeout', 'Se agoto el tiempo antes de plantar.', 'Time ran out before planting.'),
    ('why.planted', 'Plantada conseguida.', 'Defuser planted.'),
    ('why.defused', 'Los defensores desactivaron la bomba a tiempo.', 'Defenders defused the bomb in time.'),
    ('why.mvp', '{op} domino la ronda con {n} bajas.', '{op} dominated the round with {n} kills.'),
    ('why.survivors', 'Supervivientes: {a} atacantes, {d} defensores ({reason}).', 'Survivors: {a} attackers, {d} defenders ({reason}).'),
]:
    add(k, es, en)
