# PROGRESS — minesweeper-clean

Handoff file for any model/human picking this up. Keep it current.

## Goal
A one-to-one-feeling web copy of "Minesweeper – The Clean One" (Dustland Design, Android):
minimal, sleek, nicely animated. 5 presets + custom size. Mobile-first PWA (add to home screen),
equally clean on desktop. No backend; everything in localStorage.

## Rules
- Vite + TypeScript, **vanilla DOM** (no framework). Animations are CSS transforms/opacity only.
- `src/engine/` is pure logic with no DOM, and is covered by Vitest.
- Controls: tap reveals, long-press flags (adjustable delay). There's also an on-screen reveal/flag toggle (flag mode swaps them).
  Desktop: left reveals, right flags, middle/left+right or clicking a number chords.
- Every localStorage access goes through `src/state/storage.ts` (versioned key `mcs:v1`, try/catch).
- Commit and push after every milestone. Pages deploys from `main` via `.github/workflows/deploy.yml`.
- Local npm: `npm install --cache <tmpdir>` (~/.npm has root-owned files on this Mac).

## Architecture
```
src/engine/board.ts      game state, lazy mine placement (first tap safe), BFS reveal w/ depth, chord, serialize
src/engine/presets.ts    Beginner 9x9/10, Intermediate 16x16/40, Expert 16x30/99, Master 24x30/150, Insane 30x50/300
src/ui/boardView.ts      DOM grid, cached class strings (only changed cells touched), animation choreography
src/ui/icons.ts          inline stroke SVG icons
src/styles/              theme.css (6 themes as CSS vars), board.css (cells + keyframes), ui.css (HUD, dock, sheets, desktop @media)
src/ui/gestures.ts       pointer events: tap / long-press / pan / pinch / mouse buttons
src/ui/viewport.ts       transform zoom+pan, fit-to-screen
src/ui/hud.ts            counter, timer, restart, mode toggle
src/ui/sheets.ts         new game / custom / settings / stats (bottom sheet on mobile, modal on desktop)
src/state/storage.ts     saves per difficulty, stats, best times, settings
```
Deploy: GitHub Pages (`BASE_PATH=/minesweeper-clean/`). Container: `docker compose up --build` → :8080
(nginx, multi-stage Dockerfile, `BASE_PATH` build arg defaults to `/`).

## Checklist
- [x] M1 Scaffold: Vite+TS, repo, Pages workflow, Docker, PROGRESS.md
- [x] M2 Engine + tests (19 Vitest cases)
- [x] M3 Board rendering + gestures + viewport (playable)
- [x] M4 HUD, presets, custom, autosave, stats
- [x] M5 Themes, animations, haptics, desktop polish
- [x] M6 PWA icons/offline, iOS metas
- [ ] Test on a real iPhone/Android from the Pages URL (Add to Home Screen)
- [ ] Ideas: no-guess board generation, multi-tab storage sync, README screenshots

## Log
- 2026-10-25: M1 scaffold. Toolchain: vite 8.3, vitest 5, typescript 7, vite-plugin-pwa 2. Docker build/run on node:22-alpine + nginx:1.27-alpine.
- 2026-10-25: M2 engine. Lazy placement keeps the 3x3 around the first tap clear (falls back to the tapped cell alone when dense). Reveal/chord return BFS depth for animation. The timer pauses on restore and resumes on the next move.
- 2026-10-25: M3–M6 UI. Notes for the next person:
  - Zoom: during a gesture only the transform scales; `Viewport.commit()` bakes it into `--cell` so text stays crisp. Gap = 0.1 × cell (GAP in viewport.ts must match board.css).
  - Hit-testing is maths (`Viewport.cellAt`), not DOM targets.
  - Mouse input uses mouse events (chorded buttons don't fire extra pointerdowns). Touch uses pointer events with preventDefault, which suppresses compatibility mouse events.
  - The board shake uses the CSS `translate` property so it composes with the viewport transform.
  - Restarting a started game counts as a loss. Switching levels keeps each level's save.
  - Stats: one bucket per preset plus one `custom` bucket (custom best times store their size).
  - Dev-only hook `window.__ms` ({board, view, vp}) for scripted screenshot tests (puppeteer-core in a scratch dir).
  - Only the Latin Inter subsets are precached (~230 KiB in total).
