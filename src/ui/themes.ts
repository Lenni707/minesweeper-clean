import type { ThemeId } from '../state/storage';

/** Each theme is a background and one accent, as in the original. */
export const THEMES: { id: ThemeId; bg: string; accent: string; dark: boolean }[] = [
  { id: 'sand', bg: '#f8f7f8', accent: '#beb08a', dark: false },
  { id: 'olive', bg: '#1f1e1b', accent: '#b0a46f', dark: true },
  { id: 'ember', bg: '#353433', accent: '#f18027', dark: true },
  { id: 'steel', bg: '#f4f6f7', accent: '#6a9fc0', dark: false },
  { id: 'rose', bg: '#ffffff', accent: '#be636a', dark: false },
  { id: 'ocean', bg: '#0e1922', accent: '#2dbdf8', dark: true },
  { id: 'forest', bg: '#151815', accent: '#2f9a2e', dark: true },
  { id: 'berry', bg: '#1a1317', accent: '#b63565', dark: true },
  { id: 'neon', bg: '#000000', accent: '#d34cb4', dark: true },
];

export function themeById(id: ThemeId | null | undefined, systemDark: boolean) {
  return THEMES.find((t) => t.id === id) ?? THEMES.find((t) => t.id === (systemDark ? 'ocean' : 'steel'))!;
}
