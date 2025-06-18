"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useGame } from '@/components/game/game-provider';
import { Dices } from 'lucide-react';

export function DiceRoller() {
  const { state, dispatch } = useGame();
  const [rolledValue, setRolledValue] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  const diceSides = state.boardConfig?.settings.diceSides || 6;

  const rollDice = () => {
    if (isRolling) return;
    setIsRolling(true);
    
    // Simulate rolling animation
    let-rollCount = 0;
    const rollInterval = setInterval(() => {
      setRolledValue(Math.floor(Math.random() * diceSides) + 1);
      rollCount++;
      if (rollCount > 10) { // Number of "fast" rolls for animation
        clearInterval(rollInterval);
        const finalValue = Math.floor(Math.random() * diceSides) + 1;
        setRolledValue(finalValue);
        // dispatch({ type: 'SET_DICE_ROLL', payload: finalValue }); // Update game state
        setIsRolling(false);
        // Here, you'd typically trigger pawn movement or other game logic
      }
    }, 50);
  };
  
  // Effect to clear rolled value if dice sides change (e.g. new board loaded)
  useEffect(() => {
    setRolledValue(null);
  }, [diceSides]);

  return (
    <div className="flex flex-col items-center space-y-4 p-4 rounded-lg shadow-md bg-card">
      <div 
        className="w-24 h-24 border-2 border-primary rounded-lg flex items-center justify-center text-4xl font-bold text-primary bg-background shadow-inner"
        aria-live="polite"
        title={rolledValue ? `Dice rolled: ${rolledValue}` : "Dice not rolled yet"}
      >
        {rolledValue !== null ? rolledValue : <Dices size={48} className="text-muted-foreground" />}
      </div>
      <Button onClick={rollDice} disabled={isRolling} className="w-full max-w-xs">
        <Dices className="mr-2 h-5 w-5" />
        {isRolling ? 'Rolling...' : `Roll D${diceSides}`}
      </Button>
    </div>
  );
}
