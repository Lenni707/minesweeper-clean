// Icons; stroke icons inherit currentColor.

const wrap = (body: string, extra = '') =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${body}</svg>`;

/** The mine: a disc with eight studs and a diamond cut-out. Filled, so it takes `color`. */
export const mineLogo = `<svg viewBox="0 0 100 100" aria-hidden="true"><path fill="currentColor" d="${minePath()}"/></svg>`;

function minePath(): string {
  // Eight studs around a disc, as rectangles rotated about the centre.
  // Disc and studs wind clockwise; the hole winds the other way, so nonzero fill punches it out.
  let d = 'M50 14a36 36 0 1 1 -0.001 0z';
  for (let k = 0; k < 8; k++) {
    const a = (k * Math.PI) / 4;
    const pts = [
      [-9.5, -45],
      [9.5, -45],
      [9.5, -30],
      [-9.5, -30],
    ].map(([x, y]) => [50 + x * Math.cos(a) - y * Math.sin(a), 50 + x * Math.sin(a) + y * Math.cos(a)]);
    d += `M${pts.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join('L')}z`;
  }
  d += 'M50 39L39 50L50 61L61 50z';
  return d;
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
  fit: wrap('<path d="M4 9V5a1 1 0 0 1 1-1h4M15 4h4a1 1 0 0 1 1 1v4M20 15v4a1 1 0 0 1-1 1h-4M9 20H5a1 1 0 0 1-1-1v-4"/>'),
};

/** The mine as a CSS mask URL (cells use it on a loss). */
export const mineMask = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><path d='${minePath()}'/></svg>`,
)}")`;
