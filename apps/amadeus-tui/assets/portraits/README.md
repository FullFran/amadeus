# Portrait assets

Dropeá 7 PNGs acá, uno por mood:

```
annoyed.png  embarrassed.png  neutral.png  serious.png  smug.png  soft.png  thinking.png
```

Guía de generación (specs, prompts SD/Midjourney por mood, workflow): [`docs/PORTRAITS.md`](../../../../docs/PORTRAITS.md)

**Hot reload**: pi-tui carga los PNGs al arrancar — agregás archivos, reiniciás `pnpm dev`, listo. Los moods que no tengan PNG caen al ASCII fallback automáticamente.
