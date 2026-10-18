# R6 Draft Sim

Simulador por turnos inspirado en el modo Bomba de Rainbow Six Siege: bans, draft, preparacion con droneo,
refuerzos, fases de accion con decisiones de ambos bandos, post-plant y formato de partida tipo Ranked.
Juegas contra la CPU o contra otra persona (P2P, sin cuentas ni servidor propio).

> Proyecto de fans, sin afiliacion con Ubisoft. Los valores de operadores y el balance son aproximaciones propias.

## Ejecutar

Necesita servirse por HTTP (carga ficheros JSON):

```bash
python -m http.server 8123      # y abrir http://localhost:8123
```

En GitHub Pages funciona tal cual. El modo online usa PeerJS (broker publico gratuito, sin cuentas) cargado desde un CDN.

## Como funciona una partida

1. **Formato** (`config/rules.json`): se juegan rondas por mitades; al cambiar de bando se limpian los bans; prorroga si hay empate a 3.
   La wiki del juego describe el formato Ranked de forma contradictoria, asi que es una aproximacion.
2. **Bans** (cada ronda, acumulativos hasta 3 por mitad) y **draft**: 5 operadores de tu bando (todos, o un pool aleatorio de 8).
3. **Planes ocultos y simultaneos**
   - Defensa: sitio de bomba (los reales del mapa), reparto de 10 refuerzos (paredes del sitio / entradas / trampillas) y rol por operador
     (ancla, rotacion, roam, cazadrones).
   - Ataque: spawn, orden de exploracion de los drones y rol por operador.
4. **Droneo**: cada barrido puede ser destruido o bloqueado; los defensores ven que un dron esta cerca. Si el atacante localiza el sitio
   (o lo deduce por descarte) puede **cambiar de spawn y roles** antes de empezar.
5. **Fases de accion**, cada una con decisiones simultaneas: control de mapa, entrada (ruta + metodo; el defensor puede anticipar la ruta),
   ejecucion del sitio, plantada y post-plant (dos tramos).
6. **Resultado** con los factores que decidieron la ronda y el registro completo (incluida la informacion que estaba oculta).

## Estructura

| Ruta | Contenido |
|---|---|
| `config/rules.json` | formato, tiempos, refuerzos, roles |
| `config/balance.json` | todas las constantes que deciden resultados |
| `config/decisions.json` | opciones de cada fase y sus modificadores |
| `config/ai.json`, `config/ui.json`, `config/i18n.json` | IA, presentacion, idiomas |
| `config/actions.json` | acciones propias de los 75 agentes (ver `docs/diseno-acciones-de-agente.md`). **Generado** por `tools/derive_actions.py` desde `tools/research/action_specs.json` (no editar a mano); interruptor en `balance.json > actions.enabled` |
| `config/gadgets.json` | efecto de cada gadget secundario en las estadisticas del motor (peso global en `balance.json > gadgets.weight`) |
| `data/operators.json`, `data/maps.json` | operadores y mapas (generados con `tools/build_data.py`) |
| `locales/*.json` | textos (es, en). Se generan con `tools/gen_locales*.py` |
| `js/engine.js` | motor de ronda por fases (sin textos ni numeros incrustados) |
| `js/ai.js`, `js/controllers.js` | IA rival: draft, bans, planes y decisiones evaluadas con simulaciones |
| `js/match.js` | controlador de partida (formato, bans, cambio de bando) |
| `js/net.js` | P2P con PeerJS: el anfitrion ejecuta la partida, el invitado es un cliente de UI |
| `js/ui/*`, `js/app.js`, `js/i18n.js` | interfaz e internacionalizacion |
| `sw.js` | service worker: cache de imagenes/fuentes y juego sin conexion (sube `ASSET_VERSION` al cambiar assets) |

El motor emite eventos con **clave i18n + parametros**, nunca frases; cada cliente los traduce a su idioma.

## Agentes: especialidades, habilidades y gadgets
`data/operators.json` junta dos cosas:
- **Estadisticas del motor** (`aim`, `intel`, `anchor`...): diseno propio (`tools/_ops_dump.json`). Reflejan la habilidad unica de cada agente.
- **Datos oficiales** (especialidades, gadgets secundarios, salud/velocidad, habilidad): de [danielwerg/r6data](https://github.com/danielwerg/r6data) (MIT) via `tools/fetch_operator_data.py`; los agentes que aun no recoge van a mano, con su fuente, en `tools/research/operators_manual.json`.

Los gadgets secundarios si cuentan en la simulacion: la estadistica efectiva es `base + peso * efectos` (ver `config/gadgets.json`) y la ficha del agente (boton `i` de la carta) muestra de donde sale cada cifra. Al ajustar `config/gadgets.json` comprueba el equilibrio con `node tools/gadget_lift.js` y `node tools/opwin.js`.

> "Trapper" es una **especialidad** del juego, no un agente: no hay ningun agente con ese nombre.

## Datos de mapas y su fiabilidad

Sitios de bomba y spawns se recopilaron de fuentes publicas (wiki de Rainbow Six, Liquipedia, siege.gg, Hotspawn...) y cada mapa
guarda su `confidence`, `sources` y `notes`; se ven en el juego pulsando el nombre del mapa (HUD).

- 24 mapas jugables. Excluidos: District, Fort Truth, Hereford Base, Neighborhood y Stadium (sin Bomba o sin datos fiables).
- Los **spawns sin documentar** (Calypso Casino, Consulate, Fortress) se muestran como genericos.
- No existen datos publicos de entradas por spawn: la *lane* (frontal/lateral/trasera) de cada spawn y su efecto son un **modelo abstracto**.
- El pool Ranked cambia cada temporada y las fuentes discrepan; el campo `ranked` es el de la fuente mas reciente encontrada.

## Anadir un idioma

1. Anadir el codigo en `config/i18n.json` (`languages`).
2. Crear `locales/<codigo>.json` con las mismas claves (usa `locales/en.json` como plantilla).
3. `node tools/check_i18n.js` comprueba que no falta ninguna clave.

Los nombres de operadores, salas, mapas y spawns se pueden sobrescribir con `names.op.<id>`, `names.room.<sala>`, `names.map.<id>`, `names.spawn.<nombre>`.

## Herramientas

```bash
node tools/sim.js 500            # IA vs IA: ritmo de rondas, % de ataque, plantadas...
node tools/sim.js --match 6      # partidas completas CPU vs CPU
BAL='{"post":{"defuseBase":0.5}}' node tools/sim.js 500   # probar un ajuste de balance sin tocar ficheros
node tools/dominance.js 300      # detecta decisiones dominantes (resultado medio de cada opcion)
node tools/check_i18n.js         # cobertura de traducciones
python tools/build_data.py       # regenera data/*.json desde tools/research/
python tools/fetch_operator_data.py   # descarga los datos oficiales de agentes (requiere `gh`)
node tools/test_actions.js       # pruebas de las acciones de agente: infraestructura (F0)
node tools/test_actions_f1.js    # pruebas de F1: derribado, revelado, contrarrestos y los 7 agentes
node tools/test_actions_f3.js    # pruebas de F3: bonus de equipo, gadgets persistentes, supresion, trampas y cobertura de los 75 agentes
node tools/action_lift.js 2500   # empuje de cada accion (forzada vs no) en puntos de victoria; revisar las que superan +-3
node tools/action_lift_parallel.js 2000   # lo mismo para las 75 acciones, repartido en 12 procesos (~15 min)
python tools/derive_actions.py   # regenera config/actions.json tras editar action_specs.json (--check: verifica que esta al dia)
python tools/fetch_operator_notes.py   # contrarrestos citados en las notas de r6data (alimenta los textos de las acciones)
node tools/validate_actions.js   # valida config/actions.json
python tools/audit_roles.py      # agentes cuya especialidad oficial no tiene respaldo en sus estadisticas
node tools/opwin.js 8000         # tasa de victoria por agente (detecta dominantes o inutiles)
node tools/gadget_lift.js 8000   # empuje de cada gadget (con/sin) y dispersion de tasas por agente
python tools/optimize_images.py  # retratos WebP (240 px y 150 px movil) desde tools/src_images/
```
