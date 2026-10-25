// Menu, settings, high scores and the end-of-game card, in the original's spare style:
// thin type, outlined pill buttons, a "‹ Easy ›" picker, round ON/OFF buttons.

import { CUSTOM_LIMITS, PRESETS, maxMines } from '../engine/presets';
import type { Settings, Stats } from '../state/storage';
import { formatTime } from './hud';
import { icons, mineLogo } from './icons';

export const LEVEL_KEYS = [...PRESETS.map((p) => p.id), 'custom'];

export function levelName(key: string): string {
  return PRESETS.find((p) => p.id === key)?.name ?? 'Custom';
}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Record<string, string> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v);
  }
  el.append(...children);
  return el;
}

/** Repeats `fn` while a button is held down. */
function holdRepeat(btn: HTMLElement, fn: () => void): void {
  let t = 0;
  const stop = () => clearTimeout(t);
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    fn();
    let delay = 380;
    const tick = () => {
      fn();
      delay = Math.max(40, delay * 0.8);
      t = window.setTimeout(tick, delay);
    };
    t = window.setTimeout(tick, delay);
  });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, stop);
  btn.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fn()));
}

/** "‹ Easy ›" — the label slides in from the side you pressed. */
export class Picker {
  readonly el: HTMLElement;
  private label: HTMLElement;
  private idx: number;

  constructor(
    private keys: string[],
    initial: string,
    private onChange: (key: string) => void,
    private name: (key: string) => string = levelName,
  ) {
    this.idx = Math.max(0, keys.indexOf(initial));
    const prev = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Previous', html: icons.left });
    const next = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Next', html: icons.right });
    this.label = h('span', { class: 'picker-label' }, this.name(this.key));
    this.el = h('div', { class: 'picker' }, prev, h('div', { class: 'picker-window' }, this.label), next);
    prev.addEventListener('click', () => this.step(-1));
    next.addEventListener('click', () => this.step(1));
  }

  get key(): string {
    return this.keys[this.idx];
  }

  set(key: string): void {
    const i = this.keys.indexOf(key);
    if (i >= 0 && i !== this.idx) {
      this.idx = i;
      this.label.textContent = this.name(key);
    }
  }

  private step(d: number): void {
    this.idx = (this.idx + d + this.keys.length) % this.keys.length;
    const fresh = h('span', { class: `picker-label from-${d > 0 ? 'right' : 'left'}` }, this.name(this.key));
    this.label.replaceWith(fresh);
    this.label = fresh;
    this.onChange(this.key);
  }
}

/** A "‹ 12 ›" number stepper for the custom size. */
function stepper(label: string, value: number, min: () => number, max: () => number, onChange: (v: number) => void) {
  const out = h('span', { class: 'stepper-value' }, String(value));
  const dec = h('button', { class: 'icon-btn', type: 'button', 'aria-label': `Less ${label}`, html: icons.left });
  const inc = h('button', { class: 'icon-btn', type: 'button', 'aria-label': `More ${label}`, html: icons.right });
  const set = (v: number) => {
    value = Math.min(max(), Math.max(min(), v));
    out.textContent = String(value);
    onChange(value);
  };
  holdRepeat(dec, () => set(value - 1));
  holdRepeat(inc, () => set(value + 1));
  return {
    el: h('div', { class: 'stepper' }, h('span', { class: 'stepper-label' }, label), h('div', { class: 'stepper-row' }, dec, out, inc)),
    clamp: () => set(value),
  };
}

// ---- home ------------------------------------------------------------------

export interface HomeHandlers {
  start(key: string): void;
  resume(key: string): void;
  settings(): void;
  stats(): void;
  about(): void;
  setCustom(c: Settings['custom']): void;
  hasSave(key: string): number | undefined;
}

export class Home {
  readonly el: HTMLElement;
  private picker: Picker;
  private custom: HTMLElement;
  private resumeBtn: HTMLButtonElement;
  private clampMines: () => void;

  constructor(
    initial: string,
    private c: Settings['custom'],
    private hnd: HomeHandlers,
    palette: HTMLElement,
  ) {
    this.picker = new Picker(LEVEL_KEYS, initial, () => this.refresh());

    const w = stepper('Width', c.cols, () => CUSTOM_LIMITS.min, () => CUSTOM_LIMITS.max, (v) => this.updateCustom({ cols: v }));
    const ht = stepper('Height', c.rows, () => CUSTOM_LIMITS.min, () => CUSTOM_LIMITS.max, (v) => this.updateCustom({ rows: v }));
    const m = stepper('Mines', c.mines, () => 1, () => maxMines(this.c.cols, this.c.rows), (v) => this.updateCustom({ mines: v }));
    this.clampMines = m.clamp;
    this.custom = h('div', { class: 'custom' }, w.el, ht.el, m.el);

    const newGame = h('button', { class: 'pill', type: 'button' }, 'New Game');
    this.resumeBtn = h('button', { class: 'pill pill-ghost', type: 'button' });
    newGame.addEventListener('click', () => this.hnd.start(this.picker.key));
    this.resumeBtn.addEventListener('click', () => this.hnd.resume(this.picker.key));

    const icon = (html: string, label: string, fn: () => void) => {
      const b = h('button', { class: 'icon-btn', type: 'button', 'aria-label': label, html });
      b.addEventListener('click', fn);
      return b;
    };

    this.el = h(
      'section',
      { class: 'screen home' },
      h('header', { class: 'bar' }, h('span', { class: 'bar-spacer' }), palette),
      h(
        'div',
        { class: 'home-main' },
        h('div', { class: 'logo', html: mineLogo }),
        this.picker.el,
        this.custom,
        h('div', { class: 'home-actions' }, newGame, this.resumeBtn),
      ),
      h(
        'nav',
        { class: 'home-icons' },
        icon(icons.settings, 'Settings', () => this.hnd.settings()),
        icon(icons.list, 'High scores', () => this.hnd.stats()),
        icon(icons.info, 'How to play', () => this.hnd.about()),
      ),
    );
    this.refresh();
  }

  private updateCustom(patch: Partial<Settings['custom']>): void {
    Object.assign(this.c, patch);
    // Shrinking the board can push the mine count over its new maximum.
    if (!('mines' in patch)) this.clampMines();
    this.hnd.setCustom({ ...this.c });
    this.refresh();
  }

  get key(): string {
    return this.picker.key;
  }

  select(key: string): void {
    this.picker.set(key);
    this.refresh();
  }

  refresh(): void {
    // Like the original, presets show only their name; custom shows its steppers.
    const key = this.picker.key;
    this.custom.classList.toggle('open', key === 'custom');
    const saved = this.hnd.hasSave(key);
    this.resumeBtn.hidden = saved === undefined;
    this.resumeBtn.textContent = saved !== undefined ? `Continue · ${formatTime(saved)}` : '';
  }
}

// ---- settings ----------------------------------------------------------------

function onOff(value: boolean, onChange: (v: boolean) => void): HTMLButtonElement {
  const b = h('button', { class: 'round', type: 'button', role: 'switch' });
  const render = () => {
    b.textContent = value ? 'ON' : 'OFF';
    b.setAttribute('aria-checked', String(value));
  };
  b.addEventListener('click', () => {
    value = !value;
    render();
    onChange(value);
  });
  render();
  return b;
}

function item(title: string, desc: string, control: HTMLElement): HTMLElement {
  return h('div', { class: 'item' }, h('h3', {}, title), h('p', {}, desc), control);
}

export function settingsPage(
  s: Settings,
  toggleShown: boolean,
  update: (patch: Partial<Settings>) => void,
  resetStats: () => void,
  back: () => void,
): HTMLElement {
  const lpOut = h('span', { class: 'slider-value' }, `${s.longPressMs} ms`);
  const lp = h('input', { type: 'range', min: '150', max: '600', step: '10', value: String(s.longPressMs), 'aria-label': 'Long tap delay' });
  const lpSync = () => {
    lpOut.textContent = `${lp.value} ms`;
    lp.style.setProperty('--pct', `${((Number(lp.value) - 150) / 450) * 100}%`);
  };
  lp.addEventListener('input', () => {
    lpSync();
    update({ longPressMs: Number(lp.value) });
  });
  lpSync();

  const reset = h('button', { class: 'pill pill-small', type: 'button' }, 'Reset high scores');
  let armed = false;
  reset.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      reset.textContent = 'Tap again to confirm';
      setTimeout(() => {
        armed = false;
        if (!reset.disabled) reset.textContent = 'Reset high scores';
      }, 3000);
      return;
    }
    resetStats();
    reset.textContent = 'High scores cleared';
    reset.disabled = true;
  });

  const backBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back', html: icons.back });
  backBtn.addEventListener('click', back);

  return h(
    'section',
    { class: 'screen page' },
    h('header', { class: 'bar' }, backBtn),
    h(
      'div',
      { class: 'page-body' },
      h('h1', {}, 'Settings'),
      item(
        'Flag toggle',
        'Choose whether there is a flag toggle at the bottom right corner of the screen.',
        onOff(toggleShown, (v) => update({ toggle: v ? 'always' : 'never' })),
      ),
      item(
        'Long tap delay',
        'Choose how long you have to keep your finger on a cell to use the secondary action. NB! Setting the delay too low, the system might not tell simple taps from long ones.',
        h('div', { class: 'slider' }, lp, lpOut),
      ),
      item('Vibration', 'Short buzz on flags, chords and at the end of a game.', onOff(s.haptics, (v) => update({ haptics: v }))),
      item('Question marks', 'Flagging a flagged cell marks it with a question mark.', onOff(s.questionMarks, (v) => update({ questionMarks: v }))),
      item('Animations', 'Turn off for instant reveals.', onOff(!s.reducedMotion, (v) => update({ reducedMotion: !v }))),
      h('div', { class: 'item' }, reset),
    ),
  );
}

// ---- high scores --------------------------------------------------------------

function dateLabel(at: number): string {
  return new Date(at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function timesList(s: Stats, highlight = -1): HTMLElement {
  const ol = h('ol', { class: 'times' });
  if (s.times.length === 0) ol.appendChild(h('li', { class: 'empty' }, 'No times yet.'));
  s.times.forEach((t, k) => {
    ol.appendChild(
      h(
        'li',
        { class: k === highlight ? 'hl' : '', style: `--i:${k}` },
        h('span', {}, `${k + 1}. ${dateLabel(t.at)}${t.size ? ` · ${t.size}` : ''}`),
        h('span', {}, formatTime(t.ms)),
      ),
    );
  });
  return ol;
}

export function statsPage(get: (key: string) => Stats, initial: string, back: () => void): HTMLElement {
  const panel = h('div', { class: 'scores' });
  const render = (key: string) => {
    const s = get(key);
    const rate = s.played ? Math.round((s.won / s.played) * 100) : 0;
    panel.replaceChildren(
      timesList(s),
      h('p', { class: 'summary' }, `Played ${s.played} · Won ${s.won} · ${rate}% · Best streak ${s.bestStreak}`),
    );
  };
  const picker = new Picker(LEVEL_KEYS, initial, render);
  render(picker.key);
  const backBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back', html: icons.back });
  backBtn.addEventListener('click', back);
  return h(
    'section',
    { class: 'screen page' },
    h('header', { class: 'bar' }, backBtn),
    h('div', { class: 'page-body' }, h('h1', {}, 'High scores'), picker.el, panel),
  );
}

export function aboutPage(back: () => void): HTMLElement {
  const backBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Back', html: icons.back });
  backBtn.addEventListener('click', back);
  const p = (t: string) => h('p', {}, t);
  return h(
    'section',
    { class: 'screen page' },
    h('header', { class: 'bar' }, backBtn),
    h(
      'div',
      { class: 'page-body about' },
      h('h1', {}, 'How to play'),
      p('Clear every cell that has no mine. A number tells you how many mines touch that cell.'),
      p('Tap to open a cell. Long-tap to flag it, or switch the round flag button on and tap.'),
      p('Tap a number whose flags are all placed to open everything around it.'),
      p('Pinch to zoom, drag to look around. The first tap is always safe.'),
      p('On a computer: left click opens, right click flags, middle click opens around a number.'),
    ),
  );
}

// ---- end of game ----------------------------------------------------------------

export interface EndData {
  won: boolean;
  ms: number;
  rank: number;
  key: string;
  stats: Stats;
  done(): void;
}

/** "Neat!" — the top five with this game highlighted, and a "Got it!" pill. */
export function endCard(d: EndData): HTMLElement {
  const ok = h('button', { class: 'pill', type: 'button' }, 'Got it!');
  const card = h(
    'div',
    { class: `card ${d.won ? 'won' : 'lost'}`, role: 'dialog', 'aria-modal': 'true' },
    h('h2', {}, d.won ? 'Neat!' : 'Boom!'),
    h('p', { class: 'card-sub' }, `Difficulty: ${levelName(d.key)}`),
    d.won ? timesList(d.stats, d.rank) : h('p', { class: 'card-time' }, `You lasted ${formatTime(d.ms)}.`),
    ok,
  );
  const scrim = h('div', { class: 'scrim' }, card);
  const close = () => {
    scrim.classList.remove('open');
    document.removeEventListener('keydown', onKey);
    setTimeout(() => scrim.remove(), 300);
    d.done();
  };
  const onKey = (e: KeyboardEvent) => (e.key === 'Escape' || e.key === 'Enter') && close();
  ok.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => requestAnimationFrame(() => scrim.classList.add('open')));
  return scrim;
}
