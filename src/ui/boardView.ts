// Renders a Board into a DOM grid and choreographs its animations.
//
// Look (after "Minesweeper – The Clean One"): every unrevealed cell is painted in the accent colour
// with no gaps, so the hidden area reads as one solid shape. Only its outer corners are rounded,
// plus small fillets in the inner corners. Revealed cells are just the background with a thin number.
// Flags are grey rounded squares that merge with neighbouring flags.
// Each cell's class string is cached, so a sync only touches the DOM where something changed.

import { Board, FLAGGED, HIDDEN, QUESTION, REVEALED, type Opened } from '../engine/board';

const A_REVEAL = 1;
const A_FLAG = 2;
const A_MINE = 3;
const A_WIN = 4;
const A_UNFLAG = 5;
const ANIM_CLASS = ['', ' ar', ' af', ' am', ' aw', ' au'];

/** Longest stagger for any one wave (ms), so huge openings don't drag on. */
const MAX_WAVE = 650;

/** Which shape a cell belongs to: 0 = open ground, 1 = the hidden area, 2 = flags. */
const OPEN = 0;
const AREA = 1;
const FLAGS = 2;

export class BoardView {
  private board!: Board;
  private cells: HTMLElement[] = [];
  private cache: string[] = [];
  private text: string[] = [];
  private anim = new Uint8Array(0);
  private lost = false;
  private pressed = -1;
  private longPress = false;
  private hovered = -1;
  private preview = new Set<number>();
  /** Multiplier on animation delays (0 when motion is reduced). */
  speed = 1;

  constructor(readonly el: HTMLElement) {}

  build(board: Board): void {
    this.board = board;
    this.lost = board.status === 'lost';
    this.pressed = this.hovered = -1;
    this.preview.clear();
    this.anim = new Uint8Array(board.size);
    this.cache = new Array(board.size).fill('');
    this.text = new Array(board.size).fill('');
    this.el.style.setProperty('--cols', String(board.cols));
    this.el.style.setProperty('--rows', String(board.rows));
    this.el.classList.remove('shake', 'won', 'lost');
    if (board.status === 'won') this.el.classList.add('won');
    if (this.lost) this.el.classList.add('lost');

    const frag = document.createDocumentFragment();
    this.cells = [];
    for (let i = 0; i < board.size; i++) {
      const d = document.createElement('div');
      this.cells.push(d);
      frag.appendChild(d);
    }
    this.el.replaceChildren(frag);
    this.syncAll();
  }

  private group(i: number): number {
    const s = this.board.state[i];
    if (s === FLAGGED) return FLAGS;
    if (s === REVEALED) return OPEN;
    // After a loss, mines stay part of the shape (they show as cut-outs) but everything else opens up.
    return AREA;
  }

  /** Same-group neighbours as side classes, and inner-corner fillets for open cells. */
  private shape(i: number, g: number): string {
    const b = this.board;
    const r = (i / b.cols) | 0;
    const c = i % b.cols;
    const up = r > 0 ? this.group(i - b.cols) : -1;
    const dn = r < b.rows - 1 ? this.group(i + b.cols) : -1;
    const lf = c > 0 ? this.group(i - 1) : -1;
    const rt = c < b.cols - 1 ? this.group(i + 1) : -1;
    let s = '';
    if (g !== OPEN) {
      if (up === g) s += ' su';
      if (rt === g) s += ' sr';
      if (dn === g) s += ' sd';
      if (lf === g) s += ' sl';
      return s;
    }
    // Faint grid dashes only between two open cells.
    if (rt === OPEN) s += ' gr';
    if (dn === OPEN) s += ' gd';
    // A fillet sits where two hidden sides meet around an open corner and the diagonal is hidden too.
    const diag = (dr: number, dc: number) => this.group(i + dr * b.cols + dc) === AREA;
    if (up === AREA && lf === AREA && diag(-1, -1)) s += ' ftl';
    if (up === AREA && rt === AREA && diag(-1, 1)) s += ' ftr';
    if (dn === AREA && lf === AREA && diag(1, -1)) s += ' fbl';
    if (dn === AREA && rt === AREA && diag(1, 1)) s += ' fbr';
    return s;
  }

  private classFor(i: number): string {
    const b = this.board;
    const s = b.state[i];
    const g = this.group(i);
    let c: string;
    if (s === REVEALED) {
      c = b.mine[i] ? 'c o m' : `c o n${b.adj[i]}`;
    } else if (s === FLAGGED) {
      c = this.lost && !b.mine[i] ? 'c f wf' : 'c f';
    } else {
      c = 'c h';
      if (s === QUESTION) c += ' q';
      if (this.lost && b.mine[i]) c += ' m';
    }
    c += this.shape(i, g);
    if (this.lost && i === b.exploded) c += ' x';
    c += ANIM_CLASS[this.anim[i]];
    if (i === this.pressed) c += this.longPress ? ' p lp' : ' p';
    if (i === this.hovered) c += ' hv';
    if (this.preview.has(i)) c += ' pv';
    return c;
  }

  private textFor(i: number): string {
    const b = this.board;
    return b.state[i] === REVEALED && !b.mine[i] && b.adj[i] > 0 ? String(b.adj[i]) : '';
  }

  private sync(i: number): void {
    const c = this.classFor(i);
    if (c !== this.cache[i]) {
      this.cache[i] = c;
      this.cells[i].className = c;
    }
    const t = this.textFor(i);
    if (t !== this.text[i]) {
      this.text[i] = t;
      this.cells[i].textContent = t;
    }
  }

  /** Re-renders every cell. Shapes depend on neighbours, so moves call this rather than syncing single cells. */
  syncAll(): void {
    for (let i = 0; i < this.board.size; i++) this.sync(i);
  }

  private syncAround(i: number): void {
    const b = this.board;
    this.sync(i);
    for (const n of b.neighbors(i)) this.sync(n);
  }

  private delay(i: number, ms: number): void {
    this.cells[i].style.animationDelay = ms > 0 ? `${Math.round(ms * this.speed)}ms` : '';
  }

  /** Newly opened cells dissolve out of the shape, staggered by flood-fill depth. */
  reveal(opened: Opened[]): void {
    if (opened.length === 0) return;
    let maxDepth = 0;
    for (const o of opened) maxDepth = Math.max(maxDepth, o.depth);
    const step = maxDepth > 0 ? Math.min(24, MAX_WAVE / maxDepth) : 0;
    for (const o of opened) {
      this.anim[o.i] = A_REVEAL;
      this.delay(o.i, o.depth * step);
    }
    this.syncAll();
  }

  flag(i: number): void {
    this.anim[i] = this.board.state[i] === FLAGGED ? A_FLAG : A_UNFLAG;
    this.delay(i, 0);
    this.syncAround(i);
  }

  /** Mines punch out of the shape one ring at a time, rippling out from the one that went off. */
  lose(): number {
    const b = this.board;
    this.lost = true;
    this.el.classList.add('lost');
    this.el.classList.remove('shake');
    void this.el.offsetWidth;
    this.el.classList.add('shake');
    const er = (b.exploded / b.cols) | 0;
    const ec = b.exploded % b.cols;
    const dist = (i: number) => Math.hypot(((i / b.cols) | 0) - er, (i % b.cols) - ec);
    let far = 1;
    for (let i = 0; i < b.size; i++) if (b.mine[i] || b.state[i] === FLAGGED) far = Math.max(far, dist(i));
    const step = Math.min(45, 900 / far);
    for (let i = 0; i < b.size; i++) {
      if (i === b.exploded) {
        this.anim[i] = A_MINE;
        this.delay(i, 0);
      } else if ((b.mine[i] && b.state[i] !== FLAGGED) || (b.state[i] === FLAGGED && !b.mine[i])) {
        this.anim[i] = A_MINE;
        this.delay(i, 160 + dist(i) * step);
      }
    }
    this.syncAll();
    return (160 + far * step) * this.speed;
  }

  /** The last of the shape turns into flags, then a wave rolls across the numbers. */
  win(): number {
    const b = this.board;
    this.el.classList.add('won');
    const diag = b.rows + b.cols - 2 || 1;
    const step = Math.min(26, 900 / diag);
    for (let i = 0; i < b.size; i++) {
      const r = (i / b.cols) | 0;
      const c = i % b.cols;
      this.anim[i] = b.state[i] === FLAGGED && this.anim[i] !== A_FLAG ? A_FLAG : A_WIN;
      this.delay(i, 120 + (r + c) * step);
    }
    this.syncAll();
    return (120 + diag * step) * this.speed;
  }

  /** A small shake for a number that can't be chorded yet. */
  nudge(i: number): void {
    const el = this.cells[i];
    if (!el || this.speed === 0) return;
    el.animate(
      [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-10%)' },
        { transform: 'translateX(8%)' },
        { transform: 'translateX(0)' },
      ],
      { duration: 220, easing: 'ease-out' },
    );
  }

  setPressed(i: number, long: boolean): void {
    const prev = this.pressed;
    this.pressed = i;
    this.longPress = long;
    if (prev >= 0) this.sync(prev);
    if (i >= 0) this.sync(i);
  }

  setHover(i: number): void {
    if (i === this.hovered) return;
    const prev = this.hovered;
    this.hovered = i;
    if (prev >= 0) this.sync(prev);
    if (i >= 0) this.sync(i);
  }

  setChordPreview(i: number): void {
    const old = [...this.preview];
    this.preview.clear();
    if (i >= 0 && !this.board.over) {
      for (const n of [i, ...this.board.neighbors(i)]) {
        const s = this.board.state[n];
        if (s === HIDDEN || s === QUESTION) this.preview.add(n);
      }
    }
    for (const n of old) this.sync(n);
    for (const n of this.preview) this.sync(n);
  }
}
