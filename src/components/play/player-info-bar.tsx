
"use client";

import type { Player } from '@/types';
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLanguage } from '@/context/language-context';
import { cn } from '@/lib/utils';
import { Flame, Edit3, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGame } from '@/components/game/game-provider';

interface PlayerInfoBarProps {
  players: Player[];
  currentPlayerIndex: number;
}

export function PlayerInfoBar({ players, currentPlayerIndex }: PlayerInfoBarProps) {
  const { t } = useLanguage();
  const { dispatch } = useGame();
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');

  const handleEditClick = (player: Player) => {
    setEditingPlayerId(player.id);
    setEditingName(player.name);
  };

  const handleCancelEdit = () => {
    setEditingPlayerId(null);
    setEditingName('');
  };

  const handleSaveName = (playerId: string) => {
    if (editingName.trim() === '') {
      // Optionally add a toast here for empty name
      return;
    }
    dispatch({ type: 'UPDATE_PLAYER_NAME', payload: { playerId, newName: editingName.trim() } });
    setEditingPlayerId(null);
    setEditingName('');
  };

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
                {editingPlayerId === player.id ? (
                  <div className="flex items-center gap-1 flex-grow">
                    <Input 
                      type="text" 
                      value={editingName} 
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveName(player.id)}
                      className="h-7 text-sm flex-grow"
                      autoFocus
                    />
                    <Button variant="ghost" size="icon" onClick={() => handleSaveName(player.id)} className="h-7 w-7">
                      <Check className="h-4 w-4 text-green-500" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleCancelEdit} className="h-7 w-7">
                      <X className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ) : (
                  <span className={cn("font-semibold", index === currentPlayerIndex ? 'text-primary' : 'text-foreground')}>
                    {player.name}
                  </span>
                )}
                 {editingPlayerId !== player.id && (
                   <Button variant="ghost" size="icon" onClick={() => handleEditClick(player)} className="h-6 w-6 ml-1">
                      <Edit3 className="h-3 w-3 text-muted-foreground hover:text-primary" />
                    </Button>
                 )}
              </div>
              <div className="flex items-center gap-2">
                {player.currentStreak > 0 && (
                  <div className="flex items-center gap-1" title={`Correct answer streak: ${player.currentStreak}`}>
                    <Flame className="h-4 w-4 text-orange-500" />
                    <span className="text-xs font-medium text-orange-600">{player.currentStreak}</span>
                  </div>
                )}
                 {player.currentStreak === 0 && (
                  <div className="flex items-center gap-1" title={`No active streak`}>
                    <Flame className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
                <span className={cn("text-sm font-bold", index === currentPlayerIndex ? 'text-primary' : 'text-muted-foreground')}>
                  {t('playPage.score')}: {player.score}
                </span>
              </div>
            </div>
             {player.hasFinished && (
                 <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">
                    {t('log.playerFinished', {name: '', finishOrder: player.finishOrder || 0}).split('! (')[1].replace(')','')}
                </p>
            )}
            {index === currentPlayerIndex && !player.hasFinished && editingPlayerId !== player.id && (
              <p className="text-xs text-primary font-semibold mt-1 animate-pulse">{t('playPage.currentTurn')}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

    