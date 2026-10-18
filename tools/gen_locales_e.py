# Autoria de locales (parte E): textos de las acciones GENERADAS desde tools/research/action_specs.json (las 'custom' van en la parte D).
# Nada se escribe a mano por agente: el nombre y la descripcion son los de la habilidad oficial (partes C y datos de r6data), las opciones salen de
# la plantilla del arquetipo y los contrarrestos de las notas de r6data (tools/research/operator_notes_counters.json).
import json, os
from gen_locales_a import add
import gen_locales_c as C

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda *p: json.load(open(os.path.join(ROOT, *p), encoding='utf-8'))
specs = J('tools', 'research', 'action_specs.json')
ops = {o['id']: o for o in J('data', 'operators.json')}
counters = J('tools', 'research', 'operator_notes_counters.json')
MAX_NAMES = 8

for op, o in specs['ops'].items():
    ability = ops[op]['ability']; aid = f'{op}.{ability}'; A = specs['archetypes'][o['archetype']]
    off = C.official[op]['ability']
    add(f'action.{aid}', off['name'], off['name'])
    add(f'action.{aid}.desc', C.ABILITY_ES[ability], off['description'])
    names = [ops[c]['name'] for c in counters.get(op, {}).get('counters', []) if c in ops][:MAX_NAMES]
    if names:
        add(f'action.{aid}.counters', 'Contrarrestos en el juego: ' + ', '.join(names) + '.', 'Counters in the game: ' + ', '.join(names) + '.')
    else:
        add(f'action.{aid}.counters', 'Sin contrarrestos específicos documentados.', 'No specific counters documented.')
    es, en = A['text']['es'], A['text']['en']
    add(f'action.{aid}.opt.{A["option"]}', es[0], en[0]); add(f'action.{aid}.opt.{A["option"]}.desc', es[1], en[1])
