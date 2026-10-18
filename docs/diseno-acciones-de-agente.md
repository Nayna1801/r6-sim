# Diseño: acciones específicas por agente

> Estado: **aprobado** (alcance F0+F1, órdenes condicionales antes de la fase, estado `down` mínimo, máx. 2 acciones por fase). **F0 y F1 implementadas**; F2–F4 pendientes. Punto 3 de la lista de mejoras.
> Fuentes de mecánicas: notas de jugabilidad de [danielwerg/r6data](https://github.com/danielwerg/r6data) (MIT), `src/operators/<id>/notes.md`. Las cifras marcadas *(r6data)* salen de ahí; el resto son propuestas de diseño.

## 1. Qué se pide

Poder **elegir acciones propias de cada agente**, no solo decisiones de equipo. Ejemplo del enunciado: Caveira, roamer que puede dejar a un atacante derribado, **interrogarlo** para conocer la posición de sus compañeros y, mientras tanto, queda **vulnerable**.

## 2. Qué hay hoy (hallazgos del motor)

| Hecho | Consecuencia para el diseño |
|---|---|
| Las decisiones son **de equipo y por fase** (`config/decisions.json`: 5 fases, 1–3 grupos por bando). Cada opción solo aporta modificadores numéricos. | No existe el concepto "acción de un agente". Hay que añadirlo sin romper el formato. |
| Los agentes entran solo por **estadísticas** (`aim`, `intel`, `deny`…), sumadas por equipo. Los gadgets ya suman a esas estadísticas. | Una acción debe poder **leer y modificar** ese mismo modelo, no sustituirlo. |
| Los duelos son abstractos: se elige un atacante y un defensor ponderados y gana uno (`fight`). **No hay estado "derribado"**: `kill()` mata al instante. | Interrogar exige un estado intermedio mínimo. |
| La información es un escalar (`infoEdge`) y un hecho (`intel.found`). **No hay información por enemigo** (quién es, qué rol, dónde). | "Revelar posiciones" necesita un modelo de *conocimiento por enemigo*. |
| `viewFor()` ya oculta roles y planes según el bando. | La información oculta está resuelta; hay que extenderla a lo revelado. |
| Las decisiones viajan como diccionario `grupo → opción` (P2P y CPU lo comparten). | Si las acciones se expresan como grupos nuevos, **red e IA funcionan sin tocar el protocolo**. |
| No hay mapa espacial (solo sitios y habitaciones del sitio de bomba). | "Posición" será *rol + si está en el sitio*, no coordenadas. Un mapa espacial sería otro proyecto (ver §10). |

## 3. Principios

1. **Dirigido por datos.** Ninguna mecánica de un agente concreto en el código: el motor implementa ~10 *efectos* genéricos y cada acción es una entrada de `config/actions.json`. (Coherente con "nada hardcodeado".)
2. **Arquetipos, no 75 casos únicos.** Los 75 agentes caen en 12 familias (§6); cada agente solo aporta parámetros.
3. **Cada acción tiene coste y riesgo** (tiempo, usos, exposición). Si fuera gratis, siempre se elegiría.
4. **Hay contrajuego explícito.** Las acciones llevan *etiquetas* y otras acciones/gadgets las contrarrestan (§5). Eso reproduce la red del juego real (Jackal ↔ Mute, Pulse ↔ EMP…).
5. **Cabe en el flujo actual:** se decide **antes** de resolver la fase y se reproduce como eventos. Sin pausas a mitad de fase, sin estado nuevo en red.
6. **Fidelidad con simplificación declarada.** Las cifras reales (duraciones, alcances) se usan de base y se escalan al tiempo del motor.

## 4. Modelo propuesto

### 4.1 Una acción es un dato

```jsonc
// config/actions.json (ilustrativo)
"caveira.silent_step": {
  "op": "caveira", "archetype": "roam_hunt", "side": "def",
  "phases": ["early", "site"],                 // dónde puede elegirse
  "requires": { "role": ["roam", "hunt"] },    // y debe seguir viva
  "tags": ["stealth", "footsteps"],            // para el contrajuego (§5)
  "uses": 1,                                   // por ronda (r6data: carga infinita pero limitada en tiempo → 1 uso por fase)
  "options": {
    "off":              {},
    "hunt_finish":      { "do": [{ "fx": "ambush", "aim": 0.45, "downs": true }, { "fx": "finish" }], "time": 8 },
    "hunt_interrogate": { "do": [{ "fx": "ambush", "aim": 0.45, "downs": true },
                                 { "fx": "interrogate", "time": 5, "exposed": { "base": 0.25, "perAtt": 0.08 },
                                   "reveal": { "who": "all", "for": 10 } }], "time": 8 }
  }
}
```

Cada `options` es una elección del jugador para ese agente. Se expone al motor como un **grupo de decisión** `act.caveira.silent_step` con esas opciones, así que entra por `options()`, `normalizeChoice()` y `modsOf()` ya existentes y viaja por la red como cualquier otro grupo.

### 4.2 Efectos genéricos (el vocabulario del motor)

| Efecto | Qué hace | Estado que usa |
|---|---|---|
| `mod` | Modificador numérico temporal (como las decisiones actuales) | — |
| `time` | Consume segundos del reloj de acción (180 s) | `st.t` |
| `ambush` | Bonus de puntería en un duelo concreto; opcionalmente `downs` | duelo |
| `downs` / `finish` | La víctima queda **derribada** en vez de morir; `finish` la mata | `m.down` |
| `interrogate` | Requiere un derribado; cuesta tiempo, deja al ejecutor **expuesto** | `m.down`, exposición |
| `reveal` | Marca enemigos como **conocidos** durante un tiempo (identidad, rol, si están en el sitio) | `st.known` |
| `jam` / `disable` | Anula acciones/gadgets enemigos con ciertas etiquetas | `st.jammed` |
| `heal` / `revive` | Cura o levanta a un derribado propio | `m.down`, `m.hp` |
| `open` | Abre refuerzos/paredes (integra con el método de entrada) | `st.openings` |
| `place` | Prepara algo antes de la ronda (trampas, jammers) con efecto en una fase posterior | `st.carry` |

### 4.3 Estado nuevo (mínimo)

```
m.down        // derribado: no combate, no cuenta como vivo para ganar duelos, sí para el fin de ronda hasta que lo rematen
m.exposed     // ejecutando una acción vulnerable este tramo
st.known      // { att: {id: hastaT}, def: {id: hastaT} } conocimiento por enemigo y bando
st.jammed     // etiquetas anuladas por bando, con caducidad
m.uses        // usos restantes por acción
```

Todo detrás de `balance.json › actions.enabled`; con `false` el motor se comporta **exactamente igual que hoy** (se comprueba con las simulaciones de referencia).

### 4.4 Cómo se resuelve una fase con acciones

Hoy: `elegir opciones de equipo → resolver duelos → eventos`. Propuesto:

1. **Preparación**: se aplican `place` y `jam` (afectan a lo que viene después).
2. **Contrajuego**: se evalúan etiquetas (§5) y se anulan/atenúan acciones.
3. **Acciones de información** (`reveal`): rellenan `st.known`.
4. **Acciones de combate** (`ambush`, `downs`, `interrogate`): modifican/ejecutan los duelos que correspondan a su fase.
5. **Apoyo** (`heal`, `revive`).
6. **Duelos normales** de la fase, ahora con `known` (+puntería contra conocidos), `down` (fuera de combate) y `jammed`.
7. Cada paso emite eventos con clave i18n (`ev.act.<accion>.<resultado>`) y visibilidad por bando.

### 4.5 Órdenes condicionales (la clave para no romper el flujo)

El problema: "si derribo a alguien, **entonces** decido interrogar o rematar" es una decisión *durante* la fase. Pausar la fase obligaría a rediseñar red, repetición y IA.

Propuesta: **la decisión se toma antes, como regla**: `hunt_interrogate` significa "si derribo, interrogo"; `hunt_finish`, "si derribo, remato". Es la misma idea que las "reglas de enfrentamiento" tácticas, es determinista, cabe en el diccionario de decisiones y la IA la evalúa sin cambios de arquitectura.

### 4.6 Caso Caveira, paso a paso

Parámetros *(r6data)*: Paso silencioso hasta **10 s** y se recarga al doble de velocidad; sus golpes cuerpo a cuerpo y la Luison **derriban siempre**; interrogar tarda **5 s**, es vulnerable (no puede reaccionar mientras interroga), y al terminar **todos los atacantes vivos quedan marcados 10 s**. Se frustra matando a Caveira o a la víctima.

Traducción propuesta:

1. En `early` (o `site`), con rol roam/hunt, el jugador elige `hunt_interrogate`.
2. Se resuelve el encuentro del roamer con un **bonus de emboscada** (`ambush`, reducido por cada *tracker* atacante vivo: Jackal, Lion, Dokkaebi, Deimos…).
3. **Si pierde** → muere como hoy (sin interrogar).
4. **Si gana** → la víctima queda `down` (no muere).
5. `interrogate`: coste +5 s de reloj. Se tira la **exposición**: probabilidad de que un compañero de la víctima la sorprenda (`base + perAtt × atacantes vivos`, bajada si hay *roamers* atacantes ocupados o `smoke`).
   - **Expuesta** → Caveira muere; la víctima sigue derribada (la rematará su equipo o la revivirá Finka).
   - **A salvo** → la víctima muere y `reveal` marca a todos los atacantes vivos: el defensor **ve sus roles**, y durante el resto de la fase tiene `known` → bonus de puntería contra ellos y se anula el efecto sorpresa de su ruta.
6. Eventos (todos con clave i18n): `ev.act.caveira.hunt`, `.down`, `.interrogate.start`, `.interrogate.exposed`, `.interrogate.ok` (este último visible para los dos bandos: "LOCATION REVEALED", como en el juego).

Sinergias reales que cabrían sin código nuevo: los derribos de Frost (Welcome Mat) y Lesion (Gu Mines) crean `down` y habilitan la interrogación; Finka puede impedirla si revive a tiempo. Contrajuego: ver §5.

## 5. Contrajuego por etiquetas

Cada acción/gadget lleva etiquetas; otras acciones declaran qué etiquetas anulan o atenúan. Así el juego real (Jackal ↔ Mute, Pulse ↔ EMP) se reproduce con **datos**, no con `if` por agente.

| Acción | Etiquetas | La contrarrestan *(r6data)* |
|---|---|---|
| Caveira · Paso silencioso | `stealth` | Jackal (rastreo bien sincronizado), Lion, Dokkaebi, Deimos, Gridlock (corta rutas), Nomad |
| Pulse · Sensor cardiaco | `electronic`, `sensor` | EMP de Thatcher (15 s), EMP de impacto (9 s), IQ (lo localiza mientras escanea) |
| Jackal · Eyenox | `tracker` | Mute (inhibidor), Caveira (paso silencioso) |
| Mute · Inhibidor de señal | `electronic`, `jam` | EMP de Thatcher (15 s), EMP de impacto (9 s), láser de Twitch |
| *Lo que anula Mute* | `remote_charge`, `drone`, `claymore`, `tracker`, `heal` | Cargas de brecha y reforzadas, Thermite, Fuze, Hibana, drones, Claymore, Ace (SELMA), Nomad (Airjab), Jackal (Eyenox), Lion (EE-ONE-D), Finka (Adrenal Surge), Blitz (flash), y la sacudida de Dokkaebi y Grim a su alcance |

Esta tabla es el punto de partida; se amplía agente a agente leyendo sus `notes.md`.

## 6. Arquetipos y asignación de los 75 agentes (propuesta)

Cada agente se asigna a **un arquetipo principal**; el arquetipo fija qué efectos usa y el agente fija los parámetros (tiempos, usos, riesgo). Revisable al leer las notas de cada uno.

### Atacantes
| Arquetipo | Descripción | Agentes |
|---|---|---|
| `breach` | Abre refuerzos y paredes (breach duro o blando) | Thermite, Hibana, Ace, Maverick, Sledge, Buck, Ash, Zofia, Fuze, Ram, Flores |
| `entry_push` | Abre el avance y absorbe daño (escudo, rapel, fragger) | Amaru, Blitz, Montagne, Blackbeard, Osa |
| `scout` | Revela enemigos con drones, cámaras o escáneres | Lion, Grim, Dokkaebi, Deimos, IQ, Iana, Zero, Jackal |
| `anti_gadget` | Destruye o desactiva gadgets defensivos | Thatcher, Twitch, Kali, Brava |
| `vision` | Controla la visión: humo, flash, mira que ve a través del humo | Ying, Capitão, Sens, Glaz, Nomad |
| `flank` | Flanqueo sigiloso y apoyo al avance | Nøkk, Gridlock, Rauora |

### Defensores
| Arquetipo | Descripción | Agentes |
|---|---|---|
| `reveal` | Detecta atacantes por sensor, huellas o cámaras | Pulse, Valkyrie, Maestro, Echo, Alibi, Skopós, Solis |
| `roam_hunt` | Roamer que caza atacantes | Caveira, Vigil, Ela, Oryx |
| `jam` | Contrainformación: bloquea drones y dispositivos | Mute, Mozzie, Tubarão, Warden |
| `anti_breach` | Protege refuerzos y paredes del breach | Bandit, Kaid, Castle, Azami, Mira, Jäger, Wamai |
| `trap` | Trampas y negación de zona (daño, ralentización, miedo) | Kapkan, Frost, Lesion, Smoke, Tachanka, Fenrir, Melusi, Thorn, Aruni, Goyo, Denari, Noor, Clash |

### Ambos bandos
| Arquetipo | Descripción | Agentes |
|---|---|---|
| `support` | Cura, revive o da armadura | Doc, Rook, Thunderbird (def) · Finka (att) |

## 7. Interfaz

Panel **"Acciones de agente"** bajo las decisiones de cada fase; solo muestra agentes **vivos** con una acción disponible **en esa fase**:

```
ACCIONES DE AGENTE                      (máx. 2 por fase)  [ 1 / 2 ]
┌────────────────────────────────────────────────────────────────┐
│ [icono] CAVEIRA · Paso silencioso                     usos 1/1 │
│  ( ) No actuar   (•) Cazar e interrogar   ( ) Cazar y rematar  │
│  +13 s de reloj · riesgo de ser sorprendida ~30 %              │
│  Si gana: revela a todos los atacantes 10 s                    │
│  ⚠ Contrarrestada por: Jackal, Lion, Dokkaebi, Deimos          │
├────────────────────────────────────────────────────────────────┤
│ [icono] PULSE · Sensor cardiaco                       usos 1/1 │
│  ( ) No actuar   (•) Escanear el sitio                         │
└────────────────────────────────────────────────────────────────┘
```

- Cada opción muestra **coste, riesgo, efecto y contrarrestos** con los mismos chips que las decisiones de equipo (reutiliza `modChips`).
- Los contrarrestos se muestran solo si el jugador **conoce** esa información (no desvela la composición rival).
- **Móvil**: tarjetas apiladas, selector segmentado a todo el ancho, objetivos táctiles ≥ 40 px.
- La **ficha de agente** gana una sección "Acciones" (qué puede hacer, con qué coste).
- El **registro de eventos** cuenta lo ocurrido (`Caveira derriba a Ash`, `Caveira interroga…`, `¡Ubicación revelada por Caveira!`).
- Límite de **2 acciones activas por fase** para no saturar (parámetro en config).

## 8. IA rival

- Las acciones son grupos de decisión, así que `decide()` ya las enumera. Problema: el producto de opciones **explota** (3⁵ combinaciones).
- Solución: **ascenso por coordenadas**: se fijan las decisiones de equipo con la heurística actual y se evalúa cada acción de agente por separado con el mismo muestreo de simulaciones; se activan las dos mejores. Presupuesto de simulaciones **constante**.
- `determinize()` ya sortea la información oculta; se extiende para sortear *qué hace el rival con sus acciones*.
- Dificultad configurable: la IA "novata" ignora el contrajuego.

## 9. Datos, textos, red y pruebas

- **Datos**: `config/actions.json` (acciones y efectos), validado por `tools/validate_actions.js` (referencias a agentes, fases y etiquetas válidas).
- **Textos** (i18n, sin frases en código): `action.<id>`, `action.<id>.<opción>`, `ev.act.*`, y claves de panel (`ui.actions*`). Se generan en `tools/gen_locales_d.py`; `check_i18n.js` los valida.
- **Red (P2P)**: sin cambios de protocolo; las acciones son grupos de decisión.
- **Pruebas**:
  - Con `actions.enabled=false` las simulaciones de referencia **deben coincidir** con las actuales.
  - Tests deterministas por efecto (`tools/test_actions.js`, semilla fija): `downs` no mata, `interrogate` expone con la probabilidad esperada, `jam` anula etiquetas, `reveal` caduca.
  - **Balance**: nueva herramienta `tools/action_lift.js` (como `gadget_lift.js`): empuje de cada acción activada vs. desactivada. Criterio: ninguna acción aporta más de ±3 puntos de victoria ni la elige siempre una IA razonable.

## 10. Plan por fases

| Fase | Entregable | Tamaño | Criterio de aceptación |
|---|---|---|---|
| **F0 · Cimientos** ✅ | Esquema `actions.json` + validador, `options()` con grupos `act.*`, panel de UI genérico, claves i18n, interruptor `actions.enabled`, IA por ascenso por coordenadas | M | **Hecho.** Finka (Adrenal Surge, solo `mod`+`time`) funciona de punta a punta; con el interruptor apagado las simulaciones son idénticas a las de antes; 11 pruebas en `tools/test_actions.js` |
| **F1 · Rebanada vertical** ✅ | Estado derribado/revelado/gadgets colocados; efectos `reveal`, `ambush`, `breach`, `revive`, `persist`; **Caveira, Pulse, Jackal, Mute, Thermite, Bandit, Finka** con contrarrestos | L | **Hecho.** Los 7 agentes jugables; 28 pruebas deterministas; el caso Caveira reproducido; empuje de cada acción dentro de ±3 puntos |
| **F2 · IA y balance** | Ascenso por coordenadas, `action_lift.js`, ajuste de parámetros | M | Win-rate de referencia estable (±2 puntos); ninguna acción dominante |
| **F3 · Despliegue por arquetipos** | Parámetros de los 75 agentes derivados de las notas de r6data con `tools/derive_actions.py` (semiautomático) + revisión | L | Todos los agentes con acción; revisión contigo por arquetipo |
| **F4 · (opcional) Capa espacial** | Grafo de habitaciones por mapa para que "revelar" dé posiciones reales | XL | Solo si F1–F3 demuestran valor; proyecto aparte |

Se recomienda cerrar **F0+F1** y probarlo jugando antes de decidir F2–F4: es donde se ve si la idea funciona.

## 10 bis. Estado de F0 (lo construido)

- `config/actions.json`: esquema (acción → agente, bando, fases, usos, requisitos, etiquetas, opciones con `do:[{fx}]`) y `maxActive`. Validado por `tools/validate_actions.js`.
- Motor (`js/engine.js`): `options()` añade los grupos `act.<id>`; `normalizeChoice()` aplica `maxActive` (se conservan las primeras en orden de configuración); `modsOf()` suma los modificadores; `resolve()` calcula las acciones usadas **antes** de resolver (carga el tiempo una vez y emite `ev.act.used`, visible solo para su bando) y descuenta los usos **después** (si se descontaran antes, la acción desaparecería de las opciones mientras se resuelve la fase).
- IA (`js/ai.js`): decisiones de equipo por simulación como antes; acciones de agente por ascenso por coordenadas, limitadas por `maxActive`. Sin acciones, el consumo del generador aleatorio es idéntico al anterior.
- UI: panel "Acciones de agente" en la pantalla de fase (`UI.actionPanel`), con coste, efecto y usos restantes; una columna en móvil.
- i18n: `tools/gen_locales_d.py` falla si una acción no tiene texto en los dos idiomas; `check_i18n.js` valida las claves derivadas.
- Pruebas: `node tools/test_actions.js` (11), más la prueba de punta a punta en navegador.
- Interruptor: `config/balance.json › actions.enabled` (con `false` el juego es idéntico al anterior).

## 10 ter. Estado de F1 (lo construido)

**Motor** (`js/engine.js`)
- *Derribado* = `alive:false, down:true`: así `alive()` sigue valiendo en todo el motor (un derribado no combate) y solo hay que decidir cuándo se remata, se revive o se desangra (al acabar la fase, con la baja acreditada a quien lo derribó).
- *Conocimiento por enemigo* `st.known[bando][id] = fase_hasta`, con caducidad por fases (`ttl`). Conocer a un rival da `balance.actions.knownBonus` en los duelos contra él; un roamer conocido pierde `knownAmbush` de emboscada y es más fácil de detectar.
- *Gadgets colocados* (Mute, Bandit): `persist` los deja en `st.active` toda la ronda; contrarrestan por etiquetas.
- *Contrajuego*: `counters` (etiqueta activa del rival → escala) y `statCounters` (estadística del equipo rival → escala). Un efecto con escala < `fizzleBelow` emite `ev.act.fizzle`.
- *Orden de resolución* en `resolve()`: calcular acciones usadas (con su `when`) → escalas → eventos y efectos inmediatos (`reveal`, `ambush`, `breach`) → la fase normal → reanimaciones → desangrado → descontar usos y registrar gadgets.
- *Información oculta*: `viewFor` oculta al rival `active`, `known`, `uses`, `downBy` y sus decisiones (`choices`).
- Con `actions.enabled=false` el motor es idéntico (mismas cifras y mismo consumo del generador aleatorio).

**Acciones** (`config/actions.json`)

| Agente | Acción | Fases | Efecto | Contrarrestos modelados |
|---|---|---|---|---|
| Caveira | Silent Step | mapa | Emboscada + derribo; orden condicional *rematar* o *interrogar* (expuesta ≈ 10 % + 5 % por atacante vivo; si sale bien, revela a todo el equipo hasta la fase de sitio) | `intel` del equipo atacante, Jackal |
| Jackal | Eyenox | mapa | Marca a un defensor (prefiere roamers), 1 fase más | Mute, Caveira en sigilo |
| Mute | Signal Disruptor | mapa | Colocado toda la ronda: refuerza el anti-breach y frena cargas, curas y rastreo | anti-util del atacante |
| Bandit | Shock Wire | mapa | Colocado toda la ronda: gran refuerzo anti-breach duro | anti-util del atacante |
| Pulse | Heartbeat Sensor | sitio, plantada, post | Revela a 2 atacantes (3 si hay Adrenal Surge) | anti-util del atacante |
| Thermite | Exothermic Charge | entrada (solo con breach duro) | Gran potencia de breacher; fallo avisado si Mute o Bandit la neutralizan | Mute, Bandit |
| Finka | Adrenal Surge | mapa, entrada, sitio, post (3 usos) | Más puntería propia, menos la del rival; reanima a un derribado | Mute |

**Lecciones del modelado** (cosas que no estaban en el diseño y salieron al construir)
1. *El reloj de ronda no es un coste para el defensor.* `st.t` corre contra el atacante; un defensor que gasta tiempo se beneficia. Por eso `time` solo cuenta en acciones atacantes y el coste de las defensivas es la **exposición**. (Una primera versión cobraba 13 s a Caveira, que en realidad la favorecían.)
2. *Los derribos nacen en la fase de mapa*, así que Finka tiene que poder actuar ahí (si no, nunca habría a quién reanimar). Lo detectó la revisión de código, porque mis pruebas fabricaban el derribado a mano.
3. *La duración del revelado importa más que su valor*: con `ttl 1` el interrogatorio no llegaba a la fase de sitio, donde ocurren casi todos los duelos, y restaba 5 puntos de victoria. Con `ttl 2` queda equilibrado.
4. *El gasto de usos va después de resolver la fase*; antes, la acción desaparecía de las opciones mientras se resolvía y su efecto se perdía.
5. *Un multiplicador `*Mul` mayor que 1 refuerza*: el texto "Reduce anti-breach" de la regla antigua era incorrecto para él (clave `mod.<k>.up`).

**Calibración final** (`node tools/action_lift.js 3000`; rondas pareadas, acción forzada frente a no usada, IC 95 %)

| Acción / opción | Empuje (puntos de victoria) |
|---|---|
| Caveira · cazar y rematar | +0,3 ± 0,4 |
| Caveira · cazar e interrogar | +1,2 ± 1,7 |
| Jackal · rastrear | +1,6 ± 2,2 |
| Mute · inhibidores | −0,4 ± 1,5 |
| Bandit · electrificar | +0,2 ± 1,6 |
| Pulse · escanear | +1,5 ± 2,4 |
| Thermite · carga exotérmica | +0,6 ± 0,9 |
| Finka · Adrenal Surge | +2,2 ± 1,1 |

Partidas completas con la IA usando las acciones: el ataque gana ≈ 47,5 % (≈ 48,8 % con las acciones apagadas); sin errores.

**Revisión de código independiente**: sin hallazgos críticos; corregidos los 3 medios (reanimación de Finka inalcanzable, `viewFor` que dejaba pasar las decisiones del rival, `modsOf` aplicando acciones no usadas) y 4 menores (`st.act` residual, revelado más corto que uno vigente, margen de la IA y huecos de `maxActive`, estimación de exposición en la UI).

**Límites conocidos / pendiente**
- Solo 7 agentes; el resto de arquetipos es F3. Los derribos de Frost y Lesion (sinergia con Caveira) y los contrarrestos de Lion, Dokkaebi, Deimos, Gridlock, Nomad, Kaid o Maestro se **muestran** en el texto (son los reales del juego) pero el motor los modela solo de forma general (`intel` y `aUtil` del equipo), no uno a uno.
- "Revelar" da identidad y ventaja en los duelos, no posiciones (no hay mapa espacial: F4).
- Los parámetros están calibrados contra la IA actual; conviene recalibrar al añadir agentes (`action_lift.js`).

## 10 quater. Estado de F3 (lo construido)

Los 75 agentes tienen ya al menos una accion. Se generan, no se escriben a mano.

- **Datos**: `tools/research/action_specs.json` (arquetipos + parametros por agente + escala) -> `python tools/derive_actions.py` -> `config/actions.json` (GENERADO, no editar). Textos: `gen_locales_d.py` (7 acciones a medida) y `gen_locales_e.py` (el resto).
- **Efectos nuevos en el motor**: `buff` (bonus de equipo a una estadistica durante la fase; los gadgets persistentes lo guardan escalado una vez), `trapdown` (trampas que derriban: Frost, Lesion), regla `suppress` (un EMP anula el inhibidor rival de esa fase) y `statCounters` (anti-util atacante debilita gadgets electronicos).
- **Arquetipos**: informacion/drones, roamers con emboscada, anti-breach, trampas, interferencia, apoyo (`support_revive`: Finka, Doc y Thunderbird reaniman a aliados y a si mismos, como en el juego), escudos/cobertura, breach, hostigamiento (`roam_harass`, Ela).
- **Derribos de defensores**: si un bando tiene un reanimador activo en la fase, sus caidos en duelos quedan *derribados* en vez de muertos (la baja se acredita al desangrarse si nadie los levanta). El reanimador levanta primero a los aliados y despues a si mismo (`self: true`), maximo `max` por fase; un reanimador muerto (no derribado) no reanima.
- **Interfaz**: panel compacto; las acciones de una sola opcion son un interruptor con sus chips bajo el titulo, detalles plegables.
- **Revision independiente**: corrigio el aviso de "neutralizado" visible para el rival, la escala obsoleta de los bonus frente al contrajuego de la misma fase (ahora se recalculan con la escala final), Doc/Thunderbird sin consumidor, `foeAim` defensivo sin leer en la fase de mapa, y reanimadores muertos que seguian reanimando. Ademas, tu correccion: Finka, Doc y Thunderbird deben poder levantarse a si mismos y a aliados (mi primera version quitaba el revive a los defensores porque no podian caer; ahora si caen). El validador (`tools/validate_actions.js`) comprueba ahora que cada bonus afecta a una estadistica que el motor consulta en las fases de la accion, y que ambush/breach/revive tienen fase y bando validos.
- **Pruebas**: `test_actions.js` 11, `test_actions_f1.js` 28, `test_actions_f3.js` 16, mas los scripts de navegador. Con `balance.actions.enabled=false` el motor es identico al anterior.
- **Pendiente tras F3**: F2 (IA y balance fino), F4 (capa espacial), re-medir las 70 acciones no tocadas en el ultimo ajuste y revisar 5 imagenes que el test offline no sirve desde cache.
- **Limites**: sin capa espacial (F4); maximo 2 acciones por fase; los bonus persistentes no se contrarrestan en fases posteriores a la suya.

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Saturar al jugador con decisiones | Máx. 2 acciones/fase; solo agentes vivos y con acción disponible; "no actuar" por defecto |
| Desequilibrar el juego | Interruptor global, `action_lift.js`, línea base fijada antes de F1 |
| Explosión combinatoria de la IA | Ascenso por coordenadas, presupuesto constante |
| Estado derribado rompe el fin de ronda | Reglas explícitas y tests: derribado no combate, no cuenta como "vivo" en duelos, sí hasta ser rematado |
| Mecánicas inventadas | Cada parámetro apunta a su nota de r6data; lo que no tiene fuente se marca como propuesta |
| Información oculta filtrada | `viewFor` filtra `st.known` por bando; tests de filtrado |

## 12. Decisiones para el usuario

**Respondidas (2026-10-18):** 1 → F0+F1 con 7 agentes · 2 → órdenes condicionales antes de la fase · 3 → estado `down` mínimo · 4 → 2 acciones por fase (valor por defecto, ajustable en `config/actions.json`) · 5 → sin capa espacial por ahora. El detalle original, con las alternativas descartadas:

1. **Alcance de la primera entrega** → *F0 + F1 con 7 agentes* (Caveira, Pulse, Jackal, Mute, Thermite, Bandit, Finka). Alternativa: todos los arquetipos a la vez (más lento y sin validar la idea).
2. **Modelo de control** → *órdenes condicionales antes de la fase* (§4.5). Alternativa: pausar la fase para decidir en vivo (más inmersivo, pero obliga a rediseñar red, repetición e IA).
3. **Estado "derribado"** → *sí, mínimo* (`down`). Alternativa: abstraerlo como "interrogar = revelar con riesgo", sin derribados (más simple, pierde sinergias con Frost/Lesion/Finka).
4. **Límite de acciones por fase** → *2*. Alternativas: 1 (más simple) o sin límite (más caos).
5. **Capa espacial** → *no ahora* (F4 condicionada al resultado de F1).
