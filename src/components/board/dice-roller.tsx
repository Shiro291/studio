
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useGame } from '@/components/game/game-provider';
import { Dices } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import { playSound } from '@/lib/sound-service';
import { cn } from '@/lib/utils';

interface DiceRollerProps {
  isDesignerMode?: boolean;
}

export function DiceRoller({ isDesignerMode = false }: DiceRollerProps) {
  const { state, dispatch } = useGame();
  const { t } = useLanguage();
  const [rolledValueDisplay, setRolledValueDisplay] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState(false);
  const [animationIntervalId, setAnimationIntervalId] = useState<NodeJS.Timeout | null>(null);

  const diceSides = state.boardConfig?.settings.diceSides || 6;
  
  const canRoll = isDesignerMode
    ? !isRolling 
    : state.gameStatus === 'playing' && state.activeTileForInteraction === null && !state.winner && state.gameStatus !== 'animating_pawn';

  const rollDice = () => {
    if (isRolling || !canRoll) return;
    setIsRolling(true);
    setRolledValueDisplay(null); 

    if (animationIntervalId) {
      clearInterval(animationIntervalId);
    }

    let currentRollCount = 0; 
    const rollAnimId = setInterval(() => {
      setRolledValueDisplay(Math.floor(Math.random() * diceSides) + 1);
      currentRollCount++;
      if (currentRollCount > (state.boardConfig?.settings.epilepsySafeMode ? 3 : 10)) { // Shorter animation for safe mode
        clearInterval(rollAnimId);
        setAnimationIntervalId(null);
        const finalValue = Math.floor(Math.random() * diceSides) + 1;
        setRolledValueDisplay(finalValue);
        setIsRolling(false);
        playSound('diceRoll');
        if (!isDesignerMode) {
          dispatch({ type: 'PLAYER_ROLLED_DICE', payload: { diceValue: finalValue } });
          // The ADVANCE_PAWN_ANIMATION will be dispatched from within PLAYER_ROLLED_DICE reducer if a move occurs
          if (state.boardConfig?.settings.numberOfTiles && finalValue > 0) { // Ensure there's a board and a roll
            // Only trigger animation if it's not designer mode
             // The PLAYER_ROLLED_DICE action will now set pawnAnimation state,
             // and a useEffect in GameProvider will kick off ADVANCE_PAWN_ANIMATION.
          }
        }
      }
    }, state.boardConfig?.settings.epilepsySafeMode ? 150 : 75);
    setAnimationIntervalId(rollAnimId);
  };

  useEffect(() => {
    if (!isDesignerMode) {
      if (state.activeTileForInteraction || state.winner || state.gameStatus === 'animating_pawn') {
        setRolledValueDisplay(null); // Clear dice display during interaction or animation
      } else if (state.gameStatus === 'playing' && !state.activeTileForInteraction && !state.winner && state.diceRoll === null) {
        setRolledValueDisplay(null); // Clear if turn reset and no roll yet
      }
    }
     // Cleanup interval on unmount
    return () => {
      if (animationIntervalId) {
        clearInterval(animationIntervalId);
      }
    };
  }, [isDesignerMode, state.gameStatus, state.activeTileForInteraction, state.winner, state.diceRoll, animationIntervalId]);


  return (
    <div className={cn(
        "flex flex-col items-center space-y-4 p-4 rounded-lg shadow-md bg-card",
        isDesignerMode ? "p-3 space-y-2" : "p-4 space-y-4"
    )}>
      <div
        className={cn(
            "border-2 border-primary rounded-lg flex items-center justify-center text-4xl font-bold text-primary bg-background shadow-inner",
            isDesignerMode ? "w-16 h-16 text-3xl" : "w-24 h-24 text-4xl",
            isRolling && !state.boardConfig?.settings.epilepsySafeMode && "dice-is-rolling-animation" 
        )}
        aria-live="polite"
        title={rolledValueDisplay !== null ? t('diceRoller.diceRolled', {value: rolledValueDisplay}) : t('diceRoller.diceNotRolled')}
      >
         {isRolling ? (
            rolledValueDisplay ?? "..."
         ) : rolledValueDisplay !== null ? (
            rolledValueDisplay
         ) : (
            <Dices size={isDesignerMode ? 36 : 48} className="text-muted-foreground" />
         )}
      </div>
      <Button 
        onClick={rollDice} 
        disabled={isRolling || !canRoll || (!isDesignerMode && !!state.winner)} 
        className={cn(
            "w-full max-w-xs",
            isDesignerMode ? "h-9 text-sm" : "h-10" 
        )}
      >
        <Dices className={cn("mr-2", isDesignerMode ? "h-4 w-4" : "h-5 w-5")} />
        {isRolling ? t('diceRoller.rolling') : ((!isDesignerMode && state.winner) ? t('playPage.gameOver') : t('diceRoller.roll', {sides: diceSides}))}
      </Button>
    </div>
  );
}
