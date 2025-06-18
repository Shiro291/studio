
"use client";

import type { Tile, Player } from '@/types';
import { cn } from '@/lib/utils';
import { TILE_TYPE_EMOJIS, DEFAULT_TILE_COLOR } from '@/lib/constants';
import { Flag, FlagOff, Info, HelpCircle, Star } from 'lucide-react';
import React from 'react'; // Import React for React.memo

interface TileComponentProps {
  tile: Tile;
  onClick?: () => void;
  isInteractive?: boolean;
  playersOnTile?: Player[];
  isAnimatingPlayerStep?: boolean; // To highlight the current step of an animating pawn
}

const tileTypeIcons: Record<Tile['type'], React.ElementType | null> = {
  start: Flag,
  finish: FlagOff,
  quiz: HelpCircle,
  info: Info,
  reward: Star,
  empty: null,
};

function isColorDark(hexColor?: string): boolean {
  if (!hexColor) return false;
  const color = hexColor.startsWith('#') ? hexColor.substring(1) : hexColor;
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 140;
}

// Wrap TileComponent with React.memo
export const TileComponent = React.memo(function TileComponent({ tile, onClick, isInteractive, playersOnTile = [], isAnimatingPlayerStep = false }: TileComponentProps) {
  const IconComponent = tileTypeIcons[tile.type];
  const tileEmoji = tile.ui.icon || TILE_TYPE_EMOJIS[tile.type] || '';

  const defaultTextColor = 'black';
  const darkBgTextColor = 'white';

  let determinedTextColor = defaultTextColor;
  if (tile.ui.color && tile.ui.color !== DEFAULT_TILE_COLOR) {
    determinedTextColor = isColorDark(tile.ui.color) ? darkBgTextColor : defaultTextColor;
  }

  const textShadowStyle: React.CSSProperties = {
     textShadow: `
      -1px -1px 0 ${determinedTextColor === darkBgTextColor ? defaultTextColor : darkBgTextColor},  
       1px -1px 0 ${determinedTextColor === darkBgTextColor ? defaultTextColor : darkBgTextColor},
      -1px  1px 0 ${determinedTextColor === darkBgTextColor ? defaultTextColor : darkBgTextColor},
       1px  1px 0 ${determinedTextColor === darkBgTextColor ? defaultTextColor : darkBgTextColor},
       0px 0px 3px ${determinedTextColor === darkBgTextColor ? defaultTextColor : darkBgTextColor}
     `
  };


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
        isAnimatingPlayerStep && 'ring-2 ring-offset-1 ring-yellow-400 scale-105 shadow-xl' // Highlight for animating pawn
      )}
      style={{
        backgroundColor: tile.ui.color || DEFAULT_TILE_COLOR,
        borderColor: tile.ui.color ? `color-mix(in srgb, ${tile.ui.color} 70%, black)` : undefined,
      }}
      aria-label={`Tile ${tile.position + 1}, type: ${tile.type}`}
      role="gridcell"
    >
      <div
        className="absolute top-1 left-1 text-[0.6rem] font-bold opacity-90"
        style={{ color: determinedTextColor, ...textShadowStyle }}
      >
        {tile.position + 1}
      </div>

      <div className="text-2xl mb-0.5" role="img" aria-label={`${tile.type} icon`}>
        {tileEmoji || (IconComponent ? <IconComponent size={20} style={{ color: determinedTextColor }} /> : null)}
      </div>

      {playersOnTile.length > 0 && (
        <div className="absolute bottom-0.5 right-0.5 left-0.5 flex flex-wrap justify-end items-end p-px gap-px max-w-full">
          {playersOnTile.slice(0, 4).map(player => (
            <div
              key={player.id}
              className={cn(
                "w-4 h-4 rounded-full border border-background shadow-md", // Increased pawn size
                player.id === playersOnTile.find(p => isAnimatingPlayerStep && p.id === playersOnTile[0].id)?.id && "ring-1 ring-yellow-300 scale-110" // Highlight if this player is the one animating to this step
              )}
              style={{ backgroundColor: player.color }}
              title={player.name}
            />
          ))}
          {playersOnTile.length > 4 && (
             <div className="w-4 h-4 rounded-full bg-muted-foreground/50 text-white flex items-center justify-center text-[0.6rem] leading-none">
                +{playersOnTile.length - 4}
             </div>
          )}
        </div>
      )}
    </button>
  );
});

TileComponent.displayName = 'TileComponent'; // Good practice for memoized components
