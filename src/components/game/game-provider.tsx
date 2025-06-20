
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import type { BoardConfig, GameState, Player, Tile, TileConfigQuiz, TileConfigInfo, TileConfigReward, GameStatus, PersistedPlayState, PunishmentType, LogEntry, BoardSettings, PawnAnimation, QuizOption } from '@/types';
import { DEFAULT_BOARD_SETTINGS }
  from '@/types';
import { DEFAULT_TILE_COLOR, FINISH_TILE_COLOR, MAX_PLAYERS, MAX_TILES, MIN_PLAYERS, MIN_TILES, PLAYER_COLORS, RANDOM_COLORS, RANDOM_EMOJIS, START_TILE_COLOR, TILE_TYPE_EMOJIS, DIFFICULTY_POINTS } from '@/lib/constants';
import { nanoid } from 'nanoid';
import { playSound } from '@/lib/sound-service';
import { shuffleArray } from '@/lib/utils';
import { useLanguage } from '@/context/language-context';
import { translateText } from '@/ai/flows/translate-text-flow';

const PAWN_ANIMATION_STEP_DELAY = 500;
const ASSUMED_ORIGINAL_BOARD_LANGUAGE = 'en'; // Or determined dynamically in future

type GameAction =
  | { type: 'SET_INITIAL_BOARD_DATA'; payload: { boardConfig: BoardConfig; persistedPlayState?: PersistedPlayState | null } }
  | { type: 'UPDATE_BOARD_SETTINGS'; payload: Partial<BoardConfig['settings']> } // This should update originalBoardConfig and trigger re-translation
  | { type: 'UPDATE_TILES'; payload: Tile[] } // This should update originalBoardConfig and trigger re-translation
  | { type: 'SET_PLAYERS'; payload: Player[] }
  | { type: 'START_LOADING' } // Generic loading, can be used by translation too
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'PLAYER_ROLLED_DICE'; payload: { diceValue: number } }
  | { type: 'ADVANCE_PAWN_ANIMATION' }
  | { type: 'ANSWER_QUIZ'; payload: { selectedOptionId: string } }
  | { type: 'ACKNOWLEDGE_INTERACTION' }
  | { type: 'PROCEED_TO_NEXT_TURN' }
  | { type: 'RESET_GAME_FOR_PLAY' }
  | { type: 'UPDATE_PLAYER_NAME', payload: { playerId: string; newName: string }}
  | { type: 'TRANSLATION_STARTED' }
  | { type: 'TRANSLATION_FINISHED'; payload: BoardConfig } // Payload is the translated board
  | { type: 'SET_DISPLAY_BOARD'; payload: BoardConfig }; // Sets boardConfig directly (e.g., to original)


const initialState: GameState = {
  boardConfig: null,
  originalBoardConfig: null,
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
  pawnAnimation: null,
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

// Translation cache: Key: "textToTranslate::targetLanguageCode", Value: "translatedText"
const translationCache = new Map<string, string>();

async function translateTextCached(
  text: string,
  targetLanguageCode: string,
  sourceLanguageCode: string = ASSUMED_ORIGINAL_BOARD_LANGUAGE
): Promise<string> {
  if (!text || typeof text !== 'string' || text.trim() === '') return text;
  if (targetLanguageCode === sourceLanguageCode) return text;

  const cacheKey = `${sourceLanguageCode}::${text}::${targetLanguageCode}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey)!;
  }

  try {
    // console.log(`Translating from cache miss: "${text}" to ${targetLanguageCode}`);
    const { translatedText } = await translateText({ textToTranslate: text, targetLanguageCode });
    if (translatedText) {
      translationCache.set(cacheKey, translatedText);
      return translatedText;
    }
    return text; // Fallback to original if translation returns empty
  } catch (error) {
    console.error(`Translation API failed for text "${text}" to ${targetLanguageCode}:`, error);
    return text; // Fallback to original text on API error
  }
}


function generatePlayers(numberOfPlayers: number): Player[] {
  const numPlayers = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, numberOfPlayers));
  return Array.from({ length: numPlayers }, (_, i) => ({
    id: nanoid(),
    name: `Player ${i + 1}`,
    color: PLAYER_COLORS[i % PLAYER_COLORS.length],
    position: 0,
    visualPosition: 0,
    score: 0,
    currentStreak: 0,
    hasFinished: false,
    finishOrder: null,
  }));
}

function applyBoardRandomizationSettings(boardConfig: BoardConfig, persistedActiveTile?: Tile | null): BoardConfig {
  let newTiles = [...boardConfig.tiles];

  if (boardConfig.settings.randomizeTiles) {
    newTiles = newTiles.map(tile => {
      if (tile.type === 'start' || tile.type === 'finish') return tile;
      const shouldRandomizeVisual = tile.ui.color === DEFAULT_TILE_COLOR || !tile.ui.color;
      const randomColor = shouldRandomizeVisual ? RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)] : tile.ui.color;
      const randomEmoji = shouldRandomizeVisual && tile.type !== 'empty' ? RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)] : tile.ui.icon || TILE_TYPE_EMOJIS[tile.type];
      
      return { ...tile, ui: { ...tile.ui, color: randomColor, icon: randomEmoji } };
    });
  }
  
  newTiles = newTiles.map(tile => {
    if (tile.type === 'quiz' && tile.config) {
      let quizConfig = { ...(tile.config as TileConfigQuiz) };
      if (persistedActiveTile && persistedActiveTile.id === tile.id && persistedActiveTile.type === 'quiz' && !boardConfig.settings.randomizeTiles) {
         // If active tile is persisted and randomization is OFF, try to keep its option order
         // This logic is tricky due to ID changes. Comparing by position and question might be more robust.
         const persistedQuizConfig = persistedActiveTile.config as TileConfigQuiz;
         if (persistedQuizConfig.question === quizConfig.question && persistedQuizConfig.options.length === quizConfig.options.length) {
            quizConfig.options = persistedQuizConfig.options;
         } else {
            quizConfig.options = shuffleArray([...quizConfig.options]);
         }

      } else if (quizConfig.options && quizConfig.options.length > 0 && boardConfig.settings.randomizeTiles) {
        quizConfig.options = shuffleArray([...quizConfig.options]);
      }
      return { ...tile, config: quizConfig };
    }
    return tile;
  });

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
  return [newLog, ...currentLogs].slice(0, 50); 
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

function sanitizeAndValidateBoardConfig(loadedBoardConfig: Partial<BoardConfig> & { settings: Partial<BoardSettings> & { punishmentMode?: boolean } }): BoardConfig {
  const boardId = loadedBoardConfig.id || nanoid(); 

  const validatedSettings: BoardSettings = {
    ...DEFAULT_BOARD_SETTINGS,
    ...loadedBoardConfig.settings,
    name: loadedBoardConfig.settings.name || DEFAULT_BOARD_SETTINGS.name,
    numberOfTiles: Math.max(MIN_TILES, Math.min(MAX_TILES, loadedBoardConfig.settings.numberOfTiles || DEFAULT_BOARD_SETTINGS.numberOfTiles)),
    numberOfPlayers: Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, loadedBoardConfig.settings.numberOfPlayers || DEFAULT_BOARD_SETTINGS.numberOfPlayers)),
    punishmentType: loadedBoardConfig.settings.punishmentType && ['none', 'revertMove', 'moveBackFixed', 'moveBackLevelBased'].includes(loadedBoardConfig.settings.punishmentType) 
                      ? loadedBoardConfig.settings.punishmentType 
                      : (loadedBoardConfig.settings.punishmentMode === true ? 'revertMove' : (loadedBoardConfig.settings.punishmentMode === false ? 'none' : DEFAULT_BOARD_SETTINGS.punishmentType)),
    punishmentValue: typeof loadedBoardConfig.settings.punishmentValue === 'number' ? loadedBoardConfig.settings.punishmentValue : DEFAULT_BOARD_SETTINGS.punishmentValue,
    randomizeTiles: typeof loadedBoardConfig.settings.randomizeTiles === 'boolean' ? loadedBoardConfig.settings.randomizeTiles : DEFAULT_BOARD_SETTINGS.randomizeTiles,
    diceSides: typeof loadedBoardConfig.settings.diceSides === 'number' ? loadedBoardConfig.settings.diceSides : DEFAULT_BOARD_SETTINGS.diceSides,
    winningCondition: loadedBoardConfig.settings.winningCondition && ['firstToFinish', 'highestScore', 'combinedOrderScore'].includes(loadedBoardConfig.settings.winningCondition)
                      ? loadedBoardConfig.settings.winningCondition
                      : DEFAULT_BOARD_SETTINGS.winningCondition,
    boardBackgroundImage: loadedBoardConfig.settings.boardBackgroundImage,
    epilepsySafeMode: typeof loadedBoardConfig.settings.epilepsySafeMode === 'boolean' ? loadedBoardConfig.settings.epilepsySafeMode : DEFAULT_BOARD_SETTINGS.epilepsySafeMode,
  };
  delete (validatedSettings as any).punishmentMode;


  const validatedTiles = (loadedBoardConfig.tiles || []).map((tile: Partial<Tile>, index: number) => {
    const newTile: Tile = {
      id: tile.id || nanoid(), 
      type: tile.type && ['empty', 'start', 'finish', 'quiz', 'info', 'reward'].includes(tile.type) ? tile.type : 'empty',
      position: typeof tile.position === 'number' ? tile.position : index,
      ui: {
        color: tile.ui?.color,
        icon: tile.ui?.icon,
      },
      config: undefined,
    };

    if (newTile.type === 'quiz' && tile.config) {
      const quizConfig = tile.config as Partial<TileConfigQuiz>;
      let difficulty = quizConfig.difficulty;
      if (typeof difficulty !== 'number' || ![1, 2, 3].includes(difficulty)) {
        difficulty = 1;
      }
      newTile.config = {
        question: typeof quizConfig.question === 'string' ? quizConfig.question : '',
        questionImage: typeof quizConfig.questionImage === 'string' ? quizConfig.questionImage : undefined,
        options: Array.isArray(quizConfig.options) ? quizConfig.options.map(opt => ({
          id: opt.id || nanoid(), 
          text: typeof opt.text === 'string' ? opt.text : '',
          isCorrect: typeof opt.isCorrect === 'boolean' ? opt.isCorrect : false,
          image: typeof opt.image === 'string' ? opt.image : undefined,
        })) : [],
        difficulty: difficulty as 1 | 2 | 3,
        points: DIFFICULTY_POINTS[difficulty as 1 | 2 | 3] || DIFFICULTY_POINTS[1],
      };
      if ((newTile.config as TileConfigQuiz).options.length > 0) {
        const options = (newTile.config as TileConfigQuiz).options;
        const correctOptions = options.filter(opt => opt.isCorrect);
        if (correctOptions.length === 0) {
          options[0].isCorrect = true;
        } else if (correctOptions.length > 1) {
          options.forEach(opt => opt.isCorrect = false);
          options[0].isCorrect = true; 
        }
      }

    } else if (newTile.type === 'info' && tile.config) {
      const infoConfig = tile.config as Partial<TileConfigInfo>;
      newTile.config = {
        message: typeof infoConfig.message === 'string' ? infoConfig.message : '',
        image: typeof infoConfig.image === 'string' ? infoConfig.image : undefined,
      };
    } else if (newTile.type === 'reward' && tile.config) {
      const rewardConfig = tile.config as Partial<TileConfigReward>;
      newTile.config = {
        message: typeof rewardConfig.message === 'string' ? rewardConfig.message : '',
        points: typeof rewardConfig.points === 'number' ? rewardConfig.points : 0,
      };
    }
    return newTile;
  });

  return {
    id: boardId,
    settings: validatedSettings,
    tiles: validatedTiles,
  };
}


function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'SET_INITIAL_BOARD_DATA': {
      const { boardConfig: rawBoardConfigFromLoad, persistedPlayState } = action.payload;
      
      // Sanitize and set this as the original board. Content translation will happen based on this.
      const newOriginalBoardConfig = sanitizeAndValidateBoardConfig(rawBoardConfigFromLoad);
      
      // Apply randomization to a copy that will become the initial display board.
      // Persisted active tile is passed here in case randomization is off and we want to preserve quiz option order.
      const initialDisplayBoard = applyBoardRandomizationSettings(
        JSON.parse(JSON.stringify(newOriginalBoardConfig)), // Deep copy for randomization
        persistedPlayState?.activeTileForInteraction 
      );

      let players = generatePlayers(newOriginalBoardConfig.settings.numberOfPlayers);
      let currentPlayerIndex = 0;
      let gameStatus: GameStatus = persistedPlayState?.gameStatus ?? 'playing';
      let activeTileForInteraction: Tile | null = null; // Will be derived from originalBoardConfig
      let winner: Player | null = persistedPlayState?.winner ?? null;
      let diceRoll: number | null = persistedPlayState?.diceRoll ?? null;
      let logs: LogEntry[] = persistedPlayState?.logs ?? [];
      let playersFinishedCount = persistedPlayState?.playersFinishedCount ?? 0;
      let pawnAnimation: PawnAnimation | null = null;

      if (persistedPlayState?.gameStatus === 'animating_pawn') {
         gameStatus = 'playing'; 
      }

      if (persistedPlayState?.players) {
        if (persistedPlayState.players.length === newOriginalBoardConfig.settings.numberOfPlayers) {
          players = persistedPlayState.players.map(p => ({
            ...generatePlayers(1)[0], 
            ...p,
            visualPosition: p.position, 
          }));
        } else {
          logs = addLogEntry(logs, 'log.event.playerMismatch', 'game_event');
        }
        currentPlayerIndex = persistedPlayState.currentPlayerIndex ?? 0;
      }
      
      // If a tile interaction was persisted, find the corresponding tile from the *original* board config.
      // The display board (initialDisplayBoard) might have shuffled quiz options if randomization is on.
      // The activeTileForInteraction in state should reflect the content as it will be after potential translation.
      if (persistedPlayState?.activeTileForInteraction) {
        const persistedTile = persistedPlayState.activeTileForInteraction;
        const originalMatchingTile = newOriginalBoardConfig.tiles.find(t => t.position === persistedTile.position);
        if (originalMatchingTile) {
            // If the game was saved mid-quiz, we need to ensure the options order of activeTileForInteraction matches
            // what applyBoardRandomizationSettings might have done (or not done) to initialDisplayBoard.
            // The simplest is to take the tile from initialDisplayBoard (which has correct option order for display).
            activeTileForInteraction = initialDisplayBoard.tiles.find(t => t.position === persistedTile.position) || null;
        }
      }


      if (logs.length === 0 && !persistedPlayState) { 
        logs = addLogEntry(logs, 'log.event.gameStarted', 'game_event', { name: newOriginalBoardConfig.settings.name });
      }

      if (gameStatus === 'finished' && !winner && persistedPlayState?.winner) {
          winner = persistedPlayState.winner;
      }

      return {
        ...initialState,
        originalBoardConfig: newOriginalBoardConfig, // Store the pristine, original board
        boardConfig: initialDisplayBoard, // Display board, possibly randomized options
        players,
        currentPlayerIndex,
        gameStatus,
        activeTileForInteraction,
        winner,
        diceRoll,
        logs,
        playersFinishedCount,
        pawnAnimation,
        isLoading: false, // Board is loaded, translation useEffect will handle if needed
        error: null
      };
    }
    case 'UPDATE_BOARD_SETTINGS': {
      if (!state.originalBoardConfig) return state; // Should operate on original
      const updatedSettings = { ...state.originalBoardConfig.settings, ...action.payload };
      const newOriginalBoardConfig = { ...state.originalBoardConfig, settings: updatedSettings };
      
      let updatedPlayers = state.players;
      if (action.payload.numberOfPlayers !== undefined && action.payload.numberOfPlayers !== state.originalBoardConfig.settings.numberOfPlayers) {
        updatedPlayers = generatePlayers(action.payload.numberOfPlayers);
      }

      // The useEffect for language change will pick up the new originalBoardConfig and trigger re-translation
      return {
        ...state,
        originalBoardConfig: newOriginalBoardConfig,
        // boardConfig will be updated by the translation effect
        players: updatedPlayers.map(p => ({...p, visualPosition: p.position})), 
        isLoading: true, // Indicate that changes might trigger re-translation
      };
    }
    case 'UPDATE_TILES': {
      if (!state.originalBoardConfig) return state;
      const newOriginalBoardConfig = { ...state.originalBoardConfig, tiles: action.payload };
      // The useEffect for language change will pick up the new originalBoardConfig and trigger re-translation
      return {
        ...state,
        originalBoardConfig: newOriginalBoardConfig,
        isLoading: true, // Indicate that changes might trigger re-translation
      };
    }
    case 'SET_PLAYERS':
      return { ...state, players: action.payload.map(p => ({...p, visualPosition: p.position})) };
    case 'START_LOADING': // Generic loading, can be used by translation start
      return { ...state, isLoading: true, error: null }; 
    case 'SET_ERROR':
      return { ...state, isLoading: false, error: action.payload, logs: addLogEntry(state.logs, 'log.event.errorOccurred', 'game_event', { error: action.payload }) };
    case 'TRANSLATION_STARTED':
      return { ...state, isLoading: true };
    case 'TRANSLATION_FINISHED':
      return { ...state, boardConfig: action.payload, isLoading: false, activeTileForInteraction: state.activeTileForInteraction ? action.payload.tiles.find(t => t.position === state.activeTileForInteraction!.position) || null : null };
    case 'SET_DISPLAY_BOARD': // Used when setting board to original language without API
      return { ...state, boardConfig: action.payload, isLoading: false, activeTileForInteraction: state.activeTileForInteraction ? action.payload.tiles.find(t => t.position === state.activeTileForInteraction!.position) || null : null };

     case 'PLAYER_ROLLED_DICE': {
      // This logic should use state.boardConfig (the displayed, possibly translated board) for tile interactions
      if (!state.boardConfig || state.gameStatus !== 'playing' || state.winner || state.players[state.currentPlayerIndex].hasFinished) return state;

      const { diceValue } = action.payload;
      const currentPlayer = state.players[state.currentPlayerIndex];
      const maxPosition = state.boardConfig.tiles.length - 1;
      let currentLogs = state.logs;

      let targetPosition = currentPlayer.position + diceValue;
      if (targetPosition > maxPosition) targetPosition = maxPosition;
      
      currentLogs = addLogEntry(currentLogs, 'log.playerRolled', 'roll', { name: currentPlayer.name, value: diceValue });

      if (targetPosition === currentPlayer.position) { 
        currentLogs = addLogEntry(currentLogs, 'log.noMove', 'move', { name: currentPlayer.name, position: currentPlayer.position + 1 });
        let nextPlayerIndex = state.currentPlayerIndex;
        if (!state.winner) { 
            let attempts = 0;
            do {
                nextPlayerIndex = (nextPlayerIndex + 1) % state.players.length;
                attempts++;
            } while (state.players[nextPlayerIndex].hasFinished && attempts <= state.players.length);
        }

        return {
            ...state,
            diceRoll: diceValue,
            activeTileForInteraction: null, 
            gameStatus: 'playing', 
            logs: currentLogs,
            currentPlayerIndex: nextPlayerIndex, 
        };
      }

      const path: number[] = [];
      for (let i = currentPlayer.position + 1; i <= targetPosition; i++) {
        path.push(i);
      }
      
      if (state.pawnAnimation?.timerId) {
        clearTimeout(state.pawnAnimation.timerId);
      }

      return {
        ...state,
        diceRoll: diceValue,
        gameStatus: 'animating_pawn',
        pawnAnimation: {
          playerId: currentPlayer.id,
          path,
          currentStepIndex: -1,
          timerId: null,
        },
        logs: currentLogs,
      };
    }
    case 'ADVANCE_PAWN_ANIMATION': {
      if (!state.pawnAnimation || state.gameStatus !== 'animating_pawn' || !state.boardConfig) return state;

      const newPlayers = [...state.players];
      const playerIndex = newPlayers.findIndex(p => p.id === state.pawnAnimation!.playerId);
      if (playerIndex === -1) return state; 

      const newStepIndex = state.pawnAnimation.currentStepIndex + 1;
      const currentPathStep = state.pawnAnimation.path[newStepIndex];
      
      newPlayers[playerIndex] = { ...newPlayers[playerIndex], visualPosition: currentPathStep };
      playSound('pawnHop');

      if (newStepIndex === state.pawnAnimation.path.length - 1) { 
        newPlayers[playerIndex] = { ...newPlayers[playerIndex], position: currentPathStep };
        
        // Landed tile interaction uses the currently displayed (potentially translated) boardConfig
        let landedTile = state.boardConfig.tiles.find(t => t.position === currentPathStep);
        if (!landedTile) { // Should not happen if boardConfig is valid
             console.error("Landed tile not found in boardConfig during ADVANCE_PAWN_ANIMATION");
             return { ...state, pawnAnimation: null, gameStatus: 'playing' }; // Recover
        }
        // No need to re-shuffle quiz options here as it was handled by applyBoardRandomization or translation.
        
        let currentLogs = addLogEntry(state.logs, 'log.playerMovedTo', 'move', { name: newPlayers[playerIndex].name, position: currentPathStep + 1, tileType: landedTile.type });
        let newPlayersFinishedCount = state.playersFinishedCount;
        let gameWinner: Player | null = state.winner;
        let newGameStatus: GameStatus = 'interaction_pending';

        if (landedTile.type === 'finish' && !newPlayers[playerIndex].hasFinished) {
          playSound('finishSound');
          newPlayersFinishedCount++;
          newPlayers[playerIndex] = { ...newPlayers[playerIndex], hasFinished: true, finishOrder: newPlayersFinishedCount };
          currentLogs = addLogEntry(currentLogs, 'log.playerFinished', 'game_event', { name: newPlayers[playerIndex].name, finishOrder: newPlayers[playerIndex].finishOrder || undefined });
          if (state.boardConfig.settings.winningCondition === 'firstToFinish' && !gameWinner) {
            gameWinner = newPlayers[playerIndex];
            currentLogs = addLogEntry(currentLogs, 'log.firstToFinishWinner', 'winner', { name: gameWinner.name, score: gameWinner.score });
          }
        }

        return {
          ...state,
          players: newPlayers,
          pawnAnimation: null,
          activeTileForInteraction: { ...landedTile }, // Ensure it's a copy from the display board
          gameStatus: newGameStatus,
          logs: currentLogs,
          playersFinishedCount: newPlayersFinishedCount,
          winner: gameWinner,
        };
      } else { 
        const timerId = setTimeout(() => {
          if (gameReducerInstanceRef.current) { 
            gameReducerInstanceRef.current.dispatch({ type: 'ADVANCE_PAWN_ANIMATION' });
          }
        }, state.boardConfig.settings.epilepsySafeMode ? PAWN_ANIMATION_STEP_DELAY * 2 : PAWN_ANIMATION_STEP_DELAY);
        return {
          ...state,
          players: newPlayers,
          pawnAnimation: { ...state.pawnAnimation, currentStepIndex: newStepIndex, timerId },
        };
      }
    }
    case 'ANSWER_QUIZ': {
        // This interaction should use state.activeTileForInteraction, which comes from the displayed (translated) board.
        if (!state.boardConfig || !state.activeTileForInteraction || state.activeTileForInteraction.type !== 'quiz' || state.gameStatus !== 'interaction_pending' || state.diceRoll === null) return state;

        const { selectedOptionId } = action.payload;
        const quizConfig = state.activeTileForInteraction.config as TileConfigQuiz;
        const selectedOption = quizConfig.options.find(opt => opt.id === selectedOptionId);
        const currentPlayer = state.players[state.currentPlayerIndex];
        const newPlayers = [...state.players];
        const boardSettings = state.boardConfig.settings; // Use settings from displayed board
        let currentLogs = state.logs;

        let newScore = currentPlayer.score;
        let newPosition = currentPlayer.position; 
        let newVisualPosition = currentPlayer.visualPosition; 
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
            
            if (boardSettings.punishmentType !== 'none') {
                const punishmentDetails = getPunishmentLogDetails(boardSettings.punishmentType, boardSettings.punishmentValue, quizConfig.difficulty, state.diceRoll);
                if (punishmentDetails) {
                    currentLogs = addLogEntry(currentLogs, 'log.punishmentApplied', 'punishment', { name: currentPlayer.name, detailsKey: punishmentDetails.key, ...punishmentDetails.params });
                }

                let tempNewPosition = newPosition; 
                switch (boardSettings.punishmentType) {
                    case 'revertMove':
                        tempNewPosition = Math.max(0, newPosition - state.diceRoll);
                        break;
                    case 'moveBackFixed':
                        tempNewPosition = Math.max(0, newPosition - boardSettings.punishmentValue);
                        break;
                    case 'moveBackLevelBased':
                        let moveBackAmount = 0;
                        if (quizConfig.difficulty === 1) moveBackAmount = 1;
                        else if (quizConfig.difficulty === 2) moveBackAmount = 2;
                        else if (quizConfig.difficulty === 3) moveBackAmount = 3;
                        tempNewPosition = Math.max(0, newPosition - moveBackAmount);
                        break;
                }
                newPosition = tempNewPosition;
                newVisualPosition = tempNewPosition; 
            }
        }
        playSound(soundToPlay);
        newPlayers[state.currentPlayerIndex] = { ...currentPlayer, score: newScore, position: newPosition, visualPosition: newVisualPosition, currentStreak: newStreak };

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
            playSound('correctAnswer'); 
            currentLogs = addLogEntry(currentLogs, 'log.rewardCollected', 'reward', { name: currentPlayer.name, points: rewardConfig.points || 0 });
        } else if (state.activeTileForInteraction.type === 'info') {
             currentLogs = addLogEntry(currentLogs, 'log.infoAcknowledged', 'info', { name: currentPlayer.name });
        } else if (['empty', 'start'].includes(state.activeTileForInteraction.type)) { 
            currentLogs = addLogEntry(currentLogs, 'log.landedOnSimpleTile', 'move', { name: currentPlayer.name, tileType: state.activeTileForInteraction.type});
        }
        return { ...state, players: newPlayers, logs: currentLogs };
    }

    case 'PROCEED_TO_NEXT_TURN': {
        if (!state.boardConfig || state.gameStatus === 'finished' || state.gameStatus === 'animating_pawn') return state;

        let currentLogs = state.logs;
        let currentWinner = state.winner; 
        let gameIsFinished = !!currentWinner;
        const winningCondition = state.boardConfig.settings.winningCondition;
        const allPlayersHaveFinished = state.playersFinishedCount === state.players.length && state.players.length > 0;

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
                    if (prev.combinedScore === undefined) return current;
                    if (current.combinedScore === undefined) return prev;
                    if (prev.combinedScore === current.combinedScore) { 
                        if (prev.finishOrder === current.finishOrder) { 
                           return prev.score > current.score ? prev : current; 
                        }
                        return (prev.finishOrder || Infinity) < (current.finishOrder || Infinity) ? prev : current; 
                    }
                    return prev.combinedScore > current.combinedScore ? prev : current; 
                }, playersWithCombinedScore[0]);

                if (currentWinner) {
                    playSound('finishSound');
                    const winnerData = playersWithCombinedScore.find(p => p.id === currentWinner!.id);
                    currentLogs = addLogEntry(currentLogs, 'log.combinedScoreWinner', 'winner', { 
                        name: winnerData!.name, 
                        score: winnerData!.combinedScore || 0,
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
        }

        return {
            ...state,
            currentPlayerIndex: gameIsFinished ? state.currentPlayerIndex : nextPlayerIndex,
            activeTileForInteraction: null,
            diceRoll: null,
            gameStatus: gameIsFinished ? 'finished' : 'playing',
            winner: currentWinner,
            logs: currentLogs
        };
    }
    case 'RESET_GAME_FOR_PLAY': {
      if (!state.originalBoardConfig) return state; // Need original to reset from
      try {
        localStorage.removeItem(`boardwise-play-state-${state.originalBoardConfig.id}`);
      } catch (e) {
        console.warn("Failed to remove play state from localStorage on reset", e);
      }
      
      if (state.pawnAnimation?.timerId) {
        clearTimeout(state.pawnAnimation.timerId);
      }

      // Re-apply randomization to a fresh copy of originalBoardConfig
      const reRandomizedBoardConfigForDisplay = applyBoardRandomizationSettings(
        JSON.parse(JSON.stringify(state.originalBoardConfig)), // Deep copy from original
        null
      );
      const players = generatePlayers(state.originalBoardConfig.settings.numberOfPlayers);
      let initialLogs = addLogEntry([], 'log.event.gameReset', 'game_event');
      initialLogs = addLogEntry(initialLogs, 'log.event.gameStarted', 'game_event', { name: state.originalBoardConfig.settings.name });

      // The useEffect for language change will handle translating reRandomizedBoardConfigForDisplay if needed
      return {
        ...initialState,
        originalBoardConfig: state.originalBoardConfig, // Keep the original
        boardConfig: reRandomizedBoardConfigForDisplay, // Set display board
        players,
        isLoading: false, // Or true if immediate translation is expected by useEffect
        gameStatus: 'playing',
        logs: initialLogs,
      };
    }
    case 'UPDATE_PLAYER_NAME': {
      const { playerId, newName } = action.payload;
      const playerIndex = state.players.findIndex(p => p.id === playerId);
      if (playerIndex === -1) return state;

      const updatedPlayers = [...state.players];
      const oldName = updatedPlayers[playerIndex].name;
      updatedPlayers[playerIndex] = { ...updatedPlayers[playerIndex], name: newName };
      
      const logs = addLogEntry(state.logs, 'log.playerNameChanged', 'player_update', { oldName, newName });

      return { ...state, players: updatedPlayers, logs };
    }
    default:
      return state;
  }
}

let gameReducerInstanceRef: React.MutableRefObject<{ dispatch: React.Dispatch<GameAction> } | null> = { current: null };


export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const languageContext = useLanguage();
  
  const localDispatchRef = useRef<{ dispatch: React.Dispatch<GameAction> }>({ dispatch });
  useEffect(() => {
    localDispatchRef.current.dispatch = dispatch;
    gameReducerInstanceRef = localDispatchRef; 
  }, [dispatch]);


  useEffect(() => {
    if (state.gameStatus === 'animating_pawn' && state.pawnAnimation && state.pawnAnimation.currentStepIndex === -1) {
       if (!state.pawnAnimation.timerId) { 
           const timerId = setTimeout(() => {
             if (gameReducerInstanceRef.current) {
                gameReducerInstanceRef.current.dispatch({ type: 'ADVANCE_PAWN_ANIMATION' });
             }
           }, state.boardConfig?.settings.epilepsySafeMode ? PAWN_ANIMATION_STEP_DELAY * 2 : PAWN_ANIMATION_STEP_DELAY / 2);
       }
    }
    
    return () => {
      if (state.pawnAnimation?.timerId) {
        clearTimeout(state.pawnAnimation.timerId);
      }
    };
  }, [state.gameStatus, state.pawnAnimation, state.boardConfig?.settings.epilepsySafeMode]);


  useEffect(() => {
    // Persist game state, but not the full originalBoardConfig, only IDs or essential references if needed.
    // For now, activeTileForInteraction might hold translated text. On load, it should be re-derived/re-translated.
    if (state.originalBoardConfig && state.gameStatus !== 'setup' && !state.isLoading && state.gameStatus !== 'animating_pawn') {
      const persistState: PersistedPlayState = {
        players: state.players.map(({ visualPosition, ...rest }) => rest), 
        currentPlayerIndex: state.currentPlayerIndex,
        diceRoll: state.diceRoll,
        gameStatus: state.gameStatus, 
        activeTileForInteraction: state.activeTileForInteraction ? 
          { // Persist a minimal version or reference
            id: state.activeTileForInteraction.id, // ID from original board
            position: state.activeTileForInteraction.position,
            type: state.activeTileForInteraction.type,
            // Persisting full config here can be heavy and redundant if originalBoardConfig is source of truth.
            // For quiz options, if they were shuffled and one was selected, that specific shuffle might be lost
            // unless the activeTileForInteraction in state reflects that.
            // Let's persist the activeTileForInteraction as is from state.boardConfig.
            config: state.activeTileForInteraction.config,
            ui: state.activeTileForInteraction.ui,
          } : null,
        winner: state.winner,
        logs: state.logs,
        playersFinishedCount: state.playersFinishedCount,
      };
      try {
        localStorage.setItem(`boardwise-play-state-${state.originalBoardConfig.id}`, JSON.stringify(persistState));
      } catch (e) {
        console.warn("Failed to save play state to localStorage", e);
      }
    }
  }, [state.players, state.currentPlayerIndex, state.diceRoll, state.gameStatus, state.activeTileForInteraction, state.winner, state.logs, state.playersFinishedCount, state.originalBoardConfig, state.isLoading, state.boardConfig]);


  // Effect for handling board content translation on language change
  useEffect(() => {
    const { language: currentUiLanguage } = languageContext;

    const translateBoardIfNeeded = async () => {
      if (!state.originalBoardConfig) return;

      if (currentUiLanguage === ASSUMED_ORIGINAL_BOARD_LANGUAGE) {
        // If current UI language is the assumed original, set display board to original (if not already)
        // This check prevents re-dispatching if boardConfig is already the original one.
        if (!state.boardConfig || state.boardConfig.id !== state.originalBoardConfig.id || 
            JSON.stringify(state.boardConfig.tiles) !== JSON.stringify(state.originalBoardConfig.tiles) ||
            JSON.stringify(state.boardConfig.settings) !== JSON.stringify(state.originalBoardConfig.settings) ) {
          dispatch({ type: 'SET_DISPLAY_BOARD', payload: JSON.parse(JSON.stringify(state.originalBoardConfig)) });
        }
        return;
      }

      // Otherwise, translate from originalBoardConfig to currentUiLanguage
      dispatch({ type: 'TRANSLATION_STARTED' });

      const boardToTranslate = JSON.parse(JSON.stringify(state.originalBoardConfig)) as BoardConfig;

      boardToTranslate.settings.name = await translateTextCached(
        state.originalBoardConfig.settings.name, // Translate from original
        currentUiLanguage,
        ASSUMED_ORIGINAL_BOARD_LANGUAGE
      );

      const tilePromises = boardToTranslate.tiles.map(async (tile, index) => {
        const originalTile = state.originalBoardConfig!.tiles[index]; // Get corresponding original tile
        if (originalTile.config) {
          tile.config = JSON.parse(JSON.stringify(originalTile.config)); // Start from original config
          if (tile.type === 'quiz' && tile.config) {
            const config = tile.config as TileConfigQuiz;
            const originalConfig = originalTile.config as TileConfigQuiz;
            config.question = await translateTextCached(originalConfig.question, currentUiLanguage, ASSUMED_ORIGINAL_BOARD_LANGUAGE);
            const optionPromises = config.options.map(async (option, optIndex) => {
              const originalOption = originalConfig.options[optIndex];
              option.text = await translateTextCached(originalOption.text, currentUiLanguage, ASSUMED_ORIGINAL_BOARD_LANGUAGE);
            });
            await Promise.all(optionPromises);
          } else if (tile.type === 'info' && tile.config) {
            const config = tile.config as TileConfigInfo;
            const originalConfig = originalTile.config as TileConfigInfo;
            config.message = await translateTextCached(originalConfig.message, currentUiLanguage, ASSUMED_ORIGINAL_BOARD_LANGUAGE);
          } else if (tile.type === 'reward' && tile.config) {
            const config = tile.config as TileConfigReward;
            const originalConfig = originalTile.config as TileConfigReward;
            config.message = await translateTextCached(originalConfig.message, currentUiLanguage, ASSUMED_ORIGINAL_BOARD_LANGUAGE);
          }
        }
        return tile;
      });
      
      boardToTranslate.tiles = await Promise.all(tilePromises);
      dispatch({ type: 'TRANSLATION_FINISHED', payload: boardToTranslate });
    };

    if (state.originalBoardConfig) {
      translateBoardIfNeeded();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [languageContext.language, state.originalBoardConfig]); // Only run if language or original board changes.


  const initializeNewBoard = useCallback(() => {
    dispatch({ type: 'START_LOADING' });
    if (state.pawnAnimation?.timerId) clearTimeout(state.pawnAnimation.timerId);
    
    const newBoardData: Partial<BoardConfig> & { settings: Partial<BoardSettings> } = {
        // id will be generated by sanitizeAndValidateBoardConfig
        settings: { ...DEFAULT_BOARD_SETTINGS },
        tiles: Array.from({ length: DEFAULT_BOARD_SETTINGS.numberOfTiles }, (_, i) => ({
          id: nanoid(), // Assign initial ID here
          type: 'empty',
          position: i,
          ui: { icon: TILE_TYPE_EMOJIS.empty, color: DEFAULT_TILE_COLOR },
        } as Partial<Tile>)),
      };

    if (newBoardData.tiles && newBoardData.tiles.length > 0) {
        (newBoardData.tiles[0] as Tile).type = 'start';
        (newBoardData.tiles[0] as Tile).ui = { icon: TILE_TYPE_EMOJIS.start, color: START_TILE_COLOR };
        if (newBoardData.tiles.length > 1) {
            (newBoardData.tiles[newBoardData.tiles.length - 1] as Tile).type = 'finish';
            (newBoardData.tiles[newBoardData.tiles.length - 1] as Tile).ui = { icon: TILE_TYPE_EMOJIS.finish, color: FINISH_TILE_COLOR };
        }
    }
    
    const newBoardConfig = sanitizeAndValidateBoardConfig(newBoardData as any); // Sanitize generates final IDs for tiles
    dispatch({ type: 'SET_INITIAL_BOARD_DATA', payload: { boardConfig: newBoardConfig } });
  }, [state.pawnAnimation?.timerId]);

  const loadBoardFromBase64 = useCallback((rawBase64Data: string) => {
    dispatch({ type: 'START_LOADING' });
    if (state.pawnAnimation?.timerId) clearTimeout(state.pawnAnimation.timerId);
    let boardConfigToLoad: BoardConfig | null = null;
    let persistedPlayState: PersistedPlayState | null = null;
    try {
      const binaryString = atob(rawBase64Data);
      const jsonString = decodeURIComponent(escape(binaryString)); 
      const rawBoardData = JSON.parse(jsonString) as Partial<BoardConfig> & { settings: Partial<BoardSettings> & { punishmentMode?: boolean } };

      if (rawBoardData && rawBoardData.settings && rawBoardData.tiles) {
        boardConfigToLoad = sanitizeAndValidateBoardConfig(rawBoardData); // Sanitize first
        
        try {
          const storedState = localStorage.getItem(`boardwise-play-state-${boardConfigToLoad.id}`);
          if (storedState) {
            persistedPlayState = JSON.parse(storedState) as PersistedPlayState;
          }
        } catch (e) {
          console.warn("Failed to load persisted play state from localStorage", e);
          persistedPlayState = null;
        }
        dispatch({ type: 'SET_INITIAL_BOARD_DATA', payload: { boardConfig: boardConfigToLoad, persistedPlayState } });
      } else {
        throw new Error("Invalid board data structure from Base64.");
      }
    } catch (error) {
      console.error("Failed to load board from Base64:", error);
      let errorMessage = 'Failed to load board data from link. The link might be corrupted or invalid.';
      if (error instanceof Error) {
          errorMessage += ` Details: ${error.message}`;
      }
      if (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'InvalidCharacterError') {
          errorMessage = 'Failed to decode board data (Invalid Base64). The link may be corrupted.';
      }
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, [dispatch, state.pawnAnimation?.timerId]);

  const loadBoardFromJson = useCallback((jsonString: string): boolean => {
    dispatch({ type: 'START_LOADING' });
    if (state.pawnAnimation?.timerId) clearTimeout(state.pawnAnimation.timerId);
    let boardConfigToLoad: BoardConfig | null = null;
    let persistedPlayState: PersistedPlayState | null = null;
    try {
      const rawBoardData = JSON.parse(jsonString) as Partial<BoardConfig> & { settings: Partial<BoardSettings> & { punishmentMode?: boolean } };
      if (rawBoardData && rawBoardData.settings && rawBoardData.tiles) {
         boardConfigToLoad = sanitizeAndValidateBoardConfig(rawBoardData);
        try {
          const storedState = localStorage.getItem(`boardwise-play-state-${boardConfigToLoad.id}`);
          if (storedState) {
            persistedPlayState = JSON.parse(storedState) as PersistedPlayState;
          }
        } catch (e) {
          console.warn("Failed to load persisted play state from localStorage for JSON import", e);
          persistedPlayState = null;
        }
        dispatch({ type: 'SET_INITIAL_BOARD_DATA', payload: { boardConfig: boardConfigToLoad, persistedPlayState } });
        return true;
      } else {
        throw new Error("Invalid board data structure from JSON file.");
      }
    } catch (error) {
      console.error("Failed to load board from JSON:", error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load board from file. The file might be corrupted or not a valid BoardWise configuration.' });
      return false;
    }
  }, [dispatch, state.pawnAnimation?.timerId]);

  const randomizeTileVisuals = useCallback(() => {
    // This should now update originalBoardConfig if we want randomization to be part of the "source"
    // Or, it just updates the current display boardConfig temporarily.
    // For simplicity, let's assume it updates the original and triggers re-translation.
    if (state.originalBoardConfig) {
        const tempRandomizedBoardConfig = applyBoardRandomizationSettings({
            ...state.originalBoardConfig, // Randomize based on original
            settings: {...state.originalBoardConfig.settings, randomizeTiles: true } 
        }, null); // Active tile for interaction isn't relevant for this operation directly

        // This will update originalBoardConfig, and the useEffect will handle translation.
        dispatch({ type: 'UPDATE_TILES', payload: tempRandomizedBoardConfig.tiles });
        // We might also want to dispatch SET_DISPLAY_BOARD if the current language is ASSUMED_ORIGINAL_BOARD_LANGUAGE
        // to immediately reflect randomization without waiting for translation cycle.
        if (languageContext.language === ASSUMED_ORIGINAL_BOARD_LANGUAGE) {
            dispatch({ type: 'SET_DISPLAY_BOARD', payload: tempRandomizedBoardConfig });
        }
    }
  }, [state.originalBoardConfig, dispatch, languageContext.language]);


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
