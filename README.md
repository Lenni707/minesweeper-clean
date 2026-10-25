# Minesweeper — clean

A minimal, smoothly animated Minesweeper in the style of "Minesweeper – The Clean One": the unrevealed area is one solid colour shape that dissolves as you play. It's built for phones (add it to your home screen and it works offline) and looks just as clean on desktop. There's no backend.

**Play:** https://lenni707.github.io/minesweeper-clean/

## Features
- 5 presets (Easy → Insane), plus custom boards up to 100 × 100
- The first tap is always safe and opens an area
- Tap to reveal, long-press to flag (the delay is adjustable), tap a satisfied number to chord. An optional on-screen reveal/flag toggle
- Pinch zoom and pan with momentum. On desktop: right-click flags, middle-click or left+right chords, ctrl/⌘ + scroll zooms
- Animations: cells dissolve out of the shape in a ripple, flags pop and merge, mines punch out of the shape on a loss, a wave on a win
- 15 themes (a background plus an accent each, including violet, plum and lilac), picked from the palette button
- Autosave for every difficulty, best times, win rate, streaks
- Installable PWA that works fully offline

Keyboard (in game): `N`/`F2` new game · `1`–`5` presets · `Space` flag the hovered cell · `Z` fit board · `Esc` back

## Run locally
```sh
npm install
npm run dev        # http://localhost:5173
npm test
```

## Docker
```sh
docker compose up --build              # production build via nginx → http://localhost:8080
docker compose --profile dev up dev    # Vite dev server → http://<your-ip>:5173 (test from your phone)
```
