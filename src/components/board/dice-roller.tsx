
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useGame } from '@/components/game/game-provider';
import { Dices } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import { playSound } from '@/lib/sound-service';

interface DiceRollerProps {
  isDesignerMode?: boolean;
}

export function DiceRoller({ isDesignerMode = false }: DiceRollerProps) {
  const { state, dispatch } = useGame();
  const { t } = useLanguage();
  const [rolledValueDisplay, setRolledValueDisplay] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);

  const diceSides = state.boardConfig?.settings.diceSides || 6;
  
  const canRoll = isDesignerMode
    ? !isRolling 
    : state.gameStatus === 'playing' && state.activeTileForInteraction === null && !state.winner;

  const rollDice = () => {
    if (isRolling || !canRoll) return;
    setIsRolling(true);
    setRolledValueDisplay(null); // Clear display initially to show "..." or start animation clean

    let currentRollCount = 0;
    const rollInterval = setInterval(() => {
      setRolledValueDisplay(Math.floor(Math.random() * diceSides) + 1);
      currentRollCount++;
      if (currentRollCount > 10) { // Animate for 10 * 75ms = 750ms
        clearInterval(rollInterval);
        const finalValue = Math.floor(Math.random() * diceSides) + 1;
        setRolledValueDisplay(finalValue);
        setIsRolling(false);
        playSound('diceRoll');
        if (!isDesignerMode) {
          dispatch({ type: 'PLAYER_ROLLED_DICE', payload: { diceValue: finalValue } });
        }
      }
    }, 75); 
  };

  useEffect(() => {
    // This effect manages clearing the dice display based on game state changes,
    // primarily for play mode. In designer mode, the dice display is ephemeral
    // and resets with each roll animation.
    if (!isDesignerMode) {
      if (state.activeTileForInteraction || state.winner) {
        // If an interaction starts (activeTileForInteraction is set) OR the game has a winner,
        // clear the displayed dice value.
        setRolledValueDisplay(null);
      } else if (state.gameStatus === 'playing' && !state.activeTileForInteraction && !state.winner && state.diceRoll === null) {
        // This condition ensures that on a new turn (after PROCEED_TO_NEXT_TURN which nulls state.diceRoll)
        // or on "Play Again" (which also nulls state.diceRoll), the local display is cleared.
        setRolledValueDisplay(null);
      }
    }
  }, [isDesignerMode, state.gameStatus, state.activeTileForInteraction, state.winner, state.diceRoll]);


  return (
    <div className="flex flex-col items-center space-y-4 p-4 rounded-lg shadow-md bg-card">
      <div
        className="w-24 h-24 border-2 border-primary rounded-lg flex items-center justify-center text-4xl font-bold text-primary bg-background shadow-inner"
        aria-live="polite"
        title={rolledValueDisplay !== null ? t('diceRoller.diceRolled', {value: rolledValueDisplay}) : t('diceRoller.diceNotRolled')}
      >
        {isRolling && rolledValueDisplay === null ? "..." : 
         (rolledValueDisplay !== null ? rolledValueDisplay : <Dices size={48} className="text-muted-foreground" />)
        }
      </div>
      <Button 
        onClick={rollDice} 
        disabled={isRolling || !canRoll || (!isDesignerMode && !!state.winner)} 
        className="w-full max-w-xs"
      >
        <Dices className="mr-2 h-5 w-5" />
        {isRolling ? t('diceRoller.rolling') : ((!isDesignerMode && state.winner) ? t('playPage.gameOver') : t('diceRoller.roll', {sides: diceSides}))}
      </Button>
    </div>
  );
}
