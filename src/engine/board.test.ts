import { describe, expect, it } from 'vitest';
import { Board, FLAGGED, HIDDEN, QUESTION, REVEALED } from './board';
import { solve } from './solver';

function seeded(seed: number): () => number {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Builds a board with mines at fixed positions, already placed. */
function fixed(rows: number, cols: number, mines: number[]): Board {
  const b = new Board(rows, cols, mines.length);
  const save = b.serialize(0);
  const mine = Array.from({ length: rows * cols }, (_, i) => (mines.includes(i) ? '1' : '0')).join('');
  return Board.deserialize({ ...save, placed: true, status: 'ready', mine })!;
}

describe('mine placement', () => {
  it('places exactly the requested number of mines', () => {
    const b = new Board(16, 16, 40, seeded(1));
    b.reveal(0);
    expect(b.mine.reduce((a, m) => a + m, 0)).toBe(40);
  });

  it('never puts a mine on or around the first tap', () => {
    for (let seed = 0; seed < 200; seed++) {
      const b = new Board(9, 9, 10, seeded(seed));
      const tap = seed % 81;
      b.reveal(tap);
      expect(b.mine[tap]).toBe(0);
      for (const n of b.neighbors(tap)) expect(b.mine[n]).toBe(0);
      expect(b.adj[tap]).toBe(0);
      expect(b.status).not.toBe('lost');
    }
  });

  it('keeps only the tapped cell safe when the board is too dense', () => {
    const b = new Board(5, 5, 24, seeded(3));
    b.reveal(12);
    expect(b.mine[12]).toBe(0);
    expect(b.status).toBe('won');
  });

  it('clamps mines to size - 1', () => {
    expect(new Board(3, 3, 50).mines).toBe(8);
  });
});

describe('reveal', () => {
  it('flood-fills zeros and stops at numbers, reporting BFS depth', () => {
    // 3x5, one mine in the top-right corner.
    const b = fixed(3, 5, [4]);
    const { opened, exploded } = b.reveal(10, 0);
    expect(exploded).toBe(-1);
    expect(opened.length).toBe(14);
    expect(opened[0]).toEqual({ i: 10, depth: 0 });
    const depths = new Map(opened.map((o) => [o.i, o.depth]));
    expect(depths.get(11)).toBe(1);
    expect(depths.get(3)).toBeGreaterThan(depths.get(11)!);
    expect(b.status).toBe('won');
  });

  it('does not reveal flagged cells during a flood', () => {
    const b = fixed(3, 5, [4]);
    b.toggleFlag(0);
    b.reveal(10, 0);
    expect(b.state[0]).toBe(FLAGGED);
    expect(b.status).toBe('playing');
  });

  it('loses when a mine is revealed', () => {
    const b = fixed(3, 3, [4]);
    b.reveal(0, 0);
    const r = b.reveal(4, 10);
    expect(r.exploded).toBe(4);
    expect(b.status).toBe('lost');
    expect(b.reveal(1).opened).toEqual([]);
  });

  it('auto-flags remaining mines on a win', () => {
    const b = fixed(1, 3, [2]);
    b.reveal(0, 0);
    b.reveal(1, 0);
    expect(b.status).toBe('won');
    expect(b.state[2]).toBe(FLAGGED);
    expect(b.minesLeft).toBe(0);
  });
});

describe('chord', () => {
  it('reveals unflagged neighbours when flags match', () => {
    const b = fixed(3, 3, [0]);
    b.reveal(4, 0);
    b.toggleFlag(0);
    expect(b.canChord(4)).toBe(true);
    const r = b.chord(4, 0);
    expect(r.opened.length).toBe(7);
    expect(b.status).toBe('won');
  });

  it('does nothing when flags do not match', () => {
    const b = fixed(3, 3, [0]);
    b.reveal(4, 0);
    expect(b.canChord(4)).toBe(false);
    expect(b.chord(4).opened).toEqual([]);
  });

  it('loses when a wrong flag makes the chord hit a mine', () => {
    const b = fixed(3, 3, [0]);
    b.reveal(4, 0);
    b.toggleFlag(8);
    const r = b.chord(4, 0);
    expect(r.exploded).toBe(0);
    expect(b.status).toBe('lost');
  });
});

describe('flags', () => {
  it('cycles with and without question marks', () => {
    const b = new Board(3, 3, 1);
    expect(b.toggleFlag(0)).toBe(FLAGGED);
    expect(b.minesLeft).toBe(0);
    expect(b.toggleFlag(0)).toBe(HIDDEN);
    b.toggleFlag(0);
    expect(b.toggleFlag(0, true)).toBe(QUESTION);
    expect(b.toggleFlag(0, true)).toBe(HIDDEN);
    expect(b.flagCount).toBe(0);
  });

  it('cannot flag revealed cells', () => {
    const b = fixed(3, 3, [8]);
    b.reveal(0, 0);
    expect(b.state[0]).toBe(REVEALED);
    expect(b.toggleFlag(0)).toBe(-1);
  });
});

describe('timer', () => {
  it('starts on first reveal and pauses/resumes', () => {
    const b = fixed(3, 3, [2, 8]);
    expect(b.elapsed(100)).toBe(0);
    b.reveal(0, 1000);
    expect(b.elapsed(1500)).toBe(500);
    b.pause(2000);
    expect(b.elapsed(9000)).toBe(1000);
    b.resume(9000);
    expect(b.elapsed(9250)).toBe(1250);
  });

  it('stops when the game ends', () => {
    const b = fixed(3, 3, [2, 8]);
    b.reveal(0, 0);
    b.reveal(8, 300);
    expect(b.elapsed(10_000)).toBe(300);
  });
});

describe('serialize', () => {
  it('round-trips a game in progress', () => {
    const b = new Board(10, 12, 20, seeded(7));
    b.reveal(30, 0);
    const hidden = Array.from(b.state).findIndex((s) => s === HIDDEN);
    b.toggleFlag(hidden);
    const copy = Board.deserialize(JSON.parse(JSON.stringify(b.serialize(5000))))!;
    expect(Array.from(copy.mine)).toEqual(Array.from(b.mine));
    expect(Array.from(copy.state)).toEqual(Array.from(b.state));
    expect(Array.from(copy.adj)).toEqual(Array.from(b.adj));
    expect(copy.revealedCount).toBe(b.revealedCount);
    expect(copy.flagCount).toBe(1);
    expect(copy.status).toBe('playing');
    expect(copy.running).toBe(false);
    expect(copy.elapsed(99_999)).toBe(5000);
  });

  it('rejects malformed saves', () => {
    const s = new Board(3, 3, 1).serialize();
    expect(Board.deserialize({ ...s, mine: '01' })).toBeNull();
  });
});

describe('edge sizes', () => {
  it('handles a 1xN strip', () => {
    const b = new Board(1, 20, 5, seeded(2));
    b.reveal(0, 0);
    expect(b.mine[0] + b.mine[1]).toBe(0);
    // guess-free on a strip means the mines sit together at the far end, so the first tap clears it
    expect(b.status).toBe('won');
  });

  it('handles 100x100 with the max mine count', () => {
    const b = new Board(100, 100, 100 * 100 - 9, seeded(4));
    b.reveal(5050, 0);
    expect(b.status).toBe('won');
  });
});

describe('guess-free boards', () => {
  const sizes: [number, number, number][] = [
    [9, 9, 10],
    [16, 16, 40],
    [30, 16, 99],
    [30, 24, 150],
    [50, 30, 300],
  ];
  for (const [rows, cols, mines] of sizes) {
    it(`${cols}x${rows}/${mines} can be solved by logic from the first tap`, () => {
      let slowest = 0;
      for (let seed = 1; seed <= 12; seed++) {
        const b = new Board(rows, cols, mines, seeded(seed));
        const tap = Math.floor(b.size / 2);
        const t0 = performance.now();
        b.reveal(tap);
        slowest = Math.max(slowest, performance.now() - t0);
        expect(b.mine.reduce((a, m) => a + m, 0)).toBe(mines);
        expect(solve(b, tap).solved).toBe(true);
      }
      console.log(`${cols}x${rows}/${mines}: slowest first tap ${slowest.toFixed(0)}ms`);
    });
  }

  it('a 50/50 is detected as stuck', () => {
    // Two cells in a corner with one mine between them and nothing else to tell them apart.
    const b = fixed(2, 3, [2]);
    b.mine.fill(0);
    b.mine[2] = 1;
    const r = solve({ rows: 2, cols: 3, mines: 1, mine: b.mine, adj: b.adj }, 0);
    // corner (0) opens a 1; cells 2 and 5 can't be told apart
    expect(r.solved).toBe(false);
    expect(r.stuckMines).toContain(2);
  });
});
