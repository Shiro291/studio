
"use client";

import type { LogEntry } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useLanguage } from '@/context/language-context';
import { formatDistanceToNowStrict } from 'date-fns';
import { useEffect, useRef } from 'react';

interface GameLogDisplayProps {
  logs: LogEntry[];
}

export function GameLogDisplay({ logs }: GameLogDisplayProps) {
  const { t } = useLanguage();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollAreaRef.current) {
      // Access the viewport directly if ShadCN's ScrollArea provides a way,
      // otherwise, this might need adjustment based on internal structure.
      // For a simple case, let's assume the first child is the viewport.
      const viewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
      if (viewport) {
        viewport.scrollTop = 0; // Scroll to top to show newest log
      }
    }
  }, [logs]);


  if (!logs || logs.length === 0) {
    return (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="font-headline text-xl">{t('playPage.gameLogTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
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
