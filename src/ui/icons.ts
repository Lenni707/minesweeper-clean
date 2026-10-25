// Icons; stroke icons inherit currentColor.

const wrap = (body: string, extra = '') =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${body}</svg>`;

/** The mine: a disc with eight studs and a diamond cut-out. Filled, so it takes `color`. */
export const mineLogo = `<svg viewBox="0 0 100 100" aria-hidden="true"><path fill="currentColor" d="${minePath()}"/></svg>`;

function minePath(): string {
  // As in the original's icon: a disc with four broad studs on the axes, four narrower ones on the
  // diagonals (all slightly rounded) and a square hole in the middle.
  // Disc and studs wind clockwise; the hole winds the other way, so nonzero fill punches it out.
  let d = 'M50 15a35 35 0 1 1 -0.001 0z';
  for (let k = 0; k < 8; k++) d += k % 2 ? stud(k * 45, 5.8, 41.5) : stud(k * 45, 8.8, 45);
  const h = 8.8;
  const q = 1.6;
  d +=
    `M${50 - h + q} ${50 - h}A${q} ${q} 0 0 0 ${50 - h} ${50 - h + q}L${50 - h} ${50 + h - q}` +
    `A${q} ${q} 0 0 0 ${50 - h + q} ${50 + h}L${50 + h - q} ${50 + h}A${q} ${q} 0 0 0 ${50 + h} ${50 + h - q}` +
    `L${50 + h} ${50 - h + q}A${q} ${q} 0 0 0 ${50 + h - q} ${50 - h}z`;
  return d;
}

/** A stud of half-width `w` reaching out to radius `reach`, rotated `deg` clockwise from the top. */
function stud(deg: number, w: number, reach: number): string {
  const a = (deg * Math.PI) / 180;
  const q = 1.8;
  const at = (x: number, y: number) => {
    const px = 50 + x * Math.cos(a) - y * Math.sin(a);
    const py = 50 + x * Math.sin(a) + y * Math.cos(a);
    return `${px.toFixed(2)} ${py.toFixed(2)}`;
  };
  const arc = (x: number, y: number) => `A${q} ${q} 0 0 1 ${at(x, y)}`;
  const top = -reach;
  const inner = -28;
  return `M${at(-w + q, top)}L${at(w - q, top)}${arc(w, top + q)}L${at(w, inner)}L${at(-w, inner)}L${at(-w, top + q)}${arc(-w + q, top)}z`;
}

export const icons = {
  flag: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="M5 2.5a1.5 1.5 0 0 1 1.5 1.5v.5h11.2a1 1 0 0 1 .86 1.5L16.4 9.5l2.16 3.5a1 1 0 0 1-.86 1.5H6.5V20a1.5 1.5 0 0 1-3 0V4A1.5 1.5 0 0 1 5 2.5z"/></svg>`,
  mine: `<svg viewBox="0 0 100 100" width="24" height="24" aria-hidden="true"><path fill="currentColor" d="${minePath()}"/></svg>`,
  back: wrap('<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>'),
  left: wrap('<path d="M15 5l-7 7 7 7"/>'),
  right: wrap('<path d="M9 5l7 7-7 7"/>'),
  palette: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M12 2.5c5.5 0 9.5 3.7 9.5 8.3 0 3-2.4 5.2-5.3 5.2h-1.6c-.9 0-1.4.6-1.4 1.3 0 .4.2.7.4 1 .3.4.5.8.5 1.3 0 1.1-.9 1.9-2.1 1.9C6.8 21.5 2.5 17.2 2.5 12S6.8 2.5 12 2.5zM7 12.6a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zm3-4a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zm5 0a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2zm3 4a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2z"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M10.3 2h3.4l.5 2.6 1.6.9 2.5-.9 1.7 2.9-2 1.8v1.4l2 1.8-1.7 2.9-2.5-.9-1.6.9-.5 2.6h-3.4l-.5-2.6-1.6-.9-2.5.9-1.7-2.9 2-1.8V9.3l-2-1.8 1.7-2.9 2.5.9 1.6-.9zM12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4z" transform="translate(0 1)"/></svg>`,
  list: wrap('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r=".6" fill="currentColor"/><circle cx="4.5" cy="12" r=".6" fill="currentColor"/><circle cx="4.5" cy="18" r=".6" fill="currentColor"/>'),
  info: `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" d="M12 2.5a9.5 9.5 0 1 1 0 19 9.5 9.5 0 0 1 0-19zM11 10.5v7h2v-7zm1-4.2a1.3 1.3 0 1 0 0 2.6 1.3 1.3 0 0 0 0-2.6z"/></svg>`,
};

/** The mine as a CSS mask URL (cells use it on a loss). */
export const mineMask = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='${minePath()}'/></svg>`,
)}")`;
