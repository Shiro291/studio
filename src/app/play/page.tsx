
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
import { GameLogDisplay } from '@/components/play/game-log-display';
import type { Tile } from '@/types';
import { TileInteractionModal } from '@/components/play/tile-interaction-modal';


export default function PlayPage() {
  const { state, loadBoardFromBase64, dispatch } = useGame();
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [isInteractionModalOpen, setIsInteractionModalOpen] = useState(false);
  const [currentTileForModal, setCurrentTileForModal] = useState<Tile | null>(null);

  useEffect(() => {
    if (!initialLoadDone) {
      const boardData = searchParams.get('board');
      if (boardData) {
        loadBoardFromBase64(decodeURIComponent(boardData));
      } else {
        dispatch({ type: 'SET_ERROR', payload: t('playPage.noBoardDataError') });
      }
      setInitialLoadDone(true);
    }
  }, [searchParams, loadBoardFromBase64, initialLoadDone, t, dispatch]);

  useEffect(() => {
    if (state.activeTileForInteraction && state.gameStatus === 'interaction_pending') {
      const tile = state.activeTileForInteraction;
      if (tile.type === 'quiz' || tile.type === 'info' || tile.type === 'reward') {
        if (!isInteractionModalOpen || currentTileForModal?.id !== tile.id) {
            setCurrentTileForModal(tile);
            setIsInteractionModalOpen(true);
        }
      } else if (tile.type === 'empty' || tile.type === 'start' || tile.type === 'finish') {
        const timer = setTimeout(() => {
          dispatch({ type: 'ACKNOWLEDGE_INTERACTION' }); 
          dispatch({ type: 'PROCEED_TO_NEXT_TURN' });
        }, 500); 
        return () => clearTimeout(timer);
      }
    } else if (!state.activeTileForInteraction && isInteractionModalOpen) {
      setIsInteractionModalOpen(false);
      setCurrentTileForModal(null);
    }
  }, [state.activeTileForInteraction, state.gameStatus, dispatch, isInteractionModalOpen, currentTileForModal]);


  const handleModalClose = (proceedToNextTurn: boolean) => {
    setIsInteractionModalOpen(false);
    setCurrentTileForModal(null); 
    
    if (proceedToNextTurn) {
      dispatch({ type: 'PROCEED_TO_NEXT_TURN' });
    } else {
      // This branch is primarily for when a non-blocking modal is closed (e.g., info/reward via 'X')
      // or if a quiz modal was somehow closed externally before an answer (which is prevented by modal's own logic).
      // If an interaction was genuinely pending, and this close wasn't meant to end the turn,
      // the main useEffect will re-evaluate and potentially re-open the modal if needed.
      // If the interaction was completed (e.g. quiz answered) and `proceedToNextTurn` is false (should not happen for quiz),
      // then `PROCEED_TO_NEXT_TURN` needs to be called from the modal's internal logic.
      // For an unattempted Quiz modal, this `onModalClose(false)` should not be reachable via 'X' due to modal's internal checks.
      if (state.activeTileForInteraction && state.gameStatus === 'interaction_pending' && 
          (state.activeTileForInteraction.type === 'info' || state.activeTileForInteraction.type === 'reward')) {
          dispatch({ type: 'PROCEED_TO_NEXT_TURN' });
      }
    }
  };


  if (state.isLoading || (!initialLoadDone && !state.error && !state.boardConfig)) {
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
            {state.error}
          </AlertDescription>
        </Alert>
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
          <GameLogDisplay logs={state.logs} boardSettings={state.boardConfig.settings} />
        </div>

        <div className="md:col-span-1 space-y-6">
          <PlayerInfoBar players={state.players} currentPlayerIndex={state.currentPlayerIndex} />
          {!state.winner && state.boardConfig && (
            <>
              <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="font-headline text-xl">{t('playPage.controlsTitle')}</CardTitle>
                </CardHeader>
                <CardContent>
                    <DiceRoller />
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
      {state.boardConfig && (
         <TileInteractionModal
            tileForModal={currentTileForModal}
            isOpen={isInteractionModalOpen}
            onModalClose={handleModalClose}
            boardSettings={state.boardConfig.settings}
          />
      )}
    </div>
  );
}

    