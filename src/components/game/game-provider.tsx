
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { BoardConfig, GameState, Player, Tile, TileConfigQuiz, TileConfigReward, QuizOption, GameStatus, PersistedPlayState, PunishmentType } from '@/types';
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
  }));
}

function applyBoardRandomizationSettings(boardConfig: BoardConfig): BoardConfig {
  let newTiles = [...boardConfig.tiles];

  if (boardConfig.settings.randomizeTiles) {
    // Visual randomization
    newTiles = newTiles.map(tile => {
      if (tile.type === 'start' || tile.type === 'finish') return tile;
      const randomColor = RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];
      const randomEmoji = tile.type === 'empty' ? TILE_TYPE_EMOJIS.empty : RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)];
      return { ...tile, ui: { ...tile.ui, color: randomColor, icon: randomEmoji } };
    });

    // Quiz option shuffling
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


function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_BOARD_CONFIG': {
      const { boardConfig: rawBoardConfig, persistedPlayState } = action.payload;

      let processedBoardConfig = rawBoardConfig;
      // Apply randomization based on the board's configuration.
      // This function internally checks boardConfig.settings.randomizeTiles.
      processedBoardConfig = applyBoardRandomizationSettings(processedBoardConfig);

      // If loading from a persisted state, and randomization is OFF,
      // and the player was interacting with a quiz, restore the exact options they were seeing.
      if (persistedPlayState && !rawBoardConfig.settings.randomizeTiles && persistedPlayState.activeTileForInteraction?.type === 'quiz') {
          const activeQuizTileId = persistedPlayState.activeTileForInteraction.id;
          const tileToRestore = processedBoardConfig.tiles.find(t => t.id === activeQuizTileId);
          if (tileToRestore && tileToRestore.type === 'quiz' && tileToRestore.config) {
              const originalQuizOptions = (persistedPlayState.activeTileForInteraction.config as TileConfigQuiz).options;
              (tileToRestore.config as TileConfigQuiz).options = originalQuizOptions;
          }
      }

      let players = generatePlayers(processedBoardConfig.settings.numberOfPlayers);
      let currentPlayerIndex = 0;
      let gameStatus: GameStatus = persistedPlayState?.gameStatus ?? 'playing';
      let activeTileForInteraction: Tile | null = persistedPlayState?.activeTileForInteraction ?? null;
      let winner: Player | null = persistedPlayState?.winner ?? null;
      let diceRoll: number | null = persistedPlayState?.diceRoll ?? null;

      if (persistedPlayState?.players) {
        if (persistedPlayState.players.length === processedBoardConfig.settings.numberOfPlayers) {
          players = persistedPlayState.players;
        } else {
          console.warn("Persisted player count mismatch with board settings. Regenerating players.");
        }
        currentPlayerIndex = persistedPlayState.currentPlayerIndex ?? 0;
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
      // The immediate shuffling of quiz options here was removed.
      // Randomization is handled by applyBoardRandomizationSettings on board load/reset.
      return {
        ...state,
        boardConfig: { ...state.boardConfig, tiles: action.payload },
      };
    }
    case 'SET_PLAYERS':
      return { ...state, players: action.payload };
    case 'START_LOADING':
      return { ...state, isLoading: true, error: null };
    case 'SET_ERROR':
      return { ...state, isLoading: false, error: action.payload };
     case 'PLAYER_ROLLED_DICE': {
      if (!state.boardConfig || state.gameStatus !== 'playing' || state.winner) return state;

      const { diceValue } = action.payload;
      const currentPlayer = state.players[state.currentPlayerIndex];
      const newPlayers = [...state.players];
      const maxPosition = state.boardConfig.tiles.length - 1;

      let newPosition = currentPlayer.position + diceValue;
      if (newPosition > maxPosition) newPosition = maxPosition;

      newPlayers[state.currentPlayerIndex] = { ...currentPlayer, position: newPosition };

      const landedTile = state.boardConfig.tiles[newPosition];

      if (landedTile.type === 'empty' || landedTile.type === 'start' || (landedTile.type === 'finish' && state.gameStatus !== 'finished')) {
         if (landedTile.type === 'finish') {
            playSound('finishSound');
            const finishedPlayer = newPlayers[state.currentPlayerIndex];
            let gameWinner = state.winner;
            if (!gameWinner && state.boardConfig.settings.winningCondition === 'firstToFinish') {
                gameWinner = finishedPlayer;
            }
            return {
                ...state,
                players: newPlayers,
                diceRoll: diceValue,
                activeTileForInteraction: landedTile,
                gameStatus: gameWinner ? 'finished' : 'interaction_pending', 
                winner: gameWinner,
             };
        }
        // For empty, start, or non-game-ending finish, proceed to next turn automatically after setting interaction_pending
        return { ...state, players: newPlayers, diceRoll: diceValue, activeTileForInteraction: landedTile, gameStatus: 'interaction_pending' };
      }
      // For quiz, info, reward tiles
      return { ...state, players: newPlayers, diceRoll: diceValue, activeTileForInteraction: landedTile, gameStatus: 'interaction_pending' };
    }
    case 'ANSWER_QUIZ': {
        if (!state.boardConfig || !state.activeTileForInteraction || state.activeTileForInteraction.type !== 'quiz' || state.gameStatus !== 'interaction_pending' || state.diceRoll === null) return state;

        const { selectedOptionId } = action.payload;
        const quizConfig = state.activeTileForInteraction.config as TileConfigQuiz;
        const selectedOption = quizConfig.options.find(opt => opt.id === selectedOptionId);
        const currentPlayer = state.players[state.currentPlayerIndex];
        const newPlayers = [...state.players];
        const boardSettings = state.boardConfig.settings;

        let newScore = currentPlayer.score;
        let newPosition = currentPlayer.position;
        let soundToPlay = 'wrongAnswer';

        if (selectedOption?.isCorrect) {
            newScore += quizConfig.points;
            soundToPlay = 'correctAnswer';
        } else {
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
                    // Player stays on the tile, newPosition remains currentPlayer.position
                    break;
            }
        }
        playSound(soundToPlay);
        newPlayers[state.currentPlayerIndex] = { ...currentPlayer, score: newScore, position: newPosition };
        
        // The game status remains 'interaction_pending' here.
        // The TileInteractionArea will show feedback and then the user clicks "Next Turn"
        // which dispatches PROCEED_TO_NEXT_TURN.
        return { ...state, players: newPlayers };
    }
    case 'ACKNOWLEDGE_INTERACTION': {
        if (!state.boardConfig || !state.activeTileForInteraction || state.gameStatus !== 'interaction_pending') return state;

        const currentPlayer = state.players[state.currentPlayerIndex];
        const newPlayers = [...state.players];
        let newScore = currentPlayer.score;

        if (state.activeTileForInteraction.type === 'reward') {
            const rewardConfig = state.activeTileForInteraction.config as TileConfigReward;
            newScore += rewardConfig.points || 0;
            newPlayers[state.currentPlayerIndex] = { ...currentPlayer, score: newScore };
            playSound('correctAnswer'); // Or a specific reward sound
        }
        // Game status remains 'interaction_pending'.
        // TileInteractionArea will have a button to dispatch PROCEED_TO_NEXT_TURN.
        return { ...state, players: newPlayers };
    }

    case 'PROCEED_TO_NEXT_TURN': {
        if (!state.boardConfig || state.gameStatus === 'finished') return state;

        let nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
        let currentWinner = state.winner;
        let gameIsFinished = !!currentWinner;

        if (!currentWinner && state.boardConfig.settings.winningCondition === 'highestScore') {
            // Check if the game should end for 'highestScore'
            // This happens if the player who just moved (state.currentPlayerIndex before incrementing)
            // landed on the finish tile, AND it's the last player in the turn order.
            const playerWhoJustMoved = state.players[state.currentPlayerIndex];
            if(playerWhoJustMoved.position === state.boardConfig.tiles.length -1) { // On finish tile
                if (state.currentPlayerIndex === state.players.length - 1) { // Last player's turn
                    gameIsFinished = true;
                }
            }
            if (gameIsFinished) {
                currentWinner = state.players.reduce((prev, current) => (prev.score > current.score) ? prev : current, state.players[0]);
                if (currentWinner) playSound('finishSound');
            }
        } else if (!currentWinner && state.boardConfig.settings.winningCondition === 'firstToFinish') {
            // 'firstToFinish' winner is determined in PLAYER_ROLLED_DICE if they land on finish.
            // Here we just confirm if the gameStatus became 'finished' due to that.
            if (state.players[state.currentPlayerIndex].position === state.boardConfig.tiles.length -1 && state.winner) {
                 gameIsFinished = true; // Game already marked as finished by PLAYER_ROLLED_DICE setting the winner.
                 currentWinner = state.winner; // Ensure currentWinner is set from state.winner
            }
        }


        return {
            ...state,
            currentPlayerIndex: nextPlayerIndex,
            activeTileForInteraction: null,
            diceRoll: null,
            gameStatus: gameIsFinished ? 'finished' : 'playing',
            winner: currentWinner
        };
    }
    case 'RESET_GAME_FOR_PLAY': {
      if (!state.boardConfig) return state;
      try {
        localStorage.removeItem(`boardwise-play-state-${state.boardConfig.id}`);
      } catch (e) {
        console.warn("Failed to remove play state from localStorage on reset", e);
      }
      // Re-apply randomization settings to the original board config for a fresh play
      const reRandomizedBoardConfig = applyBoardRandomizationSettings(state.boardConfig);
      const players = generatePlayers(reRandomizedBoardConfig.settings.numberOfPlayers);
      return {
        ...initialState, // Reset to initial game state values
        boardConfig: reRandomizedBoardConfig, // Use the potentially re-randomized board
        players,
        isLoading: false,
        gameStatus: 'playing', // Start in 'playing' state
        winner: null,
        activeTileForInteraction: null,
        diceRoll: null,
        currentPlayerIndex: 0,
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
      };
      try {
        localStorage.setItem(`boardwise-play-state-${state.boardConfig.id}`, JSON.stringify(persistState));
      } catch (e) {
        console.warn("Failed to save play state to localStorage", e);
      }
    }
  }, [state.players, state.currentPlayerIndex, state.diceRoll, state.gameStatus, state.activeTileForInteraction, state.winner, state.boardConfig, state.isLoading]);


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
      const rawBoardData = JSON.parse(jsonString) as Partial<BoardConfig> & { settings: Partial<BoardConfig['settings']> & { punishmentMode?: boolean } };

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
  }, []);

  const loadBoardFromJson = useCallback((jsonString: string): boolean => {
    dispatch({ type: 'START_LOADING' });
    let boardConfig: BoardConfig | null = null;
    let persistedPlayState: PersistedPlayState | null = null;
    try {
      const rawBoardData = JSON.parse(jsonString) as Partial<BoardConfig> & { settings: Partial<BoardConfig['settings']> & { punishmentMode?: boolean } };
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
  }, []);

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
