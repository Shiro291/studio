
"use client";

import type { Player } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLanguage } from '@/context/language-context';

interface PlayerInfoBarProps {
  players: Player[];
  currentPlayerIndex: number;
}

export function PlayerInfoBar({ players, currentPlayerIndex }: PlayerInfoBarProps) {
  const { t } = useLanguage();
  const currentPlayer = players[currentPlayerIndex];

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="font-headline text-xl">{t('playPage.playerInfoTitle')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {players.map((player, index) => (
          <div 
            key={player.id} 
            className={`p-2 rounded-md border-2 ${index === currentPlayerIndex ? 'border-primary bg-primary/10 shadow-lg scale-105' : 'border-transparent'}`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div 
                  className="w-5 h-5 rounded-full border border-background shadow-sm"
                  style={{ backgroundColor: player.color }}
                  title={player.name}
                />
                <span className={`font-medium ${index === currentPlayerIndex ? 'text-primary' : ''}`}>
                  {player.name}
                </span>
              </div>
              <span className={`text-sm font-semibold ${index === currentPlayerIndex ? 'text-primary' : 'text-muted-foreground'}`}>
                {t('playPage.score')}: {player.score}
              </span>
            </div>
            {index === currentPlayerIndex && (
              <p className="text-xs text-primary font-semibold mt-1">{t('playPage.currentTurn')}</p>
            )}
          </div>
        ))}
        {!currentPlayer && <p className="text-sm text-muted-foreground">{t('playPage.waitingForPlayers')}</p>}
      </CardContent>
    </Card>
  );
}
