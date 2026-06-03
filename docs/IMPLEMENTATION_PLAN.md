# Amadeus implementation plan

Plan ejecutable para levantar Project Amadeus apoyándonos en [pi](https://pi.dev) para el runtime/TUI/LLM y construyendo arriba los packages propios de personaje, memoria y relación.

> Prerequisito: leer [`README.md`](./README.md) (blueprint) — explica POR QUÉ esta arquitectura, qué nos da pi y qué construimos nosotros.

## Estado actual

> Actualizado: 2026-06-03

| WP | Estado | Notas |
|---|---|---|
| WP1 bootstrap | ✅ Completo | `.prototools` no existe (Node 24 real); package es `@amadeus/tui` |
| WP2 contracts | ✅ Completo | `parseAmadeusState` + 38 tests |
| WP3 character | ✅ Completo | `buildSystemPrompt`, `responseSanitizer`, `moodRules`; `resolveMood` wired |
| WP4 wiring | ✅ Completo | Diseño basado en `message_end` (no `turn_end`); ver nota en WP4 |
| WP5 TUI shell | ✅ Completo | Shell Steins;Gate funcional con streaming |
| WP6 WaifuPortrait | ✅ Completo | ASCII fallback activo; ruta Kitty/Image implementada, esperando PNGs en `assets/portraits/` |
| WP7 memory | ⚠️ Core completo | `@amadeus/memory`: store/extract/append/search, `memory.json`, candidates con importance≥5 persisten e inyectan contexto cada turno. **Pendiente**: slash commands `/mem`, `/remember`, `/forget` |
| WP8 relationship | ⚠️ Core completo | `@amadeus/relationship`: `applyDelta`/`narrativeStage`/store, `relationship.json`, delta aplicado+persistido cada turno, stage modula tono vía `buildSystemPrompt`. **Pendiente**: slash command `/state` y overlay `StatusHud` |
| WP9 modes + tools | ❌ No iniciado | |

**Continuidad live:** antes de cada prompt la app recompone `agent.state.systemPrompt` con el estado actual de relación + las memorias relevantes al mensaje del usuario (equivalente práctico del `transformContext` planeado). Persistencia en `$XDG_DATA_HOME/amadeus` (default `~/.local/share/amadeus`), override con `AMADEUS_DATA_DIR`.

## Quick path

1. WP1 monorepo pnpm con 4 packages + 1 app.
2. WP2 contracts (`<amadeus_state>` + parser) ANTES de cualquier wiring.
3. WP3 character (system prompt Kurisu + mood rules).
4. WP4 wiring mínimo: pi-agent + character + parseAmadeusState → primer turno con personalidad y estado parseado.
5. WP5–6 shell TUI Steins;Gate + retrato de la waifu.
6. WP7–8 memoria y relación detrás de hooks.
7. WP9 modos y tool gating.

## Resultado esperado del MVP

Al final de WP9 deberías tener:

- TUI funcional con marco Steins;Gate verde CRT.
- Retrato de Kurisu cambiando por `Mood` (Kitty/iTerm2 o fallback ASCII).
- Streaming de respuesta vía pi-ai (default: OpenCode-Go + `deepseek-v4-flash`; provider configurable via `AMADEUS_PROVIDER`).
- Parser de `<amadeus_state>` con tests.
- Memoria JSON persistente, visible y editable.
- Relación con deltas aplicados turno a turno y narrative stage.
- 4 modos: companion / coding / lab / ops, con tools gateadas por modo.

## Stack base — dependencias confirmadas

```jsonc
// apps/amadeus-tui/package.json (peer deps esperadas)
{
  "dependencies": {
    "@earendil-works/pi-agent-core": "^0.75.3",
    "@earendil-works/pi-ai": "^0.75.3",
    "@earendil-works/pi-tui": "^0.75.3",
    "@amadeus/contracts": "workspace:*",
    "@amadeus/character": "workspace:*",
    "@amadeus/memory": "workspace:*",
    "@amadeus/relationship": "workspace:*",
    "chalk": "^5"
    // @sinclair/typebox ^0.34 — incorporar en WP9 (tool schemas); no instalado aún
  }
}
```

## Work packages

## WP1 — bootstrap del monorepo

### Objetivo

Dejar el esqueleto listo SIN crear packages que no vamos a tocar ya.

### Entregables

- `pnpm-workspace.yaml`
- `tsconfig.base.json`
- `package.json` raíz con scripts `dev`, `build`, `typecheck`, `lint`, `test`
- 4 packages stub (`@amadeus/contracts`, `@amadeus/character`, `@amadeus/memory`, `@amadeus/relationship`) — cada uno con `package.json`, `tsconfig.json`, `src/index.ts` vacío
- `apps/amadeus-tui` stub con `src/main.ts` que sólo importa pi y arranca un TUI vacío
- `.gitignore`, `.editorconfig` _(`.prototools` no existe — el piso real es Node 24, declarado en `engines.node` del `package.json` raíz)_
- ESLint config compartido (clonar de AIRI si querés)

### Estructura

```txt
amadeus/
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── .gitignore
├── .editorconfig
├── apps/
│   └── amadeus-tui/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/main.ts
└── packages/
    ├── contracts/{package.json,tsconfig.json,src/index.ts}
    ├── character/{package.json,tsconfig.json,src/index.ts}
    ├── memory/{package.json,tsconfig.json,src/index.ts}
    └── relationship/{package.json,tsconfig.json,src/index.ts}
```

### Criterio de aceptación

- [ ] `pnpm install` instala pi-* y los packages workspace sin warnings
- [ ] `pnpm -F @amadeus/tui typecheck` pasa
- [ ] `pnpm -F @amadeus/tui dev` arranca un TUI vacío y se cierra con Ctrl+C limpio
- [ ] Cada package workspace exporta vacío sin romper

## WP2 — amadeus-contracts (PRIMERO, no te saltes esto)

### Objetivo

Definir el lenguaje del sistema antes de escribir lógica.

### Entregables

- `Mood`, `Mode`
- `RelationshipState`, `RelationshipDelta`
- `MemoryCandidate`
- `AmadeusState`
- `parseAmadeusState(text)` — extrae el bloque `<amadeus_state>` de una respuesta
- Tests con vitest

### Archivos sugeridos

```txt
packages/contracts/src/
├── mood.ts
├── mode.ts
├── relationship.ts
├── memory.ts
├── amadeusState.ts
├── parseAmadeusState.ts
└── index.ts
packages/contracts/test/
└── parseAmadeusState.test.ts
```

### Criterio de aceptación

- [ ] Parser maneja: bloque válido, bloque ausente, JSON malformado, campos faltantes
- [ ] No crashea — devuelve `{ ok: false, error }` o `{ ok: true, state }`
- [ ] Tests cubren las 4 ramas
- [ ] Tipos exportados consumibles desde `amadeus-character` y la app

## WP3 — amadeus-character

### Objetivo

Materializar la persona de Kurisu y las reglas de mood en algo testeable.

### Entregables

- `kurisu.system.md` — prompt base (personalidad, tone, instrucciones de protocolo `<amadeus_state>`)
- `buildSystemPrompt({ mode, relationshipState, recentMemories })` — compone prompt final
- `moodRules.ts` — heurísticas de transición (ej: si `annoyance > 70` → bias hacia `annoyed`)
- `responseSanitizer.ts` — limpia el bloque `<amadeus_state>` del texto visible al user
- Fixtures conversacionales mínimas para tests

### Archivos sugeridos

```txt
packages/character/src/
├── prompts/
│   └── kurisu.system.md
├── buildSystemPrompt.ts
├── moodRules.ts
├── responseSanitizer.ts
└── index.ts
packages/character/test/
├── buildSystemPrompt.test.ts
└── responseSanitizer.test.ts
```

### Criterio de aceptación

- [ ] El prompt cambia entre modos (companion vs coding)
- [ ] El prompt incluye recentMemories cuando se le pasan
- [ ] `responseSanitizer` quita el bloque XML del output visible
- [ ] El package NO importa pi — es puro dominio

## WP4 — primer wiring (prueba de vida)

### Objetivo

Demostrar que pi + character + parser ya forman un agente Kurisu vivo, sin UI bonita.

### Entregables

- `apps/amadeus-tui/src/main.ts` armado:
  - Crea `new Agent({ initialState: { systemPrompt: buildSystemPrompt({...}), model: ... } })`
  - Subscribe a `message_end` → llama `parseAmadeusState`, aplica el `RelationshipDelta` y persiste candidates (el fold de estado ocurre aquí, no en `turn_end`)
  - _(nota: `turn_end` no se usa — toda la lógica de estado se resuelve en `message_end`)_
  - Loop simple: leer línea de stdin, `agent.prompt(line)`, imprimir streaming
- Configuración de provider vía env (`OPENCODE_API_KEY` para el default OpenCode-Go; `ANTHROPIC_API_KEY` para el fallback Anthropic — ver `config/env.ts`)

### Archivos sugeridos

```txt
apps/amadeus-tui/src/
├── main.ts
├── agent/
│   ├── createAgent.ts
│   └── attachStateHooks.ts
└── config/
    └── env.ts
```

### Criterio de aceptación

- [ ] Escribís "hola" y Kurisu responde EN PERSONAJE
- [ ] El bloque `<amadeus_state>` aparece en la respuesta cruda
- [ ] El parser extrae correctamente `Mood`, `RelationshipDelta`, `MemoryCandidate[]`
- [ ] El texto visible al user NO incluye el bloque XML (sanitizer aplicado)
- [ ] Ctrl+C cierra limpio sin requests colgados

## WP5 — TUI shell Steins;Gate

### Objetivo

Construir el chasis visual sin meter lógica de dominio en los componentes.

### Entregables

- `PhoneFrame` — wrapper `Box` con bg verde fosforito
- `Header` — clock + mode badge + status indicator
- `ChatPane` — `Markdown` que se actualiza con events `message_update`
- `InputBar` — `Editor` con submit on Enter
- Layout vertical: Header → ChatPane (flex) → InputBar
- Palette + theme constants

### Archivos sugeridos

```txt
apps/amadeus-tui/src/ui/
├── theme.ts            # paleta verde CRT, colores por Mood
├── PhoneFrame.ts
├── Header.ts
├── ChatPane.ts
├── InputBar.ts
└── layout.ts           # composición vertical
```

### Criterio de aceptación

- [ ] Visualmente reconocible como "phone Steins;Gate" (verde, marco, monospace)
- [ ] `Editor` recibe input y dispara `agent.prompt` al Enter
- [ ] `ChatPane` renderiza streaming sin flicker (diferential rendering de pi-tui)
- [ ] Header muestra modo actual
- [ ] Resize del terminal no rompe layout

## WP6 — WaifuPortrait

### Objetivo

Que Kurisu CAMBIE DE EXPRESIÓN según `Mood`.

### Entregables

- Assets PNG en `apps/amadeus-tui/assets/portraits/` (un PNG por mood)
- `WaifuPortrait` componente que recibe `Mood` y renderiza el PNG correspondiente con `pi-tui Image`
- Mapping `mood → portrait file`
- Fallback ASCII para terminales sin Kitty/iTerm2 (detectar al boot)
- Hook que escucha `message_end` → si parseAmadeusState tuvo éxito, actualiza el portrait

### Archivos sugeridos

```txt
apps/amadeus-tui/src/ui/
├── WaifuPortrait.ts
├── portraitMap.ts        # Record<Mood, string>
└── WaifuPortraitAscii.ts # fallback
apps/amadeus-tui/assets/portraits/
├── neutral.png
├── thinking.png
├── annoyed.png
├── smug.png
├── embarrassed.png
├── soft.png
└── serious.png
```

### Criterio de aceptación

- [ ] Mood `neutral` muestra `neutral.png`
- [ ] Al cambiar Mood, el portrait se swappea sin redibujar todo el TUI
- [ ] En terminal sin soporte gráfico, cae a ASCII sin crashear
- [ ] El componente no parsea estado — sólo recibe `Mood` como prop

## WP7 — amadeus-memory + injectMemory hook

### Objetivo

Dar continuidad a la conversación con memoria visible y editable por el usuario.

### Entregables

- `memoryStore.ts` — load/save de `memory.json`
- `saveMemory`, `searchMemory(query, k)`, `deleteMemory(id)`
- `extractMemoryCandidates(state)` — filtra `MemoryCandidate[]` por importance
- `injectMemoryHook` — `transformContext(messages)` que inyecta memorias relevantes al system prompt antes del LLM call
- Slash commands en `InputBar`: `/mem` (listar), `/remember <text>`, `/forget <id>`

### Archivos sugeridos

```txt
packages/memory/src/
├── memoryTypes.ts
├── memoryStore.ts
├── saveMemory.ts
├── searchMemory.ts
├── deleteMemory.ts
├── extractMemoryCandidates.ts
└── index.ts
apps/amadeus-tui/src/hooks/
└── injectMemory.ts
apps/amadeus-tui/src/commands/
├── mem.ts
├── remember.ts
└── forget.ts
```

### Criterio de aceptación

- [ ] `memory.json` se crea al primer save y persiste entre runs
- [ ] `/mem` lista todas las memorias con id
- [ ] `/remember "El user usa Linux"` agrega memoria manual
- [ ] `/forget <id>` borra
- [ ] Después de un turno con MemoryCandidate de importance >= 5, la memoria queda guardada
- [ ] El siguiente turno tiene esa memoria inyectada en el contexto (verificable por debug log)

## WP8 — amadeus-relationship + updateRelationship hook

### Objetivo

Que el tono de Kurisu cambie con continuidad real, no random.

### Entregables

- `relationshipStore.ts` — load/save `relationship.json`
- `applyDelta(state, delta)` — clampea 0..100, calcula stage
- `narrativeStage.ts` — `stranger | acquainted | familiar | close | bonded` derivado de los valores
- `updateRelationshipHook` — `subscribe('turn_end')` → aplica delta del último `AmadeusState`
- Slash command `/state` que imprime el estado actual

### Archivos sugeridos

```txt
packages/relationship/src/
├── relationshipState.ts
├── relationshipRules.ts
├── applyDelta.ts
├── narrativeStage.ts
├── relationshipStore.ts
└── index.ts
apps/amadeus-tui/src/hooks/
└── updateRelationship.ts
apps/amadeus-tui/src/commands/
└── state.ts
```

### Criterio de aceptación

- [ ] Después de cada turno el state se actualiza y persiste
- [ ] `/state` muestra trust/affection/familiarity/annoyance + stage
- [ ] Cuando `trust` cruza thresholds, el stage cambia
- [ ] El `buildSystemPrompt` recibe el stage actual y modula tono (verificable: prompt al LLM cambia)
- [ ] StatusHud (overlay) muestra los valores en vivo

## WP9 — modos y tool gating

### Objetivo

Separar `companion` de `coding` de `lab` / `ops` con policy real.

### Entregables

- `Mode` switching vía slash command `/mode companion|coding|lab|ops`
- Tool registry por modo
- `beforeToolCall` hook que rechaza tools no permitidas en el modo actual
- Tools mínimas implementadas:
  - `companion`: `recall_memory`, `set_mood` (debug)
  - `coding`: `read_file`, `write_file`, `run_bash` (con confirmación)
  - `lab`: `research_note`, `compare_options`
  - `ops`: stub (reservado)

### Archivos sugeridos

```txt
apps/amadeus-tui/src/modes/
├── modeRegistry.ts
├── companionMode.ts
├── codingMode.ts
├── labMode.ts
└── opsMode.ts
apps/amadeus-tui/src/tools/
├── memoryTools.ts
├── codingTools.ts
└── labTools.ts
apps/amadeus-tui/src/hooks/
└── enforceModePolicy.ts
apps/amadeus-tui/src/commands/
└── mode.ts
```

### Criterio de aceptación

- [ ] `/mode coding` cambia las tools disponibles
- [ ] En `companion`, intentar llamar `run_bash` queda bloqueado por `beforeToolCall`
- [ ] El prompt cambia con el modo (via `buildSystemPrompt({ mode, ... })`)
- [ ] Header del TUI refleja el modo actual

## Orden recomendado de ejecución

1. WP1 bootstrap
2. WP2 contracts (parser con tests — crítico)
3. WP3 character (prompt + sanitizer)
4. WP4 wiring mínimo (prueba de vida)
5. WP5 TUI shell Steins;Gate
6. WP6 WaifuPortrait
7. WP7 memoria + slash commands
8. WP8 relación + StatusHud
9. WP9 modos + tool gating

## Milestone MVP

El MVP está vivo cuando esto pasa de punta a punta:

```txt
Usuario escribe en InputBar (Steins;Gate phone)
  → agent.prompt(text)
    → transformContext inyecta memorias relevantes
      → pi-ai dispara LLM (Anthropic/OpenAI/Google)
        → streaming aparece en ChatPane
        → message_end firea parseAmadeusState
          → WaifuPortrait swappea PNG (Kitty)
          → StatusHud refleja nuevo trust/affection
        → message_end aplica RelationshipDelta y persiste (turn_end no se usa)
        → MemoryCandidates con importance >= 5 se guardan en memory.json
```

## Riesgos y control

| Riesgo | Control |
|---|---|
| Pi rompe API entre versiones (está en 0.x) | Caret `^0.75.3` + lockfile que fija `0.75.3` exacto; tests de integración del wiring |
| Kurisu se olvida del protocolo `<amadeus_state>` | Recordatorio en system prompt + parser tolerante + diagnostic log |
| El LLM produce JSON inválido en el bloque | Parser nunca crashea, devuelve `{ ok: false }` y se loggea |
| Terminal sin Kitty/iTerm2 (la mayoría sobre SSH) | Fallback ASCII detectado en boot |
| Memoria crece sin tope | `extractMemoryCandidates` filtra por importance + futuro: rotación |
| Tool calls del modo coding peligrosas | `beforeToolCall` con confirmación interactiva para bash/write |
| Forkear pi por algún hook faltante | NO — primero validar que un work-around vía tool o subscribe alcance |
| ESLint `node/prefer-global/process` | Config necesita ajuste — el flag falla en ESM donde `require('process')` sería incorrecto; deuda conocida |

## Checklist de salida del MVP

- [ ] El monorepo levanta con `pnpm install && pnpm -F @amadeus/tui dev`
- [ ] `amadeus-contracts` está antes que la UI y tiene tests del parser
- [ ] `amadeus-character` no importa pi
- [ ] `apps/amadeus-tui` es el único punto que conoce pi-agent-core y pi-tui
- [ ] Memoria visible (`memory.json`) y borrable (`/forget`)
- [ ] Relación persiste y modula el tono
- [ ] El portrait cambia con el `Mood`
- [ ] El modo se puede cambiar y las tools se gatean
- [ ] Funciona con al menos un provider (OpenCode-Go + `deepseek-v4-flash` por defecto; requiere `OPENCODE_API_KEY`)

## Post-MVP (no entran en estos 9 WPs)

- **WP10 — diagnostics**: trace de prompts, diff de state, debug panel overlay
- **WP11 — web renderer**: `apps/amadeus-web` con `pi-web-ui`
- **WP12 — Live2D**: mapper `Mood/PortraitState → Live2D params` consumiendo los mismos contracts
- **WP13 — MCP exposure**: servidor MCP que expone `searchMemory`, `getRelationshipState`, `sendMessage` para que Claude Code/Cursor puedan hablar con Amadeus desde afuera
- **WP14 — voice**: TTS de respuestas, STT de input

## Next step

Crear el monorepo (WP1). El siguiente artefacto útil sería `BOOTSTRAP_TASKS.md` con tareas archivo por archivo de WP1+WP2 si vas a delegar la implementación, o pasar directo a `pnpm init` si lo hacés vos.
