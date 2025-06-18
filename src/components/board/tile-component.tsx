"use client";

import type { Tile } from '@/types';
import { cn } from '@/lib/utils';
import { TILE_TYPE_EMOJIS, DEFAULT_TILE_COLOR } from '@/lib/constants';
import { Flag, FlagOff, Info, HelpCircle, Star, AlertTriangle, CheckCircle2 } from 'lucide-react'; // Added more icons

interface TileComponentProps {
  tile: Tile;
  onClick?: () => void;
  isInteractive?: boolean;
  playersOnTile?: { id: string; color: string }[];
}

const tileTypeIcons: Record<Tile['type'], React.ElementType> = {
  start: Flag,
  finish: FlagOff,
  quiz: HelpCircle,
  info: Info,
  reward: Star,
  empty: () => null, // No specific icon for empty, emoji is used
};

export function TileComponent({ tile, onClick, isInteractive, playersOnTile = [] }: TileComponentProps) {
  const IconComponent = tileTypeIcons[tile.type] || (() => null);
  const tileEmoji = tile.ui.icon || TILE_TYPE_EMOJIS[tile.type] || '';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isInteractive}
      className={cn(
        "relative w-full h-full rounded-md border-2 flex flex-col items-center justify-center p-1 shadow-sm transition-all duration-150 ease-in-out overflow-hidden text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1",
        isInteractive ? "cursor-pointer hover:scale-105 hover:shadow-md active:scale-95" : "cursor-default",
        tile.type === 'start' && 'border-green-500',
        tile.type === 'finish' && 'border-red-500',
      )}
      style={{ 
        backgroundColor: tile.ui.color || DEFAULT_TILE_COLOR,
        borderColor: tile.ui.color ? `color-mix(in srgb, ${tile.ui.color} 70%, black)` : undefined,
      }}
      aria-label={`Tile ${tile.position + 1}, type: ${tile.type}`}
      role="gridcell"
    >
      <div className="absolute top-1 left-1 text-[0.6rem] font-bold opacity-70" style={{ color: tile.ui.color && tile.ui.color !== DEFAULT_TILE_COLOR ? 'white' : 'black' }}>
        {tile.position + 1}
      </div>
      
      <div className="text-2xl mb-0.5" role="img" aria-label={`${tile.type} icon`}>
        {tileEmoji || <IconComponent size={20} style={{ color: tile.ui.color && tile.ui.color !== DEFAULT_TILE_COLOR ? 'white' : 'black' }} />}
      </div>
      
      <span className="truncate text-[0.65rem] capitalize" style={{ color: tile.ui.color && tile.ui.color !== DEFAULT_TILE_COLOR ? 'white' : 'black' }}>
        {tile.type !== 'empty' ? tile.type : ''}
      </span>

      {playersOnTile.length > 0 && (
        <div className="absolute bottom-1 right-1 flex space-x-0.5">
          {playersOnTile.map(player => (
            <div
              key={player.id}
              className="w-2 h-2 rounded-full border border-background"
              style={{ backgroundColor: player.color }}
              title={`Player on this tile`}
            />
          ))}
        </div>
      )}
    </button>
  );
}
