export interface Preset {
  id: string;
  name: string;
  /** Portrait orientation; landscape screens swap rows and cols. */
  cols: number;
  rows: number;
  mines: number;
}

export const PRESETS: Preset[] = [
  { id: 'beginner', name: 'Easy', cols: 9, rows: 9, mines: 10 },
  { id: 'intermediate', name: 'Medium', cols: 16, rows: 16, mines: 40 },
  { id: 'expert', name: 'Hard', cols: 16, rows: 30, mines: 99 },
  { id: 'master', name: 'Expert', cols: 24, rows: 30, mines: 150 },
  { id: 'insane', name: 'Insane', cols: 30, rows: 50, mines: 300 },
];

export const CUSTOM_LIMITS = { min: 5, max: 100 };

export function maxMines(cols: number, rows: number): number {
  return Math.max(1, cols * rows - 9);
}

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
