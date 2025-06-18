
"use client";

import type { LogEntry, BoardSettings, PunishmentType, WinningCondition } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/context/language-context';
import { formatDistanceToNowStrict } from 'date-fns';
import { useEffect, useRef } from 'react';
import { Separator } from '@/components/ui/separator';

interface GameLogDisplayProps {
  logs: LogEntry[];
  boardSettings: BoardSettings | null;
}

export function GameLogDisplay({ logs, boardSettings }: GameLogDisplayProps) {
  const { t } = useLanguage();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = 0; 
      }
    }
  }, [logs]);

  const getPunishmentTypeDisplay = (type: PunishmentType) => {
    switch(type) {
      case 'none': return t('log.settings.punishment.none');
      case 'revertMove': return t('log.settings.punishment.revertMove');
      case 'moveBackFixed': return t('log.settings.punishment.moveBackFixed');
      case 'moveBackLevelBased': return t('log.settings.punishment.moveBackLevelBased');
      default: return type;
    }
  };

  const getWinningConditionDisplay = (condition: WinningCondition) => {
    switch(condition) {
      case 'firstToFinish': return t('log.settings.winningCondition.firstToFinish');
      case 'highestScore': return t('log.settings.winningCondition.highestScore');
      case 'combinedOrderScore': return t('log.settings.winningCondition.combinedOrderScore');
      default: return condition;
    }
  }

  const renderSettings = () => {
    if (!boardSettings) return null;
    return (
      <div className="p-3 mb-3 border bg-muted/50 rounded-md text-xs space-y-1">
        <h4 className="font-semibold text-sm text-primary mb-2">{t('log.settings.title')}</h4>
        <p><strong>{t('log.settings.boardName')}:</strong> {boardSettings.name}</p>
        <p><strong>{t('log.settings.randomizeTiles')}:</strong> {boardSettings.randomizeTiles ? t('log.settings.on') : t('log.settings.off')}</p>
        <p><strong>{t('log.settings.punishmentMode')}:</strong> {getPunishmentTypeDisplay(boardSettings.punishmentType)}
          {boardSettings.punishmentType === 'moveBackFixed' && ` (${t('log.settings.punishmentValue', { count: boardSettings.punishmentValue })})`}
        </p>
        <p><strong>{t('log.settings.diceSides')}:</strong> {boardSettings.diceSides}</p>
        <p><strong>{t('log.settings.winningCondition.label')}:</strong> {getWinningConditionDisplay(boardSettings.winningCondition)}</p>
        <p><strong>{t('log.settings.epilepsySafeMode')}:</strong> {boardSettings.epilepsySafeMode ? t('log.settings.on') : t('log.settings.off')}</p>
      </div>
    );
  };


  if (!logs || logs.length === 0) {
    return (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl">{t('playPage.gameLogTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            {renderSettings()}
            {logs.length === 0 && boardSettings && <Separator className="my-3"/>}
            <p className="text-sm text-muted-foreground">{t('playPage.noLogsYet')}</p>
          </CardContent>
        </Card>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-xl">{t('playPage.gameLogTitle')}</CardTitle>
      </CardHeader>
      <CardContent>
        {renderSettings()}
        <Separator className="my-3"/>
        <ScrollArea className="h-[200px] w-full pr-4" ref={scrollAreaRef}>
          <ul className="space-y-2 text-sm">
            {logs.map(log => (
              <li key={log.id} className="border-b border-border/50 pb-1 mb-1 last:border-b-0">
                <p className="whitespace-pre-wrap">{t(log.messageKey, log.messageParams)}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDistanceToNowStrict(new Date(log.timestamp), { addSuffix: true })}
                </p>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

    