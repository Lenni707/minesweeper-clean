// Renders a Board into a DOM grid and choreographs its animations.
// Each cell's class string is cached, so a sync only touches the cells that changed.

import { Board, FLAGGED, HIDDEN, QUESTION, REVEALED, type Opened } from '../engine/board';

const A_REVEAL = 1;
const A_FLAG = 2;
const A_MINE = 3;
const A_WIN = 4;
const A_UNFLAG = 5;
const ANIM_CLASS = ['', ' ar', ' af', ' am', ' aw', ' au'];

/** Longest stagger for any one wave (ms), so huge openings don't drag on. */
const MAX_WAVE = 650;

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

  private classFor(i: number): string {
    const b = this.board;
    const s = b.state[i];
    let c: string;
    if (s === REVEALED) {
      c = b.mine[i] ? 'c o m' : `c o n${b.adj[i]}`;
    } else if (this.lost && b.mine[i] && s !== FLAGGED) {
      c = 'c o m';
    } else if (s === FLAGGED) {
      c = this.lost && !b.mine[i] ? 'c h f wf' : 'c h f';
    } else if (s === QUESTION) {
      c = 'c h q';
    } else {
      c = 'c h';
    }
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

  syncAll(): void {
    for (let i = 0; i < this.board.size; i++) this.sync(i);
  }

  private delay(i: number, ms: number): void {
    this.cells[i].style.animationDelay = ms > 0 ? `${Math.round(ms * this.speed)}ms` : '';
  }

  /** Staggers newly opened cells by their flood-fill depth. */
  reveal(opened: Opened[]): void {
    if (opened.length === 0) return;
    let maxDepth = 0;
    for (const o of opened) maxDepth = Math.max(maxDepth, o.depth);
    const step = maxDepth > 0 ? Math.min(22, MAX_WAVE / maxDepth) : 0;
    for (const o of opened) {
      this.anim[o.i] = A_REVEAL;
      this.delay(o.i, o.depth * step);
      this.sync(o.i);
    }
  }

  flag(i: number): void {
    this.anim[i] = this.board.state[i] === HIDDEN ? A_UNFLAG : A_FLAG;
    this.delay(i, 0);
    this.sync(i);
  }

  /** Mines appear one ring at a time, rippling out from the one that went off. */
  lose(): number {
    const b = this.board;
    this.lost = true;
    this.el.classList.add('lost');
    this.el.classList.remove('shake');
    void this.el.offsetWidth;
    this.el.classList.add('shake');
    const er = (b.exploded / b.cols) | 0;
    const ec = b.exploded % b.cols;
    let far = 1;
    for (let i = 0; i < b.size; i++) {
      if (b.mine[i] || b.state[i] === FLAGGED) {
        const r = (i / b.cols) | 0;
        far = Math.max(far, Math.hypot(r - er, (i % b.cols) - ec));
      }
    }
    const step = Math.min(45, 900 / far);
    for (let i = 0; i < b.size; i++) {
      if (i === b.exploded) {
        this.anim[i] = A_MINE;
        this.delay(i, 0);
      } else if ((b.mine[i] && b.state[i] !== FLAGGED) || (b.state[i] === FLAGGED && !b.mine[i])) {
        const r = (i / b.cols) | 0;
        this.anim[i] = A_MINE;
        this.delay(i, 160 + Math.hypot(r - er, (i % b.cols) - ec) * step);
      }
    }
    this.syncAll();
    return (160 + far * step) * this.speed;
  }

  /** A diagonal wave across the board; auto-placed flags pop in with it. */
  win(): number {
    const b = this.board;
    this.el.classList.add('won');
    const diag = b.rows + b.cols - 2 || 1;
    const step = Math.min(28, 900 / diag);
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
        { transform: 'translateX(-8%)' },
        { transform: 'translateX(6%)' },
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
