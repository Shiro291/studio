
"use client";

import type { Player } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';

interface PlayerInfoBarProps {
  players: Player[];
  currentPlayerIndex: number;
}

export function PlayerInfoBar({ players, currentPlayerIndex }: PlayerInfoBarProps) {
  const { t } = useLanguage();

  if (!players || players.length === 0) {
    return (
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="font-headline text-xl">{t('playPage.playerInfoTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('playPage.waitingForPlayers')}</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="font-headline text-xl">{t('playPage.playerInfoTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {players.map((player, index) => (
          <div 
            key={player.id} 
            className={cn(
              "p-3 rounded-lg border-2 transition-all duration-200",
              index === currentPlayerIndex 
                ? 'border-primary bg-primary/10 shadow-lg scale-105 ring-2 ring-primary ring-offset-2' 
                : 'border-transparent bg-card'
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div 
                  className="w-6 h-6 rounded-full border-2 border-background shadow-md flex-shrink-0"
                  style={{ backgroundColor: player.color, borderColor: `color-mix(in srgb, ${player.color} 70%, black)` }}
                  title={player.name}
                />
                <span className={cn("font-semibold", index === currentPlayerIndex ? 'text-primary' : 'text-foreground')}>
                  {player.name}
                </span>
              </div>
              <span className={cn("text-sm font-bold", index === currentPlayerIndex ? 'text-primary' : 'text-muted-foreground')}>
                {t('playPage.score')}: {player.score}
              </span>
            </div>
            {index === currentPlayerIndex && (
              <p className="text-xs text-primary font-semibold mt-1 animate-pulse">{t('playPage.currentTurn')}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
