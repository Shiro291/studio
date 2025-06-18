
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
  const [rolledValue, setRolledValue] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  const diceSides = state.boardConfig?.settings.diceSides || 6;

  const rollDice = () => {
    if (isRolling) return;
    setIsRolling(true);
    
    let currentRollCount = 0; 
    const rollInterval = setInterval(() => {
      setRolledValue(Math.floor(Math.random() * diceSides) + 1);
      currentRollCount++;
      if (currentRollCount > 10) { 
        clearInterval(rollInterval);
        const finalValue = Math.floor(Math.random() * diceSides) + 1;
        setRolledValue(finalValue);
        setIsRolling(false);
        playSound('diceRoll'); 
        // Note: Add dispatch for player movement & game logic here later
      }
    }, 50);
  };
  
  useEffect(() => {
    setRolledValue(null);
  }, [diceSides]);

  return (
    <div className="flex flex-col items-center space-y-4 p-4 rounded-lg shadow-md bg-card">
      <div 
        className="w-24 h-24 border-2 border-primary rounded-lg flex items-center justify-center text-4xl font-bold text-primary bg-background shadow-inner"
        aria-live="polite"
        title={rolledValue !== null ? t('diceRoller.diceRolled', {value: rolledValue}) : t('diceRoller.diceNotRolled')}
      >
        {rolledValue !== null ? rolledValue : <Dices size={48} className="text-muted-foreground" />}
      </div>
      <Button onClick={rollDice} disabled={isRolling} className="w-full max-w-xs">
        <Dices className="mr-2 h-5 w-5" />
        {isRolling ? t('diceRoller.rolling') : t('diceRoller.roll', {sides: diceSides})}
      </Button>
    </div>
  );
}
