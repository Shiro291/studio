
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { BoardConfig, GameState, Player, Tile, TileConfigQuiz, TileConfigReward, QuizOption, GameStatus, PersistedPlayState, PunishmentType, LogEntry, BoardSettings } from '@/types';
import { DEFAULT_BOARD_SETTINGS } from '@/types';
import { DEFAULT_TILE_COLOR, FINISH_TILE_COLOR, MAX_PLAYERS, MAX_TILES, MIN_PLAYERS, MIN_TILES, PLAYER_COLORS, RANDOM_COLORS, RANDOM_EMOJIS, START_TILE_COLOR, TILE_TYPE_EMOJIS, DIFFICULTY_POINTS } from '@/lib/constants';
import { nanoid } from 'nanoid';
import { playSound } from '@/lib/sound-service';
import { shuffleArray } from '@/lib/utils';

type GameAction =
  | { type: 'SET_BOARD_CONFIG'; payload: { boardConfig: BoardConfig; persistedPlayState?: PersistedPlayState | null } }
  | { type: 'UPDATE_BOARD_SETTINGS'; payload: Partial<BoardConfig['settings']> }
  | { type: 'UPDATE_TILES'; payload: Tile[] }
  | { type: 'SET_PLAYERS'; payload: Player[] }
  | { type: 'START_LOADING' }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'PLAYER_ROLLED_DICE'; payload: { diceValue: number } }
  | { type: 'ANSWER_QUIZ'; payload: { selectedOptionId: string } }
  | { type: 'ACKNOWLEDGE_INTERACTION' }
  | { type: 'PROCEED_TO_NEXT_TURN' }
  | { type: 'RESET_GAME_FOR_PLAY' };


const initialState: GameState = {
  boardConfig: null,
  players: [],
  currentPlayerIndex: 0,
  diceRoll: null,
  gameStatus: 'setup',
  isLoading: true,
  error: null,
  activeTileForInteraction: null,
  winner: null,
  logs: [],
  playersFinishedCount: 0,
};

const GameContext = createContext<{
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  initializeNewBoard: () => void;
  loadBoardFromBase64: (base64Data: string) => void;
  loadBoardFromJson: (jsonString: string) => boolean;
  randomizeTileVisuals: () => void;
}>({
  state: initialState,
  dispatch: () => null,
  initializeNewBoard: () => {},
  loadBoardFromBase64: () => {},
  loadBoardFromJson: () => false,
  randomizeTileVisuals: () => {},
});

function generatePlayers(numberOfPlayers: number): Player[] {
  const numPlayers = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, numberOfPlayers));
  return Array.from({ length: numPlayers }, (_, i) => ({
    id: nanoid(),
    name: `Player ${i + 1}`,
    color: PLAYER_COLORS[i % PLAYER_COLORS.length],
    position: 0,
    score: 0,
    currentStreak: 0,
    hasFinished: false,
    finishOrder: null,
  }));
}

function applyBoardRandomizationSettings(boardConfig: BoardConfig): BoardConfig {
  let newTiles = [...boardConfig.tiles];

  if (boardConfig.settings.randomizeTiles) {
    newTiles = newTiles.map(tile => {
      if (tile.type === 'start' || tile.type === 'finish') return tile;
      const randomColor = RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];
      const randomEmoji = tile.type === 'empty' ? TILE_TYPE_EMOJIS.empty : RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)];
      return { ...tile, ui: { ...tile.ui, color: randomColor, icon: randomEmoji } };
    });

    newTiles = newTiles.map(tile => {
      if (tile.type === 'quiz' && tile.config) {
        const quizConfig = tile.config as TileConfigQuiz;
        if (quizConfig.options && quizConfig.options.length > 0) {
          const shuffledOptions = shuffleArray([...quizConfig.options]);
          return {
            ...tile,
            config: {
              ...quizConfig,
              options: shuffledOptions,
            },
          };
        }
      }
      return tile;
    });
  }
  return { ...boardConfig, tiles: newTiles };
}

function addLogEntry(currentLogs: LogEntry[], messageKey: string, type: LogEntry['type'], messageParams?: Record<string, string | number | undefined>): LogEntry[] {
  const newLog: LogEntry = {
    id: nanoid(),
    messageKey,
    messageParams,
    timestamp: Date.now(),
    type,
  };
  return [newLog, ...currentLogs].slice(0, 50); // Keep last 50 logs
}

function getPunishmentLogDetails(
  punishmentType: PunishmentType,
  punishmentValue: number,
  quizDifficulty: 1 | 2 | 3,
  diceRoll: number | null
): { key: string; params?: Record<string, string | number | undefined> } | null {
  switch (punishmentType) {
    case 'revertMove':
      return { key: 'log.punishmentDetails.revertMove', params: { dice: diceRoll || 0 } };
    case 'moveBackFixed':
      return { key: 'log.punishmentDetails.moveBackFixed', params: { count: punishmentValue } };
    case 'moveBackLevelBased':
      let moveBackAmount = 0;
      if (quizDifficulty === 1) moveBackAmount = 1;
      else if (quizDifficulty === 2) moveBackAmount = 2;
      else if (quizDifficulty === 3) moveBackAmount = 3;
      return { key: 'log.punishmentDetails.moveBackLevelBased', params: { count: moveBackAmount, level: quizDifficulty } };
    case 'none':
    default:
      return null;
  }
}


function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_BOARD_CONFIG': {
      const { boardConfig: rawBoardConfig, persistedPlayState } = action.payload;

      let processedBoardConfig = applyBoardRandomizationSettings(rawBoardConfig);

      if (persistedPlayState && !processedBoardConfig.settings.randomizeTiles && persistedPlayState.activeTileForInteraction?.type === 'quiz') {
          const activeQuizTileId = persistedPlayState.activeTileForInteraction.id;
          const tileToRestoreIndex = processedBoardConfig.tiles.findIndex(t => t.id === activeQuizTileId);
          if (tileToRestoreIndex !== -1 && processedBoardConfig.tiles[tileToRestoreIndex].type === 'quiz' && processedBoardConfig.tiles[tileToRestoreIndex].config) {
              const originalQuizOptions = (persistedPlayState.activeTileForInteraction.config as TileConfigQuiz).options;
              (processedBoardConfig.tiles[tileToRestoreIndex].config as TileConfigQuiz).options = originalQuizOptions;
          }
      }

      let players = generatePlayers(processedBoardConfig.settings.numberOfPlayers);
      let currentPlayerIndex = 0;
      let gameStatus: GameStatus = persistedPlayState?.gameStatus ?? 'playing';
      let activeTileForInteraction: Tile | null = persistedPlayState?.activeTileForInteraction ?? null;
      let winner: Player | null = persistedPlayState?.winner ?? null;
      let diceRoll: number | null = persistedPlayState?.diceRoll ?? null;
      let logs: LogEntry[] = persistedPlayState?.logs ?? [];
      let playersFinishedCount = persistedPlayState?.playersFinishedCount ?? 0;


      if (persistedPlayState?.players) {
        if (persistedPlayState.players.length === processedBoardConfig.settings.numberOfPlayers) {
          players = persistedPlayState.players;
        } else {
          console.warn("Persisted player count mismatch with board settings. Regenerating players.");
          logs = addLogEntry(logs, 'log.event.playerMismatch', 'game_event');
        }
        currentPlayerIndex = persistedPlayState.currentPlayerIndex ?? 0;
      }
      
      if (logs.length === 0 && !persistedPlayState) { 
        logs = addLogEntry(logs, 'log.event.gameStarted', 'game_event', { name: processedBoardConfig.settings.name });
      }


      if (gameStatus === 'finished' && !winner && persistedPlayState?.winner) {
          winner = persistedPlayState.winner;
      }

      return {
        ...initialState,
        boardConfig: processedBoardConfig,
        players,
        currentPlayerIndex,
        gameStatus,
        activeTileForInteraction,
        winner,
        diceRoll,
        logs,
        playersFinishedCount,
        isLoading: false,
        error: null
      };
    }
    case 'UPDATE_BOARD_SETTINGS': {
      if (!state.boardConfig) return state;
      const updatedSettings = { ...state.boardConfig.settings, ...action.payload };
      let updatedPlayers = state.players;
      if (action.payload.numberOfPlayers !== undefined && action.payload.numberOfPlayers !== state.boardConfig.settings.numberOfPlayers) {
        updatedPlayers = generatePlayers(action.payload.numberOfPlayers);
      }
      return {
        ...state,
        boardConfig: {
          ...state.boardConfig,
          settings: updatedSettings,
        },
        players: updatedPlayers,
      };
    }
    case 'UPDATE_TILES': {
      if (!state.boardConfig) return state;
      return {
        ...state,
        boardConfig: { ...state.boardConfig, tiles: action.payload },
      };
    }
    case 'SET_PLAYERS':
      return { ...state, players: action.payload };
    case 'START_LOADING':
      return { ...state, isLoading: true, error: null, logs: state.logs }; 
    case 'SET_ERROR':
      return { ...state, isLoading: false, error: action.payload, logs: addLogEntry(state.logs, 'log.event.errorOccurred', 'game_event', { error: action.payload }) };
     case 'PLAYER_ROLLED_DICE': {
      if (!state.boardConfig || state.gameStatus !== 'playing' || state.winner || state.players[state.currentPlayerIndex].hasFinished) return state;

      const { diceValue } = action.payload;
      const currentPlayer = state.players[state.currentPlayerIndex];
      const newPlayers = [...state.players];
      const maxPosition = state.boardConfig.tiles.length - 1;
      let newPlayersFinishedCount = state.playersFinishedCount;

      let newPosition = currentPlayer.position + diceValue;
      if (newPosition > maxPosition) newPosition = maxPosition;

      newPlayers[state.currentPlayerIndex] = { ...currentPlayer, position: newPosition };

      const landedTile = state.boardConfig.tiles[newPosition];
      let currentLogs = state.logs;
      currentLogs = addLogEntry(currentLogs, 'log.playerRolled', 'roll', { name: currentPlayer.name, value: diceValue });
      currentLogs = addLogEntry(currentLogs, 'log.playerMovedTo', 'move', { name: currentPlayer.name, position: newPosition + 1, tileType: landedTile.type });


      if (landedTile.type === 'finish' && state.gameStatus !== 'finished' && !currentPlayer.hasFinished) {
        playSound('finishSound');
        newPlayersFinishedCount++;
        const finishedPlayerIndex = state.currentPlayerIndex;
        newPlayers[finishedPlayerIndex] = { 
            ...newPlayers[finishedPlayerIndex], 
            hasFinished: true, 
            finishOrder: newPlayersFinishedCount 
        };
        
        currentLogs = addLogEntry(currentLogs, 'log.playerFinished', 'game_event', { name: newPlayers[finishedPlayerIndex].name, finishOrder: newPlayers[finishedPlayerIndex].finishOrder || undefined });
        
        let gameWinner: Player | null = null;
        let newGameStatus: GameStatus = 'interaction_pending';

        if (state.boardConfig.settings.winningCondition === 'firstToFinish') {
            gameWinner = newPlayers[finishedPlayerIndex]; 
            newGameStatus = 'finished';
        } else if (newPlayersFinishedCount === newPlayers.length) { 
            newGameStatus = 'interaction_pending'; 
        }
        
        return {
            ...state,
            players: newPlayers,
            diceRoll: diceValue,
            activeTileForInteraction: landedTile, 
            gameStatus: newGameStatus,
            winner: gameWinner,
            logs: currentLogs,
            playersFinishedCount: newPlayersFinishedCount,
         };
      }
      
      return { ...state, players: newPlayers, diceRoll: diceValue, activeTileForInteraction: landedTile, gameStatus: 'interaction_pending', logs: currentLogs };
    }
    case 'ANSWER_QUIZ': {
        if (!state.boardConfig || !state.activeTileForInteraction || state.activeTileForInteraction.type !== 'quiz' || state.gameStatus !== 'interaction_pending' || state.diceRoll === null) return state;

        const { selectedOptionId } = action.payload;
        const quizConfig = state.activeTileForInteraction.config as TileConfigQuiz;
        const selectedOption = quizConfig.options.find(opt => opt.id === selectedOptionId);
        const currentPlayer = state.players[state.currentPlayerIndex];
        const newPlayers = [...state.players];
        const boardSettings = state.boardConfig.settings;
        let currentLogs = state.logs;

        let newScore = currentPlayer.score;
        let newPosition = currentPlayer.position;
        let newStreak = currentPlayer.currentStreak;
        let soundToPlay = 'wrongAnswer';

        if (selectedOption?.isCorrect) {
            newScore += quizConfig.points;
            newStreak++;
            soundToPlay = 'correctAnswer';
            currentLogs = addLogEntry(currentLogs, 'log.quizCorrect', 'quiz_correct', { name: currentPlayer.name, points: quizConfig.points });
            if (newStreak > 1) {
               currentLogs = addLogEntry(currentLogs, 'log.streakIncreased', 'streak', { name: currentPlayer.name, streak: newStreak });
            }
        } else {
            if (newStreak > 0) {
                currentLogs = addLogEntry(currentLogs, 'log.streakBroken', 'streak', { name: currentPlayer.name });
            }
            newStreak = 0;
            currentLogs = addLogEntry(currentLogs, 'log.quizIncorrect', 'quiz_incorrect', { name: currentPlayer.name });
            const punishmentDetails = getPunishmentLogDetails(boardSettings.punishmentType, boardSettings.punishmentValue, quizConfig.difficulty, state.diceRoll);

            if (punishmentDetails) {
                currentLogs = addLogEntry(currentLogs, 'log.punishmentApplied', 'punishment', { name: currentPlayer.name, detailsKey: punishmentDetails.key, ...punishmentDetails.params });
            }

            switch (boardSettings.punishmentType) {
                case 'revertMove':
                    newPosition = Math.max(0, newPosition - state.diceRoll);
                    break;
                case 'moveBackFixed':
                    newPosition = Math.max(0, newPosition - boardSettings.punishmentValue);
                    break;
                case 'moveBackLevelBased':
                    let moveBackAmount = 0;
                    if (quizConfig.difficulty === 1) moveBackAmount = 1;
                    else if (quizConfig.difficulty === 2) moveBackAmount = 2;
                    else if (quizConfig.difficulty === 3) moveBackAmount = 3;
                    newPosition = Math.max(0, newPosition - moveBackAmount);
                    break;
                case 'none':
                default:
                    break;
            }
        }
        playSound(soundToPlay);
        newPlayers[state.currentPlayerIndex] = { ...currentPlayer, score: newScore, position: newPosition, currentStreak: newStreak };

        return { ...state, players: newPlayers, logs: currentLogs };
    }
    case 'ACKNOWLEDGE_INTERACTION': {
        if (!state.boardConfig || !state.activeTileForInteraction || state.gameStatus !== 'interaction_pending') return state;

        const currentPlayer = state.players[state.currentPlayerIndex];
        const newPlayers = [...state.players];
        let currentLogs = state.logs;
        let newScore = currentPlayer.score;

        if (state.activeTileForInteraction.type === 'reward') {
            const rewardConfig = state.activeTileForInteraction.config as TileConfigReward;
            newScore += rewardConfig.points || 0;
            newPlayers[state.currentPlayerIndex] = { ...currentPlayer, score: newScore };
            playSound('correctAnswer'); // Assuming reward gives a positive sound
            currentLogs = addLogEntry(currentLogs, 'log.rewardCollected', 'reward', { name: currentPlayer.name, points: rewardConfig.points || 0 });
        } else if (state.activeTileForInteraction.type === 'info') {
             currentLogs = addLogEntry(currentLogs, 'log.infoAcknowledged', 'info', { name: currentPlayer.name });
        } else if (['empty', 'start', 'finish'].includes(state.activeTileForInteraction.type)) {
             currentLogs = addLogEntry(currentLogs, 'log.landedOnSimpleTile', 'move', { name: currentPlayer.name, tileType: state.activeTileForInteraction.type});
        }
        return { ...state, players: newPlayers, logs: currentLogs };
    }

    case 'PROCEED_TO_NEXT_TURN': {
        if (!state.boardConfig || state.gameStatus === 'finished') return state;

        let currentLogs = state.logs;
        let currentWinner = state.winner;
        let gameIsFinished = !!currentWinner;
        const winningCondition = state.boardConfig.settings.winningCondition;
        const allPlayersHaveFinished = state.playersFinishedCount === state.players.length;

        if (!currentWinner && allPlayersHaveFinished) {
            if (winningCondition === 'highestScore') {
                currentWinner = state.players.reduce((prev, current) => (prev.score > current.score) ? prev : current, state.players[0]);
                if (currentWinner) {
                    playSound('finishSound');
                    currentLogs = addLogEntry(currentLogs, 'log.highestScoreWinner', 'winner', { name: currentWinner.name, score: currentWinner.score });
                }
            } else if (winningCondition === 'combinedOrderScore') {
                const playersWithCombinedScore = state.players.map(p => {
                    const finishOrderPoints = p.finishOrder ? (state.players.length - p.finishOrder + 1) * 10 : 0;
                    return { ...p, combinedScore: finishOrderPoints + p.score };
                });
                currentWinner = playersWithCombinedScore.reduce((prev, current) => {
                    if (prev.combinedScore === current.combinedScore) {
                        if (prev.finishOrder === current.finishOrder) {
                           return prev.score > current.score ? prev : current; 
                        }
                        return (prev.finishOrder || Infinity) < (current.finishOrder || Infinity) ? prev : current; 
                    }
                    return prev.combinedScore > current.combinedScore ? prev : current;
                });

                if (currentWinner) {
                    playSound('finishSound');
                    const winnerData = playersWithCombinedScore.find(p => p.id === currentWinner!.id);
                    currentLogs = addLogEntry(currentLogs, 'log.combinedScoreWinner', 'winner', { 
                        name: winnerData!.name, 
                        score: winnerData!.combinedScore,
                        rawScore: winnerData!.score,
                        finishOrder: winnerData!.finishOrder || undefined
                    });
                }
            }
             if (currentWinner) gameIsFinished = true;
        }
        
        let nextPlayerIndex = state.currentPlayerIndex;
        if (!gameIsFinished) {
            let attempts = 0;
            do {
                nextPlayerIndex = (nextPlayerIndex + 1) % state.players.length;
                attempts++;
            } while (state.players[nextPlayerIndex].hasFinished && attempts <= state.players.length);
            
            if (attempts > state.players.length && !allPlayersHaveFinished) {
                 console.warn("Could not find next active player, but game not determined to be over.");
            }
        }


        return {
            ...state,
            currentPlayerIndex: nextPlayerIndex,
            activeTileForInteraction: null,
            diceRoll: null,
            gameStatus: gameIsFinished ? 'finished' : 'playing',
            winner: currentWinner,
            logs: currentLogs
        };
    }
    case 'RESET_GAME_FOR_PLAY': {
      if (!state.boardConfig) return state;
      try {
        localStorage.removeItem(`boardwise-play-state-${state.boardConfig.id}`);
      } catch (e) {
        console.warn("Failed to remove play state from localStorage on reset", e);
      }
      const reRandomizedBoardConfig = applyBoardRandomizationSettings(state.boardConfig);
      const players = generatePlayers(reRandomizedBoardConfig.settings.numberOfPlayers);
      let initialLogs = addLogEntry([], 'log.event.gameReset', 'game_event');
      initialLogs = addLogEntry(initialLogs, 'log.event.gameStarted', 'game_event', { name: reRandomizedBoardConfig.settings.name });

      return {
        ...initialState,
        boardConfig: reRandomizedBoardConfig,
        players,
        isLoading: false,
        gameStatus: 'playing',
        winner: null,
        activeTileForInteraction: null,
        diceRoll: null,
        currentPlayerIndex: 0,
        logs: initialLogs,
        playersFinishedCount: 0,
      };
    }
    default:
      return state;
  }
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

  useEffect(() => {
    if (state.boardConfig && state.gameStatus !== 'setup' && !state.isLoading) {
      const persistState: PersistedPlayState = {
        players: state.players,
        currentPlayerIndex: state.currentPlayerIndex,
        diceRoll: state.diceRoll,
        gameStatus: state.gameStatus,
        activeTileForInteraction: state.activeTileForInteraction,
        winner: state.winner,
        logs: state.logs,
        playersFinishedCount: state.playersFinishedCount,
      };
      try {
        localStorage.setItem(`boardwise-play-state-${state.boardConfig.id}`, JSON.stringify(persistState));
      } catch (e) {
        console.warn("Failed to save play state to localStorage", e);
      }
    }
  }, [state.players, state.currentPlayerIndex, state.diceRoll, state.gameStatus, state.activeTileForInteraction, state.winner, state.logs, state.playersFinishedCount, state.boardConfig, state.isLoading]);


  const initializeNewBoard = useCallback(() => {
    dispatch({ type: 'START_LOADING' });
    const newBoardId = nanoid();
    const initialTiles: Tile[] = Array.from({ length: DEFAULT_BOARD_SETTINGS.numberOfTiles }, (_, i) => ({
      id: nanoid(),
      type: 'empty',
      position: i,
      ui: { icon: TILE_TYPE_EMOJIS.empty, color: DEFAULT_TILE_COLOR },
    }));

    if (initialTiles.length > 0) {
      initialTiles[0] = {
        ...initialTiles[0],
        type: 'start',
        ui: { icon: TILE_TYPE_EMOJIS.start, color: START_TILE_COLOR }
      };
      if (initialTiles.length > 1) {
        initialTiles[initialTiles.length - 1] = {
          ...initialTiles[initialTiles.length - 1],
          type: 'finish',
          ui: { icon: TILE_TYPE_EMOJIS.finish, color: FINISH_TILE_COLOR }
        };
      }
    }

    let newBoardConfig: BoardConfig = {
      id: newBoardId,
      settings: { ...DEFAULT_BOARD_SETTINGS },
      tiles: initialTiles,
    };
    dispatch({ type: 'SET_BOARD_CONFIG', payload: { boardConfig: newBoardConfig } });
  }, []);

  const loadBoardFromBase64 = useCallback((base64Data: string) => {
    dispatch({ type: 'START_LOADING' });
    let boardConfig: BoardConfig | null = null;
    let persistedPlayState: PersistedPlayState | null = null;
    try {
      const jsonString = decodeURIComponent(atob(base64Data).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      const rawBoardData = JSON.parse(jsonString) as Partial<BoardConfig> & { settings: Partial<BoardSettings> & { punishmentMode?: boolean } };

      if (rawBoardData && rawBoardData.id && rawBoardData.settings && rawBoardData.tiles) {
        boardConfig = {
            id: rawBoardData.id,
            settings: {
                ...DEFAULT_BOARD_SETTINGS,
                ...rawBoardData.settings,
                numberOfTiles: Math.max(MIN_TILES, Math.min(MAX_TILES, rawBoardData.settings.numberOfTiles || DEFAULT_BOARD_SETTINGS.numberOfTiles)),
                numberOfPlayers: Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, rawBoardData.settings.numberOfPlayers || DEFAULT_BOARD_SETTINGS.numberOfPlayers)),
                punishmentType: rawBoardData.settings.punishmentType || (rawBoardData.settings.punishmentMode === true ? 'revertMove' : rawBoardData.settings.punishmentMode === false ? 'none' : DEFAULT_BOARD_SETTINGS.punishmentType),
                punishmentValue: rawBoardData.settings.punishmentValue || DEFAULT_BOARD_SETTINGS.punishmentValue,
                winningCondition: rawBoardData.settings.winningCondition || DEFAULT_BOARD_SETTINGS.winningCondition,
            },
            tiles: rawBoardData.tiles as Tile[],
        };
        delete (boardConfig.settings as any).punishmentMode;

        try {
          const storedState = localStorage.getItem(`boardwise-play-state-${boardConfig.id}`);
          if (storedState) {
            persistedPlayState = JSON.parse(storedState) as PersistedPlayState;
          }
        } catch (e) {
          console.warn("Failed to load persisted play state from localStorage", e);
          persistedPlayState = null;
        }

        dispatch({ type: 'SET_BOARD_CONFIG', payload: { boardConfig, persistedPlayState } });
      } else {
        throw new Error("Invalid board data structure from Base64.");
      }
    } catch (error) {
      console.error("Failed to load board from Base64:", error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load board data from link. The link might be corrupted or invalid.' });
    }
  }, [dispatch]);

  const loadBoardFromJson = useCallback((jsonString: string): boolean => {
    dispatch({ type: 'START_LOADING' });
    let boardConfig: BoardConfig | null = null;
    let persistedPlayState: PersistedPlayState | null = null;
    try {
      const rawBoardData = JSON.parse(jsonString) as Partial<BoardConfig> & { settings: Partial<BoardSettings> & { punishmentMode?: boolean } };
      if (rawBoardData && rawBoardData.id && rawBoardData.settings && rawBoardData.tiles) {
         boardConfig = {
            id: rawBoardData.id,
            settings: {
                ...DEFAULT_BOARD_SETTINGS,
                ...rawBoardData.settings,
                numberOfTiles: Math.max(MIN_TILES, Math.min(MAX_TILES, rawBoardData.settings.numberOfTiles || DEFAULT_BOARD_SETTINGS.numberOfTiles)),
                numberOfPlayers: Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, rawBoardData.settings.numberOfPlayers || DEFAULT_BOARD_SETTINGS.numberOfPlayers)),
                punishmentType: rawBoardData.settings.punishmentType || (rawBoardData.settings.punishmentMode === true ? 'revertMove' : rawBoardData.settings.punishmentMode === false ? 'none' : DEFAULT_BOARD_SETTINGS.punishmentType),
                punishmentValue: rawBoardData.settings.punishmentValue || DEFAULT_BOARD_SETTINGS.punishmentValue,
                winningCondition: rawBoardData.settings.winningCondition || DEFAULT_BOARD_SETTINGS.winningCondition,
            },
            tiles: rawBoardData.tiles as Tile[],
        };
        delete (boardConfig.settings as any).punishmentMode;

        try {
          const storedState = localStorage.getItem(`boardwise-play-state-${boardConfig.id}`);
          if (storedState) {
            persistedPlayState = JSON.parse(storedState) as PersistedPlayState;
          }
        } catch (e) {
          console.warn("Failed to load persisted play state from localStorage for JSON import", e);
          persistedPlayState = null;
        }

        dispatch({ type: 'SET_BOARD_CONFIG', payload: { boardConfig, persistedPlayState } });
        return true;
      } else {
        throw new Error("Invalid board data structure from JSON file.");
      }
    } catch (error) {
      console.error("Failed to load board from JSON:", error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load board from file. The file might be corrupted or not a valid BoardWise configuration.' });
      return false;
    }
  }, [dispatch]);

  const randomizeTileVisuals = useCallback(() => {
    if (state.boardConfig) {
        const newTiles = state.boardConfig.tiles.map(tile => {
            if (tile.type === 'start' || tile.type === 'finish') return tile;
            const randomColor = RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];
            const randomEmoji = tile.type === 'empty' ? TILE_TYPE_EMOJIS.empty : RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)];
            return { ...tile, ui: { ...tile.ui, color: randomColor, icon: randomEmoji } };
        });
        dispatch({ type: 'UPDATE_TILES', payload: newTiles });
    }
  }, [state.boardConfig, dispatch]);


  return (
    <GameContext.Provider value={{ state, dispatch, initializeNewBoard, loadBoardFromBase64, loadBoardFromJson, randomizeTileVisuals }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}

    