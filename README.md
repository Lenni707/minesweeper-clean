# Minesweeper — clean

A minimal, smoothly animated Minesweeper. It's built for phones (add it to your home screen and it works offline) and looks just as clean on desktop. There's no backend.

**Play:** https://lenni707.github.io/minesweeper-clean/

## Features
- 5 presets (Beginner → Insane), plus custom boards up to 100 × 100
- The first tap is always safe and opens an area
- Tap to reveal, long-press to flag (the delay is adjustable), tap a satisfied number to chord. An optional on-screen reveal/flag toggle
- Pinch zoom and pan with momentum. On desktop: right-click flags, middle-click or left+right chords, ctrl/⌘ + scroll zooms
- Animations: ripple reveals, springy flags, mines going off in sequence on a loss, a wave across the board on a win
- 6 themes (Light, Dark, Black, Sage, Sand, Grape), or follow the system setting
- Autosave for every difficulty, best times, win rate, streaks
- Installable PWA that works fully offline

Keyboard: `N`/`F2` new game · `1`–`5` presets · `Space` flag the hovered cell · `Z` fit board · `S` stats · `,` settings · `Esc` close

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
