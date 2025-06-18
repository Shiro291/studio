
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useReducer, useCallback, useEffect } from 'react';
import type { BoardConfig, GameState, Player, Tile } from '@/types';
import { DEFAULT_BOARD_SETTINGS } from '@/types';
import { nanoid } from 'nanoid';
import { 
  MAX_TILES, MIN_TILES, TILE_TYPE_EMOJIS, START_TILE_COLOR, 
  FINISH_TILE_COLOR, DEFAULT_TILE_COLOR, RANDOM_COLORS, RANDOM_EMOJIS, 
  PLAYER_COLORS, MIN_PLAYERS, MAX_PLAYERS 
} from '@/lib/constants';

type GameAction =
  | { type: 'SET_BOARD_CONFIG'; payload: BoardConfig }
  | { type: 'UPDATE_BOARD_SETTINGS'; payload: Partial<BoardConfig['settings']> }
  | { type: 'UPDATE_TILES'; payload: Tile[] }
  | { type: 'SET_PLAYERS'; payload: Player[] }
  | { type: 'START_LOADING' }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RANDOMIZE_TILE_VISUALS' };

const initialState: GameState = {
  boardConfig: null,
  players: [],
  currentPlayerIndex: 0,
  diceRoll: null,
  gameStatus: 'setup',
  isLoading: true,
  error: null,
};

const GameContext = createContext<{
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  initializeNewBoard: () => void;
  loadBoardFromBase64: (base64Data: string) => void;
  randomizeTileVisuals: () => void;
}>({
  state: initialState,
  dispatch: () => null,
  initializeNewBoard: () => {},
  loadBoardFromBase64: () => {},
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

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_BOARD_CONFIG':
      const boardConfig = action.payload;
      const players = generatePlayers(boardConfig.settings.numberOfPlayers);
      return { ...state, boardConfig, players, isLoading: false, error: null, gameStatus: 'setup' };
    case 'UPDATE_BOARD_SETTINGS':
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
    case 'UPDATE_TILES':
      if (!state.boardConfig) return state;
      return {
        ...state,
        boardConfig: { ...state.boardConfig, tiles: action.payload },
      };
    case 'SET_PLAYERS': // Could be used for more direct player updates if needed later
      return { ...state, players: action.payload };
    case 'START_LOADING':
      return { ...state, isLoading: true, error: null };
    case 'SET_ERROR':
      return { ...state, isLoading: false, error: action.payload };
    case 'RANDOMIZE_TILE_VISUALS':
      if (!state.boardConfig) return state;
      const newTiles = state.boardConfig.tiles.map(tile => {
        if (tile.type === 'start' || tile.type === 'finish') {
          return tile; 
        }
        const randomColor = RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];
        const randomEmoji = tile.type === 'empty' ? TILE_TYPE_EMOJIS.empty : RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)];
        return {
          ...tile,
          ui: {
            ...tile.ui,
            color: randomColor,
            icon: randomEmoji,
          },
        };
      });
      return {
        ...state,
        boardConfig: { ...state.boardConfig, tiles: newTiles },
      };
    default:
      return state;
  }
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);

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
    
    const newBoardConfig: BoardConfig = {
      id: newBoardId,
      settings: { ...DEFAULT_BOARD_SETTINGS },
      tiles: initialTiles,
    };
    dispatch({ type: 'SET_BOARD_CONFIG', payload: newBoardConfig });
  }, []);

  const loadBoardFromBase64 = useCallback((base64Data: string) => {
    dispatch({ type: 'START_LOADING' });
    try {
      const jsonString = atob(base64Data);
      const boardConfig = JSON.parse(jsonString) as BoardConfig;
      if (boardConfig && boardConfig.id && boardConfig.settings && boardConfig.tiles) {
        boardConfig.settings.numberOfTiles = Math.max(MIN_TILES, Math.min(MAX_TILES, boardConfig.settings.numberOfTiles || DEFAULT_BOARD_SETTINGS.numberOfTiles));
        boardConfig.settings.numberOfPlayers = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, boardConfig.settings.numberOfPlayers || DEFAULT_BOARD_SETTINGS.numberOfPlayers));
        boardConfig.settings.winningCondition = boardConfig.settings.winningCondition || DEFAULT_BOARD_SETTINGS.winningCondition;

        dispatch({ type: 'SET_BOARD_CONFIG', payload: boardConfig });
      } else {
        throw new Error("Invalid board data structure.");
      }
    } catch (error) {
      console.error("Failed to load board from Base64:", error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load board data. The link might be corrupted or invalid.' });
      initializeNewBoard(); 
    }
  }, [initializeNewBoard]);

  const randomizeTileVisuals = useCallback(() => {
    dispatch({ type: 'RANDOMIZE_TILE_VISUALS' });
  }, []);

  return (
    <GameContext.Provider value={{ state, dispatch, initializeNewBoard, loadBoardFromBase64, randomizeTileVisuals }}>
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
