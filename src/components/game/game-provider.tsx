
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { BoardConfig, GameState, Player, Tile, TileConfigQuiz, TileConfigReward, QuizOption, GameStatus, PersistedPlayState } from '@/types';
import { DEFAULT_BOARD_SETTINGS } from '@/types';
import { nanoid } from 'nanoid';
import { 
  MAX_TILES, MIN_TILES, TILE_TYPE_EMOJIS, START_TILE_COLOR, 
  FINISH_TILE_COLOR, DEFAULT_TILE_COLOR, RANDOM_COLORS, RANDOM_EMOJIS, 
  PLAYER_COLORS, MIN_PLAYERS, MAX_PLAYERS 
} from '@/lib/constants';
import { playSound } from '@/lib/sound-service';
import { shuffleArray } from '@/lib/utils';

type GameAction =
  | { type: 'SET_BOARD_CONFIG'; payload: { boardConfig: BoardConfig; persistedPlayState?: PersistedPlayState | null } }
  | { type: 'UPDATE_BOARD_SETTINGS'; payload: Partial<BoardConfig['settings']> }
  | { type: 'UPDATE_TILES'; payload: Tile[] }
  | { type: 'SET_PLAYERS'; payload: Player[] } 
  | { type: 'START_LOADING' }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RANDOMIZE_TILE_VISUALS' }
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
  gameStatus: 'setup', // Initial status
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


function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_BOARD_CONFIG': {
      const { boardConfig: rawBoardConfig, persistedPlayState } = action.payload;
      
      let reRandomizedBoardConfig = applyBoardRandomizationSettings(rawBoardConfig);
      
      let players = generatePlayers(reRandomizedBoardConfig.settings.numberOfPlayers);
      let currentPlayerIndex = 0;
      let gameStatus: GameStatus = persistedPlayState?.gameStatus ?? 'playing';
      let activeTileForInteraction: Tile | null = persistedPlayState?.activeTileForInteraction ?? null;
      let winner: Player | null = persistedPlayState?.winner ?? null;
      let diceRoll: number | null = persistedPlayState?.diceRoll ?? null;

      if (persistedPlayState?.players) {
        if (persistedPlayState.players.length === reRandomizedBoardConfig.settings.numberOfPlayers) {
          players = persistedPlayState.players;
        } else {
          console.warn("Persisted player count mismatch with board settings. Regenerating players.");
          // players already generated above with boardConfig.settings.numberOfPlayers
        }
        currentPlayerIndex = persistedPlayState.currentPlayerIndex ?? 0;
      }
      
      // If persisted state indicates game was finished, ensure winner is set
      if (gameStatus === 'finished' && !winner && persistedPlayState?.winner) {
          winner = persistedPlayState.winner;
      }


      return { 
        ...initialState, // Resets isLoading, error
        boardConfig: reRandomizedBoardConfig, 
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
    case 'UPDATE_TILES':
      if (!state.boardConfig) return state;
      return {
        ...state,
        boardConfig: { ...state.boardConfig, tiles: action.payload },
      };
    case 'SET_PLAYERS':
      return { ...state, players: action.payload };
    case 'START_LOADING':
      return { ...state, isLoading: true, error: null };
    case 'SET_ERROR':
      return { ...state, isLoading: false, error: action.payload };
    case 'RANDOMIZE_TILE_VISUALS': {
      if (!state.boardConfig) return state;
      let newTiles = state.boardConfig.tiles.map(tile => {
        if (tile.type === 'start' || tile.type === 'finish') return tile;
        const randomColor = RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];
        const randomEmoji = tile.type === 'empty' ? TILE_TYPE_EMOJIS.empty : RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)];
        return { ...tile, ui: { ...tile.ui, color: randomColor, icon: randomEmoji } };
      });
      if(state.boardConfig.settings.randomizeTiles){
        newTiles = newTiles.map(tile => {
            if (tile.type === 'quiz' && tile.config) {
                const quizConfig = tile.config as TileConfigQuiz;
                 if (quizConfig.options && quizConfig.options.length > 0) {
                    const shuffledOptions = shuffleArray([...quizConfig.options]);
                    return { ...tile, config: { ...quizConfig, options: shuffledOptions } };
                 }
            }
            return tile;
        });
      }
      return { ...state, boardConfig: { ...state.boardConfig, tiles: newTiles } };
    }
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
                activeTileForInteraction: landedTile, // Keep tile for potential "Game Over" display context
                gameStatus: gameWinner ? 'finished' : 'interaction_pending', // interaction_pending if highestScore 
                winner: gameWinner,
             };
        }
        return { ...state, players: newPlayers, diceRoll: diceValue, activeTileForInteraction: landedTile, gameStatus: 'interaction_pending' }; 
      }
      return { ...state, players: newPlayers, diceRoll: diceValue, activeTileForInteraction: landedTile, gameStatus: 'interaction_pending' };
    }
    case 'ANSWER_QUIZ': {
        if (!state.boardConfig || !state.activeTileForInteraction || state.activeTileForInteraction.type !== 'quiz' || state.gameStatus !== 'interaction_pending') return state;

        const { selectedOptionId } = action.payload;
        const quizConfig = state.activeTileForInteraction.config as TileConfigQuiz;
        const selectedOption = quizConfig.options.find(opt => opt.id === selectedOptionId);
        const currentPlayer = state.players[state.currentPlayerIndex];
        const newPlayers = [...state.players];
        
        let newScore = currentPlayer.score;
        let newPosition = currentPlayer.position;
        let soundToPlay = 'wrongAnswer';

        if (selectedOption?.isCorrect) {
            newScore += quizConfig.points;
            soundToPlay = 'correctAnswer';
        } else {
            if (state.boardConfig.settings.punishmentMode && state.diceRoll !== null) {
                newPosition = Math.max(0, currentPlayer.position - state.diceRoll);
            }
        }
        playSound(soundToPlay);
        newPlayers[state.currentPlayerIndex] = { ...currentPlayer, score: newScore, position: newPosition };
        
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
            playSound('correctAnswer');
        }
        return { ...state, players: newPlayers };
    }

    case 'PROCEED_TO_NEXT_TURN': {
        if (!state.boardConfig || state.gameStatus === 'finished') return state;

        let nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
        let currentWinner = state.winner; 
        let gameIsFinished = !!currentWinner; // If already won by firstToFinish

        if (!currentWinner && state.boardConfig.settings.winningCondition === 'highestScore') {
            const playerWhoJustMoved = state.players[state.currentPlayerIndex]; 
            if(state.activeTileForInteraction?.type === 'finish' || playerWhoJustMoved.position === state.boardConfig.tiles.length -1){ // Player ended turn on finish
                // Check if all players have finished their turns in the current round or landed on finish
                // A simple check: if the current player (who just finished) is the last player in order
                if (state.currentPlayerIndex === state.players.length - 1) {
                    gameIsFinished = true; // All players had a chance in this round, game ends
                }
            }
             if (gameIsFinished) { // This means all players finished the round where someone hit finish, or other conditions met
                currentWinner = state.players.reduce((prev, current) => (prev.score > current.score) ? prev : current, state.players[0]);
                if (currentWinner) playSound('finishSound');
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
      const reRandomizedBoardConfig = applyBoardRandomizationSettings(state.boardConfig);
      const players = generatePlayers(reRandomizedBoardConfig.settings.numberOfPlayers);
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
        // Potentially handle quota exceeded error
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
      const decodedChars = atob(base64Data).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2));
      const jsonString = decodeURIComponent(decodedChars.join(''));
      boardConfig = JSON.parse(jsonString) as BoardConfig;
      
      if (boardConfig && boardConfig.id && boardConfig.settings && boardConfig.tiles) {
        boardConfig.settings.numberOfTiles = Math.max(MIN_TILES, Math.min(MAX_TILES, boardConfig.settings.numberOfTiles || DEFAULT_BOARD_SETTINGS.numberOfTiles));
        boardConfig.settings.numberOfPlayers = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, boardConfig.settings.numberOfPlayers || DEFAULT_BOARD_SETTINGS.numberOfPlayers));
        boardConfig.settings.winningCondition = boardConfig.settings.winningCondition || DEFAULT_BOARD_SETTINGS.winningCondition;
        boardConfig.settings.boardBackgroundImage = boardConfig.settings.boardBackgroundImage || DEFAULT_BOARD_SETTINGS.boardBackgroundImage;
        boardConfig.settings.randomizeTiles = typeof boardConfig.settings.randomizeTiles === 'boolean' ? boardConfig.settings.randomizeTiles : DEFAULT_BOARD_SETTINGS.randomizeTiles;
        boardConfig.settings.punishmentMode = typeof boardConfig.settings.punishmentMode === 'boolean' ? boardConfig.settings.punishmentMode : DEFAULT_BOARD_SETTINGS.punishmentMode;

        try {
          const storedState = localStorage.getItem(`boardwise-play-state-${boardConfig.id}`);
          if (storedState) {
            persistedPlayState = JSON.parse(storedState) as PersistedPlayState;
            // Add more validation for persistedPlayState if needed
          }
        } catch (e) {
          console.warn("Failed to load persisted play state from localStorage", e);
          persistedPlayState = null; // Ensure it's null if parsing fails
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
      boardConfig = JSON.parse(jsonString) as BoardConfig;
      if (boardConfig && boardConfig.id && boardConfig.settings && boardConfig.tiles) {
        boardConfig.settings.numberOfTiles = Math.max(MIN_TILES, Math.min(MAX_TILES, boardConfig.settings.numberOfTiles || DEFAULT_BOARD_SETTINGS.numberOfTiles));
        boardConfig.settings.numberOfPlayers = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, boardConfig.settings.numberOfPlayers || DEFAULT_BOARD_SETTINGS.numberOfPlayers));
        boardConfig.settings.winningCondition = boardConfig.settings.winningCondition || DEFAULT_BOARD_SETTINGS.winningCondition;
        boardConfig.settings.boardBackgroundImage = boardConfig.settings.boardBackgroundImage || DEFAULT_BOARD_SETTINGS.boardBackgroundImage;
        boardConfig.settings.randomizeTiles = typeof boardConfig.settings.randomizeTiles === 'boolean' ? boardConfig.settings.randomizeTiles : DEFAULT_BOARD_SETTINGS.randomizeTiles;
        boardConfig.settings.punishmentMode = typeof boardConfig.settings.punishmentMode === 'boolean' ? boardConfig.settings.punishmentMode : DEFAULT_BOARD_SETTINGS.punishmentMode;
        
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
    dispatch({ type: 'RANDOMIZE_TILE_VISUALS' });
  }, []);

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

