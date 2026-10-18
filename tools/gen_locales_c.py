# Autoria de locales (parte C): especialidades, gadgets, habilidades unicas y ficha de agente. Usa add() de la parte A.
# El texto ingles de habilidades y gadgets sale de los datos oficiales (tools/research); el espanol esta traducido aqui.
import json, os
from gen_locales_a import add

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda *p: json.load(open(os.path.join(ROOT, *p), encoding='utf-8'))

# ---- especialidades oficiales (id de r6data) ----
SPECS = {
    'intel': ('Intel', 'Intel', 'Obtiene información sobre la posición del rival.', 'Gathers information on enemy positions.'),
    'support': ('Apoyo', 'Support', 'Ayuda al equipo con curación, armadura o utilidad.', 'Helps the team with healing, armor or utility.'),
    'anti-gadget': ('Anti-gadget', 'Anti-gadget', 'Contrarresta los gadgets del rival.', 'Counters enemy gadgets.'),
    'map_control': ('Control de mapa', 'Map control', 'Controla espacio y líneas de visión.', 'Controls space and lines of sight.'),
    'front-line': ('Primera línea', 'Front line', 'Abre el avance y toma los primeros enfrentamientos.', 'Leads the push and takes the first fights.'),
    'anti-entry': ('Anti-entrada', 'Anti-entry', 'Impide que los atacantes entren al sitio.', 'Stops attackers from entering the site.'),
    'trapper': ('Trampero', 'Trapper', 'Retrasa y castiga al atacante con trampas.', 'Delays and punishes attackers with traps.'),
    'crowd_control': ('Control de masas', 'Crowd control', 'Ralentiza, aturde o desorienta a los rivales.', 'Slows, stuns or disorients opponents.'),
    'breach': ('Breach', 'Breach', 'Abre paredes, suelos y techos.', 'Opens walls, floors and ceilings.'),
}
for k, (es, en, des, den) in SPECS.items():
    add(f'spec.{k}', es, en); add(f'spec.{k}.desc', des, den)

# ---- gadgets secundarios ----
GADGET_ES = {
    'deployable_shield': ('Escudo desplegable', 'Escudo antibalas que se despliega en el suelo o en marcos de puertas para dar cobertura.'),
    'nitro_cell': ('Célula de nitro', 'C4 arrojadizo que se pega a las superficies y se detona manualmente con una gran explosión.'),
    'impact_grenade': ('Granada de impacto', 'Granada explosiva que detona al impactar para crear accesos o líneas de visión en superficies destructibles.'),
    'barbed_wire': ('Alambre de espino', 'Alambre sin daño que ralentiza a los rivales y hace ruido al cruzarlo.'),
    'bulletproof_camera': ('Cámara antibalas', 'Cámara que ve a través del humo y dispara pulsos EMP manualmente para desactivar dispositivos rivales.'),
    'proximity_alarm': ('Alarma de proximidad', 'Sensor que se pega a las superficies y suena cuando detecta rivales cerca.'),
    'observation_blocker': ('Bloqueador de observación', 'Proyecta una pantalla que bloquea la línea de visión de las herramientas de observación rivales.'),
    'frag_grenade': ('Granada de fragmentación', 'Granada explosiva que detona poco después de lanzarla.'),
    'smoke_grenade': ('Granada de humo', 'Granada sin daño que produce humo poco después de lanzarla para cubrir avances.'),
    'stun_grenade': ('Granada aturdidora', 'Granada sin daño que produce un destello poco después de lanzarla para desorientar a los rivales.'),
    'claymore': ('Claymore', 'Trampa explosiva que se coloca en el suelo; útil contra los defensores que hacen roam.'),
    'hard_breach_charge': ('Carga de brecha reforzada', 'Explosivo que detona automáticamente para crear accesos en superficies destructibles y reforzadas.'),
    'breach_charge': ('Carga de brecha', 'Explosivo que se coloca en superficies destructibles y se detona manualmente para crear un acceso.'),
    'impact_emp_grenade': ('Granada EMP de impacto', 'Granada de impacto sin daño que desactiva temporalmente los dispositivos electrónicos rivales cercanos.'),
}
gadgets = {g['id']: g for g in J('tools', 'research', 'gadgets_official.json')}
effects = J('config', 'gadgets.json')['effects']
assert set(GADGET_ES) == set(gadgets) == set(effects), set(gadgets) ^ set(GADGET_ES) ^ set(effects)
for gid, (es_name, es_desc) in GADGET_ES.items():
    add(f'gadget.{gid}', es_name, gadgets[gid]['name']); add(f'gadget.{gid}.desc', es_desc, gadgets[gid]['description'])

# ---- habilidades unicas (el nombre oficial no se traduce) ----
ABILITY_ES = {
    's_e_l_m_a_aqua_breacher': 'Carga de brecha arrojadiza que crea línea de visión o accesos en superficies destructibles y reforzadas.',
    'garra_hook': 'Pistola de garfio que permite trepar rápido a cornisas y ventanas a corta distancia.',
    'breaching_rounds': 'Lanzador de proyectiles explosivos que destruyen utilidad y crean accesos en superficies destructibles.',
    'rifle_shield': 'Escudo acoplado al arma principal que protege frontalmente de los disparos a la cabeza hasta romperse.',
    'flash_shield': 'Escudo balístico con un flash que puede activarse para cegar temporalmente a los operadores.',
    'kludge_drone': 'Dron desplegable que toma el control de dispositivos electrónicos o los destruye tras un breve retardo.',
    'skeleton_key': 'Escopeta acoplada al arma principal para crear accesos o líneas de visión en superficies destructibles.',
    'tactical_crossbow': 'Ballesta que dispara virotes incendiarios para controlar zonas y microgranadas de humo para cubrir avances.',
    'deathmark_tracker': 'Pequeña sonda que revela a un rival y a Deimos entre sí durante un tiempo limitado.',
    'logic_bomb': 'Llama a los teléfonos de los defensores para delatar su posición, interrumpir el uso de herramientas de observación y dejarlos expuestos al hackeo.',
    'adrenal_surge': 'Da a Finka y a su equipo un refuerzo de salud o una reanimación y mejora sus capacidades de combate.',
    'rce_ratero_charge': 'Carga teledirigida que se ancla a una superficie, se vuelve a prueba de balas y luego detona.',
    'cluster_charge': 'Carga que se coloca en superficies destructibles y reforzadas para herir a los rivales y limpiar dispositivos al otro lado.',
    'flip_sight': 'Mira con aumento acoplada al arma principal que resalta a los rivales y permite ver a través del humo.',
    'trax_stingers': 'Dispositivo que despliega alfombrillas de púas para ralentizar y herir a quienes las pisan.',
    'kawan_hive_launcher': 'Lanzador que dispara un bote y libera un enjambre de robots que revela a los rivales que lo atraviesan durante un tiempo limitado.',
    'x_kairos': 'Dispara perdigones que se detonan manualmente para crear línea de visión o accesos en superficies destructibles y reforzadas.',
    'gemini_replicator': 'Despliega un holograma teledirigido de Iana para engañar a los rivales y obtener información.',
    'electronics_detector': 'Dispositivo portátil que localiza aparatos electrónicos cercanos a través de objetos y superficies.',
    'eyenox_model_iii': 'Casco que se puede activar para revelar las huellas de los rivales y escanearlas para marcar su posición.',
    'lv_explosive_lance': 'Proyectil bajo el cañón del arma principal que detona para destruir dispositivos a ambos lados de superficies destructibles y reforzadas.',
    'ee_one_d': 'Dron que sobrevuela el mapa y lo escanea en busca de movimiento para revelar la posición de los rivales.',
    'breaching_torch': 'Soplete que quema agujeros en silencio para crear línea de visión o accesos en superficies destructibles y reforzadas.',
    'extendable_shield': 'Escudo extensible que da protección frontal completa para obtener información y cubrir a los compañeros.',
    'airjab_launcher': 'Accesorio del arma principal que dispara un dispositivo que detona y derriba a los operadores.',
    'hel_presence_reduction': 'Borra la imagen de Nøkk de los drones y herramientas de observación cercanos y amortigua el sonido de sus pasos.',
    'talon_8_clear_shield': 'Escudo transparente a prueba de balas que se puede llevar o desplegar en el suelo y en los accesos.',
    'bu_gi_auto_breacher': 'Minitanque desplegable que avanza por una ruta fijada destruyendo dispositivos y superficies destructibles a su paso.',
    'dom_panel_launcher': 'Despliega paneles a prueba de balas a distancia; se abren o cierran con un disparador en la parte superior de la puerta.',
    'r_o_u_projector_system': 'Dispositivo arrojadizo que rueda y suelta proyectores para crear una pantalla que bloquea la línea de visión.',
    'tactical_breaching_hammer': 'Martillo que crea accesos o líneas de visión en superficies destructibles y destruye dispositivos a prueba de balas.',
    'emp_grenade': 'Granada sin daño que desactiva temporalmente los dispositivos electrónicos rivales cercanos.',
    'exothermic_charge': 'Explosivo de detonación manual que crea grandes accesos en superficies destructibles y reforzadas.',
    'shock_drones': 'Dron que dispara láseres manualmente para limpiar de dispositivos rivales las habitaciones.',
    'candela': 'Dispositivo que despliega un racimo de cargas de destello para cegar temporalmente a los operadores.',
    'argus_launcher': 'Lanzador que despliega cámaras capaces de atravesar superficies destructibles y reforzadas para vigilar ambos lados.',
    'ks79_lifeline': 'Lanzador que dispara dos tipos de granadas para desorientar a los rivales o crear accesos en superficies destructibles.',
    'prisma': 'Despliega hologramas de Alibi que revelan la posición de un rival cuando le disparan o interactúa con ellos.',
    'surya_gate': 'Puerta láser que impide el paso y la información: hiere a los rivales y destruye los dispositivos que la atraviesan.',
    'kiba_barrier': 'Dispositivo arrojadizo que se pega a las superficies y crea una barrera a prueba de balas que bloquea accesos y línea de visión.',
    'shock_wire': 'Dispositivo eléctrico que se despliega en el suelo para electrificar la utilidad metálica cercana.',
    'armor_panel': 'Barricadas a prueba de balas que se despliegan en ventanas y puertas para negar la entrada a los rivales.',
    'silent_step': 'Muévete en silencio para acercarte a los rivales y derribarlos; luego interrógalos para revelar la posición de sus compañeros.',
    'cce_shield': 'Escudo eléctrico extensible que frena las embestidas ralentizando y hiriendo poco a poco a los rivales.',
    'trip_connector': 'Si dos dispositivos se colocan en línea de visión se forma un láser entre ellos. Los enemigos que lo cruzan quedan ralentizados y heridos; más dispositivos crean una red láser mayor que niega una habitación.',
    'stim_pistol': 'Dispara un tiro que da a Doc y a su equipo un refuerzo de salud o una reanimación a distancia.',
    'yokai': 'Dron que puede flotar en el techo y dispara ráfagas sónicas manualmente para aturdir a los rivales e interrumpir sus acciones.',
    'grzmot_mine': 'Mina de conmoción que se pega a las superficies y detona al detectar rivales cerca para desorientarlos.',
    'f_natt_dread_mine': 'Dispositivo arrojadizo que se pega a las superficies y libera un gas que provoca miedo al detectar rivales cerca.',
    'welcome_mat': 'Trampa de suelo que derriba al instante a los rivales y les impide moverse.',
    'volcan_shield': 'Bomba incendiaria en una carcasa parcialmente a prueba de balas que crea fuego al destruirse.',
    'active_defense_system': 'Dispositivo desplegable que intercepta y destruye proyectiles antes de que detonen.',
    'rtila_electroclaw': 'Dispositivo eléctrico que se pega a las superficies y electrifica la utilidad metálica cercana.',
    'entry_denial_device': 'Trampa explosiva que se coloca en marcos de puertas y ventanas.',
    'gu_mines': 'Minas tóxicas que inyectan un compuesto, hiriendo a los rivales y limitando su velocidad.',
    'evil_eye': 'Cámara a prueba de balas con una torreta que dispara láseres manualmente para herir a los rivales o destruir dispositivos.',
    'banshee_sonic_defense': 'Dispositivo a prueba de balas que se activa cuando hay rivales cerca y usa el sonido para ralentizarlos.',
    'black_mirror': 'Dispositivo que se coloca en paredes destructibles o reforzadas para crear una ventana unidireccional a prueba de balas.',
    'pest_launcher': 'Lanza robots que se enganchan automáticamente a los drones rivales a su alcance para tomar su control.',
    'signal_disruptor': 'Inhibidor de señal que desactiva los dispositivos electrónicos rivales a su alcance.',
    'horus_lance_launcher': 'Dispara 5 proyectiles que atraviesan escudos y superficies destructibles antes de estallar en llamas. Pueden pasar por suelos, techos y habitaciones contiguas.',
    'remah_dash': 'Embestida que crea accesos en paredes destructibles, derriba a los rivales y permite moverse más rápido.',
    'heartbeat_sensor': 'Detecta los latidos de los rivales cercanos a través de objetos y superficies.',
    'armor_pack': 'Paquete de placas de armadura que da vida extra a los compañeros y los protege una vez de ser eliminados.',
    'v10_pantheon_shells': 'Controla dos carcasas enlazadas: una que maneja directamente y otra que actúa como herramienta de observación blindada. Puede alternar entre ellas pero solo maneja una a la vez; perder cualquiera corta la conexión con ambas.',
    'remote_gas_grenade': 'Bote arrojadizo que se pega a las superficies y se detona manualmente para liberar una nube de gas tóxico.',
    'spec_io_electro_sensor': 'Dispositivo que identifica los dispositivos electrónicos rivales y los escanea para marcar su posición.',
    'shumikha_launcher': 'Lanza granadas incendiarias que crean fuego al detonar.',
    'razorbloom_shell': 'Dispositivo arrojadizo que se pega a las superficies y lanza un conjunto de cuchillas afiladas al detectar rivales cerca.',
    'kona_station': 'Dispositivo que cura o reanima automáticamente a cualquier operador herido a su alcance, incluidos los rivales.',
    'zoto_canister': 'Dispositivo arrojadizo que se pega a las superficies y libera un gas helado que desactiva dispositivos y ralentiza a los enemigos.',
    'black_eye': 'Cámaras arrojadizas que se pegan a las superficies y que Valkyrie y su equipo usan para obtener información.',
    'erc_7': 'Borra la imagen de Vigil de los drones y herramientas de observación cercanos para que no pueda ser escaneado.',
    'mag_net_system': 'Dispositivo arrojadizo que captura granadas y proyectiles entrantes y los detona tras un retardo.',
    'glance_smart_glasses': 'Gafas que mejoran la visibilidad entre el humo y protegen del deslumbramiento de los flashes.',
}
official = {o['id']: o for o in J('tools', 'research', 'operators_official.json')}
official.update({o['id']: o for o in J('tools', 'research', 'operators_manual.json')})
used = set()
for o in J('data', 'operators.json'):
    aid = o['ability']; a = official[o['id']]['ability']; used.add(aid)
    assert aid in ABILITY_ES, f'falta traduccion de la habilidad {aid} ({o["id"]})'
    add(f'ability.{aid}', a['name'], a['name']); add(f'ability.{aid}.desc', ABILITY_ES[aid], a['description'])
assert used == set(ABILITY_ES), set(ABILITY_ES) - used

# ---- ficha de agente ----
for k, es, en in (
    ('ui.info', 'Ver ficha del agente', 'View operator sheet'),
    ('sheet.specialties', 'Especialidades', 'Specialties'),
    ('sheet.ability', 'Habilidad única', 'Unique ability'),
    ('sheet.gadgets', 'Gadgets secundarios', 'Secondary gadgets'),
    ('sheet.health', 'Salud', 'Health'),
    ('sheet.speed', 'Velocidad', 'Speed'),
    ('sheet.unknownRating', 'sin dato', 'no data'),
    ('sheet.sim', 'Cómo influye en la simulación', 'How it affects the simulation'),
    ('sheet.simNote', 'Cada valor suma el perfil base del agente (su habilidad) y el efecto de sus gadgets. Son las cifras que usa el motor.', "Each value adds the operator's base profile (their ability) and the effect of their gadgets. These are the figures the engine uses."),
    ('sheet.base', 'base', 'base'),
    ('sheet.noStats', 'Sin efecto propio en las estadísticas del motor.', 'No effect of its own on the engine stats.'),
):
    add(k, es, en)
