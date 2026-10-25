// Pure Minesweeper rules. No DOM in here.

export type Status = 'ready' | 'playing' | 'won' | 'lost';

export const HIDDEN = 0;
export const REVEALED = 1;
export const FLAGGED = 2;
export const QUESTION = 3;

export interface Opened {
  i: number;
  /** BFS distance from the tapped cell, used to stagger the reveal animation. */
  depth: number;
}

export interface MoveResult {
  opened: Opened[];
  /** Index of the mine that went off, or -1. */
  exploded: number;
}

export interface SavedGame {
  v: 1;
  rows: number;
  cols: number;
  mines: number;
  placed: boolean;
  status: Status;
  mine: string;
  state: string;
  elapsedMs: number;
  exploded: number;
}

const EMPTY: MoveResult = { opened: [], exploded: -1 };

export class Board {
  readonly rows: number;
  readonly cols: number;
  readonly mines: number;
  readonly size: number;
  readonly mine: Uint8Array;
  readonly adj: Uint8Array;
  readonly state: Uint8Array;
  status: Status = 'ready';
  placed = false;
  exploded = -1;
  revealedCount = 0;
  flagCount = 0;
  private elapsedMs = 0;
  private runningSince: number | null = null;
  private readonly rng: () => number;

  constructor(rows: number, cols: number, mines: number, rng: () => number = Math.random) {
    this.rows = Math.max(1, Math.floor(rows));
    this.cols = Math.max(1, Math.floor(cols));
    this.size = this.rows * this.cols;
    this.mines = Math.min(Math.max(0, Math.floor(mines)), this.size - 1);
    this.mine = new Uint8Array(this.size);
    this.adj = new Uint8Array(this.size);
    this.state = new Uint8Array(this.size);
    this.rng = rng;
  }

  get safeCells(): number {
    return this.size - this.mines;
  }

  get minesLeft(): number {
    return this.mines - this.flagCount;
  }

  get over(): boolean {
    return this.status === 'won' || this.status === 'lost';
  }

  neighbors(i: number): number[] {
    const r = (i / this.cols) | 0;
    const c = i % this.cols;
    const out: number[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      const rr = r + dr;
      if (rr < 0 || rr >= this.rows) continue;
      for (let dc = -1; dc <= 1; dc++) {
        const cc = c + dc;
        if ((dr === 0 && dc === 0) || cc < 0 || cc >= this.cols) continue;
        out.push(rr * this.cols + cc);
      }
    }
    return out;
  }

  /** Lays the mines so that `safe` (and its neighbours, when there's room) stays clear. */
  private place(safe: number): void {
    const keepClear = new Set<number>([safe]);
    const zone = this.neighbors(safe);
    if (this.size - 1 - zone.length >= this.mines) zone.forEach((n) => keepClear.add(n));

    const candidates: number[] = [];
    for (let i = 0; i < this.size; i++) if (!keepClear.has(i)) candidates.push(i);
    // Partial Fisher-Yates: the first `mines` entries become mines.
    for (let k = 0; k < this.mines; k++) {
      const j = k + Math.floor(this.rng() * (candidates.length - k));
      [candidates[k], candidates[j]] = [candidates[j], candidates[k]];
      this.mine[candidates[k]] = 1;
    }
    this.computeAdjacency();
    this.placed = true;
  }

  private computeAdjacency(): void {
    for (let i = 0; i < this.size; i++) {
      let n = 0;
      for (const j of this.neighbors(i)) n += this.mine[j];
      this.adj[i] = n;
    }
  }

  private start(now: number): void {
    if (this.status !== 'ready') return;
    this.status = 'playing';
    this.runningSince = now;
  }

  /** Reveals a cell (flood-filling zeros). */
  reveal(i: number, now = Date.now()): MoveResult {
    if (this.over || this.state[i] === REVEALED || this.state[i] === FLAGGED) return EMPTY;
    if (!this.placed) this.place(i);
    this.start(now);
    this.resume(now);
    return this.open([i], now);
  }

  /** Taps a satisfied number: reveals every unflagged neighbour. */
  chord(i: number, now = Date.now()): MoveResult {
    if (this.status !== 'playing' || this.state[i] !== REVEALED || this.adj[i] === 0) return EMPTY;
    const around = this.neighbors(i);
    let flags = 0;
    for (const n of around) if (this.state[n] === FLAGGED) flags++;
    if (flags !== this.adj[i]) return EMPTY;
    const targets = around.filter((n) => this.state[n] === HIDDEN || this.state[n] === QUESTION);
    if (targets.length === 0) return EMPTY;
    this.resume(now);
    return this.open(targets, now);
  }

  /** Can this revealed number be chorded right now? */
  canChord(i: number): boolean {
    if (this.status !== 'playing' || this.state[i] !== REVEALED || this.adj[i] === 0) return false;
    let flags = 0;
    let hidden = 0;
    for (const n of this.neighbors(i)) {
      if (this.state[n] === FLAGGED) flags++;
      else if (this.state[n] !== REVEALED) hidden++;
    }
    return flags === this.adj[i] && hidden > 0;
  }

  /** Multi-source BFS from `sources` (depth 0). */
  private open(sources: number[], now: number): MoveResult {
    const opened: Opened[] = [];
    let exploded = -1;
    const queue: number[] = [];
    const depth = new Map<number, number>();

    for (const s of sources) {
      if (this.mine[s]) {
        if (exploded < 0) exploded = s;
        continue;
      }
      if (!depth.has(s)) {
        depth.set(s, 0);
        queue.push(s);
      }
    }

    for (let head = 0; head < queue.length; head++) {
      const i = queue[head];
      const d = depth.get(i)!;
      this.state[i] = REVEALED;
      this.revealedCount++;
      opened.push({ i, depth: d });
      if (this.adj[i] !== 0) continue;
      for (const n of this.neighbors(i)) {
        if (depth.has(n) || this.mine[n]) continue;
        const s = this.state[n];
        if (s === REVEALED || s === FLAGGED) continue;
        depth.set(n, d + 1);
        queue.push(n);
      }
    }

    if (exploded >= 0) {
      this.exploded = exploded;
      this.finish('lost', now);
    } else if (this.revealedCount === this.safeCells) {
      for (let i = 0; i < this.size; i++) {
        if (this.mine[i] && this.state[i] !== FLAGGED) {
          this.state[i] = FLAGGED;
          this.flagCount++;
        }
      }
      this.finish('won', now);
    }
    return { opened, exploded };
  }

  /** Cycles hidden → flagged (→ question) → hidden. Returns the new state, or -1 if nothing changed. */
  toggleFlag(i: number, questionMarks = false): number {
    if (this.over || this.state[i] === REVEALED) return -1;
    const s = this.state[i];
    let next: number;
    if (s === HIDDEN) next = FLAGGED;
    else if (s === FLAGGED) next = questionMarks ? QUESTION : HIDDEN;
    else next = HIDDEN;
    if (s === FLAGGED) this.flagCount--;
    if (next === FLAGGED) this.flagCount++;
    this.state[i] = next;
    return next;
  }

  private finish(status: 'won' | 'lost', now: number): void {
    this.pause(now);
    this.status = status;
  }

  pause(now = Date.now()): void {
    if (this.runningSince !== null) {
      this.elapsedMs += now - this.runningSince;
      this.runningSince = null;
    }
  }

  resume(now = Date.now()): void {
    if (this.status === 'playing' && this.runningSince === null) this.runningSince = now;
  }

  get running(): boolean {
    return this.runningSince !== null;
  }

  elapsed(now = Date.now()): number {
    return this.elapsedMs + (this.runningSince !== null ? now - this.runningSince : 0);
  }

  serialize(now = Date.now()): SavedGame {
    let mine = '';
    let state = '';
    for (let i = 0; i < this.size; i++) {
      mine += this.mine[i];
      state += this.state[i];
    }
    return {
      v: 1,
      rows: this.rows,
      cols: this.cols,
      mines: this.mines,
      placed: this.placed,
      status: this.status,
      mine,
      state,
      elapsedMs: this.elapsed(now),
      exploded: this.exploded,
    };
  }

  /** Restores a saved game. The timer stays paused until the next move or `resume()`. */
  static deserialize(s: SavedGame, rng?: () => number): Board | null {
    if (!s || s.v !== 1) return null;
    const b = new Board(s.rows, s.cols, s.mines, rng);
    if (s.mine.length !== b.size || s.state.length !== b.size) return null;
    for (let i = 0; i < b.size; i++) {
      b.mine[i] = s.mine.charCodeAt(i) - 48;
      b.state[i] = s.state.charCodeAt(i) - 48;
      if (b.state[i] === REVEALED) b.revealedCount++;
      if (b.state[i] === FLAGGED) b.flagCount++;
    }
    b.placed = s.placed;
    b.status = s.status;
    b.elapsedMs = s.elapsedMs;
    b.exploded = s.exploded;
    if (b.placed) b.computeAdjacency();
    return b;
  }
}
