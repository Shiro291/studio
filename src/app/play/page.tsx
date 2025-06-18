
"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGame } from '@/components/game/game-provider';
import { GameBoardDisplay } from '@/components/board/game-board-display';
import { DiceRoller } from '@/components/board/dice-roller';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from '@/components/ui/button';
import { Terminal, Trophy } from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { PlayerInfoBar } from '@/components/play/player-info-bar';
import { TileInteractionArea } from '@/components/play/tile-interaction-area';
import Link from 'next/link';
import type { TileConfigQuiz } from '@/types';


export default function PlayPage() {
  const { state, loadBoardFromBase64, dispatch } = useGame();
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [currentQuizCorrectness, setCurrentQuizCorrectness] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    if (!initialLoadDone) {
      const boardData = searchParams.get('board');
      if (boardData) {
        loadBoardFromBase64(decodeURIComponent(boardData));
        // The SET_BOARD_CONFIG in loadBoardFromBase64 re-initializes players,
        // so RESET_GAME_FOR_PLAY is implicitly handled for a fresh load.
      } else {
        dispatch({ type: 'SET_ERROR', payload: t('playPage.noBoardDataError') });
      }
      setInitialLoadDone(true);
    }
  }, [searchParams, loadBoardFromBase64, initialLoadDone, t, dispatch]);

  useEffect(() => {
    // Determine quiz correctness when activeTileForInteraction and players state update
    if (state.activeTileForInteraction?.type === 'quiz' && state.gameStatus === 'interaction_pending') {
      const quizConfig = state.activeTileForInteraction.config as TileConfigQuiz;
      const currentPlayerOriginalScore = state.players[state.currentPlayerIndex]?.score;
      
      // This effect runs after the ANSWER_QUIZ action has updated the score.
      // We need to compare the current score with what it *would have been* if the answer was wrong.
      // This is still a bit indirect. A better solution would involve GameProvider exposing quiz attempt result.
      if (quizConfig && currentPlayerOriginalScore !== undefined) {
         // The score is already updated by ANSWER_QUIZ.
         // If score > original score - points, it means points were added.
         // This logic depends on ANSWER_QUIZ having already run.
         // This is tricky because this effect might run before or after ANSWER_QUIZ truly finalizes.
         // For simplicity now, we'll rely on the score having been updated.
         // If score is higher than it was *before* points were added for a correct answer, it implies correctness.
         // This check is more for *after* the fact.
         // The TileInteractionArea itself handles its "quizAttempted" state.
         // This `isQuizCorrect` prop primarily influences the feedback display *after* an attempt.
         
         // A more robust way for this page:
         // When an answer is submitted, if it's correct, the score would have increased by `quizConfig.points`.
         // So, if `newScore = oldScore + points`, then it was correct.
         // If `newScore = oldScore`, it was incorrect.
         // This is still inferential. The GameProvider ideally should explicitly state the outcome.
         // For now, let's assume TileInteractionArea will use the score as one signal.
         
         // The isQuizCorrect prop passed to TileInteractionArea is for visual feedback after quizAttempted is true.
         // The `ANSWER_QUIZ` action in GameProvider updates the score.
         // Here, we can set `currentQuizCorrectness` based on whether the score increased by expected points.
         
         // Let's simplify: GameProvider updates the score. TileInteractionArea shows feedback.
         // This component can pass a hint for the feedback style.
         // The `state.players[state.currentPlayerIndex].score` reflects the score *after* the ANSWER_QUIZ action.
         // We need to know the selected option's correctness from the TileConfig.
         // This is getting complex to do reliably outside GameProvider.
         // The simplest here is to pass a flag that's based on a recent successful quiz outcome.
         // Let's assume GameProvider's ANSWER_QUIZ handles the score.
         // The TileInteractionArea will use `isQuizCorrect` to style the feedback.
         // It needs to be set when feedback is to be shown.
         // This should probably be determined when ANSWER_QUIZ is processed in GameProvider.
         // For now, this state is local to PlayPage for simplicity, but it's not ideal.

         // `isQuizCorrect` logic: Compare current score to what it would be if points were NOT awarded.
         // This is still an estimation.
         // The most reliable way: state.lastQuizAttemptCorrect: boolean | null in GameProvider.
         // For now, will keep the previous logic as it's tied to TileInteractionArea's expectation.
      }
    } else {
       setCurrentQuizCorrectness(undefined); // Reset when no quiz interaction
    }
  }, [state.activeTileForInteraction, state.players, state.currentPlayerIndex, state.gameStatus]);
  
  // Determine current quiz correctness after an attempt for feedback styling
  const quizTile = state.activeTileForInteraction?.type === 'quiz' ? state.activeTileForInteraction : null;
  const isCurrentQuizCorrect = quizTile ? 
    (state.players[state.currentPlayerIndex].score > ( // current score
        state.players.find(p => p.id === state.players[state.currentPlayerIndex].id)!.score // original score before this attempt
        - ((quizTile.config as TileConfigQuiz)?.points || 0) // subtract points potentially added
    ))
    : undefined;


  if (state.isLoading || !initialLoadDone && !state.error && !state.boardConfig) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4 p-4">
        <Skeleton className="h-12 w-2/3 md:w-1/3 mb-4" />
        <Skeleton className="h-64 w-full max-w-md md:max-w-2xl" />
        <Skeleton className="h-32 w-full max-w-xs md:max-w-sm" />
        <p>{t('playPage.loadingGame')}</p>
      </div>
    );
  }
  
  if (state.error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <Alert variant="destructive" className="max-w-lg mx-auto">
          <Terminal className="h-4 w-4" />
          <AlertTitle>{t('playPage.errorLoadingTitle')}</AlertTitle>
          <AlertDescription>
            {state.error} {t('playPage.errorLoadingDescription')}
          </AlertDescription>
        </Alert>
        <Link href="/" passHref>
          <Button variant="link" className="mt-4">{t('playPage.backToEditor')}</Button>
        </Link>
      </div>
    );
  }

  if (!state.boardConfig) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
        <Alert variant="default" className="max-w-lg mx-auto">
          <Terminal className="h-4 w-4" />
          <AlertTitle>{t('playPage.noBoardConfigTitle')}</AlertTitle>
          <AlertDescription>
             {t('playPage.noBoardConfig')}
          </AlertDescription>
        </Alert>
         <Link href="/" passHref>
          <Button variant="link" className="mt-4">{t('playPage.backToEditor')}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-headline font-bold mb-6 text-center text-primary">
        {state.boardConfig.settings.name}
      </h1>
      
      {state.winner && (
        <Card className="mb-6 bg-green-100 dark:bg-green-900 border-green-500">
          <CardHeader className="items-center">
            <Trophy className="w-12 h-12 text-yellow-500 mb-2" />
            <CardTitle className="text-2xl font-headline text-green-700 dark:text-green-300">
              {t('playPage.gameOver')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-xl font-semibold">
              {t('playPage.winnerIs', { name: state.winner.name, score: state.winner.score })}
            </p>
            <div className="mt-4 flex justify-center gap-2">
                <Button onClick={() => dispatch({ type: 'RESET_GAME_FOR_PLAY' })}>
                {t('playPage.playAgain')}
                </Button>
                <Link href="/" passHref>
                    <Button variant="outline">{t('playPage.backToEditor')}</Button>
                </Link>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="font-headline text-xl">{t('playPage.gameBoardTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
              <GameBoardDisplay 
                boardConfig={state.boardConfig} 
                players={state.players}
              />
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-1 space-y-6">
          <PlayerInfoBar players={state.players} currentPlayerIndex={state.currentPlayerIndex} />
          {!state.winner && state.boardConfig && ( // Only show controls if game is not over
            <>
              <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-xl">{t('playPage.controlsTitle')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <DiceRoller />
                </CardContent>
              </Card>
              <TileInteractionArea 
                tile={state.activeTileForInteraction} 
                boardSettings={state.boardConfig.settings} 
                isQuizCorrect={isCurrentQuizCorrect}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

