# AIVerse Manager

Central Hub and Manager for all your favorite AI tools

Minimal Electron + React + SQLite app to manage AI tools (ChatGPT, NovelAI, ElevenLabs, etc.).

## Development

1. Install deps

```bash
npm install
```

2. Start dev (runs Vite + builds main/preload + launches Electron)

```bash
npm run dev
```

If the Electron window opens before Vite is ready, it will wait for port 5173.

## Tests

1. Downgrade some deps

```bash
npm run rebuild:test
```

2. Run tests

```bash
npm run test
```

3. Upgrade deps back to dev

```bash
npm run rebuild:native
```

## Build (Might not work)

```bash
npm run dist
```

This builds renderer, bundles main/preload with esbuild, and packages with electron-builder.

## Notes

- Database stored at OS userData path (e.g., `%APPDATA%/AIVerse Manager/aiverse.sqlite`).
