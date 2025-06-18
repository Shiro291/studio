
export type TileType = 'empty' | 'start' | 'finish' | 'quiz' | 'info' | 'reward';

export interface QuizOption {
  id: string;
  text: string;
  isCorrect: boolean;
  image?: string;
}

export interface TileConfigQuiz {
  question: string;
  questionImage?: string;
  options: QuizOption[];
  difficulty: 1 | 2 | 3;
  points: number;
}

export interface TileConfigInfo {
  message: string;
  image?: string;
}

export interface TileConfigReward {
  message: string;
  points?: number;
}

export interface Tile {
  id:string;
  type: TileType;
  position: number;
  config?: TileConfigQuiz | TileConfigInfo | TileConfigReward;
  ui: {
    color?: string;
    icon?: string;
  };
}

export type WinningCondition = 'firstToFinish' | 'highestScore' | 'combinedOrderScore';
export type PunishmentType = 'none' | 'revertMove' | 'moveBackFixed' | 'moveBackLevelBased';

export interface BoardSettings {
  name: string;
  description?: string;
  numberOfTiles: number;
  punishmentType: PunishmentType;
  punishmentValue: number;
  randomizeTiles: boolean;
  diceSides: number;
  numberOfPlayers: number;
  winningCondition: WinningCondition;
  boardBackgroundImage?: string;
}

export interface BoardConfig {
  id: string;
  settings: BoardSettings;
  tiles: Tile[];
}

export interface Player {
  id: string;
  name: string;
  color: string;
  position: number;
  score: number;
  currentStreak: number;
  hasFinished: boolean;
  finishOrder: number | null;
}

export type GameStatus = 'setup' | 'playing' | 'interaction_pending' | 'finished';

export interface LogEntry {
  id: string;
  messageKey: string;
  messageParams?: Record<string, string | number | undefined>;
  timestamp: number;
  type: 'roll' | 'move' | 'quiz_correct' | 'quiz_incorrect' | 'punishment' | 'reward' | 'info' | 'game_event' | 'winner' | 'streak';
}

export interface GameState {
  boardConfig: BoardConfig | null;
  players: Player[];
  currentPlayerIndex: number;
  diceRoll: number | null;
  gameStatus: GameStatus;
  isLoading: boolean;
  error: string | null;
  activeTileForInteraction: Tile | null;
  winner: Player | null;
  logs: LogEntry[];
  playersFinishedCount: number;
}

export const DEFAULT_BOARD_SETTINGS: BoardSettings = {
  name: 'My Awesome Board Game',
  numberOfTiles: 20,
  punishmentType: 'none',
  punishmentValue: 1,
  randomizeTiles: false,
  diceSides: 6,
  numberOfPlayers: 2,
  winningCondition: 'firstToFinish',
  boardBackgroundImage: undefined,
};

export interface PersistedPlayState {
  players: Player[];
  currentPlayerIndex: number;
  diceRoll: number | null;
  gameStatus: GameStatus;
  activeTileForInteraction: Tile | null;
  winner: Player | null;
  logs: LogEntry[];
  playersFinishedCount: number;
}

