
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
  | { type: 'RANDOMIZE_TILE_VISUALS' } // Manual randomization via button
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
  randomizeTileVisuals: () => void; // For the button
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

// This function is called by SET_BOARD_CONFIG or RESET_GAME_FOR_PLAY.
// It applies randomization ONLY IF boardConfig.settings.randomizeTiles is true.
function applyBoardRandomizationSettings(boardConfig: BoardConfig): BoardConfig {
  let newTiles = [...boardConfig.tiles];

  if (boardConfig.settings.randomizeTiles) {
    // 1. Randomize tile visuals (colors and icons)
    newTiles = newTiles.map(tile => {
      if (tile.type === 'start' || tile.type === 'finish') return tile; // Keep start/finish visuals stable
      const randomColor = RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];
      const randomEmoji = tile.type === 'empty' ? TILE_TYPE_EMOJIS.empty : RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)];
      return { ...tile, ui: { ...tile.ui, color: randomColor, icon: randomEmoji } };
    });

    // 2. Shuffle quiz options for all quiz tiles
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
  // If randomizeTiles is false, the original newTiles (a copy of boardConfig.tiles) is used, preserving all original UI and option orders.
  return { ...boardConfig, tiles: newTiles };
}


function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_BOARD_CONFIG': {
      let boardConfig = action.payload;
      
      // Apply randomization settings (visuals and quiz options if enabled in boardConfig.settings)
      boardConfig = applyBoardRandomizationSettings(boardConfig);
      
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
      // Note: If settings like randomizeTiles change, they will take effect on next full board load/reset (SET_BOARD_CONFIG or RESET_GAME_FOR_PLAY).
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
      // When tiles are updated by the editor, we respect their current configuration directly.
      // The `randomizeTiles` setting applies on initial board load/reset for play, not during these active editing updates.
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
    case 'RANDOMIZE_TILE_VISUALS': { // This is for the manual button in the editor
      if (!state.boardConfig) return state;
      let newTiles = state.boardConfig.tiles.map(tile => {
        if (tile.type === 'start' || tile.type === 'finish') return tile;
        const randomColor = RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];
        const randomEmoji = tile.type === 'empty' ? TILE_TYPE_EMOJIS.empty : RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)];
        return { ...tile, ui: { ...tile.ui, color: randomColor, icon: randomEmoji } };
      });
      // Also shuffle quiz options if the manual button is pressed AND the board setting for randomizeTiles is currently ON
      // This ensures the "Randomize Visuals" button can also affect quiz order if the overall board setting intends for randomization.
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
            // Check winning condition only if no winner yet
            if (!gameWinner && state.boardConfig.settings.winningCondition === 'firstToFinish') {
                gameWinner = finishedPlayer;
            }
            // For 'highestScore', winner is determined in PROCEED_TO_NEXT_TURN if all players finished or conditions met.
            // Here, just mark the player as finished.
            return { 
                ...state, 
                players: newPlayers, 
                diceRoll: diceValue, 
                activeTileForInteraction: null, 
                gameStatus: gameWinner ? 'finished' : 'playing', 
                winner: gameWinner,
             };
        }
        // Auto-proceed for empty/start, game status remains 'playing', next turn will be triggered
        // This effectively means PROCEED_TO_NEXT_TURN should be called immediately after this state update.
        // Let's set activeTileForInteraction to null for these, and PROCEED_TO_NEXT_TURN will handle the rest.
        return { ...state, players: newPlayers, diceRoll: diceValue, activeTileForInteraction: landedTile, gameStatus: 'interaction_pending' }; 
      }

      // For quiz, info, reward - interaction is pending
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
        let newPosition = currentPlayer.position; // Current position after the initial move
        let soundToPlay = 'wrongAnswer';

        if (selectedOption?.isCorrect) {
            newScore += quizConfig.points;
            soundToPlay = 'correctAnswer';
        } else {
            // Answer is wrong
            if (state.boardConfig.settings.punishmentMode && state.diceRoll !== null) {
                // Revert the move by subtracting the dice roll that led to this tile
                // The initial position before this roll was (currentPlayer.position - state.diceRoll)
                // However, player object already has new position. We need to get the position before current dice roll.
                // This requires storing pre-roll position or calculating.
                // Simplest: newPosition = currentPosition - diceRoll
                newPosition = Math.max(0, currentPlayer.position - state.diceRoll);

            }
            // If not punishment mode, or diceRoll is somehow null, position remains, just no points.
        }
        playSound(soundToPlay);
        newPlayers[state.currentPlayerIndex] = { ...currentPlayer, score: newScore, position: newPosition };
        
        // The gameStatus remains 'interaction_pending' here. 
        // The TileInteractionArea will show feedback, and its button click will dispatch ACKNOWLEDGE_INTERACTION, which then calls PROCEED_TO_NEXT_TURN.
        return { ...state, players: newPlayers }; 
    }
    case 'ACKNOWLEDGE_INTERACTION': { // For info, reward, or after quiz feedback
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
        // If it was a quiz, score/position adjustments are already handled in ANSWER_QUIZ.
        // This action primarily signals that the player has seen the info/reward/quiz feedback.
        
        return { ...state, players: newPlayers }; // State updated, now TileInteractionArea will call PROCEED_TO_NEXT_TURN
    }

    case 'PROCEED_TO_NEXT_TURN': {
        if (!state.boardConfig || state.gameStatus === 'finished') return state;

        let nextPlayerIndex = (state.currentPlayerIndex + 1) % state.players.length;
        let currentWinner = state.winner; 
        let gameIsFinished = !!currentWinner;

        // Check for 'highestScore' win condition if not already won by 'firstToFinish'
        if (!currentWinner && state.boardConfig.settings.winningCondition === 'highestScore') {
            const playerWhoJustMoved = state.players[state.currentPlayerIndex]; // Player whose turn just ended
            const tilePlayerLandedOn = state.boardConfig.tiles[playerWhoJustMoved.position];

            // Game ends for highestScore if the LAST player in the turn order lands on finish.
            // This means everyone has had a chance to finish in that round.
            if (tilePlayerLandedOn.type === 'finish' && state.currentPlayerIndex === state.players.length - 1) { 
                gameIsFinished = true;
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
      // Re-apply randomization settings when resetting for play
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
      settings: { ...DEFAULT_BOARD_SETTINGS }, // randomizeTiles is false by default here
      tiles: initialTiles,
    };
    // applyBoardRandomizationSettings will be called by SET_BOARD_CONFIG reducer
    dispatch({ type: 'SET_BOARD_CONFIG', payload: newBoardConfig });
  }, []);

  const loadBoardFromBase64 = useCallback((base64Data: string) => {
    dispatch({ type: 'START_LOADING' });
    try {
      const decodedChars = atob(base64Data).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2));
      const jsonString = decodeURIComponent(decodedChars.join(''));
      let boardConfig = JSON.parse(jsonString) as BoardConfig;
      
      if (boardConfig && boardConfig.id && boardConfig.settings && boardConfig.tiles) {
        boardConfig.settings.numberOfTiles = Math.max(MIN_TILES, Math.min(MAX_TILES, boardConfig.settings.numberOfTiles || DEFAULT_BOARD_SETTINGS.numberOfTiles));
        boardConfig.settings.numberOfPlayers = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, boardConfig.settings.numberOfPlayers || DEFAULT_BOARD_SETTINGS.numberOfPlayers));
        boardConfig.settings.winningCondition = boardConfig.settings.winningCondition || DEFAULT_BOARD_SETTINGS.winningCondition;
        boardConfig.settings.boardBackgroundImage = boardConfig.settings.boardBackgroundImage || DEFAULT_BOARD_SETTINGS.boardBackgroundImage;
        boardConfig.settings.randomizeTiles = typeof boardConfig.settings.randomizeTiles === 'boolean' ? boardConfig.settings.randomizeTiles : DEFAULT_BOARD_SETTINGS.randomizeTiles;
        boardConfig.settings.punishmentMode = typeof boardConfig.settings.punishmentMode === 'boolean' ? boardConfig.settings.punishmentMode : DEFAULT_BOARD_SETTINGS.punishmentMode;
        
        // SET_BOARD_CONFIG will call applyBoardRandomizationSettings
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
        boardConfig.settings.punishmentMode = typeof boardConfig.settings.punishmentMode === 'boolean' ? boardConfig.settings.punishmentMode : DEFAULT_BOARD_SETTINGS.punishmentMode;
        
        // SET_BOARD_CONFIG will call applyBoardRandomizationSettings
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

  const randomizeTileVisuals = useCallback(() => { // This is for the manual button in the editor
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

