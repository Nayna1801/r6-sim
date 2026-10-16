"""Genera locales/es.json y locales/en.json a partir de gen_locales_a.py y gen_locales_b.py.
Los JSON generados son la fuente de verdad en ejecucion; este script solo facilita la autoria paralela es/en.
Uso: python tools/gen_locales.py
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import gen_locales_a as A
import gen_locales_b  # noqa: F401  (registra claves en A.ES / A.EN)
assert set(A.ES) == set(A.EN), set(A.ES) ^ set(A.EN)
out = os.path.join(os.path.dirname(HERE), 'locales'); os.makedirs(out, exist_ok=True)
for name, d in (('es', A.ES), ('en', A.EN)):
    json.dump(d, open(os.path.join(out, name + '.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(len(A.ES), 'claves por idioma')
