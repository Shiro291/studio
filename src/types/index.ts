
export type TileType = 'empty' | 'start' | 'finish' | 'quiz' | 'info' | 'reward';

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
  image?: string; // Data URI for the option image
}

export interface TileConfigQuiz {
  question: string;
  questionImage?: string; // Data URI for the question image
  options: QuizOption[];
  difficulty: 1 | 2 | 3; // Level 1, 2, 3
  points: number; // 5, 10, 15
}

export interface TileConfigInfo {
  message: string;
  image?: string; // Data URI for the info image
}

export interface TileConfigReward {
  message: string;
  points?: number;
}

export interface Tile {
  id:string;
  type: TileType;
  position: number; // 0-indexed
  config?: TileConfigQuiz | TileConfigInfo | TileConfigReward; // Specific config based on type
  ui: {
    color?: string; // Hex color
    icon?: string; // Icon name (e.g., from lucide-react or emoji)
  };
}

export type WinningCondition = 'firstToFinish' | 'highestScore';

export interface BoardSettings {
  name: string;
  description?: string;
  numberOfTiles: number; // Max 100
  punishmentMode: boolean; // Pawn doesn't move on wrong answer
  randomizeTiles: boolean; // On load or new game, tile types/content could be randomized
  diceSides: number; // 1-12
  numberOfPlayers: number; // 1-10
  winningCondition: WinningCondition;
  boardBackgroundImage?: string; // Data URI for the board background
}

export interface BoardConfig {
  id: string; // Unique ID for the board, could be generated
  settings: BoardSettings;
  tiles: Tile[];
}

export interface Player {
  id: string;
  name: string;
  color: string; // Player pawn color
  position: number; // Tile index
  score: number;
}

export interface GameState {
  boardConfig: BoardConfig | null;
  players: Player[];
  currentPlayerIndex: number;
  diceRoll: number | null; // Stores the value of the last dice roll
  gameStatus: 'setup' | 'playing' | 'interaction_pending' | 'finished';
  isLoading: boolean;
  error: string | null;
  activeTileForInteraction: Tile | null; // Tile current player landed on and needs to interact with
  winner: Player | null; // Stores the winner when game is finished
}

// Default values for a new board
export const DEFAULT_BOARD_SETTINGS: BoardSettings = {
  name: 'My Awesome Board Game',
  numberOfTiles: 20,
  punishmentMode: false,
  randomizeTiles: false,
  diceSides: 6,
  numberOfPlayers: 2,
  winningCondition: 'firstToFinish',
  boardBackgroundImage: undefined,
};
