// Zoom & pan for the board. The board is laid out at a committed cell size (`--cell`)
// and moved with a transform. During a gesture we only change the transform (cheap); when it
// settles we commit the new cell size into the layout so text re-rasterises crisply.

/** Gap between cells, as a fraction of the cell size (mirrors board.css). */
export const GAP = 0.1;

export interface ViewportOptions {
  minCell: number;
  maxCell: number;
  /** Space kept around the board, px. */
  margin: number;
}

export class Viewport {
  /** Live cell size in px (layout × transform). */
  s = 32;
  tx = 0;
  ty = 0;
  /** True until the user zooms or pans; resizing then refits. */
  auto = true;
  private committed = 32;
  private cols = 1;
  private rows = 1;
  private commitTimer = 0;
  private momentum = 0;

  constructor(
    readonly host: HTMLElement,
    readonly board: HTMLElement,
    private opts: ViewportOptions,
  ) {
    new ResizeObserver(() => (this.auto ? this.fit(false) : this.clampAndApply())).observe(host);
  }

  setOptions(opts: ViewportOptions): void {
    this.opts = opts;
  }

  get width(): number {
    return this.host.clientWidth;
  }

  get height(): number {
    return this.host.clientHeight;
  }

  private units(n: number): number {
    return n + GAP * (n - 1);
  }

  /** Board size in px at the live scale. */
  get boardW(): number {
    return this.s * this.units(this.cols);
  }

  get boardH(): number {
    return this.s * this.units(this.rows);
  }

  private fitCell(): number {
    return Math.min(
      (this.width - this.opts.margin * 2) / this.units(this.cols),
      (this.height - this.opts.margin * 2) / this.units(this.rows),
    );
  }

  /** The smallest you may zoom out to: whole board visible, but never below 4px. */
  private minScale(): number {
    return Math.max(4, Math.min(this.fitCell(), this.opts.minCell));
  }

  private maxScale(): number {
    return Math.max(this.opts.maxCell * 1.8, 72);
  }

  setBoard(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    this.fit(false);
  }

  /** Fits the board to the screen (within the comfortable cell-size range) and centres it. */
  fit(animate = true): void {
    this.stopMomentum();
    this.auto = true;
    const cell = Math.min(this.opts.maxCell, Math.max(this.fitCell(), this.opts.minCell));
    this.s = Math.max(4, cell);
    this.tx = (this.width - this.boardW) / 2;
    this.ty = (this.height - this.boardH) / 2;
    this.clamp();
    if (!animate) return this.commit();
    // Glide there with the transform, then bake the size in.
    this.board.classList.add('vp-anim');
    this.apply();
    clearTimeout(this.commitTimer);
    this.commitTimer = window.setTimeout(() => {
      this.board.classList.remove('vp-anim');
      this.commit();
    }, 320);
  }

  /** Zooms by factor `k` around the host-relative point (px, py). */
  zoomAt(k: number, px: number, py: number): void {
    this.auto = false;
    const next = Math.min(this.maxScale(), Math.max(this.minScale(), this.s * k));
    const wx = (px - this.tx) / this.s;
    const wy = (py - this.ty) / this.s;
    this.s = next;
    this.tx = px - wx * next;
    this.ty = py - wy * next;
    this.clampAndApply();
    this.scheduleCommit();
  }

  panBy(dx: number, dy: number): void {
    this.auto = false;
    this.tx += dx;
    this.ty += dy;
    this.clampAndApply();
  }

  /** Continues a pan with the release velocity (px/ms). */
  fling(vx: number, vy: number): void {
    this.stopMomentum();
    if (Math.hypot(vx, vy) < 0.25) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(32, now - last);
      last = now;
      const beforeX = this.tx;
      const beforeY = this.ty;
      this.panBy(vx * dt, vy * dt);
      // Stop dead on an edge instead of sliding along it forever.
      if (this.tx === beforeX) vx = 0;
      if (this.ty === beforeY) vy = 0;
      const decay = Math.pow(0.994, dt);
      vx *= decay;
      vy *= decay;
      if (Math.hypot(vx, vy) > 0.02) this.momentum = requestAnimationFrame(step);
      else this.momentum = 0;
    };
    this.momentum = requestAnimationFrame(step);
  }

  stopMomentum(): void {
    if (this.momentum) cancelAnimationFrame(this.momentum);
    this.momentum = 0;
  }

  /** Converts a host-relative point to a cell index, or -1. */
  cellAt(px: number, py: number): number {
    const step = this.s * (1 + GAP);
    const x = (px - this.tx) / step;
    const y = (py - this.ty) / step;
    const c = Math.floor(x + GAP / 2 / (1 + GAP));
    const r = Math.floor(y + GAP / 2 / (1 + GAP));
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    return r * this.cols + c;
  }

  private clamp(): void {
    const w = this.boardW;
    const h = this.boardH;
    if (w <= this.width - this.opts.margin * 2) this.tx = (this.width - w) / 2;
    else this.tx = Math.min(this.opts.margin, Math.max(this.width - w - this.opts.margin, this.tx));
    if (h <= this.height - this.opts.margin * 2) this.ty = (this.height - h) / 2;
    else this.ty = Math.min(this.opts.margin, Math.max(this.height - h - this.opts.margin, this.ty));
  }

  private clampAndApply(): void {
    this.clamp();
    this.apply();
  }

  private apply(): void {
    const k = this.s / this.committed;
    this.board.style.transform = `translate3d(${this.tx}px, ${this.ty}px, 0) scale(${k})`;
  }

  private scheduleCommit(): void {
    clearTimeout(this.commitTimer);
    this.commitTimer = window.setTimeout(() => this.commit(), 160);
  }

  /** Bakes the live scale into the layout. Call when a gesture ends. */
  commit(): void {
    clearTimeout(this.commitTimer);
    this.committed = this.s;
    this.board.style.setProperty('--cell', `${this.s}px`);
    this.apply();
  }
}
