"use client";

import type { BoardConfig, Tile } from '@/types';
import { TileComponent } from './tile-component';
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

interface GameBoardDisplayProps {
  boardConfig: BoardConfig;
  onTileClick?: (tile: Tile) => void; // For designer interaction
  activePlayerId?: string;
  players?: { id: string; position: number; color: string }[];
}

export function GameBoardDisplay({ boardConfig, onTileClick, activePlayerId, players = [] }: GameBoardDisplayProps) {
  const { tiles, settings } = boardConfig;
  const numTiles = settings.numberOfTiles;

  // Determine grid layout - simple linear for now, can be more complex (e.g. snake, spiral)
  // For a linear board, a horizontal scroll might be best for many tiles.
  // Let's try to make it wrap if possible, aiming for a squarish layout.
  const cols = Math.ceil(Math.sqrt(numTiles));
  const rows = Math.ceil(numTiles / cols);
  
  // Calculate tile size based on container width/height for responsiveness
  // This is a simplified approach. For perfect squares and responsiveness, more complex CSS or JS is needed.
  const tileSize = "minmax(60px, 1fr)"; // Responsive tile size

  return (
    <div className="w-full aspect-square max-w-2xl mx-auto bg-muted/30 p-2 rounded-lg shadow-inner overflow-hidden">
      <ScrollArea className="w-full h-full whitespace-nowrap">
        <div
            className="grid gap-1.5 h-full"
            style={{
                gridTemplateColumns: `repeat(${cols}, ${tileSize})`,
                gridTemplateRows: `repeat(${rows}, ${tileSize})`,
                // Ensure the grid itself can be smaller than the scroll area if few tiles
                minWidth: `${cols * 60}px`, 
                minHeight: `${rows * 60}px`,
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
