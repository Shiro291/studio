
"use client";

import React, { useState, useEffect } from 'react';
import type { Tile, TileConfigQuiz, TileConfigInfo, TileConfigReward, BoardSettings } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import Image from 'next/image';
import { useGame } from '@/components/game/game-provider';
import { useLanguage } from '@/context/language-context';
import { CheckCircle, XCircle, InfoIcon, GiftIcon, ChevronRight, HelpCircle } from 'lucide-react';

interface TileInteractionModalProps {
  tileForModal: Tile | null;
  isOpen: boolean;
  onModalClose: (proceedToNextTurn: boolean) => void;
  boardSettings: BoardSettings;
}

export function TileInteractionModal({
  tileForModal,
  isOpen,
  onModalClose,
  boardSettings,
}: TileInteractionModalProps) {
  const { state, dispatch } = useGame();
  const { t } = useLanguage();

  const [selectedQuizOptionIdFromModal, setSelectedQuizOptionIdFromModal] = useState<string | undefined>(undefined);
  const [quizAttemptedFromModal, setQuizAttemptedFromModal] = useState(false);
  const [isCorrectQuizAnswer, setIsCorrectQuizAnswer] = useState<boolean | null>(null);

  useEffect(() => {
    // Reset local modal state when it opens with a new tile
    if (isOpen && tileForModal) {
      setSelectedQuizOptionIdFromModal(undefined);
      setQuizAttemptedFromModal(false);
      setIsCorrectQuizAnswer(null);
    }
  }, [isOpen, tileForModal]);

  const handleQuizSubmit = () => {
    if (tileForModal?.type === 'quiz' && selectedQuizOptionIdFromModal) {
      dispatch({ type: 'ANSWER_QUIZ', payload: { selectedOptionId: selectedQuizOptionIdFromModal } });
      setQuizAttemptedFromModal(true);
      const quizConfig = tileForModal.config as TileConfigQuiz;
      const selectedOption = quizConfig.options.find(opt => opt.id === selectedQuizOptionIdFromModal);
      setIsCorrectQuizAnswer(!!selectedOption?.isCorrect);
    }
  };

  const handleInfoRewardAcknowledge = () => {
    dispatch({ type: 'ACKNOWLEDGE_INTERACTION' });
    onModalClose(true); // Proceed to next turn
  };
  
  const handleQuizFeedbackContinue = () => {
     onModalClose(true); // Proceed to next turn after seeing feedback
  };


  const renderImage = (src?: string, altKey?: string, hint?: string) => {
    if (!src) return null;
    return (
      <div className="my-2 relative w-full h-40 rounded-md overflow-hidden border" data-ai-hint={hint || 'game element'}>
        <Image src={src} alt={t(altKey || 'tileEditor.imagePreview')} layout="fill" objectFit="contain" unoptimized />
      </div>
    );
  };
  
  const getPunishmentDescriptionForUI = (quizConfig: TileConfigQuiz) => {
    if (!boardSettings || boardSettings.punishmentType === 'none') return null;

    let detailsKey = '';
    let params: Record<string, string | number | undefined> = {};

    switch (boardSettings.punishmentType) {
      case 'revertMove':
        detailsKey = 'log.punishmentDetails.revertMove';
        params = { dice: state.diceRoll || 0 };
        break;
      case 'moveBackFixed':
        detailsKey = 'log.punishmentDetails.moveBackFixed';
        params = { count: boardSettings.punishmentValue };
        break;
      case 'moveBackLevelBased':
        let moveBackAmount = 0;
        if (quizConfig.difficulty === 1) moveBackAmount = 1;
        else if (quizConfig.difficulty === 2) moveBackAmount = 2;
        else if (quizConfig.difficulty === 3) moveBackAmount = 3;
        detailsKey = 'log.punishmentDetails.moveBackLevelBased';
        params = { count: moveBackAmount, level: quizConfig.difficulty };
        break;
      default:
        return null;
    }
    return t(detailsKey, params);
  };


  if (!isOpen || !tileForModal) {
    return null;
  }

  let modalTitleContent = t('playPage.tileInteractionTitle');
  let modalContent = null;
  let modalFooter = null;

  switch (tileForModal.type) {
    case 'quiz': {
      const config = tileForModal.config as TileConfigQuiz;
      modalTitleContent = `${t('playPage.tileInteractionTitle')} - ${t('capitalize.quiz')}`;
      if (!quizAttemptedFromModal) {
        modalContent = (
          <div className="space-y-3">
            {renderImage(config.questionImage, 'playPage.questionImageAlt', 'question illustration')}
            <p className="font-semibold text-base">{config.question || t('playPage.quizQuestion')}</p>
            <RadioGroup value={selectedQuizOptionIdFromModal} onValueChange={setSelectedQuizOptionIdFromModal} className="space-y-2">
              {config.options.map((opt) => (
                <div key={opt.id} className="flex items-start space-x-2 p-2 border rounded-md hover:bg-accent/10">
                  <RadioGroupItem value={opt.id} id={`modal-${opt.id}`} className="mt-1" />
                  <Label htmlFor={`modal-${opt.id}`} className="flex-1 cursor-pointer">
                    {opt.text}
                    {renderImage(opt.image, 'playPage.optionImageAlt', 'answer choice')}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>
        );
        modalFooter = (
          <Button onClick={handleQuizSubmit} disabled={!selectedQuizOptionIdFromModal} className="w-full">
            {t('playPage.submitAnswer')}
          </Button>
        );
      } else { // Quiz attempted, show feedback
        modalContent = (
           <div className="space-y-2 p-3 rounded-md text-center">
            {isCorrectQuizAnswer ? (
              <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" />
            ) : (
              <XCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
            )}
            <p className={`font-semibold text-lg ${isCorrectQuizAnswer ? 'text-green-700 dark:text-green-300' : 'text-destructive'}`}>
              {isCorrectQuizAnswer ? t('playPage.correctAnswer') : t('playPage.wrongAnswer')}
            </p>
            <p className={`text-sm ${isCorrectQuizAnswer ? 'text-foreground' : 'text-muted-foreground'}`}>
              {isCorrectQuizAnswer ? t('playPage.pointsAwarded', { points: config.points }) : t('playPage.noPoints')}
            </p>
            {!isCorrectQuizAnswer && boardSettings.punishmentType !== 'none' && (
              <p className="text-xs text-muted-foreground/80">{getPunishmentDescriptionForUI(config)}</p>
            )}
          </div>
        );
        modalFooter = (
          <Button onClick={handleQuizFeedbackContinue} className="w-full mt-3">
            {t('playPage.nextTurn')} <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        );
      }
      break;
    }
    case 'info': {
      const config = tileForModal.config as TileConfigInfo;
      modalTitleContent = `${t('playPage.tileInteractionTitle')} - ${t('capitalize.info')}`;
      modalContent = (
        <div className="space-y-3 text-center">
          <InfoIcon className="h-8 w-8 text-primary mx-auto mb-2" />
          {renderImage(config.image, 'playPage.infoImageAlt', 'informational graphic')}
          <p className="text-base">{config.message || t('playPage.infoMessage')}</p>
        </div>
      );
      modalFooter = (
        <Button onClick={handleInfoRewardAcknowledge} className="w-full">
          {t('playPage.acknowledgeAndContinue')} <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      );
      break;
    }
    case 'reward': {
      const config = tileForModal.config as TileConfigReward;
      modalTitleContent = `${t('playPage.tileInteractionTitle')} - ${t('capitalize.reward')}`;
      modalContent = (
        <div className="space-y-3 text-center">
          <GiftIcon className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
          <p className="text-base">{config.message || t('playPage.rewardMessage')}</p>
          {config.points && config.points > 0 && (
            <p className="font-semibold text-green-600 dark:text-green-400">
              {t('playPage.pointsAwarded', { points: config.points })}
            </p>
          )}
        </div>
      );
      modalFooter = (
        <Button onClick={handleInfoRewardAcknowledge} className="w-full">
          {t('playPage.collectAndContinue')} <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      );
      break;
    }
    default:
      return null; // Should not happen for interactive tiles
  }

  return (
    <Dialog 
        open={isOpen} 
        onOpenChange={(open) => {
            if (!open) { // If the modal is attempting to close
                // If it's a quiz and not yet attempted, prevent closing by 'X' or overlay click.
                // Allow closing only through designated buttons after interaction or for non-quiz types.
                if (tileForModal.type === 'quiz' && !quizAttemptedFromModal) {
                    return; // Don't close
                }
                onModalClose(false); // Call close handler, indicating not to proceed to next turn automatically
            }
        }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-headline text-xl flex items-center gap-2">
            {tileForModal.type === 'quiz' && <HelpCircle className="h-6 w-6 text-primary" />}
            {tileForModal.type === 'info' && <InfoIcon className="h-6 w-6 text-blue-500" />}
            {tileForModal.type === 'reward' && <GiftIcon className="h-6 w-6 text-yellow-500" />}
            {modalTitleContent}
          </DialogTitle>
          {tileForModal.position !== undefined && (
            <DialogDescription>{t('playPage.tileNumber', { number: tileForModal.position + 1 })}</DialogDescription>
          )}
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-2 -mr-2">
         <div className="py-4 pr-4">
            {modalContent}
          </div>
        </ScrollArea>
        {modalFooter && <DialogFooter className="pt-4">{modalFooter}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
}
