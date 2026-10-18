"""Genera data/operators.json y data/maps.json a partir de:
 - tools/_ops_dump.json      (stats de operadores, diseno propio)
 - tools/_maps_profile.json  (perfil abstracto open/vert/tight, diseno propio)
 - tools/research/group*.json (sitios/spawns investigados con fuentes)
Uso: python tools/build_data.py <carpeta_research>
"""
import json, re, sys, glob, unicodedata, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
research_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'tools', 'research')


def slug(t):
    t = re.sub(r"\s*\(.*\)", "", t)
    t = unicodedata.normalize('NFKD', t).encode('ascii', 'ignore').decode()
    return re.sub(r'[^a-z0-9]+', '', t.lower())


def level(floor):
    """B=0, 1F=1, 2F=2...; combinaciones (1F/2F) -> media."""
    if not floor:
        return None
    vals = []
    for tok in re.split(r'[/ ,]+', floor.replace('?', '')):
        if tok.upper().startswith('B'):
            vals.append(0)
        else:
            m = re.match(r'(\d+)F', tok.upper())
            if m:
                vals.append(int(m.group(1)))
    return sum(vals) / len(vals) if vals else None


LANES = json.load(open(os.path.join(ROOT, 'config', 'rules.json'), encoding='utf-8'))['lanes']
ops = json.load(open(os.path.join(ROOT, 'tools', '_ops_dump.json'), encoding='utf-8'))

# datos oficiales (tools/fetch_operator_data.py + operators_manual.json para los agentes que r6data aun no recoge)
official = {o['id']: o for o in json.load(open(os.path.join(research_dir, 'operators_official.json'), encoding='utf-8'))}
official.update({o['id']: o for o in json.load(open(os.path.join(research_dir, 'operators_manual.json'), encoding='utf-8'))})
for o in ops:
    d = official.get(o['id'])
    if d is None:
        raise SystemExit(f"sin datos oficiales para {o['id']}: ejecuta tools/fetch_operator_data.py o anadelo a operators_manual.json")
    if d['side'] != o['side']:
        raise SystemExit(f"bando distinto en {o['id']}: {o['side']} vs {d['side']}")
    o.update({'specialties': d['specialties'], 'gadgets': d['gadgets'], 'ability': re.sub(r'[^a-z0-9]+', '_', d['ability']['id'].lower()).strip('_'), 'health': d['health'], 'speed': d['speed'], 'season': d['season']})

json.dump(ops, open(os.path.join(ROOT, 'data', 'operators.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)

profiles = {m['id']: m for m in json.load(open(os.path.join(ROOT, 'tools', '_maps_profile.json'), encoding='utf-8'))}
researched = {}
for f in sorted(glob.glob(os.path.join(research_dir, 'group*.json'))):
    for m in json.load(open(f, encoding='utf-8')):
        researched[slug(m['map'])] = m

maps = []
for mid, p in profiles.items():
    r = researched.get(mid, {})
    sites = []
    for s in (r.get('sites') or []):
        sites.append({'id': s['id'], 'floor': s.get('floor'), 'level': level(s.get('floor')), 'rooms': s['rooms']})
    spawns = []
    for i, sp in enumerate(r.get('spawns') or []):
        spawns.append({'id': f"sp{i + 1}", 'name': sp['name'], 'documented': True, 'entries': sp.get('entries'), 'closestSites': sp.get('closest_sites'),
                       'lane': LANES[i % len(LANES)], 'laneSource': 'abstract'})
    if len(sites) >= 2 and not spawns:
        # mapa sin spawns documentados: 3 spawns genericos (la UI los marca como no documentados)
        for i in range(3):
            spawns.append({'id': f"sp{i + 1}", 'name': None, 'documented': False, 'entries': None, 'closestSites': None,
                           'lane': LANES[i % len(LANES)], 'laneSource': 'abstract'})
    maps.append({
        'id': mid, 'name': r.get('map') or p['name'],
        'profile': {'open': p['open'], 'vert': p['vert'], 'tight': p['tight']},
        'sites': sites, 'spawns': spawns,
        'playable': len(sites) >= 2,
        'ranked': bool(r.get('ranked')),
        'confidence': r.get('confidence'),
        'features': r.get('features') or [],
        'sources': r.get('sources') or [],
        'notes': r.get('notes'),
        'img': p['img'],
    })
json.dump(maps, open(os.path.join(ROOT, 'data', 'maps.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(len(ops), 'operadores;', sum(m['playable'] for m in maps), 'mapas jugables de', len(maps))
