
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

type GameAction =
  | { type: 'SET_BOARD_CONFIG'; payload: BoardConfig }
  | { type: 'UPDATE_BOARD_SETTINGS'; payload: Partial<BoardConfig['settings']> }
  | { type: 'UPDATE_TILES'; payload: Tile[] }
  | { type: 'SET_PLAYERS'; payload: Player[] } // Can be used for direct player updates if needed later
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
    position: 0, // All players start at tile 0
    score: 0,
  }));
}

function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_BOARD_CONFIG': {
      const boardConfig = action.payload;
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
      const newTiles = state.boardConfig.tiles.map(tile => {
        if (tile.type === 'start' || tile.type === 'finish') return tile;
        const randomColor = RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];
        const randomEmoji = tile.type === 'empty' ? TILE_TYPE_EMOJIS.empty : RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)];
        return { ...tile, ui: { ...tile.ui, color: randomColor, icon: randomEmoji } };
      });
      return { ...state, boardConfig: { ...state.boardConfig, tiles: newTiles } };
    }
     case 'PLAYER_ROLLED_DICE': {
      if (!state.boardConfig || state.gameStatus !== 'playing') return state;
      
      const { diceValue } = action.payload;
      const currentPlayer = state.players[state.currentPlayerIndex];
      const newPlayers = [...state.players];
      const maxPosition = state.boardConfig.tiles.length - 1;
      
      let newPosition = currentPlayer.position + diceValue;
      if (newPosition > maxPosition) newPosition = maxPosition; // Stop at finish line

      newPlayers[state.currentPlayerIndex] = { ...currentPlayer, position: newPosition };
      
      const landedTile = state.boardConfig.tiles[newPosition];
      
      // If tile is empty, start, or finish (and not game over yet), auto-proceed
      if (landedTile.type === 'empty' || landedTile.type === 'start' || (landedTile.type === 'finish' && state.gameStatus !== 'finished')) {
         if (landedTile.type === 'finish') {
            playSound('finishSound');
            // Basic win condition: first to finish
            return { 
                ...state, 
                players: newPlayers, 
                diceRoll: diceValue, 
                activeTileForInteraction: null, // No interaction for finish, handled by PROCEED_TO_NEXT_TURN
                gameStatus: state.boardConfig.settings.winningCondition === 'firstToFinish' ? 'finished' : 'playing', // Game might continue for highestScore
                winner: state.boardConfig.settings.winningCondition === 'firstToFinish' ? currentPlayer : null,
             };
        }
        return { ...state, players: newPlayers, diceRoll: diceValue, activeTileForInteraction: null, gameStatus: 'playing' }; // No interaction, turn ends implicitly by DiceRoller triggering PROCEED_TO_NEXT_TURN after this
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
        } else {
            // Handle punishment mode (simplified: no score change, turn ends)
            // More complex punishment (e.g., no move) would require adjusting PLAYER_ROLLED_DICE logic
            // or storing original position before move. For now, player has moved.
        }
        playSound(soundToPlay);
        newPlayers[state.currentPlayerIndex] = { ...currentPlayer, score: newScore };
        
        return { ...state, players: newPlayers, activeTileForInteraction: state.activeTileForInteraction }; // Keep tile active until ACKNOWLEDGE_INTERACTION
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
            playSound('correctAnswer'); // Or a generic "positive" sound
        }
        // For info tiles, no score change, just acknowledge.

        return { ...state, players: newPlayers, activeTileForInteraction: state.activeTileForInteraction }; // Keep tile active to show result, then PROCEED_TO_NEXT_TURN is called from UI
    }

    case 'PROCEED_TO_NEXT_TURN': {
        if (!state.boardConfig || state.gameStatus === 'finished') return state;

        let nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
        let gameStatus = state.gameStatus;
        let winner = state.winner;

        // Check if current player landed on finish and game winning condition is highest score
        const currentPlayer = state.players[state.currentPlayerIndex];
        const currentTile = state.boardConfig.tiles[currentPlayer.position];
        
        if (currentTile.type === 'finish' && state.boardConfig.settings.winningCondition === 'highestScore') {
             // Check if all players have finished or a certain number of rounds passed (not implemented yet)
             // For simplicity, if anyone reaches finish in highestScore mode, we check scores after all players had a turn in this "round"
             // This is a simplified check. A full implementation might track rounds or if all players finished.
            const allPlayersFinishedOrLastPlayerOfRound = nextPlayerIndex === 0; // Basic check if we wrapped around
            if (allPlayersFinishedOrLastPlayerOfRound) {
                gameStatus = 'finished';
                winner = state.players.reduce((prev, current) => (prev.score > current.score) ? prev : current);
                playSound('finishSound');
            }
        }


        return { 
            ...state, 
            currentPlayerIndex: nextPlayerIndex, 
            activeTileForInteraction: null, 
            diceRoll: null,
            gameStatus: winner ? 'finished' : 'playing', // if winner determined, game is finished
            winner: winner
        };
    }
    case 'RESET_GAME_FOR_PLAY': {
      if (!state.boardConfig) return state;
      const players = generatePlayers(state.boardConfig.settings.numberOfPlayers);
      return {
        ...initialState, // Reset most things
        boardConfig: state.boardConfig, // Keep the loaded board config
        players, // Reset players
        isLoading: false,
        gameStatus: 'playing', // Start in playing state
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
      const jsonString = decodeURIComponent(atob(base64Data).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
      const boardConfig = JSON.parse(jsonString) as BoardConfig;
      
      if (boardConfig && boardConfig.id && boardConfig.settings && boardConfig.tiles) {
        boardConfig.settings.numberOfTiles = Math.max(MIN_TILES, Math.min(MAX_TILES, boardConfig.settings.numberOfTiles || DEFAULT_BOARD_SETTINGS.numberOfTiles));
        boardConfig.settings.numberOfPlayers = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, boardConfig.settings.numberOfPlayers || DEFAULT_BOARD_SETTINGS.numberOfPlayers));
        boardConfig.settings.winningCondition = boardConfig.settings.winningCondition || DEFAULT_BOARD_SETTINGS.winningCondition;
        boardConfig.settings.boardBackgroundImage = boardConfig.settings.boardBackgroundImage || DEFAULT_BOARD_SETTINGS.boardBackgroundImage;
        
        dispatch({ type: 'SET_BOARD_CONFIG', payload: boardConfig });
        dispatch({ type: 'RESET_GAME_FOR_PLAY' }); // Reset player states for the loaded board
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
