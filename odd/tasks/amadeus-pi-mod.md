Objective: turn Amadeus into a Pi mod, the way Gentle Shell is one, with the waifu as the interface.
Branch: feat/pi-mod. Delivery strategy: ask-on-risk. Test runner: vitest (`pnpm test:run`).

## Specs

- S1. "que sea un mod de pi igual que lo es gentle shell"
- S2. Interface: "la novela visual es lo que mas me gusta", meaning a large character in one column with Pi's chat beside it.
- S3. Spike: "utilizar alguna pet de las de familiard para hacer la prueba" and "que la prueba para ver que hace bien las animaciones y demas sea aprobechando una pet". Acceptance: a familiard pet sheet animates in the column, and changes pose with Pi's real agent events.
- S4. Assumption, not yet requested as such: pet art is read from the local gallery and is never committed, because fan packs stay out of shared repos.
- S5. Connections: "tenemos que poder conectar Notion para el metaharness" and "agentmail para que se comunique"; "es solo dejarle poder conectarse a mcp". Not started.
- S6. "yo tambien actualizaria esto que es antiguo y pi ha cambiado mucho" and "tal vez deberiamos simplificar el proyecto". Not started.

## Tasks

- [x] T1 (S2, S3, S4) Stage spike in `spikes/vn-stage`: sheet decoding, half-block renderer, pose state machine, column beside the chat. Route: inline, no writer trigger. Commit: dd37416.
- [x] T2 (S2) Check images through Kitty in Ghostty. Route: inline. Commits: a3d21a6, 66ceab3. Seen working by the user in Ghostty through tmux.
- [ ] T3 (S1) Hide state tags during streaming with a `streamSimple` wrapper. Route: inline. Commit: 05799fd. Verified with a scripted model; pending a run on the real model.
- [ ] T4 (S1, S6) Launcher with its own home, soul hooks, retire the old TUI. Route: inline. Pending.
- [ ] T5 (S1) Character pack outside the code. Route: inline. Pending.
- [ ] T6 (S5) MCP: Notion, then AgentMail with its own mailbox and a send gate. Route: inline. Pending; needs a credential from the user.
- [ ] T7 (S6) familiard lifecycle, plan and ADR-0001 update. Route: inline. Pending.

## Log

- L1 (2026-11-01, user): "este proyecto, tenemos que actualizarlo con todo lo que hemos aprendido de gentleshell y familiard"
- L2 (2026-11-01, user): "esque queremos hacer amadeus de steins gate... pero que sea un mod de pi igual que lo es gentle shell!!"
- L3 (2026-11-01, user): "pero, tenemos que poder conectar Notion para el metaharness!! y agentmail para que se comunique. pero esque eso no hay que montarlo lo tenemos ya montado!! revisa notion. es solo dejarle poder conectarse a mcp"
- L4 (2026-11-01, user): "sisi, la novela visual es lo que mas me gusta jajajaj. puedes por ahora utilizar alguna pet de las de familiard para hacer la prueba? arranca y que la prueba para ver que hace bien las animaciones y demas sea aprobechando una pet"
- L5 (2026-11-01): the column uses Gentle Shell's technique of wrapping the layout root's layout node, an undocumented internal of pi-tui. Half-blocks come first because the user's tmux has `allow-passthrough off`, which blocks Kitty images, and because their output can be checked from a tmux capture.
- L6 (2026-11-01): T1 evidence, in a private tmux at 150x48 with a scripted provider. A turn showed `idle > thinking > tool > thinking > speaking > celebrating > idle`, though `tool` is so short that a later sample missed it. `/stage demo` played all seven poses. Below 100 columns the column is gone and the chat takes the whole width. kurisu and my-pet draw; a 17-test file covers sheet and pose logic; `index.ts` has no automated test.
- L7 (2026-11-01): open problems for T4. Idle cost is about 5.5% of one core against 0.8% without the stage, and memory 271-491 MB against 123 MB; removing a per-render rescale barely helped CPU, so the cause is not established. Iria's sheet (2765x2059) is rejected because frames are found by grid, while familiard finds them through transparent gaps. Pi also lists ambient skills at startup, which a companion must disable. Not seen by a human yet in a real terminal.
- L8 (2026-11-01, user): "vale funciona jajajaja hay que mejorar cosas de la vision pero funciona xD se ve pixelada si"
- L9 (2026-11-01): T2 uses Kitty unicode placeholders. In a private tmux with no outer terminal: the column holds placeholder cells colored with the image id, frames upload once, the turn still walks its poses. Idle measured 2.7% of one core and 237 MB, against 5.5% and 271-491 MB with half-blocks. No image has been seen by anyone yet.
- L10 (2026-11-01, user): sent a screenshot, "asi se ve". Kitty works through tmux in Ghostty, large and sharp, with a magenta outline.
- L11 (2026-11-01): the outline is in the sheet: 28162 partly transparent magenta pixels in kurisu, more hidden under transparency, and an outline tinted by it. Removed in 66ceab3, checked on a rendered frame, not yet by the user in Ghostty. Still open for T4: Pi's startup noise (skill list, conflicts, tmux warning) in the chat.
- L12 (2026-11-01, user): "sigue!"
- L13 (2026-11-01): T3. In a private tmux, 295 samples of a scripted turn with tags split every 5 characters showed no tag fragment in the screen; the caption went `thinking > speaking · smug > celebrating · soft > idle · soft`; the mood arrived 1 ms before the first text. Open, needs the real model: the agent's history now holds clean text, so the model no longer sees its own tags in earlier turns and may stop writing them. The repo's `.env` cannot be read from this session, so the real run is the user's.
- Next: the user runs `spikes/vn-stage/run.sh --real` for a few turns and shares the mood log; then T4.
