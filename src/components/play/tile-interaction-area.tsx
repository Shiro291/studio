
"use client";

import React, { useState, useEffect } from 'react';
import type { Tile, TileConfigQuiz, TileConfigInfo, TileConfigReward, BoardSettings, QuizOption, PunishmentType } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import Image from 'next/image';
import { useGame } from '@/components/game/game-provider';
import { useLanguage } from '@/context/language-context';
import { CheckCircle, XCircle, InfoIcon, GiftIcon, ChevronRight, HelpCircle } from 'lucide-react';
import { DIFFICULTY_POINTS } from '@/lib/constants';

interface TileInteractionAreaProps {
  tile: Tile | null;
  boardSettings: BoardSettings;
  isQuizCorrect?: boolean; 
}

export function TileInteractionArea({ tile, boardSettings, isQuizCorrect }: TileInteractionAreaProps) {
  const { state, dispatch } = useGame();
  const { t } = useLanguage();
  const [selectedQuizOptionId, setSelectedQuizOptionId] = useState<string | undefined>(undefined);
  const [quizAttempted, setQuizAttempted] = useState(false);

  useEffect(() => {
    if (!tile || state.gameStatus === 'playing' || (tile && tile.id !== state.activeTileForInteraction?.id)) {
      setSelectedQuizOptionId(undefined);
      setQuizAttempted(false);
    }
  }, [tile, state.gameStatus, state.activeTileForInteraction]);


  const handleQuizSubmit = () => {
    if (selectedQuizOptionId) {
      dispatch({ type: 'ANSWER_QUIZ', payload: { selectedOptionId } });
      setQuizAttempted(true); // This component now knows an attempt was made
    }
  };

  const handleAcknowledge = () => {
    dispatch({ type: 'ACKNOWLEDGE_INTERACTION' }); 
    dispatch({ type: 'PROCEED_TO_NEXT_TURN' }); 
  };
  
  const renderImage = (src?: string, altKey?: string, hint?:string) => {
    if (!src) return null;
    return (
      <div className="my-2 relative w-full h-40 rounded-md overflow-hidden border" data-ai-hint={hint || 'game element'}>
        <Image src={src} alt={t(altKey || 'tileEditor.imagePreview')} layout="fill" objectFit="contain" unoptimized />
      </div>
    );
  };

  const getPunishmentDescription = (quizConfig: TileConfigQuiz) => {
    if (!boardSettings || boardSettings.punishmentType === 'none') return null;

    switch (boardSettings.punishmentType) {
      case 'revertMove':
        return t('playPage.punishment.revertMove');
      case 'moveBackFixed':
        return t('playPage.punishment.moveBackFixed', { count: boardSettings.punishmentValue });
      case 'moveBackLevelBased':
        let moveBackAmount = 0;
        if (quizConfig.difficulty === 1) moveBackAmount = 1;
        else if (quizConfig.difficulty === 2) moveBackAmount = 2;
        else if (quizConfig.difficulty === 3) moveBackAmount = 3;
        return t('playPage.punishment.moveBackLevelBased', { count: moveBackAmount });
      default:
        return null;
    }
  };


  if (state.gameStatus === 'finished') {
    return (
      <Card className="bg-muted/30 shadow-sm">
        <CardHeader>
          <CardTitle className="font-headline text-lg">{t('playPage.gameOver')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('playPage.gameHasEnded')}</p>
        </CardContent>
      </Card>
    );
  }
  
  if (!tile || state.gameStatus === 'playing' || !state.activeTileForInteraction || tile.id !== state.activeTileForInteraction.id) { 
    return (
       <Card className="bg-muted/30 shadow-sm">
        <CardHeader>
          <CardTitle className="font-headline text-lg">{t('playPage.tileInteractionTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('playPage.rollDiceToMove')}</p>
        </CardContent>
      </Card>
    );
  }
  
  let interactionContent = null;

  switch (tile.type) {
    case 'quiz': {
      const config = tile.config as TileConfigQuiz;
      interactionContent = (
        <div className="space-y-3">
          {renderImage(config.questionImage, 'playPage.questionImageAlt', 'question illustration')}
          <p className="font-semibold text-base">{config.question || t('playPage.quizQuestion')}</p>
          {!quizAttempted ? (
            <>
              <RadioGroup value={selectedQuizOptionId} onValueChange={setSelectedQuizOptionId} className="space-y-2">
                {config.options.map((opt) => (
                  <div key={opt.id} className="flex items-start space-x-2 p-2 border rounded-md hover:bg-accent/10">
                    <RadioGroupItem value={opt.id} id={opt.id} className="mt-1"/>
                    <Label htmlFor={opt.id} className="flex-1 cursor-pointer">
                      {opt.text}
                      {renderImage(opt.image, 'playPage.optionImageAlt', 'answer choice')}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
              <Button onClick={handleQuizSubmit} disabled={!selectedQuizOptionId} className="w-full mt-2">
                {t('playPage.submitAnswer')}
              </Button>
            </>
          ) : (
            <div className="space-y-2 p-3 rounded-md text-center" style={{ backgroundColor: isQuizCorrect ? 'hsl(var(--muted))' : 'hsl(var(--destructive))'}}>
                {isQuizCorrect ? (
                    <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                ) : (
                    <XCircle className="h-8 w-8 text-destructive-foreground mx-auto mb-2" />
                )}
                <p className={`font-semibold ${isQuizCorrect ? 'text-green-700 dark:text-green-300' : 'text-destructive-foreground'}`}>
                {isQuizCorrect ? t('playPage.correctAnswer') : t('playPage.wrongAnswer')}
                </p>
                <p className={`text-sm ${isQuizCorrect ? 'text-foreground' : 'text-destructive-foreground'}`}>
                    {isQuizCorrect ? t('playPage.pointsAwarded', { points: config.points }) : t('playPage.noPoints')}
                </p>
                {!isQuizCorrect && boardSettings.punishmentType !== 'none' && (
                    <p className="text-xs text-destructive-foreground/80">{getPunishmentDescription(config)}</p>
                )}
                <Button onClick={handleAcknowledge} className="w-full mt-3" variant={isQuizCorrect ? 'default' : 'outline'}>
                    {t('playPage.nextTurn')} <ChevronRight className="ml-1 h-4 w-4"/>
                </Button>
            </div>
          )}
        </div>
      );
      break;
    }
    case 'info': {
      const config = tile.config as TileConfigInfo;
      interactionContent = (
        <div className="space-y-3 text-center">
          <InfoIcon className="h-8 w-8 text-primary mx-auto mb-2" />
          {renderImage(config.image, 'playPage.infoImageAlt', 'informational graphic')}
          <p className="text-base">{config.message || t('playPage.infoMessage')}</p>
          <Button onClick={handleAcknowledge} className="w-full mt-2">
            {t('playPage.acknowledgeAndContinue')} <ChevronRight className="ml-1 h-4 w-4"/>
          </Button>
        </div>
      );
      break;
    }
    case 'reward': {
       const config = tile.config as TileConfigReward;
       interactionContent = (
        <div className="space-y-3 text-center">
          <GiftIcon className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
          <p className="text-base">{config.message || t('playPage.rewardMessage')}</p>
          {config.points && config.points > 0 && <p className="font-semibold text-green-600 dark:text-green-400">{t('playPage.pointsAwarded', {points: config.points})}</p>}
          <Button onClick={handleAcknowledge} className="w-full mt-2">
            {t('playPage.collectAndContinue')} <ChevronRight className="ml-1 h-4 w-4"/>
          </Button>
        </div>
      );
      break;
    }
     case 'start':
     case 'empty':
     case 'finish': // Finish tile interactions (like winning) are handled more globally by GameProvider
        // Auto-proceed for these tiles if interaction somehow lands here
        if (state.activeTileForInteraction && state.gameStatus === 'interaction_pending') {
            setTimeout(() => dispatch({ type: 'PROCEED_TO_NEXT_TURN' }), 0);
        }
        interactionContent = <p className="text-sm text-muted-foreground">{t('playPage.landedOnEmpty', {type: t(`capitalize.${tile.type}` as any)})}</p>;
        break;
    default: 
      interactionContent = <p className="text-sm text-muted-foreground">{t('playPage.landedOnEmpty', {type: t(`capitalize.${tile.type}` as any)})}</p>;
      break;
  }

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="font-headline text-lg flex items-center gap-2">
            {tile.type === 'quiz' && <HelpCircle className="h-5 w-5 text-primary" />}
            {tile.type === 'info' && <InfoIcon className="h-5 w-5 text-blue-500" />}
            {tile.type === 'reward' && <GiftIcon className="h-5 w-5 text-yellow-500" />}
            {t('playPage.tileInteractionTitle')} - <span className="capitalize">{t(`capitalize.${tile.type}` as any)}</span>
        </CardTitle>
        {tile.position !== undefined && <CardDescription>{t('playPage.tileNumber', {number: tile.position + 1})}</CardDescription>}
      </CardHeader>
      <CardContent>
        <ScrollArea className="max-h-[400px] pr-2">
            {interactionContent}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
