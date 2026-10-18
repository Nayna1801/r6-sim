"""Descarga las notas de jugabilidad de r6data (src/operators/<id>/notes.md) y extrae, por agente, que otros agentes se citan como
contrarresto (seccion "Counters") y como sinergia (seccion "Strategies/Synergies").
Salida: tools/research/operator_notes_counters.json   ({id: {counters: [ids], synergies: [ids], source: url}})
Uso: python tools/fetch_operator_notes.py   (requiere la CLI `gh` autenticada)"""
import json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = 'danielwerg/r6data'
ops = json.load(open(os.path.join(ROOT, 'data', 'operators.json'), encoding='utf-8'))
official = json.load(open(os.path.join(ROOT, 'tools', 'research', 'operators_official.json'), encoding='utf-8'))
NAMES = {o['id']: o['name'] for o in official}
NAMES.update({o['id']: o['name'] for o in ops})   # nombres de nuestros datos (incluye los 4 que r6data aun no tiene)


def fetch(op_id):
    r = subprocess.run(['gh', 'api', '-H', 'Accept: application/vnd.github.raw', f'repos/{REPO}/contents/src/operators/{op_id}/notes.md'], capture_output=True, text=True, encoding='utf-8')
    return r.stdout if r.returncode == 0 else None


def section(text, title_re):
    m = re.search(rf'^#{{2,4}}\s*(?:{title_re})[^\n]*\n(.*?)(?=^#{{2,4}}\s|\Z)', text, re.S | re.M | re.I)
    return m.group(1) if m else ''


def mentioned(text, self_id):
    found = []
    for oid, name in NAMES.items():
        if oid == self_id:
            continue
        if re.search(rf"(?<![\w]){re.escape(name)}(?![\w])", text) and oid not in found:
            found.append(oid)
    return found


def main():
    out = {}; missing = []
    for o in ops:
        txt = fetch(o['id'])
        if txt is None:
            missing.append(o['id']); out[o['id']] = {'counters': [], 'synergies': [], 'source': None}; continue
        out[o['id']] = {'counters': mentioned(section(txt, 'Counters'), o['id']), 'synergies': mentioned(section(txt, r'Strateg\w+(?:/Synerg\w+)?|Synerg\w+'), o['id']),
                        'source': f'https://github.com/{REPO}/blob/master/src/operators/{o["id"]}/notes.md'}
    json.dump(out, open(os.path.join(ROOT, 'tools', 'research', 'operator_notes_counters.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print(f'{len(out) - len(missing)} notas descargadas; sin notas en r6data: {missing}')


if __name__ == '__main__':
    sys.exit(main())
