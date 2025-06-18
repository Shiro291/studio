
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

  // Dynamically adjust columns for better layout, aiming for squarish look
  let displayCols = Math.max(1, Math.ceil(Math.sqrt(numTiles)));
  if (numTiles <= 10) displayCols = Math.min(numTiles, 5); // Max 5 cols for few tiles
  else if (numTiles <= 20) displayCols = Math.min(numTiles, 6); // Max 6 cols for up to 20
  else if (numTiles <= 30) displayCols = Math.min(numTiles, 7);
  else if (numTiles <= 50) displayCols = Math.min(numTiles, 8);
  else displayCols = Math.min(numTiles, 10); // General max columns

  const displayRows = Math.max(1, Math.ceil(numTiles / displayCols));
  
  const tileSize = "minmax(60px, 1fr)"; // Tiles will try to fill space but have a min size
  const minDimension = 60; // Minimum px width/height for a tile

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
      style={boardBackgroundStyle} // max-w-2xl removed to allow expansion
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
