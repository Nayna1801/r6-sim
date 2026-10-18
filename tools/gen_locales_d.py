# Autoria de locales (parte D): acciones de agente (config/actions.json), sus eventos y su panel. Usa add() de la parte A.
# Cada accion de la configuracion debe tener texto aqui: si falta, la generacion falla (nada de claves a medias).
import json, os
from gen_locales_a import add

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
actions = json.load(open(os.path.join(ROOT, 'tools', 'research', 'action_specs.json'), encoding='utf-8'))['custom']   # el resto lo genera gen_locales_e.py

# id de accion -> name (es, en) · desc (es, en) · counters (es, en: contrarrestos REALES del juego segun r6data) · opts {opcion: (nombre_es, nombre_en, desc_es, desc_en)}
TEXT = {
    'caveira.silent_step': {
        'name': ('Silent Step', 'Silent Step'),
        'desc': ('Muévete en silencio por el mapa exterior para sorprender a un atacante: lo derribas y decides si lo rematas o lo interrogas.', 'Move silently through the outer map to ambush an attacker: you down them and decide whether to finish them or interrogate them.'),
        'counters': ('Contrarrestada en el juego por: Jackal, Lion, Dokkaebi, Deimos, Gridlock, Nomad.', 'Countered in the game by: Jackal, Lion, Dokkaebi, Deimos, Gridlock, Nomad.'),
        'opts': {
            'hunt_finish': ('Cazar y rematar', 'Hunt and finish', 'Emboscada con bonus de puntería; si derribas, rematas al instante.', 'Ambush with an aim bonus; if you down someone you finish them at once.'),
            'hunt_interrogate': ('Cazar e interrogar', 'Hunt and interrogate', 'Si derribas, interrogas 5 s: si nadie te sorprende, revelas a todo el equipo atacante; si te sorprenden, mueres.', 'If you down someone you interrogate for 5 s: if nobody catches you the whole attacking team is revealed; if they do, you die.'),
        },
    },
    'jackal.eyenox': {
        'name': ('Eyenox', 'Eyenox'),
        'desc': ('Rastrea las huellas de los defensores para marcar a uno, con preferencia por los roamers.', "Tracks defenders' footprints to mark one, preferring roamers."),
        'counters': ('Contrarrestado en el juego por: Mute (su inhibidor lo anula) y Caveira (paso silencioso).', "Countered in the game by: Mute (the jammer disables it) and Caveira (Silent Step)."),
        'opts': {'track': ('Rastrear huellas', 'Track footprints', 'Marca a un defensor esta fase y la siguiente; un roamer marcado pierde el factor sorpresa.', 'Marks a defender this phase and the next; a marked roamer loses the element of surprise.')},
    },
    'mute.signal_disruptor': {
        'name': ('Signal Disruptor', 'Signal Disruptor'),
        'desc': ('Inhibidores que anulan drones, cargas remotas, curas y rastreo del rival durante toda la ronda.', "Jammers that disable the enemy's drones, remote charges, healing and tracking for the whole round."),
        'counters': ('Contrarrestado en el juego por: Thatcher y los EMP de impacto, y el láser de Twitch.', "Countered in the game by: Thatcher and impact EMPs, and Twitch's lasers."),
        'opts': {'jam': ('Colocar inhibidores', 'Place jammers', 'Refuerza la defensa del breach y frena cargas, curas y rastreo del rival toda la ronda.', "Strengthens the defence against breaching and slows the enemy's charges, healing and tracking all round.")},
    },
    'bandit.shock_wire': {
        'name': ('Shock Wire', 'Shock Wire'),
        'desc': ('Electrifica refuerzos, alambre y escudos: lo electrónico que los toque se destruye.', 'Electrifies reinforcements, barbed wire and shields: electronics that touch them are destroyed.'),
        'counters': ('Contrarrestado en el juego por: Thatcher y los EMP de impacto, e IQ (lo detecta).', 'Countered in the game by: Thatcher and impact EMPs, and IQ (detects it).'),
        'opts': {'electrify': ('Electrificar refuerzos', 'Electrify reinforcements', 'Gran protección contra el breach duro; una carga exotérmica se destruye al tocar la pared.', 'Strong protection against hard breaching; an exothermic charge is destroyed on touching the wall.')},
    },
    'pulse.heartbeat_sensor': {
        'name': ('Heartbeat Sensor', 'Heartbeat Sensor'),
        'desc': ('Detecta a los atacantes por su latido a través de las paredes.', 'Detects attackers by their heartbeat through walls.'),
        'counters': ('Contrarrestado en el juego por: Thatcher y los EMP de impacto, e IQ (lo localiza al escanear).', 'Countered in the game by: Thatcher and impact EMPs, and IQ (locates it while scanning).'),
        'opts': {'scan': ('Escanear', 'Scan', 'Revelas a 2 atacantes esta fase; los conocidos pierden ventaja en los duelos. El Adrenal Surge amplía el alcance.', 'Reveals 2 attackers this phase; known attackers lose their edge in duels. Adrenal Surge extends the range.')},
    },
    'thermite.exothermic_charge': {
        'name': ('Exothermic Charge', 'Exothermic Charge'),
        'desc': ('Carga que abre refuerzos en tres segundos.', 'A charge that breaks through reinforcements in three seconds.'),
        'counters': ('Contrarrestada en el juego por: Mute, Bandit y Kaid (pared electrificada), Maestro y las granadas de impacto.', 'Countered in the game by: Mute, Bandit and Kaid (electrified wall), Maestro and impact grenades.'),
        'opts': {'exo': ('Plantar la carga', 'Plant the charge', 'Mejora mucho el breach duro de esta fase; los gadgets de Mute o Bandit pueden neutralizarla.', "Greatly improves this phase's hard breach; Mute's or Bandit's gadgets can neutralise it.")},
    },
    'finka.adrenal_surge': {
        'name': ('Adrenal Surge', 'Adrenal Surge'),
        'desc': ('Refuerzo de salud y combate para todo el equipo atacante; reanima a un derribado (tambien a si misma).', 'A health and combat boost for the whole attacking team; revives a downed teammate or itself.'),
        'counters': ('Contrarrestada en el juego por: Mute (no se activa dentro del alcance de su inhibidor).', "Countered in the game by: Mute (it can't be activated within the jammer's range)."),
        'opts': {'surge': ('Activar la oleada', 'Trigger the surge', 'Más puntería propia y menos eficacia del rival; reanima a un derribado. Un inhibidor de Mute la frena.', "Better own aim and weaker enemy aim; revives a downed teammate. Mute's jammer slows it.")},
    },
}

assert set(TEXT) == set(actions), f'acciones sin texto o texto huerfano: {set(TEXT) ^ set(actions)}'
for aid, a in actions.items():
    t = TEXT[aid]
    add(f'action.{aid}', *t['name']); add(f'action.{aid}.desc', *t['desc']); add(f'action.{aid}.counters', *t['counters'])
    non_off = [o for o in a['options'] if o != 'off']
    assert set(t['opts']) == set(non_off), f'{aid}: opciones sin texto: {set(t["opts"]) ^ set(non_off)}'
    for o, (nes, nen, des, den) in t['opts'].items():
        add(f'action.{aid}.opt.{o}', nes, nen); add(f'action.{aid}.opt.{o}.desc', des, den)

for k, es, en in (
    # panel
    ('ui.actions', 'Acciones de agente', 'Agent actions'),
    ('ui.actionsMax', 'máx. {n} a la vez', 'max {n} at once'),
    ('ui.actionUses', 'usos: {n}', 'uses: {n}'),
    ('ui.actionOff', 'No actuar', 'Do nothing'),
    ('ui.actionDetails', 'Detalles', 'Details'),
    ('ui.actionWhen', 'Solo se usa si eliges: {what}', 'Only used if you choose: {what}'),
    ('ui.actionPersist', 'Se queda colocado toda la ronda', 'Stays in place for the whole round'),
    ('ui.located', 'Localizado', 'Located'),
    ('ui.downed', 'DERRIBADO', 'DOWN'),
    ('ui.revived', 'REANIMADO', 'REVIVED'),
    ('ui.revealedBanner', 'UBICACIÓN REVELADA', 'LOCATION REVEALED'),
    ('mod.carry.aHBMul.up', 'Refuerza anti-breach', 'Boosts anti-breach'),
    ('ui.fx.reveal', 'Localiza a {n}', 'Locates {n}'),
    ('ui.fx.revealAll', 'Localiza a todos', 'Locates everyone'),
    ('ui.fx.ambush', 'Emboscada +{v}', 'Ambush +{v}'),
    ('ui.fx.down', 'Derriba', 'Downs'),
    ('ui.fx.exposure', 'Riesgo de exposición ≈ {p}%', 'Exposure risk ≈ {p}%'),
    ('ui.fx.breach', 'Breach +{v}', 'Breach +{v}'),
    ('ui.fx.revive', 'Reanima {n}', 'Revives {n}'),
    ('ui.fx.buff', '{stat} +{v}', '{stat} +{v}'),
    ('ui.fx.trapdown', 'Puede derribar (≈{p}%)', 'May down (≈{p}%)'),
    # eventos
    ('evtype.act', 'Acción', 'Action'),
    ('ev.act.used', '{who} activa «{action}» ({opt}).', '{who} activates "{action}" ({opt}).'),
    ('ev.act.reveal', '{who} localiza a {ops}.', '{who} locates {ops}.'),
    ('ev.act.down', '{killer} derriba a {victim}.', '{killer} downs {victim}.'),
    ('ev.act.interrogate.start', '{who} empieza a interrogar a {victim}.', '{who} starts interrogating {victim}.'),
    ('ev.act.interrogate.ok', 'Ubicación revelada por {who}: {ops}.', 'Location revealed by {who}: {ops}.'),
    ('ev.act.bleed', '{victim} se desangra.', '{victim} bleeds out.'),
    ('ev.act.revive', '{who} reanima a {victim}.', '{who} revives {victim}.'),
    ('ev.act.fizzle', '«{action}» de {who} queda neutralizada.', '{who}\'s "{action}" is neutralised.'),
    ('ev.kill.finish', '{killer} remata a {victim}.', '{killer} finishes off {victim}.'),
    ('ev.kill.reviveCut', '{killer} sorprende a {victim} mientras reanimaba.', '{killer} catches {victim} while reviving.'),
    ('ev.kill.interrogCut', '{killer} sorprende a {victim} mientras interrogaba.', '{killer} catches {victim} mid-interrogation.'),
):
    add(k, es, en)
