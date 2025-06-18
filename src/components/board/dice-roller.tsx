
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useGame } from '@/components/game/game-provider';
import { Dices } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import { playSound } from '@/lib/sound-service';

export function DiceRoller() {
  const { state, dispatch } = useGame();
  const { t } = useLanguage();
  const [rolledValueDisplay, setRolledValueDisplay] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  const diceSides = state.boardConfig?.settings.diceSides || 6;
  const canRoll = state.gameStatus === 'playing' && state.activeTileForInteraction === null && !state.winner;

  const rollDice = () => {
    if (isRolling || !canRoll) return;
    setIsRolling(true);
    setRolledValueDisplay(null); 

    let currentRollCount = 0;
    const rollInterval = setInterval(() => {
      setRolledValueDisplay(Math.floor(Math.random() * diceSides) + 1);
      currentRollCount++;
      if (currentRollCount > 10) {
        clearInterval(rollInterval);
        const finalValue = Math.floor(Math.random() * diceSides) + 1;
        setRolledValueDisplay(finalValue);
        setIsRolling(false);
        playSound('diceRoll');
        dispatch({ type: 'PLAYER_ROLLED_DICE', payload: { diceValue: finalValue } });
      }
    }, 75); 
  };

  useEffect(() => {
    if (state.gameStatus === 'playing' && state.activeTileForInteraction === null) {
      setRolledValueDisplay(null);
    }
    if (state.activeTileForInteraction !== null) { 
        setRolledValueDisplay(null);
    }
  }, [state.currentPlayerIndex, state.gameStatus, state.activeTileForInteraction]);


  return (
    <div className="flex flex-col items-center space-y-4 p-4 rounded-lg shadow-md bg-card">
      <div
        className="w-24 h-24 border-2 border-primary rounded-lg flex items-center justify-center text-4xl font-bold text-primary bg-background shadow-inner"
        aria-live="polite"
        title={rolledValueDisplay !== null ? t('diceRoller.diceRolled', {value: rolledValueDisplay}) : t('diceRoller.diceNotRolled')}
      >
        {isRolling ? "..." : (rolledValueDisplay !== null ? rolledValueDisplay : <Dices size={48} className="text-muted-foreground" />)}
      </div>
      <Button 
        onClick={rollDice} 
        disabled={isRolling || !canRoll || !!state.winner} 
        className="w-full max-w-xs"
      >
        <Dices className="mr-2 h-5 w-5" />
        {isRolling ? t('diceRoller.rolling') : (state.winner ? t('playPage.gameOver') : t('diceRoller.roll', {sides: diceSides}))}
      </Button>
    </div>
  );
}
