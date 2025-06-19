
"use client";

import type { ReactNode } from 'react';
import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';
import type { BoardConfig, GameState, Player, Tile, TileConfigQuiz, TileConfigReward, QuizOption, GameStatus, PersistedPlayState, PunishmentType, LogEntry, BoardSettings, PawnAnimation } from '@/types';
import { DEFAULT_BOARD_SETTINGS }
  from '@/types';
import { DEFAULT_TILE_COLOR, FINISH_TILE_COLOR, MAX_PLAYERS, MAX_TILES, MIN_PLAYERS, MIN_TILES, PLAYER_COLORS, RANDOM_COLORS, RANDOM_EMOJIS, START_TILE_COLOR, TILE_TYPE_EMOJIS, DIFFICULTY_POINTS } from '@/lib/constants';
import { nanoid } from 'nanoid';
import { playSound } from '@/lib/sound-service';
import { shuffleArray } from '@/lib/utils';

const PAWN_ANIMATION_STEP_DELAY = 500; 

type GameAction =
  | { type: 'SET_BOARD_CONFIG'; payload: { boardConfig: BoardConfig; persistedPlayState?: PersistedPlayState | null } }
  | { type: 'UPDATE_BOARD_SETTINGS'; payload: Partial<BoardConfig['settings']> }
  | { type: 'UPDATE_TILES'; payload: Tile[] }
  | { type: 'SET_PLAYERS'; payload: Player[] }
  | { type: 'START_LOADING' }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'PLAYER_ROLLED_DICE'; payload: { diceValue: number } }
  | { type: 'ADVANCE_PAWN_ANIMATION' }
  | { type: 'ANSWER_QUIZ'; payload: { selectedOptionId: string } }
  | { type: 'ACKNOWLEDGE_INTERACTION' }
  | { type: 'PROCEED_TO_NEXT_TURN' }
  | { type: 'RESET_GAME_FOR_PLAY' }
  | { type: 'UPDATE_PLAYER_NAME', payload: { playerId: string; newName: string }};


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
        quizConfig.options = (persistedActiveTile.config as TileConfigQuiz).options;
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
      id: nanoid(), 
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
        console.warn(`Invalid quiz difficulty '${difficulty}' for tile at pos ${newTile.position}. Defaulting to 1.`);
        difficulty = 1;
      }
      newTile.config = {
        question: typeof quizConfig.question === 'string' ? quizConfig.question : '',
        questionImage: typeof quizConfig.questionImage === 'string' ? quizConfig.questionImage : undefined,
        options: Array.isArray(quizConfig.options) ? quizConfig.options.map(opt => ({
          id: nanoid(), 
          text: typeof opt.text === 'string' ? opt.text : '',
          isCorrect: typeof opt.isCorrect === 'boolean' ? opt.isCorrect : false,
          image: typeof opt.image === 'string' ? opt.image : undefined,
        })) : [],
        difficulty: difficulty as 1 | 2 | 3,
        points: DIFFICULTY_POINTS[difficulty as 1 | 2 | 3] || DIFFICULTY_POINTS[1],
      };
      // Ensure at least one option is correct if options exist, and only one is correct
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
    case 'SET_BOARD_CONFIG': {
      const { boardConfig: rawBoardConfig, persistedPlayState } = action.payload;
      let processedBoardConfig = applyBoardRandomizationSettings(rawBoardConfig, persistedPlayState?.activeTileForInteraction);

      let players = generatePlayers(processedBoardConfig.settings.numberOfPlayers);
      let currentPlayerIndex = 0;
      let gameStatus: GameStatus = persistedPlayState?.gameStatus ?? 'playing';
      let activeTileForInteraction: Tile | null = persistedPlayState?.activeTileForInteraction ?? null;
      let winner: Player | null = persistedPlayState?.winner ?? null;
      let diceRoll: number | null = persistedPlayState?.diceRoll ?? null;
      let logs: LogEntry[] = persistedPlayState?.logs ?? [];
      let playersFinishedCount = persistedPlayState?.playersFinishedCount ?? 0;
      let pawnAnimation: PawnAnimation | null = null; 

      if (persistedPlayState?.gameStatus === 'animating_pawn') {
         gameStatus = 'playing'; 
      }


      if (persistedPlayState?.players) {
        if (persistedPlayState.players.length === processedBoardConfig.settings.numberOfPlayers) {
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
        pawnAnimation,
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
        players: updatedPlayers.map(p => ({...p, visualPosition: p.position})), 
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
      return { ...state, players: action.payload.map(p => ({...p, visualPosition: p.position})) };
    case 'START_LOADING':
      return { ...state, isLoading: true, error: null, logs: state.logs }; 
    case 'SET_ERROR':
      return { ...state, isLoading: false, error: action.payload, logs: addLogEntry(state.logs, 'log.event.errorOccurred', 'game_event', { error: action.payload }) };
     case 'PLAYER_ROLLED_DICE': {
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

            const allFinished = state.players.every(p => p.hasFinished);
            if (allFinished && state.players.length > 0) {
                if (state.boardConfig.settings.winningCondition === 'highestScore' || state.boardConfig.settings.winningCondition === 'combinedOrderScore') {
                } else if (state.boardConfig.settings.winningCondition === 'firstToFinish' && state.winner) {
                }
            }
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
        
        let landedTile = { ...state.boardConfig.tiles[currentPathStep] };
        if (landedTile.type === 'quiz' && landedTile.config) {
          const quizConfig = { ...(landedTile.config as TileConfigQuiz) };
          if (quizConfig.options && quizConfig.options.length > 0) {
            quizConfig.options = shuffleArray([...quizConfig.options]); 
            landedTile.config = quizConfig;
          }
        }
        
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
          activeTileForInteraction: landedTile,
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
                    case 'none': 
                    default:
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
      if (!state.boardConfig) return state;
      try {
        localStorage.removeItem(`boardwise-play-state-${state.boardConfig.id}`);
      } catch (e) {
        console.warn("Failed to remove play state from localStorage on reset", e);
      }
      
      if (state.pawnAnimation?.timerId) {
        clearTimeout(state.pawnAnimation.timerId);
      }

      const reRandomizedBoardConfig = applyBoardRandomizationSettings(state.boardConfig, null);
      const players = generatePlayers(reRandomizedBoardConfig.settings.numberOfPlayers);
      let initialLogs = addLogEntry([], 'log.event.gameReset', 'game_event');
      initialLogs = addLogEntry(initialLogs, 'log.event.gameStarted', 'game_event', { name: reRandomizedBoardConfig.settings.name });

      return {
        ...initialState,
        boardConfig: reRandomizedBoardConfig,
        players,
        isLoading: false,
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
    if (state.boardConfig && state.gameStatus !== 'setup' && !state.isLoading && state.gameStatus !== 'animating_pawn') {
      const persistState: PersistedPlayState = {
        players: state.players.map(({ visualPosition, ...rest }) => rest), 
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
    if (state.pawnAnimation?.timerId) clearTimeout(state.pawnAnimation.timerId);
    
    const newBoardData: Partial<BoardConfig> & { settings: Partial<BoardSettings> } = {
        id: nanoid(),
        settings: { ...DEFAULT_BOARD_SETTINGS },
        tiles: Array.from({ length: DEFAULT_BOARD_SETTINGS.numberOfTiles }, (_, i) => ({
          // id will be generated by sanitizeAndValidateBoardConfig
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
    
    const newBoardConfig = sanitizeAndValidateBoardConfig(newBoardData as any);
    const processedBoardConfig = applyBoardRandomizationSettings(newBoardConfig, null);
    dispatch({ type: 'SET_BOARD_CONFIG', payload: { boardConfig: processedBoardConfig } });
  }, [state.pawnAnimation?.timerId]);

  const loadBoardFromBase64 = useCallback((rawBase64Data: string) => {
    dispatch({ type: 'START_LOADING' });
    if (state.pawnAnimation?.timerId) clearTimeout(state.pawnAnimation.timerId);
    let boardConfig: BoardConfig | null = null;
    let persistedPlayState: PersistedPlayState | null = null;
    try {
      const binaryString = atob(rawBase64Data);
      const jsonString = decodeURIComponent(escape(binaryString)); 
      
      const rawBoardData = JSON.parse(jsonString) as Partial<BoardConfig> & { settings: Partial<BoardSettings> & { punishmentMode?: boolean } };

      if (rawBoardData && rawBoardData.settings && rawBoardData.tiles) {
        boardConfig = sanitizeAndValidateBoardConfig(rawBoardData);
        
        try {
          const storedState = localStorage.getItem(`boardwise-play-state-${boardConfig.id}`);
          if (storedState) {
            persistedPlayState = JSON.parse(storedState) as PersistedPlayState;
            // Re-apply persisted quiz option order if it was for the currently active tile
            if (persistedPlayState.activeTileForInteraction && persistedPlayState.activeTileForInteraction.type === 'quiz') {
                const persistedQuizConfig = persistedPlayState.activeTileForInteraction.config as TileConfigQuiz;
                const boardTile = boardConfig.tiles.find(t => t.id === persistedPlayState.activeTileForInteraction?.id); // This ID comparison won't work due to new IDs. We need to compare position.
                const activePersistedTilePos = persistedPlayState.activeTileForInteraction.position;
                const currentBoardTileAtPos = boardConfig.tiles.find(t => t.position === activePersistedTilePos && t.type === 'quiz');

                if (currentBoardTileAtPos && currentBoardTileAtPos.config) {
                    // Ensure the options array matches in length before trying to apply.
                    // This handles cases where the board definition might have changed.
                    // For simplicity, we will let the new shuffle from applyBoardRandomizationSettings take precedence
                    // if randomizeTiles is on, or use the board's native option order.
                    // Persisting exact option order through storage for a potentially different board definition
                    // from a link is complex. The current tile.id regeneration makes direct mapping hard.
                    // The most important is that the content of activeTileForInteraction in persisted state is used if it's the same logical tile.
                    if(persistedPlayState.activeTileForInteraction.id === currentBoardTileAtPos.id && // Check if it IS the same tile based on old ID
                       (currentBoardTileAtPos.config as TileConfigQuiz).options.length === persistedQuizConfig.options.length
                    ) {
                       (currentBoardTileAtPos.config as TileConfigQuiz).options = persistedQuizConfig.options;
                    }
                }
            }
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
    let boardConfig: BoardConfig | null = null;
    let persistedPlayState: PersistedPlayState | null = null;
    try {
      const rawBoardData = JSON.parse(jsonString) as Partial<BoardConfig> & { settings: Partial<BoardSettings> & { punishmentMode?: boolean } };
      if (rawBoardData && rawBoardData.settings && rawBoardData.tiles) {
         boardConfig = sanitizeAndValidateBoardConfig(rawBoardData);

        try {
          const storedState = localStorage.getItem(`boardwise-play-state-${boardConfig.id}`);
          if (storedState) {
            persistedPlayState = JSON.parse(storedState) as PersistedPlayState;
            // Similar logic as in loadBoardFromBase64 for persisted quiz options if needed.
            // For now, let's keep it simple; the primary sanitization is key.
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
  }, [dispatch, state.pawnAnimation?.timerId]);

  const randomizeTileVisuals = useCallback(() => {
    if (state.boardConfig) {
        const currentSettings = state.boardConfig.settings;
        const tempRandomizedBoardConfig = applyBoardRandomizationSettings({
            ...state.boardConfig,
            settings: {...currentSettings, randomizeTiles: true } 
        }, state.activeTileForInteraction);

        dispatch({ type: 'UPDATE_TILES', payload: tempRandomizedBoardConfig.tiles });
    }
  }, [state.boardConfig, state.activeTileForInteraction, dispatch]);


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

    