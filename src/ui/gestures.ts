// Turns raw input on the board into game intents.
// Touch/pen: tap, long-press, one-finger pan, two-finger pinch.
// Mouse: left = primary, right = secondary, middle or left+right = chord, drag = pan, wheel = pan/zoom.

import type { Viewport } from './viewport';

export interface GestureHandlers {
  primary(i: number): void;
  secondary(i: number): void;
  chord(i: number): void;
  /** Visual press feedback; `long` shows the long-press ring. -1 clears. */
  press(i: number, long: boolean): void;
  hover(i: number): void;
  chordPreview(i: number): void;
}

const TOUCH_SLOP = 9;
const MOUSE_SLOP = 5;

interface Pt {
  x: number;
  y: number;
}

export class Gestures {
  longPressMs = 300;
  private pts = new Map<number, Pt>();
  private mode: 'idle' | 'pending' | 'fired' | 'pan' | 'pinch' = 'idle';
  private start: Pt = { x: 0, y: 0 };
  private startCell = -1;
  private timer = 0;
  private last: Pt = { x: 0, y: 0 };
  private lastDist = 0;
  private vel: Pt = { x: 0, y: 0 };
  private lastT = 0;
  private mouse: 'idle' | 'pending' | 'pan' | 'chord' = 'idle';

  constructor(
    private host: HTMLElement,
    private vp: Viewport,
    private h: GestureHandlers,
  ) {
    host.addEventListener('pointerdown', this.onDown);
    host.addEventListener('pointermove', this.onMove);
    host.addEventListener('pointerup', this.onUp);
    host.addEventListener('pointercancel', this.onCancel);
    host.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mouseup', this.onMouseUp);
    host.addEventListener('mouseleave', () => this.mouse === 'idle' && this.h.hover(-1));
    host.addEventListener('contextmenu', (e) => e.preventDefault());
    host.addEventListener('wheel', this.onWheel, { passive: false });
    // Safari's proprietary pinch events would otherwise zoom the page.
    host.addEventListener('gesturestart', (e) => e.preventDefault());
  }

  private local(e: { clientX: number; clientY: number }): Pt {
    const r = this.host.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private cancelPending(): void {
    clearTimeout(this.timer);
    this.h.press(-1, false);
  }

  // ---- touch & pen -------------------------------------------------------

  private onDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') return;
    e.preventDefault();
    this.host.setPointerCapture(e.pointerId);
    const p = this.local(e);
    this.pts.set(e.pointerId, p);
    this.vp.stopMomentum();

    if (this.pts.size === 1) {
      this.mode = 'pending';
      this.start = p;
      this.last = p;
      this.lastT = e.timeStamp;
      this.vel = { x: 0, y: 0 };
      this.startCell = this.vp.cellAt(p.x, p.y);
      if (this.startCell >= 0) {
        this.h.press(this.startCell, true);
        this.timer = window.setTimeout(() => {
          if (this.mode !== 'pending') return;
          this.mode = 'fired';
          this.h.press(-1, false);
          this.h.secondary(this.startCell);
        }, this.longPressMs);
      }
    } else if (this.pts.size === 2) {
      if (this.mode === 'pending') this.cancelPending();
      this.mode = 'pinch';
      const [a, b] = [...this.pts.values()];
      this.lastDist = Math.hypot(a.x - b.x, a.y - b.y);
      this.last = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  };

  private onMove = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' || !this.pts.has(e.pointerId)) return;
    const p = this.local(e);
    this.pts.set(e.pointerId, p);

    if (this.mode === 'pending' || this.mode === 'fired') {
      if (Math.hypot(p.x - this.start.x, p.y - this.start.y) > TOUCH_SLOP) {
        if (this.mode === 'pending') this.cancelPending();
        this.mode = 'pan';
        this.last = p;
      }
    }
    if (this.mode === 'pan') {
      const dt = Math.max(1, e.timeStamp - this.lastT);
      const dx = p.x - this.last.x;
      const dy = p.y - this.last.y;
      this.vel = { x: 0.7 * (dx / dt) + 0.3 * this.vel.x, y: 0.7 * (dy / dt) + 0.3 * this.vel.y };
      this.lastT = e.timeStamp;
      this.vp.panBy(dx, dy);
      this.last = p;
    } else if (this.mode === 'pinch' && this.pts.size >= 2) {
      const [a, b] = [...this.pts.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (this.lastDist > 0) this.vp.zoomAt(dist / this.lastDist, mid.x, mid.y);
      this.vp.panBy(mid.x - this.last.x, mid.y - this.last.y);
      this.lastDist = dist;
      this.last = mid;
    }
  };

  private onUp = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' || !this.pts.has(e.pointerId)) return;
    this.pts.delete(e.pointerId);

    if (this.mode === 'pending') {
      this.cancelPending();
      this.mode = 'idle';
      if (this.startCell >= 0) this.h.primary(this.startCell);
      return;
    }
    if (this.mode === 'pinch') {
      if (this.pts.size === 1) {
        // Lifting one finger of a pinch continues as a pan, never as a tap.
        this.mode = 'pan';
        this.last = [...this.pts.values()][0];
        this.lastT = e.timeStamp;
        this.vel = { x: 0, y: 0 };
      }
      this.vp.commit();
      return;
    }
    if (this.pts.size === 0) {
      if (this.mode === 'pan' && e.timeStamp - this.lastT < 80) this.vp.fling(this.vel.x, this.vel.y);
      this.mode = 'idle';
    }
  };

  private onCancel = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') return;
    this.pts.delete(e.pointerId);
    this.cancelPending();
    if (this.pts.size === 0) {
      this.mode = 'idle';
      this.vp.commit();
    }
  };

  // ---- mouse -------------------------------------------------------------

  private onMouseDown = (e: MouseEvent): void => {
    const p = this.local(e);
    const i = this.vp.cellAt(p.x, p.y);
    this.vp.stopMomentum();
    const both = (e.buttons & 3) === 3;
    if (e.button === 1 || both) {
      e.preventDefault();
      this.mouse = 'chord';
      this.h.press(-1, false);
      this.h.chordPreview(i);
      return;
    }
    if (e.button === 0) {
      this.mouse = 'pending';
      this.start = p;
      this.last = p;
      this.startCell = i;
      if (i >= 0) this.h.press(i, false);
    } else if (e.button === 2 && i >= 0) {
      this.h.secondary(i);
    }
  };

  private onMouseMove = (e: MouseEvent): void => {
    const p = this.local(e);
    if (this.mouse === 'pending' && Math.hypot(p.x - this.start.x, p.y - this.start.y) > MOUSE_SLOP) {
      this.h.press(-1, false);
      this.mouse = 'pan';
      this.host.classList.add('grabbing');
    }
    if (this.mouse === 'pan') {
      this.vp.panBy(p.x - this.last.x, p.y - this.last.y);
      this.last = p;
    } else if (this.mouse === 'chord') {
      this.h.chordPreview(this.vp.cellAt(p.x, p.y));
    } else if (this.mouse === 'pending') {
      const i = this.vp.cellAt(p.x, p.y);
      this.h.press(i === this.startCell ? i : -1, false);
    } else if (e.target instanceof Node && this.host.contains(e.target)) {
      this.h.hover(this.vp.cellAt(p.x, p.y));
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    const p = this.local(e);
    const i = this.vp.cellAt(p.x, p.y);
    if (this.mouse === 'chord') {
      if ((e.buttons & 7) === 0) {
        this.mouse = 'idle';
        this.h.chordPreview(-1);
        if (i >= 0) this.h.chord(i);
      }
      return;
    }
    if (e.button !== 0) return;
    if (this.mouse === 'pending') {
      this.h.press(-1, false);
      if (i >= 0 && i === this.startCell) this.h.primary(i);
    }
    this.host.classList.remove('grabbing');
    this.mouse = 'idle';
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.vp.height : 1;
    const p = this.local(e);
    if (e.ctrlKey || e.metaKey) {
      // Trackpad pinch arrives as ctrl+wheel with small deltas.
      this.vp.zoomAt(Math.exp(-e.deltaY * unit * 0.01), p.x, p.y);
    } else {
      this.vp.panBy(-e.deltaX * unit, -e.deltaY * unit);
    }
  };
}
