export const MAX_TILES = 100;
export const MIN_TILES = 10;
export const DEFAULT_TILE_COLOR = '#FFFFFF'; // White
export const START_TILE_COLOR = '#4CAF50'; // Green
export const FINISH_TILE_COLOR = '#F44336'; // Red
export const QUIZ_TILE_COLOR = '#2196F3'; // Blue
export const INFO_TILE_COLOR = '#FFC107'; // Amber
export const REWARD_TILE_COLOR = '#9C27B0'; // Purple

export const TILE_TYPE_EMOJIS: Record<string, string> = {
  empty: '⬜',
  start: '🏁',
  finish: '🏆',
  quiz: '❓',
  info: 'ℹ️',
  reward: '⭐',
};

export const DIFFICULTY_POINTS: Record<number, number> = {
  1: 5,
  2: 10,
  3: 15,
};
