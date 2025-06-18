"use client";

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarSeparator,
  SidebarInput
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGame } from '@/components/game/game-provider';
import { MAX_TILES, MIN_TILES } from '@/lib/constants';
import { Gem, Settings, Share2, Zap, Rows3, Palette, Info, Wand2 } from 'lucide-react';
import type { BoardSettings } from '@/types';
import React from 'react';

export function AppSidebarContent() {
  const { state, dispatch, initializeNewBoard } = useGame();
  const boardSettings = state.boardConfig?.settings;

  const handleSettingChange = <K extends keyof BoardSettings>(key: K, value: BoardSettings[K]) => {
    dispatch({ type: 'UPDATE_BOARD_SETTINGS', payload: { [key]: value } });
  };
  
  const handleNumberOfTilesChange = (value: number[]) => {
    const newNumberOfTiles = value[0];
    if (boardSettings && newNumberOfTiles !== boardSettings.numberOfTiles) {
      handleSettingChange('numberOfTiles', newNumberOfTiles);
      // Potentially re-initialize tiles or adjust existing ones.
      // For now, just updating settings. Tile array adjustment logic will be in BoardDesigner.
    }
  };

  const handleShare = () => {
    if (state.boardConfig) {
      try {
        const jsonString = JSON.stringify(state.boardConfig);
        const base64Data = btoa(jsonString);
        const shareUrl = `${window.location.origin}/?board=${encodeURIComponent(base64Data)}`;
        navigator.clipboard.writeText(shareUrl)
          .then(() => alert('Shareable link copied to clipboard!'))
          .catch(err => console.error('Failed to copy URL: ', err));
      } catch (error) {
        console.error("Error creating share link:", error);
        alert("Error creating share link.");
      }
    }
  };


  return (
    <ScrollArea className="h-full flex-1">
      <SidebarMenu>
        <SidebarGroup>
          <SidebarGroupLabel className="font-headline">BoardWise Designer</SidebarGroupLabel>
          <SidebarGroupContent className="space-y-4">
            <Button onClick={initializeNewBoard} className="w-full" variant="outline">
              <Wand2 className="mr-2 h-4 w-4" /> New Board
            </Button>
             {boardSettings && (
              <Button onClick={handleShare} className="w-full">
                <Share2 className="mr-2 h-4 w-4" /> Share Board
              </Button>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarSeparator />

        {boardSettings && (
          <>
            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center gap-2 font-headline">
                <Settings size={16} /> Board Settings
              </SidebarGroupLabel>
              <SidebarGroupContent className="space-y-4">
                <div>
                  <Label htmlFor="boardName" className="text-sm font-medium">Board Name</Label>
                  <Input 
                    id="boardName" 
                    value={boardSettings.name} 
                    onChange={(e) => handleSettingChange('name', e.target.value)}
                    className="mt-1"
                  />
                </div>
                 <div>
                  <Label htmlFor="boardDescription" className="text-sm font-medium">Description</Label>
                  <Input 
                    id="boardDescription" 
                    value={boardSettings.description || ''} 
                    onChange={(e) => handleSettingChange('description', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="numTiles" className="text-sm font-medium">
                    Number of Tiles: {boardSettings.numberOfTiles}
                  </Label>
                  <Slider
                    id="numTiles"
                    min={MIN_TILES}
                    max={MAX_TILES}
                    step={1}
                    value={[boardSettings.numberOfTiles]}
                    onValueChange={handleNumberOfTilesChange}
                    className="mt-2"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="punishmentMode" className="text-sm font-medium">Punishment Mode</Label>
                  <Switch
                    id="punishmentMode"
                    checked={boardSettings.punishmentMode}
                    onCheckedChange={(checked) => handleSettingChange('punishmentMode', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="randomizeTiles" className="text-sm font-medium">Randomize Tiles</Label>
                  <Switch
                    id="randomizeTiles"
                    checked={boardSettings.randomizeTiles}
                    onCheckedChange={(checked) => handleSettingChange('randomizeTiles', checked)}
                  />
                </div>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />

            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center gap-2 font-headline">
                <Gem size={16} /> Dice Configuration
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <div>
                  <Label htmlFor="diceSides" className="text-sm font-medium">Dice Sides: {boardSettings.diceSides}</Label>
                  <Slider
                    id="diceSides"
                    min={1}
                    max={12}
                    step={1}
                    value={[boardSettings.diceSides]}
                    onValueChange={(val) => handleSettingChange('diceSides', val[0])}
                    className="mt-2"
                  />
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
            <SidebarSeparator />
             <SidebarGroup>
                <SidebarGroupLabel className="flex items-center gap-2 font-headline">
                    <Palette size={16} /> Tile Editor (Selected Tile)
                </SidebarGroupLabel>
                <SidebarGroupContent>
                    <p className="text-sm text-muted-foreground">Select a tile on the board to edit its properties here.</p>
                    {/* Placeholder for TileEditor component or its contents */}
                </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}

        <SidebarMenuItem>
          <SidebarMenuButton tooltip="Coming Soon!" disabled>
            <Zap size={16} /> AI Generation
          </SidebarMenuButton>
        </SidebarMenuItem>
        
        <SidebarMenuItem>
          <SidebarMenuButton tooltip="Guide & Info">
            <Info size={16} /> Tutorial & Info
          </SidebarMenuButton>
        </SidebarMenuItem>

      </SidebarMenu>
    </ScrollArea>
  );
}
