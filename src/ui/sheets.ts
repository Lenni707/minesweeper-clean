// Bottom sheets on phones, centred cards on desktop: new game, settings, stats, result.

import { CUSTOM_LIMITS, PRESETS, maxMines } from '../engine/presets';
import type { SavedGame } from '../engine/board';
import type { Settings, Stats, ThemeId, ToggleMode } from '../state/storage';
import { formatTime } from './hud';
import { icons } from './icons';

let current: { close: () => void } | null = null;

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

export function isSheetOpen(): boolean {
  return current !== null;
}

export function closeSheet(): void {
  current?.close();
}

/** Opens a sheet. Only one is open at a time. */
export function openSheet(title: string, body: HTMLElement, opts: { variant?: string; onClose?: () => void } = {}): () => void {
  current?.close();
  const closeBtn = h('button', { class: 'icon-btn sheet-close', type: 'button', 'aria-label': 'Close', html: icons.close });
  const sheet = h(
    'div',
    { class: `sheet ${opts.variant ?? ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'grab' }),
    h('header', { class: 'sheet-head' }, h('h2', {}, title), closeBtn),
    h('div', { class: 'sheet-body' }, body),
  );
  const backdrop = h('div', { class: 'backdrop' }, sheet);
  document.body.appendChild(backdrop);
  requestAnimationFrame(() => requestAnimationFrame(() => backdrop.classList.add('open')));

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    if (current?.close === close) current = null;
    document.removeEventListener('keydown', onKey);
    backdrop.classList.remove('open');
    backdrop.classList.add('closing');
    setTimeout(() => backdrop.remove(), 320);
    opts.onClose?.();
  };
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
  document.addEventListener('keydown', onKey);
  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('pointerdown', (e) => e.target === backdrop && close());

  // Swipe the handle/header down to dismiss.
  const head = sheet.querySelector<HTMLElement>('.sheet-head')!;
  for (const handle of [sheet.querySelector<HTMLElement>('.grab')!, head]) {
    handle.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || (e.target as HTMLElement).closest('button')) return;
      const y0 = e.clientY;
      let dy = 0;
      sheet.style.transition = 'none';
      const move = (ev: PointerEvent) => {
        dy = Math.max(0, ev.clientY - y0);
        sheet.style.transform = `translateY(${dy}px)`;
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        sheet.style.transition = '';
        sheet.style.transform = '';
        if (dy > 80) close();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
  }

  current = { close };
  return close;
}

// ---- new game ---------------------------------------------------------------

export interface LevelSheetData {
  currentKey: string;
  custom: Settings['custom'];
  saves: Record<string, SavedGame | undefined>;
  best: Record<string, number | undefined>;
  pick(key: string): void;
  startCustom(c: Settings['custom']): void;
}

function slider(label: string, min: number, max: number, value: number, onInput: (v: number) => void) {
  const out = h('output', {}, String(value));
  const input = h('input', { type: 'range', min: String(min), max: String(max), value: String(value), step: '1' });
  const minus = h('button', { class: 'step', type: 'button', 'aria-label': `Fewer ${label.toLowerCase()}` }, '−');
  const plus = h('button', { class: 'step', type: 'button', 'aria-label': `More ${label.toLowerCase()}` }, '+');
  const sync = () => {
    out.textContent = input.value;
    const pct = ((Number(input.value) - Number(input.min)) / (Number(input.max) - Number(input.min) || 1)) * 100;
    input.style.setProperty('--pct', `${pct}%`);
    onInput(Number(input.value));
  };
  input.addEventListener('input', sync);
  const bump = (d: number) => {
    input.value = String(Math.min(Number(input.max), Math.max(Number(input.min), Number(input.value) + d)));
    sync();
  };
  minus.addEventListener('click', () => bump(-1));
  plus.addEventListener('click', () => bump(1));
  const row = h('div', { class: 'slider' }, h('span', { class: 'slider-label' }, label, out), h('div', { class: 'slider-row' }, minus, input, plus));
  return {
    row,
    input,
    setMax(m: number) {
      input.max = String(m);
      if (Number(input.value) > m) input.value = String(m);
      sync();
    },
    init: sync,
  };
}

export function levelSheet(d: LevelSheetData): void {
  const list = h('div', { class: 'levels' });
  const keys = [...PRESETS.map((p) => p.id), 'custom'];
  keys.forEach((key, idx) => {
    const p = PRESETS.find((x) => x.id === key);
    const name = p ? p.name : 'Custom';
    const dims = p ? `${p.cols} × ${p.rows} · ${p.mines}` : `${d.custom.cols} × ${d.custom.rows} · ${d.custom.mines}`;
    const save = d.saves[key];
    const best = d.best[key];
    const meta = save
      ? `<span class="badge">Resume · ${formatTime(save.elapsedMs)}</span>`
      : best !== undefined
        ? `<span class="best">${icons.trophy}${formatTime(best, true)}</span>`
        : '';
    const btn = h('button', {
      class: `level-row${key === d.currentKey ? ' current' : ''}`,
      type: 'button',
      style: `--i:${idx}`,
      html: `<span class="level-row-text"><b>${name}</b><span>${dims}</span></span><span class="level-row-meta">${meta}</span>`,
    });
    btn.addEventListener('click', () => {
      closeSheet();
      d.pick(key);
    });
    list.appendChild(btn);
  });

  // Custom editor
  const c = { ...d.custom };
  const density = h('span', { class: 'density' });
  const updateDensity = () => {
    density.textContent = `${Math.round((c.mines / (c.cols * c.rows)) * 100)}% mines`;
  };
  const mines = slider('Mines', 1, maxMines(c.cols, c.rows), c.mines, (v) => {
    c.mines = v;
    updateDensity();
  });
  const cols = slider('Columns', CUSTOM_LIMITS.min, CUSTOM_LIMITS.max, c.cols, (v) => {
    c.cols = v;
    mines.setMax(maxMines(c.cols, c.rows));
  });
  const rows = slider('Rows', CUSTOM_LIMITS.min, CUSTOM_LIMITS.max, c.rows, (v) => {
    c.rows = v;
    mines.setMax(maxMines(c.cols, c.rows));
  });
  const start = h('button', { class: 'btn primary', type: 'button', html: `${icons.play}<span>Start custom game</span>` });
  start.addEventListener('click', () => {
    closeSheet();
    d.startCustom(c);
  });
  const editor = h(
    'div',
    { class: 'custom' },
    h('div', { class: 'custom-head' }, h('h3', {}, 'Custom size'), density),
    cols.row,
    rows.row,
    mines.row,
    start,
  );
  cols.init();
  rows.init();
  mines.init();

  openSheet('New game', h('div', {}, list, editor), { variant: 'levels-sheet' });
}

// ---- settings ---------------------------------------------------------------

export const THEMES: { id: ThemeId; name: string }[] = [
  { id: 'light', name: 'Light' },
  { id: 'dark', name: 'Dark' },
  { id: 'black', name: 'Black' },
  { id: 'sage', name: 'Sage' },
  { id: 'sand', name: 'Sand' },
  { id: 'grape', name: 'Grape' },
];

function toggleRow(label: string, hint: string, value: boolean, onChange: (v: boolean) => void) {
  const input = h('input', { type: 'checkbox', role: 'switch' });
  input.checked = value;
  input.addEventListener('change', () => onChange(input.checked));
  return h('label', { class: 'setting' }, h('span', { class: 'setting-text' }, h('b', {}, label), h('span', {}, hint)), input);
}

function segmented<T extends string>(options: { value: T; label: string }[], value: T, onChange: (v: T) => void) {
  const wrap = h('div', { class: 'seg', role: 'radiogroup' });
  const render = (v: T) => {
    wrap.querySelectorAll('button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.v === v)));
  };
  for (const o of options) {
    const b = h('button', { type: 'button', role: 'radio', 'data-v': o.value }, o.label);
    b.addEventListener('click', () => {
      render(o.value);
      onChange(o.value);
    });
    wrap.appendChild(b);
  }
  render(value);
  return wrap;
}

export function settingsSheet(s: Settings, update: (patch: Partial<Settings>) => void, resetStats: () => void): void {
  const swatches = h('div', { class: 'themes' });
  const themeOptions: (ThemeId | null)[] = [null, ...THEMES.map((t) => t.id)];
  const renderSwatches = () =>
    swatches.querySelectorAll<HTMLElement>('.swatch').forEach((el) => el.setAttribute('aria-checked', String(el.dataset.theme === String(s.theme))));
  for (const id of themeOptions) {
    const name = id ? THEMES.find((t) => t.id === id)!.name : 'System';
    const el = h('button', {
      class: 'swatch',
      type: 'button',
      role: 'radio',
      'data-theme': String(id),
      html: `<span class="swatch-preview" ${id ? `data-theme="${id}"` : 'data-system'}><i></i><i></i><i></i><i></i></span><span>${name}</span>`,
    });
    el.addEventListener('click', () => {
      update({ theme: id });
      renderSwatches();
    });
    swatches.appendChild(el);
  }
  renderSwatches();

  const lp = h('output', {}, `${s.longPressMs} ms`);
  const lpInput = h('input', { type: 'range', min: '150', max: '600', step: '10', value: String(s.longPressMs) });
  const lpSync = () => {
    lp.textContent = `${lpInput.value} ms`;
    lpInput.style.setProperty('--pct', `${((Number(lpInput.value) - 150) / 450) * 100}%`);
  };
  lpInput.addEventListener('input', () => {
    lpSync();
    update({ longPressMs: Number(lpInput.value) });
  });
  lpSync();

  const reset = h('button', { class: 'btn danger', type: 'button' }, 'Reset statistics');
  let armed = false;
  reset.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      reset.textContent = 'Tap again to erase all stats';
      setTimeout(() => {
        armed = false;
        reset.textContent = 'Reset statistics';
      }, 3000);
      return;
    }
    resetStats();
    reset.textContent = 'Statistics cleared';
    reset.disabled = true;
  });

  const body = h(
    'div',
    { class: 'settings' },
    h('h3', {}, 'Theme'),
    swatches,
    h('h3', {}, 'Controls'),
    h('label', { class: 'slider' }, h('span', { class: 'slider-label' }, 'Long-press delay', lp), lpInput),
    h(
      'div',
      { class: 'setting' },
      h('span', { class: 'setting-text' }, h('b', {}, 'Flag toggle'), h('span', {}, 'Auto shows it on touch screens')),
      segmented<ToggleMode>(
        [
          { value: 'auto', label: 'Auto' },
          { value: 'always', label: 'On' },
          { value: 'never', label: 'Off' },
        ],
        s.toggle,
        (v) => update({ toggle: v }),
      ),
    ),
    toggleRow('Haptics', 'Vibrate on flag, chord and game end', s.haptics, (v) => update({ haptics: v })),
    toggleRow('Question marks', 'Flag cycles through ? as well', s.questionMarks, (v) => update({ questionMarks: v })),
    toggleRow('Reduce motion', 'Shorter, calmer animations', s.reducedMotion, (v) => update({ reducedMotion: v })),
    h('h3', {}, 'Data'),
    reset,
    h('p', { class: 'fineprint' }, 'Everything is stored on this device only.'),
  );
  openSheet('Settings', body);
}

// ---- stats ------------------------------------------------------------------

export function statsSheet(get: (key: string) => Stats, initialKey: string): void {
  const keys = [...PRESETS.map((p) => ({ id: p.id, name: p.name })), { id: 'custom', name: 'Custom' }];
  const tabs = h('div', { class: 'chips', role: 'tablist' });
  const panel = h('div', { class: 'stats-panel' });

  const show = (key: string) => {
    tabs.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.k === key)));
    const s = get(key);
    const rate = s.played ? Math.round((s.won / s.played) * 100) : 0;
    const tiles = [
      ['Played', String(s.played)],
      ['Won', String(s.won)],
      ['Win rate', `${rate}%`],
      ['Streak', String(s.streak)],
      ['Best streak', String(s.bestStreak)],
      ['Best time', s.times[0] ? formatTime(s.times[0].ms, true) : '—'],
    ];
    const grid = h('div', { class: 'tiles' });
    for (const [label, value] of tiles) grid.appendChild(h('div', { class: 'tile' }, h('b', {}, value), h('span', {}, label)));
    const times = h('ol', { class: 'times' });
    if (s.times.length === 0) times.appendChild(h('li', { class: 'empty' }, 'No wins yet. Go sweep some mines.'));
    s.times.forEach((t, idx) => {
      const date = new Date(t.at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
      times.appendChild(
        h('li', { style: `--i:${idx}` }, h('span', { class: 'rank' }, String(idx + 1)), h('b', {}, formatTime(t.ms, true)), h('span', {}, t.size ? `${t.size} · ${date}` : date)),
      );
    });
    panel.replaceChildren(grid, h('h3', {}, 'Best times'), times);
  };

  for (const k of keys) {
    const b = h('button', { type: 'button', role: 'tab', 'data-k': k.id }, k.name);
    b.addEventListener('click', () => show(k.id));
    tabs.appendChild(b);
  }
  show(keys.some((k) => k.id === initialKey) ? initialKey : 'beginner');
  openSheet('Statistics', h('div', {}, tabs, panel));
}

// ---- result -----------------------------------------------------------------

export interface ResultData {
  won: boolean;
  ms: number;
  rank: number;
  best?: number;
  stats: Stats;
  nextName?: string;
  again(): void;
  next?(): void;
}

export function resultSheet(r: ResultData): void {
  const rate = r.stats.played ? Math.round((r.stats.won / r.stats.played) * 100) : 0;
  const again = h('button', { class: 'btn primary', type: 'button', html: `${icons.restart}<span>Play again</span>` });
  again.addEventListener('click', () => {
    closeSheet();
    r.again();
  });
  const actions = h('div', { class: 'actions' }, again);
  if (r.won && r.next && r.nextName) {
    const next = h('button', { class: 'btn', type: 'button' }, `Next: ${r.nextName}`);
    next.addEventListener('click', () => {
      closeSheet();
      r.next!();
    });
    actions.appendChild(next);
  } else if (!r.won) {
    const look = h('button', { class: 'btn', type: 'button' }, 'View board');
    look.addEventListener('click', closeSheet);
    actions.appendChild(look);
  }

  const badge = r.won && r.rank === 0 ? h('span', { class: 'badge glow' }, 'New best time') : r.won && r.rank > 0 ? h('span', { class: 'badge' }, `#${r.rank + 1} best time`) : '';
  const body = h(
    'div',
    { class: `result ${r.won ? 'won' : 'lost'}` },
    h('div', { class: 'result-time' }, r.won ? formatTime(r.ms, true) : formatTime(r.ms)),
    badge,
    h(
      'div',
      { class: 'result-stats' },
      h('div', {}, h('b', {}, r.best !== undefined ? formatTime(r.best, true) : '—'), h('span', {}, 'Best')),
      h('div', {}, h('b', {}, `${rate}%`), h('span', {}, 'Win rate')),
      h('div', {}, h('b', {}, String(r.stats.streak)), h('span', {}, 'Streak')),
    ),
    actions,
  );
  openSheet(r.won ? 'Cleared!' : 'Boom.', body, { variant: 'result-sheet' });
}
