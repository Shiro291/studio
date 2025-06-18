
"use client";

import type { BoardConfig, Tile, Player } from '@/types';
import { TileComponent } from './tile-component';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useGame } from '@/components/game/game-provider'; // Added for pawn animation check

interface GameBoardDisplayProps {
  boardConfig: BoardConfig;
  onTileClick?: (tile: Tile) => void; 
  players?: Player[]; // Make players optional as GameProvider will supply them in play mode
}

export function GameBoardDisplay({ boardConfig, onTileClick }: GameBoardDisplayProps) {
  const { state: gameState } = useGame(); // Get full game state
  const actualPlayers = gameState.players; // Use players from game state for accurate visualPosition
  const { tiles, settings } = boardConfig;
  const numTiles = settings.numberOfTiles;

  let displayCols: number;

  if (numTiles <= 0) {
    displayCols = 1; 
  } else if (numTiles <= 5) {
    displayCols = numTiles; 
  } else {
    const sqrtN = Math.sqrt(numTiles);
    const c1 = Math.floor(sqrtN); 
    const c2 = Math.ceil(sqrtN);

    let r1 = Infinity, r2 = Infinity;
    let badness1 = Infinity, badness2 = Infinity;
    let isPerfect1 = false, isPerfect2 = false;

    if (c1 > 0) {
        r1 = Math.ceil(numTiles / c1);
        badness1 = Math.abs(c1 - r1) + ((c1 * r1) - numTiles);
        isPerfect1 = (c1 * r1 === numTiles);
    }
    
    if (c2 > 0) { 
        r2 = Math.ceil(numTiles / c2);
        badness2 = Math.abs(c2 - r2) + ((c2 * r2) - numTiles);
        isPerfect2 = (c2 * r2 === numTiles);
    }
    
    if (c1 > 0 && isPerfect1 && isPerfect2) { 
        displayCols = (c1 >= r1) ? c1 : c2;
    } else if (isPerfect1 && c1 > 0) {
        displayCols = c1;
    } else if (isPerfect2) {
        displayCols = c2;
    } else { 
        if (c1 > 0 && badness1 <= badness2) {
            displayCols = c1;
        } else {
            displayCols = c2;
        }
    }

    if (numTiles > 12) {
        if (numTiles <= 25 && displayCols > 6) displayCols = Math.min(displayCols, 6); 
        else if (numTiles <= 30 && displayCols > 7) displayCols = Math.min(displayCols, 7);
        else if (numTiles <= 50 && displayCols > 8) displayCols = Math.min(displayCols, 8);
        else if (numTiles > 50 && displayCols > 10) displayCols = Math.min(displayCols, 10);
    } else if (numTiles > 5) { 
        if (displayCols > 5) displayCols = Math.min(displayCols, 5); 
    }
  }
  
  displayCols = Math.min(displayCols, numTiles); 
  if (displayCols <= 0) displayCols = 1; 

  const displayRows = Math.ceil(numTiles / displayCols);
  
  const tileSize = "minmax(60px, 1fr)"; 
  const minDimension = 60; 

  const boardBackgroundStyle: React.CSSProperties = {};
  if (settings.boardBackgroundImage) {
    boardBackgroundStyle.backgroundImage = `url(${settings.boardBackgroundImage})`;
    boardBackgroundStyle.backgroundSize = 'cover'; 
    boardBackgroundStyle.backgroundPosition = 'center';
    boardBackgroundStyle.backgroundRepeat = 'no-repeat';
  }

  return (
    <div 
      className="w-full aspect-square mx-auto bg-muted/30 p-2 rounded-lg shadow-inner overflow-hidden"
      style={boardBackgroundStyle}
    >
      <ScrollArea className="w-full h-full whitespace-nowrap">
        <div
            className="grid gap-1.5 h-full"
            style={{
                gridTemplateColumns: `repeat(${displayCols}, ${tileSize})`,
                gridTemplateRows: `repeat(${displayRows}, ${tileSize})`,
                minWidth: `${displayCols * minDimension}px`, 
                minHeight: `${displayRows * minDimension}px`,
            }}
            role="grid"
            aria-label="Game Board"
        >
            {tiles.map((tile) => {
              const playersOnThisTile = actualPlayers.filter(p => p.visualPosition === tile.position);
              const isAnimatingPlayerOnThisTile = gameState.pawnAnimation && 
                                                playersOnThisTile.some(p => p.id === gameState.pawnAnimation?.playerId);
              return (
                <TileComponent
                    key={tile.id}
                    tile={tile}
                    onClick={onTileClick ? () => onTileClick(tile) : undefined}
                    isInteractive={!!onTileClick}
                    playersOnTile={playersOnThisTile}
                    isAnimatingPlayerStep={isAnimatingPlayerOnThisTile && gameState.pawnAnimation?.path[gameState.pawnAnimation.currentStepIndex] === tile.position}
                />
              );
            })}
        </div>
        <ScrollBar orientation="horizontal" />
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </div>
  );
}
