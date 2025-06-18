
"use client";

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useGame } from '@/components/game/game-provider';
import { BoardDesigner } from '@/components/board/board-designer';
import { GameBoardDisplay } from '@/components/board/game-board-display';
import { DiceRoller } from '@/components/board/dice-roller';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";
import { useLanguage } from '@/context/language-context';

export default function BoardDesignerPage() {
  const { state, initializeNewBoard, loadBoardFromBase64 } = useGame();
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  useEffect(() => {
    if (!initialLoadDone) {
      const boardData = searchParams.get('board');
      if (boardData) {
        loadBoardFromBase64(decodeURIComponent(boardData));
      } else {
        initializeNewBoard();
      }
      setInitialLoadDone(true);
    }
  }, [searchParams, initializeNewBoard, loadBoardFromBase64, initialLoadDone]);

  if (state.isLoading || !initialLoadDone) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-1/3" />
        <Skeleton className="h-64 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    );
  }
  
  if (state.error) {
    return (
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <Terminal className="h-4 w-4" />
        <AlertTitle>{t('boardDesignerPage.errorLoadingBoard')}</AlertTitle>
        <AlertDescription>
          {state.error} {t('boardDesignerPage.errorLoadingBoardDescription')}
        </AlertDescription>
      </Alert>
    );
  }


  if (!state.boardConfig) {
    return (
      <div className="flex items-center justify-center h-full">
        <p>{t('boardDesignerPage.noBoardLoaded')}</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-headline font-bold mb-8 text-primary">
        {state.boardConfig.settings.name}
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle className="font-headline">{t('boardDesignerPage.gameBoard')}</CardTitle>
            </CardHeader>
            <CardContent>
              <GameBoardDisplay boardConfig={state.boardConfig} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
                <CardTitle className="font-headline">{t('boardDesignerPage.gameControls')}</CardTitle>
            </CardHeader>
            <CardContent>
                <DiceRoller isDesignerMode={true} />
            </CardContent>
          </Card>
        </div>
        
        <div className="lg:col-span-1">
          <BoardDesigner />
        </div>
      </div>
    </div>
  );
}
