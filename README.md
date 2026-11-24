# Song Painter

An interactive, audio-reactive generative art studio built with **React**, **TypeScript**, and **Vite** that transforms audio and vocal tracks into digital paintings on a web canvas.

> **Status:** Phase 1 Prototype

## Overview

Song Painter analyzes audio input in real time and translates sound dynamics into dynamic brush strokes, textures, and color palettes. Designed with a modular studio interface, it lets users control playback, switch brush styles, and export their generated artwork directly from the browser.

## Features (Phase 1)

- **Audio Playback & Analysis:** Built-in audio player and real-time frequency/amplitude analysis (`useAudioPlayer`, `audioAnalyzer`).
- **Generative Painting Engines:** Modular canvas rendering with standard, vocal-reactive, and automated brush engines (`paintingEngine`, `brushEngine`, `vocalBrush`, `autoPainter`).
- **Customizable Studio Controls:** Interactive controls for switching brush styles, color palettes, and painting parameters (`PaintingControls`, `StyleSelector`, `palettes`).
- **Export Studio:** Dedicated export workflow for saving finished generative artworks (`ExportStudio`, `exportArtwork`).
- **Component Tests:** Unit tests covering core studio controls and style selection (`PaintingControls.test.tsx`, `StyleSelector.test.tsx`).

## Tech Stack

- **Framework & Language:** React, TypeScript
- **Build Tool:** Vite
- **Styling:** CSS

## Project Structure

```text
song-painter/
├── docs/
│   └── phase-1.md          # Phase 1 design and milestone notes
├── src/
│   ├── components/
│   │   ├── layout/         # App header layout
│   │   ├── studio/         # PaintingCanvas, PaintingControls, StyleSelector, ExportStudio & tests
│   │   └── ui/             # AboutModal and shared UI elements
│   ├── hooks/              # Audio playback hook (useAudioPlayer)
│   ├── lib/                # Audio analyzer, brush/painting engines, palettes, export helpers
│   ├── types/              # TypeScript definitions for brushes and studio state
│   ├── App.tsx
│   ├── main.tsx
│   └── styles.css
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
