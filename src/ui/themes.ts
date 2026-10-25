import type { ThemeId } from '../state/storage';

/** Each theme is a background and one accent, as in the original. Ordered for the 5-wide palette grid. */
export const THEMES: { id: ThemeId; bg: string; accent: string; dark: boolean }[] = [
  // light
  { id: 'sand', bg: '#f8f7f5', accent: '#beb08a', dark: false },
  { id: 'steel', bg: '#f4f6f8', accent: '#6a9fc0', dark: false },
  { id: 'rose', bg: '#fffafa', accent: '#c96a74', dark: false },
  { id: 'lilac', bg: '#f8f6fc', accent: '#9479e0', dark: false },
  { id: 'coral', bg: '#fff9f6', accent: '#f07c5e', dark: false },
  // dark
  { id: 'olive', bg: '#1f1e1b', accent: '#b0a46f', dark: true },
  { id: 'ember', bg: '#2e2c2b', accent: '#f18027', dark: true },
  { id: 'ocean', bg: '#0e1922', accent: '#2dbdf8', dark: true },
  { id: 'forest', bg: '#121814', accent: '#3fb456', dark: true },
  { id: 'mint', bg: '#0f1918', accent: '#4fd6b0', dark: true },
  // deep
  { id: 'violet', bg: '#15121f', accent: '#9d7bff', dark: true },
  { id: 'plum', bg: '#1b1220', accent: '#c56bf0', dark: true },
  { id: 'berry', bg: '#1a1317', accent: '#d2457a', dark: true },
  { id: 'neon', bg: '#000000', accent: '#e04fc2', dark: true },
  { id: 'midnight', bg: '#0b0f1e', accent: '#6f8cff', dark: true },
];

export function themeById(id: ThemeId | null | undefined, systemDark: boolean) {
  return THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === (systemDark ? 'violet' : 'lilac'))!;
}
