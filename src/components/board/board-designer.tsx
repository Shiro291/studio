"use client";

import React, { useState, useEffect } from 'react';
import { useGame } from '@/components/game/game-provider';
import type { Tile, TileType } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { nanoid } from 'nanoid';
import { DEFAULT_TILE_COLOR, START_TILE_COLOR, FINISH_TILE_COLOR, TILE_TYPE_EMOJIS } from '@/lib/constants';
import { Edit3, Trash2 } from 'lucide-react';
import { TileEditorModal } from './tile-editor-modal';
import { useLanguage } from '@/context/language-context';

export function BoardDesigner() {
  const { state, dispatch } = useGame();
  const { t } = useLanguage();
  const [selectedTileForEdit, setSelectedTileForEdit] = useState<Tile | null>(null);

  useEffect(() => {
    if (state.boardConfig) {
      const { numberOfTiles } = state.boardConfig.settings;
      const currentTiles = state.boardConfig.tiles || []; // Ensure currentTiles is an array

      // Determine if an update is needed
      let needsUpdate = currentTiles.length !== numberOfTiles;

      if (!needsUpdate && numberOfTiles > 0) {
        if (currentTiles[0]?.type !== 'start' || 
            currentTiles[0]?.ui?.icon !== TILE_TYPE_EMOJIS.start ||
            currentTiles[0]?.ui?.color !== START_TILE_COLOR) {
          needsUpdate = true;
        }
        if (numberOfTiles > 1) {
          if(currentTiles[numberOfTiles - 1]?.type !== 'finish' ||
             currentTiles[numberOfTiles - 1]?.ui?.icon !== TILE_TYPE_EMOJIS.finish ||
             currentTiles[numberOfTiles - 1]?.ui?.color !== FINISH_TILE_COLOR) {
            needsUpdate = true;
          }
        }
      } else if (numberOfTiles === 0 && currentTiles.length > 0) {
        // If numberOfTiles is somehow 0 but currentTiles exist, clear them
        needsUpdate = true;
      }


      if (needsUpdate) {
        const newTiles: Tile[] = [];
        if (numberOfTiles > 0) {
            for (let i = 0; i < numberOfTiles; i++) {
                const existingTileAtPosition = currentTiles.find(
                    (t) => t.position === i && t.type !== 'start' && t.type !== 'finish'
                );

                if (i === 0) {
                    newTiles.push({
                        id: currentTiles[0]?.type === 'start' ? currentTiles[0].id : nanoid(),
                        type: 'start' as TileType,
                        position: 0,
                        ui: { color: START_TILE_COLOR, icon: TILE_TYPE_EMOJIS.start },
                        config: undefined,
                    });
                } else if (i === numberOfTiles - 1 && numberOfTiles > 1) {
                    newTiles.push({
                        id: currentTiles[numberOfTiles - 1]?.type === 'finish' ? currentTiles[numberOfTiles - 1].id : nanoid(),
                        type: 'finish' as TileType,
                        position: i,
                        ui: { color: FINISH_TILE_COLOR, icon: TILE_TYPE_EMOJIS.finish },
                        config: undefined,
                    });
                } else if (existingTileAtPosition) {
                    newTiles.push({ ...existingTileAtPosition, position: i });
                } else {
                    newTiles.push({
                        id: nanoid(),
                        type: 'empty' as TileType,
                        position: i,
                        ui: { color: DEFAULT_TILE_COLOR, icon: TILE_TYPE_EMOJIS.empty },
                    });
                }
            }
        }
        // Ensure if only one tile, it is a start tile.
        if (newTiles.length === 1 && newTiles[0].type !== 'start') {
            newTiles[0] = {
                id: newTiles[0].id, // Keep ID if possible
                type: 'start' as TileType,
                position: 0,
                ui: { color: START_TILE_COLOR, icon: TILE_TYPE_EMOJIS.start },
                config: undefined,
            };
        }
        
        dispatch({ type: 'UPDATE_TILES', payload: newTiles });
      }
    }
  }, [state.boardConfig?.settings.numberOfTiles, state.boardConfig?.tiles, dispatch]);


  if (!state.boardConfig) {
    return <p>{t('boardDesigner.loadingBoardConfig')}</p>;
  }

  const { tiles } = state.boardConfig;

  const handleEditTile = (tile: Tile) => {
    setSelectedTileForEdit(tile);
  };

  const handleSaveTile = (updatedTile: Tile) => {
    const newTiles = tiles.map(t => t.id === updatedTile.id ? updatedTile : t);
    dispatch({ type: 'UPDATE_TILES', payload: newTiles });
    setSelectedTileForEdit(null);
  };

  const handleDeleteTileConfig = (tileId: string) => {
    const targetTile = tiles.find(t => t.id === tileId);
    if (!targetTile || targetTile.type === 'start' || targetTile.type === 'finish') return;

    const newTiles = tiles.map(t => 
      t.id === tileId 
        ? { ...t, type: 'empty' as TileType, config: undefined, ui: { ...t.ui, icon: TILE_TYPE_EMOJIS.empty, color: DEFAULT_TILE_COLOR } } 
        : t
    );
    dispatch({ type: 'UPDATE_TILES', payload: newTiles });
  };
  
  const getTileTypeDisplayName = (type: TileType) => {
    const key = `capitalize.${type.toLowerCase()}` as keyof typeof import('@/lib/locales/en').en;
    return t(key);
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline">{t('boardDesigner.tileConfiguration')}</CardTitle>
        <CardDescription>{t('boardDesigner.tileConfigurationDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          <div className="space-y-2">
            {tiles.map((tile) => (
              <Card key={tile.id} className="p-3 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                     <span 
                        className="w-6 h-6 rounded-sm flex items-center justify-center text-xs" 
                        style={{ backgroundColor: tile.ui.color || DEFAULT_TILE_COLOR, color: tile.ui.color && tile.ui.color !== DEFAULT_TILE_COLOR && tile.ui.color !== START_TILE_COLOR && tile.ui.color !== FINISH_TILE_COLOR ? 'white' : 'black' }}
                        role="img"
                        aria-label={`${tile.type} tile icon`}
                      >
                       {tile.ui.icon || TILE_TYPE_EMOJIS[tile.type] || TILE_TYPE_EMOJIS.empty}
                      </span>
                    <span className="font-medium">{t('boardDesigner.tile')} {tile.position + 1}</span>
                    <span className="text-sm text-muted-foreground capitalize">{getTileTypeDisplayName(tile.type)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEditTile(tile)} aria-label={t('boardDesigner.editTile', {position: tile.position + 1 })}>
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    {(tile.type !== 'empty' && tile.type !== 'start' && tile.type !== 'finish') && (
                       <Button variant="ghost" size="icon" onClick={() => handleDeleteTileConfig(tile.id)} aria-label={t('boardDesigner.clearTileConfig', {position: tile.position + 1 })}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>
                {tile.config && tile.type === 'quiz' && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{t('boardDesigner.questionShort')}: {tile.config.question}</p>
                )}
                 {tile.config && tile.type === 'info' && (
                  <p className="text-xs text-muted-foreground mt-1 truncate">{t('boardDesigner.infoShort')}: {tile.config.message}</p>
                )}
              </Card>
            ))}
          </div>
        </ScrollArea>
        {selectedTileForEdit && (
          <TileEditorModal
            tile={selectedTileForEdit}
            onSave={handleSaveTile}
            onClose={() => setSelectedTileForEdit(null)}
          />
        )}
      </CardContent>
    </Card>
  );
}
