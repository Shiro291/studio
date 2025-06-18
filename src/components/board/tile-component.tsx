
"use client";

import type { Tile, Player } from '@/types';
import { cn } from '@/lib/utils';
import { TILE_TYPE_EMOJIS, DEFAULT_TILE_COLOR, START_TILE_COLOR, FINISH_TILE_COLOR } from '@/lib/constants';
import { Flag, FlagOff, Info, HelpCircle, Star } from 'lucide-react';

interface TileComponentProps {
  tile: Tile;
  onClick?: () => void;
  isInteractive?: boolean;
  playersOnTile?: Player[];
}

const tileTypeIcons: Record<Tile['type'], React.ElementType | null> = {
  start: Flag,
  finish: FlagOff,
  quiz: HelpCircle,
  info: Info,
  reward: Star,
  empty: null,
};

export function TileComponent({ tile, onClick, isInteractive, playersOnTile = [] }: TileComponentProps) {
  const IconComponent = tileTypeIcons[tile.type];
  const tileEmoji = tile.ui.icon || TILE_TYPE_EMOJIS[tile.type] || '';

  const textColor = tile.ui.color && tile.ui.color !== DEFAULT_TILE_COLOR && tile.ui.color !== START_TILE_COLOR && tile.ui.color !== FINISH_TILE_COLOR ? 'white' : 'black';

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
      <div className="absolute top-1 left-1 text-[0.6rem] font-bold opacity-70" style={{ color: textColor }}>
        {tile.position + 1}
      </div>

      <div className="text-2xl mb-0.5" role="img" aria-label={`${tile.type} icon`}>
        {tileEmoji || (IconComponent ? <IconComponent size={20} style={{ color: textColor }} /> : null)}
      </div>

      <span className="truncate text-[0.65rem] capitalize" style={{ color: textColor }}>
        {tile.type !== 'empty' ? tile.type : ''}
      </span>

      {playersOnTile.length > 0 && (
        <div className="absolute bottom-0.5 right-0.5 left-0.5 flex flex-wrap justify-end items-end p-px gap-px max-w-full">
          {playersOnTile.slice(0, 4).map(player => (
            <div
              key={player.id}
              className="w-3 h-3 rounded-full border border-background shadow-md"
              style={{ backgroundColor: player.color }}
              title={player.name}
            />
          ))}
          {playersOnTile.length > 4 && (
             <div className="w-3 h-3 rounded-full bg-muted-foreground/50 text-white flex items-center justify-center text-[0.6rem] leading-none">
                +{playersOnTile.length - 4}
             </div>
          )}
        </div>
      )}
    </button>
  );
}
