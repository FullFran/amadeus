# ADR-0001 — Proveedor LLM por defecto: OpenCode-Go + deepseek-v4-flash

**Estado:** Aceptado
**Fecha:** 2026-06-03

## Contexto

El blueprint original presentaba pi-ai como una capa multi-provider (Anthropic, OpenAI, Google) y recomendaba Anthropic como el proveedor para arrancar. Al momento de implementar WP4 quedó claro que para un companion en modo conversacional el cuello de botella más relevante es la latencia al primer token, no la máxima calidad de razonamiento.

OpenCode-Go es un proxy OpenAI-compatible alojado en `https://opencode.ai/zen/go/v1` que expone `deepseek-v4-flash` con latencias de primer token sensiblemente menores que los endpoints directos de Anthropic en conversaciones cortas. pi-ai lo soporta nativamente como provider `'opencode-go'`.

## Decisión

- **Proveedor por defecto:** `opencode-go` — definido en `apps/amadeus-tui/src/config/env.ts` como constante `AMADEUS_PROVIDER`.
- **Modelo por defecto:** `deepseek-v4-flash` — instanciado en `apps/amadeus-tui/src/agent/createAgent.ts` via `getModel('opencode-go', 'deepseek-v4-flash')`.
- **Nivel de thinking:** `'off'` en modo companion para maximizar velocidad de respuesta; se puede subir a `'low'`/`'medium'` en modos `coding`/`lab` (WP9).
- **Fallback documentado:** `anthropic` — soportado vía `AMADEUS_PROVIDER=anthropic` + `ANTHROPIC_API_KEY`.
- pi-ai conserva toda su capacidad multi-provider; la elección del default no cierra ninguna puerta.

## Consecuencias

- Los nuevos usuarios necesitan `OPENCODE_API_KEY` (no `ANTHROPIC_API_KEY`) para arrancar. El `.env.example` en la raíz del monorepo debe reflejarlo.
- Cambiar de proveedor hoy implica editar `AMADEUS_PROVIDER` en `config/env.ts` y reiniciar. Una mejora futura sería leerlo desde una variable de entorno en runtime sin recompilar.
- La calidad de respuesta del modelo (deepseek-v4-flash) es inferior a Opus/Sonnet en razonamiento complejo; la compensación es intencional para companion mode. Para sesiones de `coding`/`lab` con WP9, se puede cambiar el modelo por `kimi-k2.6` o `deepseek-v4-pro` sin tocar la infraestructura.
- La voz y el "carácter" de las respuestas puede diferir de lo que se obtendría con Claude — es un tradeoff de latencia vs. fidelidad de personalidad que puede revisarse si el UX lo requiere.

## Referencias

- `apps/amadeus-tui/src/agent/createAgent.ts` — `KURISU_MODEL`
- `apps/amadeus-tui/src/config/env.ts` — `AMADEUS_PROVIDER`, `ENV_VAR_FOR_PROVIDER`
