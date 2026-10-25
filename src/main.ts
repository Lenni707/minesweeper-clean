import '@fontsource-variable/rubik/wght.css';
import '@fontsource-variable/rubik/wght-italic.css';
import './styles/base.css';
import './styles/board.css';
import './styles/ui.css';
import { registerSW } from 'virtual:pwa-register';

import { Board, FLAGGED, REVEALED, type MoveResult } from './engine/board';
import { PRESETS, presetById } from './engine/presets';
import * as store from './state/storage';
import { BoardView } from './ui/boardView';
import { Gestures } from './ui/gestures';
import { Hud, paletteButton, type Mode } from './ui/hud';
import { Home, LEVEL_KEYS, Picker, aboutPage, endCard, settingsPage, statsPage } from './ui/pages';
import { themeById } from './ui/themes';
import { mineMask } from './ui/icons';
import { Viewport } from './ui/viewport';

registerSW({ immediate: true });

const settings = store.getSettings();
const coarse = matchMedia('(pointer: coarse)');
const prefersReduced = matchMedia('(prefers-reduced-motion: reduce)');
const systemDark = matchMedia('(prefers-color-scheme: dark)');

let board: Board;
let key = LEVEL_KEYS.includes(settings.lastKey) ? settings.lastKey : 'beginner';
let mode: Mode = 'reveal';
let endTimer = 0;

const app = document.getElementById('app')!;
app.className = 'app';

// ---- theme ------------------------------------------------------------------

function applyTheme(): void {
  const t = themeById(settings.theme, systemDark.matches);
  const root = document.documentElement;
  root.classList.add('theme-fade');
  root.style.setProperty('--bg', t.bg);
  root.style.setProperty('--accent', t.accent);
  root.dataset.tone = t.dark ? 'dark' : 'light';
  root.style.colorScheme = t.dark ? 'dark' : 'light';
  setTimeout(() => root.classList.remove('theme-fade'), 450);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bg);
}

const currentTheme = () => themeById(settings.theme, systemDark.matches).id;
const pickTheme = (id: store.ThemeId) => applySettings({ theme: id });

// ---- game screen -----------------------------------------------------------------

const game = document.createElement('section');
game.className = 'screen game';
const stage = document.createElement('main');
stage.className = 'stage';
const boardEl = document.createElement('div');
boardEl.className = 'board';
stage.appendChild(boardEl);

const hud = new Hud(
  {
    back: () => history.back(),
    mode: (m) => setMode(m),
  },
  paletteButton(currentTheme, pickTheme),
);

// Shown under the board once a game is over: "Start new game" and "‹ Hard ›".
const after = document.createElement('div');
after.className = 'after';
const againBtn = document.createElement('button');
againBtn.type = 'button';
againBtn.className = 'pill';
againBtn.textContent = 'Start new game';
const afterPicker = new Picker(LEVEL_KEYS, key, () => {});
after.append(againBtn, afterPicker.el);
againBtn.addEventListener('click', () => fresh(afterPicker.key));

game.append(hud.top, stage, after, hud.fab);

const view = new BoardView(boardEl);
const vp = new Viewport(stage, boardEl, cellRange());
const gestures = new Gestures(stage, vp, {
  primary: (i) => (mode === 'reveal' ? reveal(i) : flag(i)),
  secondary: (i) => (mode === 'reveal' ? flag(i) : reveal(i)),
  chord: (i) => chord(i),
  // A long press morphs the cell toward what it will become: a flag, or open ground in flag mode.
  press: (i, long) =>
    view.setPressed(board.over ? -1 : i, !long || i < 0 || board.state[i] === REVEALED ? '' : mode === 'reveal' ? 'flag' : 'open'),
  hover: (i) => view.setHover(board.over ? -1 : i),
  chordPreview: (i) => view.setChordPreview(i),
});

function cellRange() {
  return coarse.matches ? { minCell: 22, maxCell: 48, margin: 12 } : { minCell: 22, maxCell: 40, margin: 32 };
}

// ---- screens & history -----------------------------------------------------------------

type ScreenName = 'home' | 'game' | 'settings' | 'stats' | 'about';
let screen: ScreenName = 'home';
let current: HTMLElement | null = null;

const home = new Home(
  key,
  { ...settings.custom },
  {
    start: (k) => {
      fresh(k);
      go('game');
    },
    resume: (k) => {
      open(k);
      go('game');
    },
    settings: () => go('settings'),
    stats: () => go('stats'),
    about: () => go('about'),
    setCustom: (c) => store.updateSettings({ custom: c }),
    hasSave: (k) => {
      if (board && k === key && board.status === 'playing') return board.elapsed();
      const s = store.getSave(k);
      return s && s.status === 'playing' ? s.elapsedMs : undefined;
    },
  },
  paletteButton(currentTheme, pickTheme),
);

function build(name: ScreenName): HTMLElement {
  switch (name) {
    case 'home':
      home.select(key);
      return home.el;
    case 'game':
      return game;
    case 'settings':
      return settingsPage(settings, toggleShown(), applySettings, store.resetStats, () => history.back());
    case 'stats':
      return statsPage(store.getStats, key, () => history.back());
    case 'about':
      return aboutPage(() => history.back());
  }
}

/** Swaps screens with a short fade/slide. Going deeper slides left, going back slides right. */
function show(name: ScreenName, back = false): void {
  if (name !== 'game') persist();
  if (screen === 'game' && name !== 'game') board?.pause();
  const next = build(name);
  const prev = current;
  screen = name;
  current = next;
  next.classList.remove('leave', 'leave-back', 'enter-back', 'enter');
  next.classList.add(back ? 'enter-back' : 'enter');
  if (!next.isConnected) app.appendChild(next);
  requestAnimationFrame(() => requestAnimationFrame(() => next.classList.remove('enter', 'enter-back')));
  if (prev && prev !== next) {
    prev.classList.add('leave');
    if (back) prev.classList.add('leave-back');
    setTimeout(() => {
      if (current !== prev) {
        prev.remove();
        prev.classList.remove('leave', 'leave-back');
      }
    }, 320);
  }
  if (name === 'game') requestAnimationFrame(() => vp.auto && vp.fit(false));
}

function go(name: ScreenName): void {
  history.pushState({ screen: name }, '');
  show(name);
}

window.addEventListener('popstate', (e) => {
  const name = (e.state?.screen as ScreenName | undefined) ?? 'home';
  show(name, true);
});

// ---- settings ------------------------------------------------------------------------

function toggleShown(): boolean {
  return settings.toggle === 'always' || (settings.toggle === 'auto' && coarse.matches);
}

function applyMotion(): void {
  const reduced = settings.reducedMotion || prefersReduced.matches;
  document.documentElement.classList.toggle('reduced', reduced);
  view.speed = reduced ? 0 : 1;
}

function applyToggle(): void {
  const show = toggleShown();
  hud.showToggle(show);
  if (!show && mode === 'flag') setMode('reveal');
}

function applySettings(patch: Partial<store.Settings>): void {
  store.updateSettings(patch);
  if ('theme' in patch) applyTheme();
  if ('reducedMotion' in patch) applyMotion();
  if ('toggle' in patch) applyToggle();
  gestures.longPressMs = settings.longPressMs;
  view.longPressMs = settings.longPressMs;
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

// ---- games ------------------------------------------------------------------------------

function dimsFor(k: string) {
  const p = presetById(k);
  if (!p) return { ...settings.custom };
  // Presets are defined portrait; turn them sideways on landscape screens.
  const landscape = innerWidth > innerHeight * 1.15;
  const flip = landscape && p.rows > p.cols;
  return { cols: flip ? p.rows : p.cols, rows: flip ? p.cols : p.rows, mines: p.mines };
}

function load(b: Board, k: string): void {
  clearTimeout(endTimer);
  document.querySelector('.scrim')?.remove();
  board = b;
  key = k;
  store.updateSettings({ lastKey: k });
  afterPicker.set(k);
  game.classList.toggle('over', b.over);
  hud.setMines(b.minesLeft, false);
  hud.setTime(b.elapsed(), false);
  hud.setState(b.status);
  setMode('reveal');
  view.build(b);
  vp.setBoard(b.cols, b.rows);
}

/** Opens the level: resumes its saved game if there is one. */
function open(k: string): void {
  if (board && k === key && board.status === 'playing') return;
  persist();
  const saved = store.getSave(k);
  const b = saved && Board.deserialize(saved);
  if (b && !b.over) return load(b, k);
  if (saved) store.dropSave(k);
  fresh(k);
}

function fresh(k: string): void {
  // Abandoning a started game counts as a loss (it breaks the streak).
  if (board && k === key && board.status === 'playing' && board.placed) {
    store.recordResult(key, false, board.elapsed());
  } else {
    persist();
  }
  store.dropSave(k);
  const d = dimsFor(k);
  load(new Board(d.rows, d.cols, d.mines), k);
}

function persist(): void {
  if (board?.status === 'playing') store.putSave(key, board.serialize());
}

// ---- moves ----------------------------------------------------------------------------------

function reveal(i: number): void {
  if (board.over) return;
  if (board.state[i] === REVEALED) return chord(i);
  if (board.state[i] === FLAGGED) return view.nudge(i);
  afterMove(board.reveal(i));
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
  afterMove(board.chord(i));
}

function afterMove(r: MoveResult): void {
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
  const size = key === 'custom' ? `${board.cols}×${board.rows}` : undefined;
  const rank = store.recordResult(key, won, ms, size);
  const stats = store.getStats(key);
  const k = key;
  endTimer = window.setTimeout(() => {
    game.appendChild(endCard({ won, ms, rank, key: k, stats, done: () => game.classList.add('over') }));
  }, animMs + 300);
}

// ---- clock, lifecycle, keyboard ----------------------------------------------------------------

setInterval(() => {
  if (board?.running) hud.setTime(board.elapsed());
}, 250);

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    board?.pause();
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
  if (e.metaKey || e.ctrlKey || e.altKey || e.target instanceof HTMLInputElement) return;
  if (document.querySelector('.scrim')) return;
  const k = e.key.toLowerCase();
  if (screen !== 'game') {
    if (k === 'escape' && screen !== 'home') history.back();
    return;
  }
  if (k === 'escape') history.back();
  else if (k === 'n' || e.key === 'F2') fresh(key);
  else if (k >= '1' && k <= '5') open(PRESETS[Number(k) - 1].id);
  else if ((k === ' ' || k === 'f') && hovered >= 0) {
    e.preventDefault();
    flag(hovered);
  } else if (k === 'z' || k === '0') vp.fit();
});

if (import.meta.env.DEV) {
  // Test hook for the screenshot harness.
  (window as unknown as { __ms: unknown }).__ms = { board: () => board, view, vp, go, fresh };
}

// ---- boot --------------------------------------------------------------------------------------

document.documentElement.style.setProperty('--mine-icon', mineMask);
applyTheme();
applyMotion();
applySettings({});
applyToggle();
open(key);
history.replaceState({ screen: 'home' }, '');
show('home');
requestAnimationFrame(() => document.documentElement.classList.add('ready'));
