# Minesweeper — clean

A minimal, smoothly animated Minesweeper. It's built for phones (add it to your home screen and it works offline) and looks just as clean on desktop. There's no backend.

**Play:** https://lenni707.github.io/minesweeper-clean/

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
