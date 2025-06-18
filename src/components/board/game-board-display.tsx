
"use client";

import type { BoardConfig, Tile } from '@/types';
import { TileComponent } from './tile-component';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface GameBoardDisplayProps {
  boardConfig: BoardConfig;
  onTileClick?: (tile: Tile) => void; // For designer interaction
  activePlayerId?: string;
  players?: { id: string; position: number; color: string; name?: string }[];
}

export function GameBoardDisplay({ boardConfig, onTileClick, activePlayerId, players = [] }: GameBoardDisplayProps) {
  const { tiles, settings } = boardConfig;
  const numTiles = settings.numberOfTiles;

  // Only grid layout is supported for now
  const displayCols = Math.max(1, Math.ceil(Math.sqrt(numTiles)));
  const displayRows = Math.max(1, Math.ceil(numTiles / displayCols));
  
  const tileSize = "minmax(60px, 1fr)";
  const minDimension = 60;

  const boardBackgroundStyle: React.CSSProperties = {};
  if (settings.boardBackgroundImage) {
    boardBackgroundStyle.backgroundImage = `url(${settings.boardBackgroundImage})`;
    boardBackgroundStyle.backgroundSize = 'cover'; // Or 'contain' or specific values
    boardBackgroundStyle.backgroundPosition = 'center';
    boardBackgroundStyle.backgroundRepeat = 'no-repeat';
  }

  return (
    <div 
      className="w-full aspect-square max-w-2xl mx-auto bg-muted/30 p-2 rounded-lg shadow-inner overflow-hidden"
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
