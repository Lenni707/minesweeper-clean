// A logic-only solver, used to make boards guess-free like the original.
// It plays from the first tap using rules a person can follow: single-number counts, pairs of
// overlapping numbers, and the total mine count. If it can open every safe cell, no guess is ever needed.

export interface Grid {
  rows: number;
  cols: number;
  mines: number;
  mine: Uint8Array;
  adj: Uint8Array;
}

export interface SolveResult {
  solved: boolean;
  /** Safe cells the solver managed to open. */
  opened: number;
  /** Undeduced mines next to opened ground: moving one of these is what un-sticks the solver. */
  stuckMines: number[];
  /** Hidden, mine-free cells touching no opened ground: safe places to move a mine to. */
  interior: number[];
  /** Fallbacks for the end-game, when the lists above run dry: every undeduced mine / hidden safe cell. */
  hiddenMines: number[];
  hiddenSafe: number[];
}

const UNKNOWN = 0;
const SAFE = 1;
const MINE = 2;

export function neighbourTable(rows: number, cols: number): Int32Array[] {
  const out: Int32Array[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const list: number[] = [];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const rr = r + dr;
          const cc = c + dc;
          if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) list.push(rr * cols + cc);
        }
      }
      out.push(Int32Array.from(list));
    }
  }
  return out;
}

export function solve(g: Grid, start: number, nb: Int32Array[] = neighbourTable(g.rows, g.cols)): SolveResult {
  const size = g.rows * g.cols;
  const known = new Uint8Array(size);
  let opened = 0;
  let flagged = 0;
  const goal = size - g.mines;

  const stack: number[] = [];
  const open = (i: number) => {
    if (known[i] !== UNKNOWN) return;
    stack.push(i);
    while (stack.length) {
      const j = stack.pop()!;
      if (known[j] !== UNKNOWN) continue;
      known[j] = SAFE;
      opened++;
      if (g.adj[j] === 0) for (const n of nb[j]) if (known[n] === UNKNOWN) stack.push(n);
    }
  };
  const mark = (i: number) => {
    if (known[i] !== UNKNOWN) return;
    known[i] = MINE;
    flagged++;
  };

  open(start);
  while (opened < goal) {
    let progress = false;

    // Constraints from opened numbers that still touch unknown cells.
    const cells: number[][] = [];
    const need: number[] = [];
    const owner = new Map<number, number[]>();
    for (let i = 0; i < size; i++) {
      if (known[i] !== SAFE || g.adj[i] === 0) continue;
      const unk: number[] = [];
      let m = 0;
      for (const n of nb[i]) {
        if (known[n] === UNKNOWN) unk.push(n);
        else if (known[n] === MINE) m++;
      }
      if (unk.length === 0) continue;
      const rem = g.adj[i] - m;
      if (rem === 0) {
        for (const n of unk) open(n);
        progress = true;
      } else if (rem === unk.length) {
        for (const n of unk) mark(n);
        progress = true;
      } else {
        const k = cells.length;
        cells.push(unk);
        need.push(rem);
        for (const n of unk) {
          const list = owner.get(n);
          if (list) list.push(k);
          else owner.set(n, [k]);
        }
      }
    }
    if (progress) continue;

    // Pairs of overlapping numbers: if B needs exactly |B \ A| more mines than A,
    // B \ A are all mines and A \ B are all safe.
    pairs: for (let a = 0; a < cells.length; a++) {
      const seen = new Set<number>();
      for (const n of cells[a]) for (const b of owner.get(n)!) if (b !== a) seen.add(b);
      const A = new Set(cells[a]);
      for (const b of seen) {
        const onlyB = cells[b].filter((n) => !A.has(n));
        const B = new Set(cells[b]);
        const onlyA = cells[a].filter((n) => !B.has(n));
        const diff = need[b] - need[a];
        if (diff === onlyB.length && (onlyB.length > 0 || onlyA.length > 0)) {
          for (const n of onlyB) mark(n);
          for (const n of onlyA) open(n);
          progress = true;
          break pairs;
        }
      }
    }
    if (progress) continue;

    // Mine count: all remaining mines found, or every unknown cell is a mine.
    let unknown = 0;
    for (let i = 0; i < size; i++) if (known[i] === UNKNOWN) unknown++;
    const left = g.mines - flagged;
    if (left === 0 || left === unknown) {
      for (let i = 0; i < size; i++) {
        if (known[i] !== UNKNOWN) continue;
        if (left === 0) open(i);
        else mark(i);
      }
      continue;
    }
    break;
  }

  if (opened >= goal) return { solved: true, opened, stuckMines: [], interior: [], hiddenMines: [], hiddenSafe: [] };

  const stuckMines: number[] = [];
  const interior: number[] = [];
  const hiddenMines: number[] = [];
  const hiddenSafe: number[] = [];
  for (let i = 0; i < size; i++) {
    if (known[i] !== UNKNOWN) continue;
    let touches = false;
    for (const n of nb[i]) if (known[n] === SAFE) touches = true;
    if (g.mine[i]) hiddenMines.push(i);
    else hiddenSafe.push(i);
    if (touches && g.mine[i]) stuckMines.push(i);
    else if (!touches && !g.mine[i]) interior.push(i);
  }
  return { solved: false, opened, stuckMines, interior, hiddenMines, hiddenSafe };
}
