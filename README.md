# Song Painter ✦

A browser-based creative studio that turns local audio into generative visual art.

## Status

**Phase 1 — frontend foundation / proof of concept.** The studio shell, file picker, browser audio playback, basic Web Audio frequency mapping, visual presets, palette controls, and PNG export are included. The visuals are experimental and not yet a refined painting engine.

## Run locally

Requires Node.js 20.19+ or 22.12+ and npm.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To check production output:

```bash
npm run build
npm run preview
```

## Tech

React, TypeScript, Vite, CSS, Web Audio API, Canvas 2D, and Lucide icons. No backend required.

## Privacy

Audio files are loaded through an in-browser object URL. This project does not upload files to any server. The app loads fonts from Google Fonts while online.

## Known limitations

- File playback support varies by browser/codec.
- The renderer uses a simple frequency-energy value, not tempo or semantic mood detection.
- PNG exports capture the current canvas only, not the interface or song audio.
- Visual performance needs testing on low-powered devices.
- This is not yet manual brush-based painting.

See [Phase 1 checklist](docs/phase-1.md).
