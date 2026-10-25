# PROGRESS — minesweeper-clean

Handoff file for any model/human picking this up. Keep it current.

## Goal
A one-to-one-feeling web copy of "Minesweeper – The Clean One" (Dustland Design, Android):
minimal, sleek, nicely animated. 5 presets + custom size. Mobile-first PWA (add to home screen),
equally clean on desktop. No backend; everything in localStorage.

## Rules
- Look = "Minesweeper – The Clean One" (Dustland Design, Android). Reference: Play Store screenshots. The hidden area is ONE solid accent shape
  (gap 0, only outer corners rounded, inner-corner fillets on open cells). Numbers are thin and single-colour, and dashed grid lines run between open cells.
  Flags are grey rounded squares that merge with neighbouring flags. Rubik font, italic outlined pills, a `‹ Easy ›` picker, round ON/OFF buttons.
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
src/engine/presets.ts    Easy 9x9/10, Medium 16x16/40, Hard 16x30/99, Expert 24x30/150, Insane 30x50/300 (ids stay beginner/intermediate/expert/master/insane for storage)
src/ui/boardView.ts      DOM grid, cached class strings (only changed cells touched), animation choreography
src/ui/icons.ts          inline stroke SVG icons
src/styles/              base.css (tokens mixed from --bg/--accent), board.css (shape, flags, keyframes), ui.css (screens)
src/ui/gestures.ts       pointer events: tap / long-press / pan / pinch / mouse buttons
src/ui/viewport.ts       transform zoom+pan, fit-to-screen
src/ui/hud.ts            game bar (back · mines/time · fit · palette), flag FAB, palette dot bar, formatTime ("3M 41S")
src/ui/pages.ts          home (logo, ‹ level › picker, custom steppers, New Game), settings, high scores, about, end card
src/ui/themes.ts         15 themes = background + accent (the original 9 sampled from the store screenshots + lilac, coral, mint, violet, plum, midnight). Default: violet (dark) / lilac (light)
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
- 2026-10-25: Redesign to match the original app (the user asked for an exact copy of its look). The colours were sampled from the store screenshots.
  - Screens: home → game (history.pushState, so the phone's back gesture works), settings, high scores, about. End card ("Neat!" with top 5) → "Start new game" + picker under the board.
  - Shape rendering: `BoardView.shape()` adds side classes (su/sr/sd/sl) for same-group neighbours, `ftl/ftr/fbl/fbr` fillets and `gr/gd` grid dashes. Moves call syncAll, because shapes depend on neighbours.
  - Flag bridges are box-shadow copies of the inset square offset by fi+1px, so merged flags have no seams and L-joins stay clean.
  - Reveal = an accent ::after square shrinking to a circle (the "dissolve"). On a loss, mines are cut out of the shape (bg-coloured mask). The mine mask is generated from `minePath()` in icons.ts.
  - The preset names (Easy…Insane) and sizes beyond Easy/Medium/Hard are my guesses; the store listing only says "5 levels".
- 2026-10-25: Animation polish (user: "too blocky", "slower", "more seamless").
  - Every board animation uses `--ease` (cubic-bezier(.33,0,.15,1), no overshoot). Durations: reveal 0.7s (34ms/ring, max 900ms wave), flag 0.55s, screens 0.5s.
  - Hidden cells have an always-present rounded `::after` overlay. Hover lightens it, press darkens it, and a long-press (`lp`) morphs it over `--lp` into the grey flag square. In flag mode (`lo`) it shrinks to a dot.
  - Flag placed after a finished long-press morph gets `af-soft` (just settle + icon). A tap-placed flag morphs accent → grey rounded square (`flag-morph`). Unflag swells the grey back into the shape (fill `backwards`, so hover still works afterwards).
  - Fillets now also apply to flag cells (vars renamed --ftl/--ftr/--fbl/--fbr to avoid clashing with the flag bridges' --bl/--br).
  - Removed the fit/fullscreen button (`Z` key still refits). The palette is now a 5-wide popover grid.
- 2026-10-25: Reveal timing fix (user: "revealing too slow", "stuff triggers before the animation can play").
  - Reveal is now 0.42s with 20ms per ring (max 480ms wave). Win wave 0.7s.
  - `BoardView.shown` is the visual open state and trails the engine. Cells join the open group (corners, fillets, grid dashes) from a rAF `pending` queue at about 30% of their own dissolve, so the shape no longer snaps open before the animation.
  - `win()` starts the wave only after `revealEnd`. `win()` and `lose()` return the full animation length, and the end card appears at animMs + 300 with no cap.
- 2026-10-25: The first reveal of a game is slower (760ms dissolve, 42ms per ring, max 1000ms wave), set per cell with `--rd`. Removed the "arrow" spikes: fillets on open cells now only face truly hidden cells (not ones still dissolving), and a revealed cell takes the open shape only once it is `shown`.
- 2026-10-25: Fixed the first reveal "opening before the animation". `num-in` used to scale the whole cell to 0.7, which shrank the dissolve square straight away and showed the grid. It now fades the number colour only. The dissolve square also gets a 1px accent shadow so cells waiting in the stagger show no seams.
- 2026-10-25: Closer to the original (goal: 1:1 in looks, animation and behaviour).
  - Guess-free boards: the store listing says "guess-free". `engine/solver.ts` is a logic-only solver (single-number counts, overlapping pairs, total mine count). On the first tap, `Board.place` scatters the mines, then keeps moving a mine the solver is stuck on to a hidden cell out of sight until the board solves. A layout that stops improving is reshuffled. 600ms budget: presets take 0–160ms, and very dense customs fall back to the last layout.
  - Mine logo and app icons redrawn from the original icon: 4 broad axis studs, 4 narrow diagonal ones, rounded corners, square hole. PWA icons are a white mine with a long shadow on #2b2b2b.
  - Palette is the original's pill: it grows left out of the button over the bar (clip-path) and scrolls sideways. Themes are ordered like the original's row.
  - Loss: the whole shape dissolves in a wave from the exploded mine (as in the "Smooth gameplay" screenshot), leaving numbers and mines on open ground. Wrong flags are crossed out as the wave passes. When a game ends, the bar keeps only the time, centred.
- 2026-10-25: Matched the current original (from gameplay video frames): mine count and time centred in the bar; no grid dashes on open ground; the flag toggle is a bottom-centre pill with reveal (mine) and flag buttons and a sliding accent knob. Home presets show only their name.
- 2026-10-25: Reveal and loss polish (user feedback).
  - No more sharp square hole: an opening cell gets its inner-corner fillets at once (they only face truly hidden cells). The hidden neighbours still straighten their corners via `shown`.
  - Slower multi-tile reveals: first tap 900ms dissolve at 80ms per ring (max 1.8s wave). Later floods 720ms at 60ms per ring. Single tiles stay 420ms.
  - Loss is now Google-Minesweeper style (the user asked for it): the hidden shape stays, and the mines pop out one by one (nearest the exploded one first, 110ms apart, capped at 3.2s in total). Each pop swells the accent square then shrinks it away (`pop-out`), and the mine icon pops in behind it (`mine-pop`). Wrong flags are crossed out in the same run.
