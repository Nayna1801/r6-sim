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
| `data/operators.json`, `data/maps.json` | operadores y mapas (generados con `tools/build_data.py`) |
| `locales/*.json` | textos (es, en). Se generan con `tools/gen_locales*.py` |
| `js/engine.js` | motor de ronda por fases (sin textos ni numeros incrustados) |
| `js/ai.js`, `js/controllers.js` | IA rival: draft, bans, planes y decisiones evaluadas con simulaciones |
| `js/match.js` | controlador de partida (formato, bans, cambio de bando) |
| `js/net.js` | P2P con PeerJS: el anfitrion ejecuta la partida, el invitado es un cliente de UI |
| `js/ui/*`, `js/app.js`, `js/i18n.js` | interfaz e internacionalizacion |

El motor emite eventos con **clave i18n + parametros**, nunca frases; cada cliente los traduce a su idioma.

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
```
