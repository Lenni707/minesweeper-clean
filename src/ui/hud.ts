// Game screen chrome: back arrow · mines left / time · palette, and the round flag toggle.

import type { ThemeId } from '../state/storage';
import { icons } from './icons';
import { THEMES } from './themes';

export type Mode = 'reveal' | 'flag';

/** "38S", "3M 41S", "1H 2M": the original's format. */
export function formatTime(ms: number): string {
  const total = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}H ${m}M`;
  if (m > 0) return `${m}M ${s}S`;
  return `${s}S`;
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

/** The palette button; tapping it grows a pill of theme dots out to the left (ring = background, dot = accent). */
export function paletteButton(current: () => ThemeId, pick: (id: ThemeId) => void): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'palette';
  const dots = THEMES.map(
    (t, k) =>
      `<button type="button" class="dot" data-theme-id="${t.id}" style="--ring:${t.bg};--fill:${t.accent};--k:${k};--n:${THEMES.length}" aria-label="${t.id} theme"></button>`,
  ).join('');
  wrap.innerHTML = `<div class="dots">${dots}</div><button type="button" class="icon-btn palette-btn" aria-label="Themes">${icons.palette}</button>`;
  const mark = () =>
    wrap.querySelectorAll<HTMLElement>('.dot').forEach((d) => d.classList.toggle('on', d.dataset.themeId === current()));
  const close = (e: Event) => {
    if (!wrap.contains(e.target as Node)) setOpen(false);
  };
  const setOpen = (open: boolean) => {
    wrap.classList.toggle('open', open);
    if (open) {
      mark();
      // Bring the current theme into view (the row scrolls on narrow screens).
      const row = wrap.querySelector<HTMLElement>('.dots')!;
      const on = row.querySelector<HTMLElement>('.dot.on');
      if (on) row.scrollLeft = Math.max(0, on.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2);
      setTimeout(() => document.addEventListener('pointerdown', close), 0);
    } else {
      document.removeEventListener('pointerdown', close);
    }
  };
  wrap.querySelector('.palette-btn')!.addEventListener('click', () => setOpen(!wrap.classList.contains('open')));
  wrap.querySelector('.dots')!.addEventListener('click', (e) => {
    const dot = (e.target as HTMLElement).closest<HTMLElement>('.dot');
    if (!dot) return;
    pick(dot.dataset.themeId as ThemeId);
    mark();
  });
  return wrap;
}

export interface HudHandlers {
  back(): void;
  mode(m: Mode): void;
}

export class Hud {
  readonly top: HTMLElement;
  readonly fab: HTMLElement;
  private mines: Ticker;
  private time: Ticker;

  constructor(h: HudHandlers, palette: HTMLElement) {
    this.top = document.createElement('header');
    this.top.className = 'bar';
    this.top.innerHTML = `
      <button class="icon-btn" data-act="back" type="button" aria-label="Back to menu">${icons.back}</button>
      <div class="status">
        <span class="status-mines">${icons.mine}<span class="ticker"></span></span>
        <span class="status-time ticker"></span>
      </div>
      <span class="bar-spacer"></span>`;
    this.top.appendChild(palette);

    // As in the current original: a pill at the bottom centre with a reveal (mine) and a flag button;
    // the accent knob slides behind whichever mode is active.
    this.fab = document.createElement('div');
    this.fab.className = 'fab';
    this.fab.setAttribute('role', 'group');
    this.fab.setAttribute('aria-label', 'Tap mode');
    this.fab.innerHTML = `
      <span class="fab-knob"></span>
      <button type="button" data-mode="reveal" aria-label="Reveal mode" aria-pressed="true">${icons.mine}</button>
      <button type="button" data-mode="flag" aria-label="Flag mode" aria-pressed="false">${icons.flag}</button>`;

    this.mines = new Ticker(this.top.querySelector('.status-mines .ticker')!);
    this.time = new Ticker(this.top.querySelector('.status-time')!);

    this.top.querySelector('[data-act=back]')!.addEventListener('click', () => h.back());
    this.fab.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-mode]');
      if (b) h.mode(b.dataset.mode as Mode);
    });
  }

  setMines(n: number, animate = true): void {
    this.mines.set(String(n), animate);
  }

  setTime(ms: number, animate = true): void {
    this.time.set(formatTime(ms), animate);
  }

  setMode(m: Mode): void {
    this.fab.dataset.mode = m;
    this.fab.querySelectorAll<HTMLElement>('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === m)));
  }

  showToggle(show: boolean): void {
    this.fab.hidden = !show;
  }

  setState(state: 'ready' | 'playing' | 'won' | 'lost'): void {
    this.top.dataset.state = state;
  }
}
