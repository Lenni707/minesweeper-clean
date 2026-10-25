import '@fontsource-variable/inter';
import './styles/base.css';
import './styles/theme.css';
import './styles/board.css';
import './styles/ui.css';
import { registerSW } from 'virtual:pwa-register';

import { Board, FLAGGED, REVEALED, type MoveResult } from './engine/board';
import { PRESETS, presetById } from './engine/presets';
import * as store from './state/storage';
import { BoardView } from './ui/boardView';
import { Gestures } from './ui/gestures';
import { Hud, type Mode } from './ui/hud';
import { closeSheet, isSheetOpen, levelSheet, resultSheet, settingsSheet, statsSheet } from './ui/sheets';
import { Viewport } from './ui/viewport';

registerSW({ immediate: true });

const settings = store.getSettings();
const coarse = matchMedia('(pointer: coarse)');
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)');
const systemDark = matchMedia('(prefers-color-scheme: dark)');

// ---- layout ---------------------------------------------------------------

const app = document.getElementById('app')!;
app.className = 'app';
const stage = document.createElement('main');
stage.className = 'stage';
const boardEl = document.createElement('div');
boardEl.className = 'board';
stage.appendChild(boardEl);

let board: Board;
let key = settings.lastKey;
let mode: Mode = 'reveal';
let endTimer = 0;

const hud = new Hud({
  level: () => openLevels(),
  stats: () => statsSheet(store.getStats, key),
  settings: () => settingsSheet(settings, applySettings, store.resetStats),
  fit: () => vp.fit(),
  restart: () => restart(),
  mode: (m) => setMode(m),
});
app.append(hud.top, stage, hud.dock);

const view = new BoardView(boardEl);
const vp = new Viewport(stage, boardEl, cellRange());
const gestures = new Gestures(stage, vp, {
  primary: (i) => (mode === 'reveal' ? reveal(i) : flag(i)),
  secondary: (i) => (mode === 'reveal' ? flag(i) : reveal(i)),
  chord: (i) => chord(i),
  press: (i, long) => view.setPressed(board.over ? -1 : i, long && isFlaggable(i)),
  hover: (i) => view.setHover(board.over ? -1 : i),
  chordPreview: (i) => view.setChordPreview(i),
});

function cellRange() {
  return coarse.matches ? { minCell: 20, maxCell: 52, margin: 10 } : { minCell: 22, maxCell: 44, margin: 36 };
}

function isFlaggable(i: number): boolean {
  return i >= 0 && board.state[i] !== REVEALED;
}

// ---- settings & theme ---------------------------------------------------------

function applyTheme(): void {
  const id = settings.theme ?? (systemDark.matches ? 'dark' : 'light');
  const root = document.documentElement;
  root.classList.add('theme-fade');
  root.dataset.theme = id;
  setTimeout(() => root.classList.remove('theme-fade'), 400);
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
}

function applyMotion(): void {
  const reduced = settings.reducedMotion || prefersReduced.matches;
  document.documentElement.classList.toggle('reduced', reduced);
  view.speed = reduced ? 0 : 1;
}

function applyToggle(): void {
  const show = settings.toggle === 'always' || (settings.toggle === 'auto' && coarse.matches);
  hud.showToggle(show);
  if (!show && mode === 'flag') setMode('reveal');
}

function applySettings(patch: Partial<store.Settings>): void {
  store.updateSettings(patch);
  if ('theme' in patch) applyTheme();
  if ('reducedMotion' in patch) applyMotion();
  if ('toggle' in patch) applyToggle();
  gestures.longPressMs = settings.longPressMs;
  boardEl.style.setProperty('--lp', `${settings.longPressMs}ms`);
}

systemDark.addEventListener('change', () => settings.theme === null && applyTheme());
prefersReduced.addEventListener('change', applyMotion);
coarse.addEventListener('change', () => {
  applyToggle();
  vp.setOptions(cellRange());
});

function setMode(m: Mode): void {
  mode = m;
  hud.setMode(m);
  stage.dataset.mode = m;
}

function buzz(pattern: number | number[]): void {
  if (settings.haptics) navigator.vibrate?.(pattern);
}

// ---- games ------------------------------------------------------------------

interface Dims {
  cols: number;
  rows: number;
  mines: number;
  name: string;
}

function dimsFor(k: string): Dims {
  const p = presetById(k);
  if (!p) {
    const c = settings.custom;
    return { ...c, name: 'Custom' };
  }
  // Presets are defined portrait; turn them sideways on landscape screens.
  const landscape = stage.clientWidth > stage.clientHeight * 1.15;
  const flip = landscape && p.rows > p.cols;
  return { cols: flip ? p.rows : p.cols, rows: flip ? p.cols : p.rows, mines: p.mines, name: p.name };
}

function show(b: Board, k: string): void {
  clearTimeout(endTimer);
  closeSheet();
  board = b;
  key = k;
  store.updateSettings({ lastKey: k });
  const d = dimsFor(k);
  hud.setLevel(d.name, `${b.cols} × ${b.rows} · ${b.mines}`);
  hud.setMines(b.minesLeft, false);
  hud.setTime(b.elapsed(), false);
  hud.setState(b.status);
  view.build(b);
  vp.setBoard(b.cols, b.rows);
}

/** Opens the level: resumes its saved game if there is one. */
function open(k: string): void {
  const saved = store.getSave(k);
  const b = saved && Board.deserialize(saved);
  if (b && !b.over) return show(b, k);
  if (saved) store.dropSave(k);
  fresh(k);
}

function fresh(k: string): void {
  const d = dimsFor(k);
  show(new Board(d.rows, d.cols, d.mines), k);
}

function restart(): void {
  // Abandoning a game in progress counts as a loss (it breaks the streak).
  if (board.status === 'playing') {
    store.recordResult(key, false, board.elapsed());
    store.dropSave(key);
  }
  fresh(key);
}

function persist(): void {
  if (board.status === 'playing') store.putSave(key, board.serialize());
}

function openLevels(): void {
  const keys = [...PRESETS.map((p) => p.id), 'custom'];
  const saves: Record<string, ReturnType<typeof store.getSave>> = {};
  const best: Record<string, number | undefined> = {};
  for (const k of keys) {
    const s = k === key && board.status === 'playing' ? board.serialize() : store.getSave(k);
    if (s && s.status === 'playing') saves[k] = s;
    best[k] = store.getStats(k).times[0]?.ms;
  }
  levelSheet({
    currentKey: key,
    custom: settings.custom,
    saves,
    best,
    pick: (k) => {
      persist();
      if (k !== key) open(k);
    },
    startCustom: (c) => {
      persist();
      if (key === 'custom' && board.status === 'playing') store.recordResult('custom', false, board.elapsed());
      store.dropSave('custom');
      store.updateSettings({ custom: c });
      fresh('custom');
    },
  });
}

// ---- moves --------------------------------------------------------------------

function reveal(i: number): void {
  if (board.over) return;
  if (board.state[i] === REVEALED) return chord(i);
  if (board.state[i] === FLAGGED) return view.nudge(i);
  after(board.reveal(i));
}

function flag(i: number): void {
  if (board.over) return;
  if (board.state[i] === REVEALED) return chord(i);
  if (board.toggleFlag(i, settings.questionMarks) < 0) return;
  view.flag(i);
  buzz(12);
  hud.setMines(board.minesLeft);
  persist();
}

function chord(i: number): void {
  if (board.over || board.state[i] !== REVEALED) return;
  if (!board.canChord(i)) return view.nudge(i);
  buzz(8);
  after(board.chord(i));
}

function after(r: MoveResult): void {
  view.reveal(r.opened);
  hud.setState(board.status);
  if (board.status === 'lost') return finish(false, view.lose());
  if (board.status === 'won') {
    hud.setMines(0);
    return finish(true, view.win());
  }
  persist();
}

function finish(won: boolean, animMs: number): void {
  const ms = board.elapsed();
  hud.setTime(ms);
  buzz(won ? [20, 60, 20, 60, 40] : [60, 40, 120]);
  store.dropSave(key);
  const size = key === 'custom' ? `${board.cols}×${board.rows}·${board.mines}` : undefined;
  const rank = store.recordResult(key, won, ms, size);
  const stats = store.getStats(key);
  const idx = PRESETS.findIndex((p) => p.id === key);
  const next = idx >= 0 && idx < PRESETS.length - 1 ? PRESETS[idx + 1] : undefined;
  endTimer = window.setTimeout(
    () =>
      resultSheet({
        won,
        ms,
        rank,
        best: stats.times[0]?.ms,
        stats,
        nextName: next?.name,
        again: () => fresh(key),
        next: next ? () => open(next.id) : undefined,
      }),
    Math.min(1600, animMs + (won ? 350 : 500)),
  );
}

// ---- clock, lifecycle, keyboard -------------------------------------------------------

setInterval(() => {
  if (board.running) hud.setTime(board.elapsed());
}, 200);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    board.pause();
    persist();
  }
});
window.addEventListener('pagehide', persist);

let hovered = -1;
stage.addEventListener('mousemove', (e) => {
  const r = stage.getBoundingClientRect();
  hovered = vp.cellAt(e.clientX - r.left, e.clientY - r.top);
});
stage.addEventListener('mouseleave', () => (hovered = -1));

document.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey || isSheetOpen()) return;
  if (e.target instanceof HTMLInputElement) return;
  const k = e.key.toLowerCase();
  if (k === 'n' || e.key === 'F2') {
    e.preventDefault();
    restart();
  } else if (k >= '1' && k <= '5') {
    persist();
    open(PRESETS[Number(k) - 1].id);
  } else if ((k === ' ' || k === 'f') && hovered >= 0) {
    e.preventDefault();
    flag(hovered);
  } else if (k === 'r' && hovered >= 0) {
    reveal(hovered);
  } else if (k === 'z' || k === '0') {
    vp.fit();
  } else if (k === 's') {
    statsSheet(store.getStats, key);
  } else if (k === ',') {
    settingsSheet(settings, applySettings, store.resetStats);
  }
});

if (import.meta.env.DEV) {
  // Test hook for the screenshot harness.
  (window as unknown as { __ms: unknown }).__ms = { board: () => board, view, vp };
}

// ---- boot ----------------------------------------------------------------------------

applyTheme();
applyMotion();
applySettings({});
setMode('reveal');
applyToggle();
requestAnimationFrame(() => {
  open(key in Object.fromEntries(PRESETS.map((p) => [p.id, 1])) || key === 'custom' ? key : 'beginner');
  document.documentElement.classList.add('ready');
});
