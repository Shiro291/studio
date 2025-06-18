
"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGame } from '@/components/game/game-provider';
import { GameBoardDisplay } from '@/components/board/game-board-display';
import { DiceRoller } from '@/components/board/dice-roller';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { useLanguage } from '@/context/language-context';
import { PlayerInfoBar } from '@/components/play/player-info-bar';
import { TileInteractionArea } from '@/components/play/tile-interaction-area';


export default function PlayPage() {
  const { state, loadBoardFromBase64, initializeNewBoard } = useGame();
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  useEffect(() => {
    if (!initialLoadDone) {
      const boardData = searchParams.get('board');
      if (boardData) {
        loadBoardFromBase64(decodeURIComponent(boardData));
      } else {
        // If no board data, maybe redirect to home or show an error/default board
        // For now, initialize a new default board if no data is passed for playing
        initializeNewBoard(); 
        // Or, set an error:
        // dispatch({ type: 'SET_ERROR', payload: t('playPage.noBoardDataError') });
      }
      setInitialLoadDone(true);
    }
  }, [searchParams, loadBoardFromBase64, initializeNewBoard, initialLoadDone, t]);

  if (state.isLoading || !initialLoadDone) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen space-y-4">
        <Skeleton className="h-12 w-1/3 mb-4" />
        <Skeleton className="h-64 w-full max-w-2xl" />
        <Skeleton className="h-32 w-full max-w-sm" />
        <p>{t('playPage.loadingGame')}</p>
      </div>
    );
  }
  
  if (state.error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Alert variant="destructive" className="max-w-lg mx-auto">
          <Terminal className="h-4 w-4" />
          <AlertTitle>{t('playPage.errorLoadingTitle')}</AlertTitle>
          <AlertDescription>
            {state.error} {t('playPage.errorLoadingDescription')}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!state.boardConfig) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>{t('playPage.noBoardConfig')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-headline font-bold mb-6 text-center text-primary">
        {state.boardConfig.settings.name}
      </h1>
      
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
                // activePlayerId might be needed later
              />
            </CardContent>
          </Card>
        </div>
        
        <div className="md:col-span-1 space-y-6">
          <PlayerInfoBar players={state.players} currentPlayerIndex={state.currentPlayerIndex} />
          <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="font-headline text-xl">{t('playPage.controlsTitle')}</CardTitle>
            </CardHeader>
            <CardContent>
                <DiceRoller />
            </CardContent>
          </Card>
          <TileInteractionArea tile={null} /> {/* Placeholder */}
        </div>
      </div>
    </div>
  );
}
