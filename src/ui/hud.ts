// Top bar (mines left · level · time) and bottom dock (stats, settings, mode toggle, fit, restart).

import { icons } from './icons';

export type Mode = 'reveal' | 'flag';

export function formatTime(ms: number, tenths = false): string {
  const total = Math.max(0, ms) / 1000;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.floor(total % 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  let out = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  if (tenths) out += `.${Math.floor((total * 10) % 10)}`;
  return out;
}

/** Renders a string one span per character; changed characters roll in from below. */
class Ticker {
  private value = '';
  constructor(readonly el: HTMLElement) {}

  set(next: string, animate = true): void {
    if (next === this.value) return;
    const prev = this.value;
    this.value = next;
    const spans = Array.from(this.el.children) as HTMLElement[];
    if (spans.length !== next.length || !animate) {
      this.el.replaceChildren(
        ...[...next].map((ch) => {
          const s = document.createElement('span');
          s.textContent = ch;
          return s;
        }),
      );
      return;
    }
    for (let k = 0; k < next.length; k++) {
      if (next[k] === prev[k]) continue;
      const s = document.createElement('span');
      s.textContent = next[k];
      s.className = 'roll';
      this.el.replaceChild(s, spans[k]);
    }
  }
}

export interface HudHandlers {
  level(): void;
  stats(): void;
  settings(): void;
  fit(): void;
  restart(): void;
  mode(m: Mode): void;
}

export class Hud {
  readonly top: HTMLElement;
  readonly dock: HTMLElement;
  private mines: Ticker;
  private time: Ticker;
  private levelName: HTMLElement;
  private levelSub: HTMLElement;
  private toggle: HTMLElement;
  private restartBtn: HTMLButtonElement;

  constructor(h: HudHandlers) {
    this.top = document.createElement('header');
    this.top.className = 'top';
    this.top.innerHTML = `
      <div class="stat stat-mines" aria-label="Mines left">${icons.flag}<span class="ticker"></span></div>
      <button class="level" type="button" aria-label="Choose difficulty">
        <span class="level-text"><span class="level-name"></span><span class="level-sub"></span></span>
        ${icons.chevron}
      </button>
      <div class="stat stat-time" aria-label="Time">${icons.timer}<span class="ticker"></span></div>`;

    this.dock = document.createElement('nav');
    this.dock.className = 'dock';
    this.dock.innerHTML = `
      <button class="icon-btn" data-act="stats" type="button" aria-label="Statistics">${icons.stats}</button>
      <button class="icon-btn" data-act="settings" type="button" aria-label="Settings">${icons.settings}</button>
      <div class="mode" role="radiogroup" aria-label="Tap action">
        <span class="mode-thumb"></span>
        <button type="button" role="radio" data-mode="reveal" aria-label="Tap reveals">${icons.tap}</button>
        <button type="button" role="radio" data-mode="flag" aria-label="Tap flags">${icons.flag}</button>
      </div>
      <button class="icon-btn" data-act="fit" type="button" aria-label="Fit board to screen">${icons.fit}</button>
      <button class="icon-btn restart" data-act="restart" type="button" aria-label="New game">${icons.restart}</button>`;

    this.mines = new Ticker(this.top.querySelector('.stat-mines .ticker')!);
    this.time = new Ticker(this.top.querySelector('.stat-time .ticker')!);
    this.levelName = this.top.querySelector('.level-name')!;
    this.levelSub = this.top.querySelector('.level-sub')!;
    this.toggle = this.dock.querySelector('.mode')!;
    this.restartBtn = this.dock.querySelector('.restart')!;

    this.top.querySelector('.level')!.addEventListener('click', () => h.level());
    this.dock.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button');
      if (!btn) return;
      const mode = btn.dataset.mode as Mode | undefined;
      if (mode) return h.mode(mode);
      const act = btn.dataset.act as 'stats' | 'settings' | 'fit' | 'restart' | undefined;
      if (act === 'restart') {
        this.restartBtn.classList.remove('spin');
        void this.restartBtn.offsetWidth;
        this.restartBtn.classList.add('spin');
      }
      if (act) h[act]();
    });
  }

  setMines(n: number, animate = true): void {
    this.mines.set(String(n), animate);
  }

  setTime(ms: number, animate = true): void {
    this.time.set(formatTime(ms), animate);
  }

  setLevel(name: string, sub: string): void {
    this.levelName.textContent = name;
    this.levelSub.textContent = sub;
  }

  setMode(m: Mode): void {
    this.toggle.dataset.mode = m;
    for (const b of this.toggle.querySelectorAll<HTMLElement>('button')) {
      b.setAttribute('aria-checked', String(b.dataset.mode === m));
    }
  }

  showToggle(show: boolean): void {
    this.dock.classList.toggle('no-toggle', !show);
  }

  setState(state: 'ready' | 'playing' | 'won' | 'lost'): void {
    this.top.dataset.state = state;
  }
}
