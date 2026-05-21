# Amadeus blueprint

Blueprint técnico de Project Amadeus. La señal útil de AIRI sigue intacta — **renderer separado del cerebro, unidos por contracts explícitos** — pero el runtime, el LLM API y la TUI los pone [pi](https://pi.dev) (MIT, `@earendil-works/pi-*`). Nosotros aportamos el personaje, la memoria, la relación y el look Steins;Gate.

## Quick path

1. `pnpm` workspace con `apps/amadeus-tui` + 4 packages: `contracts`, `character`, `memory`, `relationship`.
2. Definir `<amadeus_state>` en `amadeus-contracts` ANTES que cualquier wiring.
3. Wirear `pi-agent-core` con el system prompt de Kurisu y el hook que parsea `<amadeus_state>`.
4. Construir el shell TUI con `pi-tui` (`Box` verde fosforito + `Image` para la waifu + `Editor` para input).
5. Agregar memoria y relación detrás de hooks (`transformContext`, `turn_end`).

## Decisión base

| Área | Decisión |
|---|---|
| Runtime de agente | `@earendil-works/pi-agent-core` (event loop, tool calling, hooks) |
| LLM API | `@earendil-works/pi-ai` (multi-provider: Anthropic, OpenAI, Google…) |
| TUI | `@earendil-works/pi-tui` (componentes, overlays, Kitty/iTerm2 images) |
| Web (futuro) | `@earendil-works/pi-web-ui` |
| Persistencia MVP | JSON visible y editable por el usuario |
| Look | Steins;Gate phone — marco verde CRT, retrato central, HUD flotante |
| Expansión futura | Live2D y exposición MCP del estado emocional |

## Lo que NO construimos (pi nos lo da)

| Necesidad | Solución pi |
|---|---|
| Loop de agente, lifecycle de sesión | `Agent` class + `agent.subscribe(event)` |
| System prompt configurable | `initialState.systemPrompt` + `.pi/SYSTEM.md` + `APPEND_SYSTEM.md` |
| Interceptar respuesta del LLM | `agent.subscribe('message_end' \| 'turn_end')` |
| Inyectar contexto antes del LLM | `transformContext(messages, signal) => messages` |
| Bloquear/transformar tool calls | `beforeToolCall` / `afterToolCall` |
| Tool registry con tipos | `agent.state.tools = [...]` (TypeBox schemas) |
| Streaming de tokens | event `message_update` |
| Multi-provider LLM | `getModel('anthropic', '...')` / `'openai'` / `'google'` |
| TUI con overlays flotantes | `tui.showOverlay(comp, { anchor: 'center', ... })` |
| Render de imágenes en terminal | `new Image(base64, mimeType, theme, options)` (Kitty/iTerm2) |
| Markdown highlighting | `new Markdown(text, paddingX, paddingY, theme)` |
| Editor multi-línea con autocompletado | `new Editor(tui, theme, options?)` |
| IME / CJK support | nativo en pi-tui |

## Lo que SÍ construimos

| Package | Responsabilidad | Por qué no lo da pi |
|---|---|---|
| `amadeus-contracts` | `Mood`, `RelationshipState`, `RelationshipDelta`, `MemoryCandidate`, `AmadeusState`, parser de `<amadeus_state>` | Es el lenguaje del personaje, no del agente. |
| `amadeus-character` | Prompt builder de Kurisu, reglas de mood, response parser complementario, guardrails | Identidad — pi es agnóstico. |
| `amadeus-memory` | `memory.json`, save/search/delete, extractor de candidates, comandos `/mem`, `/remember`, `/forget` | Pi no opina sobre cómo recordás. |
| `amadeus-relationship` | `trust/affection/familiarity/annoyance`, reglas de delta, narrative stages, serializer | Pi no opina sobre cómo te vinculás. |
| `apps/amadeus-tui` | Composition root: wirea pi-agent + pi-tui + hooks + componentes Steins;Gate | Es la app — siempre tuya. |

## Arquitectura recomendada

```txt
project-waifu/amadeus/
├── apps/
│   └── amadeus-tui/
│       ├── src/
│       │   ├── main.ts
│       │   ├── ui/
│       │   │   ├── PhoneFrame.ts      # marco verde CRT
│       │   │   ├── WaifuPortrait.ts   # pi-tui Image, swap por Mood
│       │   │   ├── ChatPane.ts        # pi-tui Markdown streaming
│       │   │   ├── InputBar.ts        # pi-tui Editor + slash commands
│       │   │   └── StatusHud.ts       # overlay mood + relationship
│       │   ├── prompts/
│       │   │   └── kurisu.system.md   # personalidad base
│       │   ├── hooks/
│       │   │   ├── parseAmadeusState.ts   # subscribe('message_end')
│       │   │   ├── injectMemory.ts        # transformContext
│       │   │   └── updateRelationship.ts  # subscribe('turn_end')
│       │   └── tools/
│       │       ├── memoryTools.ts     # save/search/delete via tool calls
│       │       └── modeTools.ts       # switch companion|coding|lab|ops
│       └── assets/
│           └── portraits/             # neutral.png, smug.png, embarrassed.png…
└── packages/
    ├── amadeus-contracts/
    ├── amadeus-character/
    ├── amadeus-memory/
    └── amadeus-relationship/
```

## Look Steins;Gate — spec concreta

El feeling "phone de Future Gadget Lab" con Pi-TUI se logra así:

```txt
┌──────────────────────────────────────┐  ← Box(2, 1, bgFn = chalk.bgBlack.green)
│ 22:13   AMADEUS  [companion]   ◉ rec │  ← Text header (clock + mode + status)
├──────────────────────────────────────┤
│                                      │
│             ╔══════════╗             │
│             ║          ║             │  ← Image(portrait, mood-based)
│             ║  KURISU  ║             │     swap por evento parseAmadeusState
│             ║          ║             │
│             ╚══════════╝             │
│                                      │
│  > "El microondas no es un teléfono" │  ← Markdown streaming
│    — pero quizás funcione, baka.    │
│                                      │
├──────────────────────────────────────┤
│ > _                                  │  ← Editor (input)
└──────────────────────────────────────┘
   trust 42  affection 18  fam 7  ann 3   ← StatusHud overlay (anchor: bottom-center)
```

Componentes pi-tui usados:
- `Container` (raíz vertical)
- `Box(2, 1, t => chalk.bgBlack.green(t))` para marco CRT
- `TruncatedText` para header (clock/mode/status)
- `Image(base64Portrait, 'image/png', theme)` para Kurisu — protocolo Kitty/iTerm2
- `Markdown` para mensajes del assistant
- `Editor` para input del user
- `tui.showOverlay(statusHud, { anchor: 'bottom-center', visible: (w,h) => w >= 80 })` para HUD relacional

Fallbacks:
- Terminal sin Kitty/iTerm2 → swap a `WaifuPortraitAscii` con arte ANSI.
- Width chico → HUD se oculta (regla `visible`).

## Flujo de datos

```txt
Usuario teclea en Editor
  -> agent.prompt(text)
    -> transformContext  (inyectamos memoria relevante)
      -> pi-ai (LLM call vía provider)
        -> streaming events: message_update
          -> ChatPane re-render diferencial
        -> message_end
          -> parseAmadeusState  (Mood + RelationshipDelta + MemoryCandidate[])
            -> WaifuPortrait swap (Mood)
            -> StatusHud update
        -> tool_execution_* (si hay tool call)
        -> turn_end
          -> updateRelationship (aplicar delta)
          -> persistMemoryCandidates (filtrar + guardar)
```

## Contrato mínimo de `<amadeus_state>`

```ts
export type Mood =
  | 'neutral'
  | 'thinking'
  | 'annoyed'
  | 'smug'
  | 'embarrassed'
  | 'soft'
  | 'serious'

export type Mode = 'companion' | 'coding' | 'lab' | 'ops'

export interface RelationshipDelta {
  trust: number       // -10..10
  affection: number   // -10..10
  familiarity: number // -10..10
  annoyance: number   // -10..10
}

export interface RelationshipState {
  trust: number       // 0..100
  affection: number   // 0..100
  familiarity: number // 0..100
  annoyance: number   // 0..100
  stage: 'stranger' | 'acquainted' | 'familiar' | 'close' | 'bonded'
}

export interface MemoryCandidate {
  type: 'fact' | 'preference' | 'project' | 'event' | 'goal' | 'boundary' | 'relationship'
  content: string
  importance: number  // 0..10
}

export interface AmadeusState {
  mood: Mood
  relationshipDelta: RelationshipDelta
  memoryCandidates: MemoryCandidate[]
}
```

Convención de protocolo: Kurisu responde en lenguaje natural y al final agrega un bloque oculto:

```xml
<amadeus_state>
{
  "mood": "smug",
  "relationshipDelta": { "trust": 1, "affection": 0, "familiarity": 1, "annoyance": 0 },
  "memoryCandidates": [
    { "type": "preference", "content": "El usuario odia el café instantáneo", "importance": 6 }
  ]
}
</amadeus_state>
```

El parser vive en `amadeus-contracts/src/parseAmadeusState.ts` y es ESTRICTO: respuestas mal formadas no crashean pero emiten un evento de diagnóstico.

## Anti-patrones a evitar

- Meter personalidad dentro de componentes UI — la persona vive en `amadeus-character`, la UI sólo consume `Mood`.
- Acoplar memoria al renderer — la memoria es un package independiente con su propia API.
- Parsear `<amadeus_state>` con regexes dispersos — un solo parser centralizado.
- Replicar lo que ya hace pi (no crear nuestro propio event bus, tool registry o LLM adapter).
- Construir MCP server en MVP — eso es exposición HACIA afuera, no necesario para que la app funcione.
- Live2D antes de tener contracts estables y portraits funcionando.

## Checklist

- [ ] El runtime puede ejecutarse sin renderer (`pi-agent-core` solo, asserts contra eventos).
- [ ] El renderer puede cambiarse (TUI → Web) sin tocar memoria/relación/character.
- [ ] `<amadeus_state>` tiene schema y parser centralizado con tests.
- [ ] La memoria es visible y borrable por el usuario (`memory.json` + `/forget`).
- [ ] Pi-tui Image se degrada a ASCII en terminales sin soporte gráfico.
- [ ] El system prompt de Kurisu vive en un archivo editable, no hardcodeado.

## Next step

El plan ejecutable vive en [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) — 9 work packages ordenados con criterio de aceptación por WP.
