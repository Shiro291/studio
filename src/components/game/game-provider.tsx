
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useReducer, useCallback } from 'react';
import type { BoardConfig, GameState, Player, Tile, TileConfigQuiz, TileConfigReward, QuizOption } from '@/types';
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
  | { type: 'SET_BOARD_CONFIG'; payload: BoardConfig }
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

function applyBoardRandomization(boardConfig: BoardConfig): BoardConfig {
  let newTiles = [...boardConfig.tiles];

  // 1. Randomize tile visuals if setting is enabled
  if (boardConfig.settings.randomizeTiles) {
    newTiles = newTiles.map(tile => {
      if (tile.type === 'start' || tile.type === 'finish') return tile;
      const randomColor = RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];
      const randomEmoji = tile.type === 'empty' ? TILE_TYPE_EMOJIS.empty : RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)];
      return { ...tile, ui: { ...tile.ui, color: randomColor, icon: randomEmoji } };
    });
  }

  // 2. Shuffle quiz options for all quiz tiles
  newTiles = newTiles.map(tile => {
    if (tile.type === 'quiz' && tile.config) {
      const quizConfig = tile.config as TileConfigQuiz;
      const shuffledOptions = shuffleArray([...quizConfig.options]); // Shuffle a copy
      return {
        ...tile,
        config: {
          ...quizConfig,
          options: shuffledOptions,
        },
      };
    }
    return tile;
  });

  return { ...boardConfig, tiles: newTiles };
}


function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_BOARD_CONFIG': {
      let boardConfig = action.payload;
      
      // Apply randomization of visuals and quiz options here
      boardConfig = applyBoardRandomization(boardConfig);
      
      const players = generatePlayers(boardConfig.settings.numberOfPlayers);
      return { ...initialState, boardConfig, players, isLoading: false, gameStatus: 'playing', error: null };
    }
    case 'UPDATE_BOARD_SETTINGS': {
      if (!state.boardConfig) return state;
      const updatedSettings = { ...state.boardConfig.settings, ...action.payload };
      let updatedPlayers = state.players;
      if (action.payload.numberOfPlayers !== undefined && action.payload.numberOfPlayers !== state.boardConfig.settings.numberOfPlayers) {
        updatedPlayers = generatePlayers(action.payload.numberOfPlayers);
      }
      // Note: If settings like randomizeTiles change, they will take effect on next full board load/reset.
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
      // If tiles are updated directly (e.g. by editor), re-apply quiz option shuffle for consistency
      // This assumes UPDATE_TILES provides the "canonical" tile structure from the editor.
      // Visual randomization based on boardSettings.randomizeTiles is only applied on SET_BOARD_CONFIG.
      // Manual randomization is via RANDOMIZE_TILE_VISUALS button.
      let updatedTilesPayload = action.payload.map(tile => {
        if (tile.type === 'quiz' && tile.config) {
          const quizConfig = tile.config as TileConfigQuiz;
          // Shuffle options if not already shuffled or if structure might have changed.
          // For simplicity, always shuffle on UPDATE_TILES to ensure consistency if options are edited.
          const shuffledOptions = shuffleArray([...quizConfig.options]);
          return { ...tile, config: { ...quizConfig, options: shuffledOptions } };
        }
        return tile;
      });
      return {
        ...state,
        boardConfig: { ...state.boardConfig, tiles: updatedTilesPayload },
      };
    case 'SET_PLAYERS':
      return { ...state, players: action.payload };
    case 'START_LOADING':
      return { ...state, isLoading: true, error: null };
    case 'SET_ERROR':
      return { ...state, isLoading: false, error: action.payload };
    case 'RANDOMIZE_TILE_VISUALS': {
      if (!state.boardConfig) return state;
      const newTiles = state.boardConfig.tiles.map(tile => {
        if (tile.type === 'start' || tile.type === 'finish') return tile;
        const randomColor = RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];
        const randomEmoji = tile.type === 'empty' ? TILE_TYPE_EMOJIS.empty : RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)];
        return { ...tile, ui: { ...tile.ui, color: randomColor, icon: randomEmoji } };
      });
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
            if (state.boardConfig.settings.winningCondition === 'firstToFinish') {
                gameWinner = finishedPlayer;
            }
            return { 
                ...state, 
                players: newPlayers, 
                diceRoll: diceValue, 
                activeTileForInteraction: null, 
                gameStatus: gameWinner ? 'finished' : 'playing', 
                winner: gameWinner,
             };
        }
        // Auto-proceed for empty/start, then dispatch PROCEED_TO_NEXT_TURN
        // This ensures the game state reflects the move before proceeding.
        // For simplicity, direct PROCEED_TO_NEXT_TURN will be called from UI or effect if activeTileForInteraction is null.
        // We set gameStatus to playing here, next turn logic handles cycling.
        return { ...state, players: newPlayers, diceRoll: diceValue, activeTileForInteraction: null, gameStatus: 'playing' }; 
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
        let soundToPlay = 'wrongAnswer';

        if (selectedOption?.isCorrect) {
            newScore += quizConfig.points;
            soundToPlay = 'correctAnswer';
        } 
        playSound(soundToPlay);
        newPlayers[state.currentPlayerIndex] = { ...currentPlayer, score: newScore };
        
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
        let gameIsFinished = !!currentWinner;

        if (!currentWinner && state.boardConfig.settings.winningCondition === 'highestScore') {
            const currentPlayerJustFinishedTurn = state.players[state.currentPlayerIndex];
            const currentTileOfPlayer = state.boardConfig.tiles[currentPlayerJustFinishedTurn.position];
            
            if (currentTileOfPlayer.type === 'finish' && nextPlayerIndex === 0) { 
                gameIsFinished = true;
                currentWinner = state.players.reduce((prev, current) => (prev.score > current.score) ? prev : current, state.players[0]);
                playSound('finishSound');
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
      // Re-apply randomization when resetting for play, ensuring settings are respected.
      const reRandomizedBoardConfig = applyBoardRandomization(state.boardConfig);
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
    // Apply randomization to new board based on its default settings.
    newBoardConfig = applyBoardRandomization(newBoardConfig);

    dispatch({ type: 'SET_BOARD_CONFIG', payload: newBoardConfig });
  }, []);

  const loadBoardFromBase64 = useCallback((base64Data: string) => {
    dispatch({ type: 'START_LOADING' });
    try {
      const jsonString = decodeURIComponent(atob(base64Data).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      let boardConfig = JSON.parse(jsonString) as BoardConfig;
      
      if (boardConfig && boardConfig.id && boardConfig.settings && boardConfig.tiles) {
        boardConfig.settings.numberOfTiles = Math.max(MIN_TILES, Math.min(MAX_TILES, boardConfig.settings.numberOfTiles || DEFAULT_BOARD_SETTINGS.numberOfTiles));
        boardConfig.settings.numberOfPlayers = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, boardConfig.settings.numberOfPlayers || DEFAULT_BOARD_SETTINGS.numberOfPlayers));
        boardConfig.settings.winningCondition = boardConfig.settings.winningCondition || DEFAULT_BOARD_SETTINGS.winningCondition;
        boardConfig.settings.boardBackgroundImage = boardConfig.settings.boardBackgroundImage || DEFAULT_BOARD_SETTINGS.boardBackgroundImage;
        boardConfig.settings.randomizeTiles = typeof boardConfig.settings.randomizeTiles === 'boolean' ? boardConfig.settings.randomizeTiles : DEFAULT_BOARD_SETTINGS.randomizeTiles;
        
        // SET_BOARD_CONFIG will call applyBoardRandomization
        dispatch({ type: 'SET_BOARD_CONFIG', payload: boardConfig });
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
    try {
      let boardConfig = JSON.parse(jsonString) as BoardConfig;
      if (boardConfig && boardConfig.id && boardConfig.settings && boardConfig.tiles) {
        boardConfig.settings.numberOfTiles = Math.max(MIN_TILES, Math.min(MAX_TILES, boardConfig.settings.numberOfTiles || DEFAULT_BOARD_SETTINGS.numberOfTiles));
        boardConfig.settings.numberOfPlayers = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, boardConfig.settings.numberOfPlayers || DEFAULT_BOARD_SETTINGS.numberOfPlayers));
        boardConfig.settings.winningCondition = boardConfig.settings.winningCondition || DEFAULT_BOARD_SETTINGS.winningCondition;
        boardConfig.settings.boardBackgroundImage = boardConfig.settings.boardBackgroundImage || DEFAULT_BOARD_SETTINGS.boardBackgroundImage;
        boardConfig.settings.randomizeTiles = typeof boardConfig.settings.randomizeTiles === 'boolean' ? boardConfig.settings.randomizeTiles : DEFAULT_BOARD_SETTINGS.randomizeTiles;
        
        // SET_BOARD_CONFIG will call applyBoardRandomization
        dispatch({ type: 'SET_BOARD_CONFIG', payload: boardConfig });
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

