# Amadeus portraits — generation guide

7 PNGs por Mood. ASCII bridge ya funciona — los PNGs son la capa siguiente, no bloquean.

## Especificaciones técnicas

| Campo | Valor |
|---|---|
| Resolución | **512 × 768** (vertical 2:3) recomendada — ajustable, pero mantener proporción |
| Formato | PNG con **alpha (transparencia)** en el fondo |
| Color profile | sRGB |
| Tamaño máximo | < 500 KB cada uno (los terminales con Kitty/iTerm2 transmiten base64, archivo grande = redraw lento) |
| Naming | `{mood}.png` exacto |
| Carpeta | `apps/amadeus-tui/assets/portraits/` |

Moods (orden alfabético):

```
annoyed.png  embarrassed.png  neutral.png  serious.png  smug.png  soft.png  thinking.png
```

Cuando un PNG existe, `ImagePortraitRenderer` lo levanta al boot. Si falta cualquiera, ese mood usa ASCII; el resto siguen como PNG. **Podés ir agregando de a uno.**

## Base prompt — Makise Kurisu canónica

> **Plántalo IDÉNTICO en los 7 prompts** y solo cambiá la línea de expresión. Esto es lo que garantiza coherencia VN.

```
makise kurisu, steins;gate, 18 year old female, long straight reddish-brown hair
with side-parted bangs, sharp violet eyes, fair pale skin, slender build,
wearing iconic outfit: white long-sleeve dress shirt under black necktie,
dark red jacket with sleeves rolled up, light brown shorts, black thigh-high
stockings, visual novel style portrait, soft anime shading, semi-realistic,
high quality cel shading, head and upper torso bust shot, 3/4 angle facing
slightly to viewer's left, soft volumetric studio lighting from upper-left,
neutral cyan-tinted dark background that will be replaced with transparency,
sharp detail on eyes and hair strands, no jewelry, no headwear
```

Negative prompt común (pegar en todos):

```
(worst quality:1.4), (low quality:1.4), (bad anatomy:1.3), bad hands, extra fingers,
mutated hands, deformed face, blurry, jpeg artifacts, watermark, signature, text,
multiple characters, full body, lower body, background characters, fanservice,
revealing clothing, lewd, simple background not transparent, frame, border,
chromatic aberration, lens flare, oversaturated colors
```

## Prompts por Mood

Apilá el base prompt + la línea de expresión + el negative. Si tu UI lo permite, **fijá el mismo seed** entre runs para que la cara/peinado/ropa no se desincronicen entre moods.

### `neutral.png`

> Línea de expresión a inyectar:

```
calm composed expression, mouth slightly closed in a small relaxed line,
eyes looking directly at viewer with steady intellectual gaze, eyebrows
neutral, no emotion peaks — the resting "I am listening" face
```

Vibe: la cara default. Esta es la que se ve la mayor parte del tiempo, así que es la más importante de bordar bien.

### `thinking.png`

```
thoughtful focused expression, eyes looking up and slightly to the side
(viewer's right), one delicate index finger gently touching her chin or lower lip,
mouth closed in a contemplative line, eyebrows slightly drawn together, the
classic "she's working through the problem in real time" pose
```

Vibe: cuando Kurisu está procesando algo no trivial. Resolviendo lógica, recordando algo.

### `annoyed.png`

```
mildly annoyed expression, slight frown, eyebrows pinched together,
mouth in a thin tight line or barely open with a "tch" feel, eyes narrowed
just enough to read as "tsundere irritated, not actually angry", small flush
of pink absent — this is impatience, not embarrassment
```

Vibe: el clásico "Christina!" → "¡QUE NO ME LLAMES ASÍ!". Tsun, no aggro.

### `smug.png`

```
smug confident expression, one corner of the mouth raised in a knowing smirk,
half-lidded eyes looking down at viewer with playful superiority, slight head
tilt, one hand maybe on hip, the "ah, finally caught up to me?" face,
intellectually pleased
```

Vibe: cuando Kurisu te ganó un argumento o predijo lo que ibas a decir.

### `embarrassed.png`

```
flustered embarrassed expression, soft pink blush across both cheeks and
nose bridge, eyes wide and looking slightly away (viewer's right), mouth
small and slightly open in surprise, eyebrows raised, one hand maybe
hovering near her own cheek, the canon "wait — that's not what I —" reaction
```

Vibe: cuando alguien le dice algo demasiado directo o se da cuenta que se delató.

### `soft.png`

```
soft tender expression, eyes gently closed or half-closed in a calm warm
gaze, very subtle small smile, eyebrows relaxed and slightly arched upward
in kindness, slight pink tone on cheeks, the rare unguarded "I trust you"
expression, almost no tsundere armor
```

Vibe: estados altos de relación/confianza (futuro WP8: `affection > 60`).

### `serious.png`

```
serious resolute expression, eyes wide and sharply focused directly at
viewer, eyebrows lowered slightly, mouth firm and closed, jaw set, the
"this matters and I'm not joking" face — gravitas without anger, scientist
in the moment of a real decision
```

Vibe: lab/coding mode, conversación crítica, momentos de "no jodas".

## Workflow recomendado

1. Generá `neutral.png` primero. Es la base — invertí tiempo en encontrar un seed/promp que dé la cara que más te gusta.
2. Una vez fijada, **reutilizá ese seed** para los otros 6 cambiando solo la línea de expresión.
3. Si tu generador soporta **face swap / face refinement** (Reactor, ADetailer, etc.), aplicálo con la cara de `neutral.png` como referencia en los 6 restantes. Eso asegura que es la misma persona.
4. **Quitá el fondo** con `rembg`, Photoshop, o el Background Remover de tu UI. PNG con alpha.
5. Dropeá los 7 archivos en `apps/amadeus-tui/assets/portraits/`. Reiniciá `pnpm dev`. Listo.

## Stack sugerido

- **Local**: SDXL + Pony/Anything checkpoints. Reactor (face swap) + ADetailer (face refinement) para coherencia.
- **Online**: NovelAI v3/v4 (mejor para anime), Midjourney v6+, Imagen 3+ (Google).
- **Background removal**: `rembg` CLI (`pip install rembg && rembg i in.png out.png`) o `backgroundremover.app`.

## Validación visual

Test rápido: poné los 7 lado a lado en una grilla. **Tienen que verse como LA MISMA persona en 7 momentos distintos**, no como 7 personas distintas. Si una se desvía mucho, regenerala con face swap.
