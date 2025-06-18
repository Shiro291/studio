
"use client";

import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/language-context';
import { ScrollArea } from '../ui/scroll-area';

interface TutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TutorialModal({ isOpen, onClose }: TutorialModalProps) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="font-headline">{t('tutorialModal.title')}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] p-1 pr-3">
          <div className="grid gap-4 py-4">
            <h3 className="font-semibold text-lg">{t('tutorialModal.welcome.title')}</h3>
            <p>{t('tutorialModal.welcome.p1')}</p>
            
            <h3 className="font-semibold text-lg mt-4">{t('tutorialModal.gettingStarted.title')}</h3>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li>{t('tutorialModal.gettingStarted.step1')}</li>
              <li>{t('tutorialModal.gettingStarted.step2')}</li>
              <li>{t('tutorialModal.gettingStarted.step3')}</li>
              <li>{t('tutorialModal.gettingStarted.step4')}</li>
            </ul>

            <h3 className="font-semibold text-lg mt-4">{t('tutorialModal.boardSettings.title')}</h3>
             <p className="text-sm">{t('tutorialModal.boardSettings.intro')}</p>
            <ul className="list-disc pl-5 space-y-1 text-sm">
              <li><strong>{t('tutorialModal.boardSettings.nameDescription.label')}:</strong> {t('tutorialModal.boardSettings.nameDescription.text')}</li>
              <li><strong>{t('tutorialModal.boardSettings.numberOfTiles.label')}:</strong> {t('tutorialModal.boardSettings.numberOfTiles.text')}</li>
              <li><strong>{t('tutorialModal.boardSettings.punishmentType.label')}:</strong> {t('tutorialModal.boardSettings.punishmentType.text')}</li>
              <li><strong>{t('tutorialModal.boardSettings.backgroundImage.label')}:</strong> {t('tutorialModal.boardSettings.backgroundImage.text')}</li>
              <li><strong>{t('tutorialModal.boardSettings.playerSettings.label')}:</strong> {t('tutorialModal.boardSettings.playerSettings.text')}</li>
              <li><strong>{t('tutorialModal.boardSettings.diceSettings.label')}:</strong> {t('tutorialModal.boardSettings.diceSettings.text')}</li>
            </ul>

            <h3 className="font-semibold text-lg mt-4">{t('tutorialModal.tileConfiguration.title')}</h3>
            <p className="text-sm">{t('tutorialModal.tileConfiguration.intro')}</p>
             <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>{t('tutorialModal.tileConfiguration.selectTile')}</li>
                <li><strong>{t('tutorialModal.tileConfiguration.types.label')}:</strong>
                    <ul className="list-circle pl-5">
                        <li><strong>{t('capitalize.quiz')}:</strong> {t('tutorialModal.tileConfiguration.types.quiz')}</li>
                        <li><strong>{t('capitalize.info')}:</strong> {t('tutorialModal.tileConfiguration.types.info')}</li>
                        <li><strong>{t('capitalize.reward')}:</strong> {t('tutorialModal.tileConfiguration.types.reward')}</li>
                    </ul>
                </li>
                <li>{t('tutorialModal.tileConfiguration.customization')}</li>
            </ul>
            
            <h3 className="font-semibold text-lg mt-4">{t('tutorialModal.sharing.title')}</h3>
            <p className="text-sm">{t('tutorialModal.sharing.text')}</p>

            <p className="mt-6 text-center text-primary font-medium">{t('tutorialModal.haveFun')}</p>
          </div>
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" onClick={onClose}>{t('tutorialModal.close')}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
