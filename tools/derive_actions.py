"""Genera config/actions.json a partir de tools/research/action_specs.json (plantillas por arquetipo + parametros por agente).

  python tools/derive_actions.py           escribe config/actions.json
  python tools/derive_actions.py --check   falla (codigo 1) si config/actions.json no coincide con lo que se generaria

Para cambiar una accion: edita action_specs.json (parametros del agente, 'k' propio o 'scale' del arquetipo) y vuelve a generar.
Despues: python tools/gen_locales.py (textos) y node tools/validate_actions.js.
"""
import copy, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPEC = os.path.join(ROOT, 'tools', 'research', 'action_specs.json')
OUT = os.path.join(ROOT, 'config', 'actions.json')

DOC = ("GENERADO por tools/derive_actions.py desde tools/research/action_specs.json: no editar a mano. "
       "Acciones propias de cada agente (ver docs/diseno-acciones-de-agente.md). Cada accion es un grupo de decision 'act.<id>' cuya primera opcion es siempre 'off'. "
       "Efectos: mod (modificadores numericos de equipo), buff (bonus de equipo a una estadistica del motor durante la fase, o toda la ronda si el gadget persiste), "
       "time (segundos del reloj de ronda; solo cuenta para acciones atacantes, porque ese reloj corre en su contra), reveal (el bando conoce a enemigos hasta ttl fases mas tarde), "
       "ambush (bonus de emboscada del roamer, con derribo y orden condicional 'then': finish | interrogate), breach (potencia extra de un breacher duro), "
       "revive (levanta derribados propios al acabar la fase), trapdown (una trampa puede derribar a atacantes). "
       "'persist': el gadget queda colocado toda la ronda. 'when': solo se usa si el equipo eligio ese valor en una decision de equipo. "
       "'tags' + 'counters'/'suppress'/'statCounters' definen el contrajuego. Cifras de diseno propio; las mecanicas salen de las notas de r6data (src/operators/<id>/notes.md).")
SCALED = {'buff': ('v',), 'breach': ('power',), 'ambush': ('aim',)}


def subst(node, params, where):
    """Sustituye '$nombre' por el parametro; deja los demas valores igual."""
    if isinstance(node, dict):
        return {k: subst(v, params, where) for k, v in node.items()}
    if isinstance(node, list):
        return [subst(v, params, where) for v in node]
    if isinstance(node, str) and node.startswith('$'):
        name = node[1:]
        if name not in params:
            raise SystemExit(f'{where}: falta el parametro "{name}"')
        return params[name]
    return node


def active(entry, params):
    cond = entry.get('if')
    return True if cond is None else bool(params.get(cond))


def scale_effect(e, k):
    e = copy.deepcopy(e)
    if k == 1:
        return e
    for f in SCALED.get(e['fx'], ()):
        e[f] = e[f] * k
    if e['fx'] == 'mod':
        e['mods'] = {m: (1 + (v - 1) * k if m.endswith('Mul') else v * k) for m, v in e['mods'].items()}
    if e['fx'] == 'trapdown':
        e['p'] = min(1, e['p'] * k)
    return e


def round_numbers(node):
    if isinstance(node, float):
        return round(node, 3)
    if isinstance(node, dict):
        return {k: round_numbers(v) for k, v in node.items()}
    if isinstance(node, list):
        return [round_numbers(v) for v in node]
    return node


def build():
    spec = json.load(open(SPEC, encoding='utf-8'))
    ops = {o['id']: o for o in json.load(open(os.path.join(ROOT, 'data', 'operators.json'), encoding='utf-8'))}
    actions = {}
    for aid, a in spec['custom'].items():
        actions[aid] = a
    for op, o in spec['ops'].items():
        if op not in ops:
            raise SystemExit(f'{op}: agente inexistente')
        arch = spec['archetypes'].get(o['archetype'])
        if arch is None:
            raise SystemExit(f'{op}: arquetipo desconocido {o["archetype"]}')
        if ops[op]['side'] != arch['side']:
            raise SystemExit(f'{op}: el arquetipo {o["archetype"]} es del bando {arch["side"]} y el agente del {ops[op]["side"]}')
        aid = f'{op}.{ops[op]["ability"]}'
        if aid in actions:
            raise SystemExit(f'{aid}: duplicada (esta en custom y en ops)')
        params = {**arch.get('params', {}), **o.get('p', {})}
        k = spec['scale'].get(o['archetype'], 1) * o.get('k', 1)
        do = [scale_effect(subst({kk: vv for kk, vv in e.items() if kk != 'if'}, params, f'{aid}'), k) for e in arch['do'] if active(e, params)]
        action = {'op': op, 'archetype': o['archetype'], 'side': arch['side'], 'phases': o.get('phases', arch['phases']), 'uses': o.get('uses', arch['uses'])}
        if arch.get('persist'):
            action['persist'] = True
        action['requires'] = arch.get('requires', {})
        if arch.get('when'):
            action['when'] = arch['when']
        action['tags'] = list(dict.fromkeys(arch.get('tags', []) + o.get('tags', [])))
        action['options'] = {'off': {}, arch['option']: {'do': do}}
        actions[aid] = round_numbers(action)
    cfg = spec['config']
    out = {'_doc': DOC}
    for key in ('maxActive', 'effects', 'tagList', 'counters', 'suppress', 'statCounters'):
        out[key] = cfg[key]
    out['actions'] = actions
    return json.dumps(out, indent=1, ensure_ascii=False) + '\n'


def main():
    text = build().replace('\n', '\r\n')
    if '--check' in sys.argv:
        cur = open(OUT, encoding='utf-8', newline='').read() if os.path.exists(OUT) else ''
        if cur != text:
            print('config/actions.json no coincide con lo que genera derive_actions.py (regenerar con: python tools/derive_actions.py)')
            return 1
        print('config/actions.json esta al dia')
        return 0
    open(OUT, 'w', encoding='utf-8', newline='').write(text)
    n = text.count('"op":')
    print(f'config/actions.json generado: {n} acciones')
    return 0


if __name__ == '__main__':
    sys.exit(main())
