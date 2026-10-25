import type { SavedGame } from '../engine/board';

export type ThemeId =
  | 'sand'
  | 'steel'
  | 'rose'
  | 'lilac'
  | 'coral'
  | 'olive'
  | 'ember'
  | 'ocean'
  | 'forest'
  | 'mint'
  | 'violet'
  | 'plum'
  | 'berry'
  | 'neon'
  | 'midnight';
export type ToggleMode = 'auto' | 'always' | 'never';

export interface Settings {
  /** `null` follows the system light/dark preference. */
  theme: ThemeId | null;
  longPressMs: number;
  toggle: ToggleMode;
  haptics: boolean;
  questionMarks: boolean;
  reducedMotion: boolean;
  lastKey: string;
  custom: { cols: number; rows: number; mines: number };
}

export interface BestTime {
  ms: number;
  at: number;
  /** Board size, for custom games. */
  size?: string;
}

export interface Stats {
  played: number;
  won: number;
  streak: number;
  bestStreak: number;
  times: BestTime[];
}

interface Store {
  v: 1;
  settings: Settings;
  saves: Record<string, SavedGame>;
  stats: Record<string, Stats>;
}

const KEY = 'mcs:v1';

export const DEFAULT_SETTINGS: Settings = {
  theme: null,
  longPressMs: 300,
  toggle: 'auto',
  haptics: true,
  questionMarks: false,
  reducedMotion: false,
  lastKey: 'beginner',
  custom: { cols: 12, rows: 20, mines: 40 },
};

function blank(): Store {
  return { v: 1, settings: { ...DEFAULT_SETTINGS }, saves: {}, stats: {} };
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blank();
    const parsed = JSON.parse(raw) as Partial<Store>;
    if (parsed.v !== 1) return blank();
    return {
      v: 1,
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
      saves: parsed.saves ?? {},
      stats: parsed.stats ?? {},
    };
  } catch {
    return blank();
  }
}

const store = load();

function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Storage full or blocked (private mode): the game still works, it just won't remember.
  }
}

export function getSettings(): Settings {
  return store.settings;
}

export function updateSettings(patch: Partial<Settings>): Settings {
  Object.assign(store.settings, patch);
  persist();
  return store.settings;
}

export function getSave(key: string): SavedGame | undefined {
  return store.saves[key];
}

export function putSave(key: string, game: SavedGame): void {
  store.saves[key] = game;
  persist();
}

export function dropSave(key: string): void {
  delete store.saves[key];
  persist();
}

export function getStats(key: string): Stats {
  return store.stats[key] ?? { played: 0, won: 0, streak: 0, bestStreak: 0, times: [] };
}

/** Records a finished (or abandoned) game. Returns the 0-based rank of the time if it made the top 5. */
export function recordResult(key: string, won: boolean, ms: number, size?: string): number {
  const s = getStats(key);
  s.played++;
  let rank = -1;
  if (won) {
    s.won++;
    s.streak++;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
    const entry: BestTime = { ms, at: Date.now(), ...(size ? { size } : {}) };
    s.times.push(entry);
    s.times.sort((a, b) => a.ms - b.ms);
    s.times = s.times.slice(0, 5);
    rank = s.times.indexOf(entry);
  } else {
    s.streak = 0;
  }
  store.stats[key] = s;
  persist();
  return rank;
}

export function resetStats(): void {
  store.stats = {};
  persist();
}
