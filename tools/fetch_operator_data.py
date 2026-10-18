"""Extrae datos oficiales de agentes (especialidades, habilidad unica, gadgets, salud/velocidad) de danielwerg/r6data (MIT).

Genera tools/research/operators_official.json y tools/research/gadgets_official.json.
Los agentes que r6data aun no recoge se completan a mano en tools/research/operators_manual.json (con su fuente).
Uso: python tools/fetch_operator_data.py   (requiere la CLI `gh` autenticada)
"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tools', 'research')
REPO = 'danielwerg/r6data'


def gh_raw(path):
    r = subprocess.run(['gh', 'api', '-H', 'Accept: application/vnd.github.raw', f'repos/{REPO}/contents/{path}'], capture_output=True, text=True, encoding='utf-8')
    if r.returncode:
        raise RuntimeError(f'{path}: {r.stderr.strip()}')
    return r.stdout


def gh_dirs(path):
    r = subprocess.run(['gh', 'api', f'repos/{REPO}/contents/{path}', '--jq', '.[] | select(.type=="dir") | .name'], capture_output=True, text=True, encoding='utf-8')
    if r.returncode:
        raise RuntimeError(r.stderr.strip())
    return r.stdout.split()


def read_string(src, i):
    """Lee un literal de cadena TS ('...', "..." o `...`) que empieza en src[i]; devuelve (valor, indice siguiente)."""
    q = src[i]; i += 1; buf = []
    while src[i] != q:
        if src[i] == '\\':
            i += 1
        buf.append(src[i]); i += 1
    return ''.join(buf), i + 1


def field_str(block, key):
    m = re.search(rf'\b{key}:\s*', block)
    if not m:
        return None
    i = m.end()
    if block[i] in '\'"`':
        return read_string(block, i)[0]
    return None


def field_list(block, key):
    m = re.search(rf'\b{key}:\s*\[([^\]]*)\]', block, re.S)
    return re.findall(r'[\'"]([a-z0-9_\-]+)[\'"]', m.group(1)) if m else []


def block_after(src, key):
    """Devuelve el texto de la llave {...} que sigue a `key:` (balanceando llaves)."""
    m = re.search(rf'\b{key}:\s*\{{', src)
    if not m:
        return None
    i = m.end(); depth = 1; start = i
    while depth:
        c = src[i]
        if c in '\'"`':
            _, i = read_string(src, i); continue
        depth += (c == '{') - (c == '}'); i += 1
    return src[start:i - 1]


def parse_operator(slug, src):
    ratings = block_after(src, 'ratings') or ''
    season = block_after(src, 'season') or ''
    gadgets = block_after(src, 'gadgets') or ''
    ua = block_after(src, 'uniqueAbility')
    num = lambda b, k: (lambda m: int(m.group(1)) if m else None)(re.search(rf'\b{k}:\s*(\d+)', b))
    return {
        'id': slug,
        'name': field_str(src, 'name'),
        'side': {'attack': 'att', 'defense': 'def'}[field_str(src, 'side')],
        'health': num(ratings, 'health'), 'speed': num(ratings, 'speed'),
        'season': num(season, 'id'),
        'specialties': field_list(src, 'specialties'),
        'gadgets': field_list(gadgets, 'secondary'),
        'ability': None if ua is None else {'id': field_str(ua, 'slug'), 'name': field_str(ua, 'name'), 'type': field_str(ua, 'type'), 'description': field_str(ua, 'description'), 'info': field_str(ua, 'info')},
        'source': f'https://github.com/{REPO}/blob/master/src/operators/{slug}/index.ts',
    }


def parse_gadgets(src):
    out = []
    for m in re.finditer(r"\{\s*slug:\s*'([a-z_]+)',\s*name:\s*'([^']+)',\s*side:\s*'(attack|defense)',\s*amount:\s*(\d+),\s*description:\s*", src):
        i = m.end(); desc, _ = read_string(src, i)
        out.append({'id': m.group(1), 'name': m.group(2), 'side': 'att' if m.group(3) == 'attack' else 'def', 'amount': int(m.group(4)), 'description': desc})
    return out


def main():
    os.makedirs(OUT, exist_ok=True)
    ops = []
    for d in sorted(gh_dirs('src/operators')):
        if d.startswith('recruit'):
            continue
        ops.append(parse_operator(d, gh_raw(f'src/operators/{d}/index.ts')))
    gadgets = parse_gadgets(gh_raw('src/gadgets.ts'))
    json.dump(ops, open(os.path.join(OUT, 'operators_official.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    json.dump(gadgets, open(os.path.join(OUT, 'gadgets_official.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print(f'{len(ops)} agentes, {len(gadgets)} gadgets')


if __name__ == '__main__':
    sys.exit(main())
