
"use client";

import type { BoardConfig, Tile } from '@/types';
import { TileComponent } from './tile-component';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface GameBoardDisplayProps {
  boardConfig: BoardConfig;
  onTileClick?: (tile: Tile) => void; 
  activePlayerId?: string;
  players?: { id: string; position: number; color: string; name?: string }[];
}

export function GameBoardDisplay({ boardConfig, onTileClick, activePlayerId, players = [] }: GameBoardDisplayProps) {
  const { tiles, settings } = boardConfig;
  const numTiles = settings.numberOfTiles;

  let displayCols: number;

  if (numTiles <= 0) {
    displayCols = 1; // Should not happen, defensive
  } else if (numTiles <= 5) {
    displayCols = numTiles; // Single row for very few tiles
  } else {
    // Aim for a layout that's as close to square as possible
    const sqrtN = Math.sqrt(numTiles);
    // Candidate column counts
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
    
    if (c2 > 0) { // c2 will always be >0 if numTiles > 0
        r2 = Math.ceil(numTiles / c2);
        badness2 = Math.abs(c2 - r2) + ((c2 * r2) - numTiles);
        isPerfect2 = (c2 * r2 === numTiles);
    }
    
    if (c1 > 0 && isPerfect1 && isPerfect2) { // Both make perfect rectangles
        // Prefer wider or square. If c1 is 4x5 (c1=4,r1=5), c2 is 5x4 (c2=5,r2=4). (c1 >= r1) is false. So, displayCols = c2 (5).
        displayCols = (c1 >= r1) ? c1 : c2;
    } else if (isPerfect1 && c1 > 0) {
        displayCols = c1;
    } else if (isPerfect2) {
        displayCols = c2;
    } else { // Neither is perfect, pick based on "badness" score
        if (c1 > 0 && badness1 <= badness2) {
            displayCols = c1;
        } else {
            displayCols = c2;
        }
    }

    // Apply general constraints to prevent overly stretched layouts
    if (numTiles > 12) {
        if (numTiles <= 25 && displayCols > 6) displayCols = Math.min(displayCols, 6); // e.g., 25 tiles, 5x5 better than 6x5
        else if (numTiles <= 30 && displayCols > 7) displayCols = Math.min(displayCols, 7);
        else if (numTiles <= 50 && displayCols > 8) displayCols = Math.min(displayCols, 8);
        else if (numTiles > 50 && displayCols > 10) displayCols = Math.min(displayCols, 10);
    } else if (numTiles > 5) { // For 6-12 tiles
        if (displayCols > 5) displayCols = Math.min(displayCols, 5); // Max 5 columns for smaller boards like 9 (3x3) or 12 (4x3)
    }
  }
  
  displayCols = Math.min(displayCols, numTiles); // Cannot have more columns than tiles
  if (displayCols <= 0) displayCols = 1; // Failsafe if numTiles was 0 or negative

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
            {tiles.map((tile) => (
            <TileComponent
                key={tile.id}
                tile={tile}
                onClick={onTileClick ? () => onTileClick(tile) : undefined}
                isInteractive={!!onTileClick}
                playersOnTile={players.filter(p => p.position === tile.position)}
            />
            ))}
        </div>
        <ScrollBar orientation="horizontal" />
        <ScrollBar orientation="vertical" />
      </ScrollArea>
    </div>
  );
}
