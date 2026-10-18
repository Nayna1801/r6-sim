"""Auditoria de coherencia: especialidades oficiales de cada agente frente a las estadisticas base (diseno propio) del motor.
Muestra los agentes cuya especialidad oficial no esta respaldada por ninguna estadistica. Uso: python tools/audit_roles.py"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ops = json.load(open(os.path.join(ROOT, 'data', 'operators.json'), encoding='utf-8'))

# especialidad -> (estadistica, minimo) alternativas por bando; basta con que se cumpla una
EXPECT = {
    'intel': {'att': [('intel', 1)], 'def': [('intel', 1)]},
    'anti-entry': {'def': [('aHB', 1), ('deny', 2), ('anchor', 2)]},
    'anti-gadget': {'att': [('aUtil', 1)], 'def': [('aIntel', 1), ('aNade', 1), ('vis', 1), ('aHB', 1)]},
    'breach': {'att': [('hb', 0.5), ('vtl', 1), ('entry', 2)]},
    'support': {'att': [('sup', 1), ('smoke', 1), ('clear', 1), ('intel', 1)], 'def': [('sup', 1), ('intel', 1), ('aHB', 1)]},
    'front-line': {'att': [('entry', 2)]},
    'map_control': {'att': [('flank', 1), ('smoke', 1), ('intel', 1), ('post', 1)], 'def': [('roam', 1), ('intel', 1), ('deny', 1)]},
    'crowd_control': {'att': [('clear', 1), ('smoke', 1), ('entry', 1)], 'def': [('deny', 1), ('roam', 1)]},
    'trapper': {'def': [('deny', 2)]},
}

bad = []
for o in ops:
    for s in o['specialties']:
        alts = EXPECT.get(s, {}).get(o['side'])
        if alts is None:
            bad.append((o['id'], s, 'especialidad no esperable para este bando'))
        elif not any((o.get(k) or 0) >= m for k, m in alts):
            bad.append((o['id'], s, 'ninguna de ' + ', '.join(f'{k}>={m}' for k, m in alts)))
by = {}
for i, s, why in bad:
    by.setdefault(i, []).append(f'{s} ({why})')
for i, v in sorted(by.items()):
    o = next(x for x in ops if x['id'] == i)
    print(f"{i:11} {o['side']} esp={o['specialties']}  stats={ {k: o[k] for k in o if isinstance(o[k], (int, float)) and o[k] and k not in ('aim', 'health', 'speed', 'season')} }")
    for w in v:
        print('     -', w)
print(f'\n{len(by)} agentes con alguna especialidad sin respaldo de {len(ops)}')
sys.exit(0)
