
"use client";

import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useGame } from '@/components/game/game-provider';
import { MAX_TILES, MIN_TILES, MIN_PLAYERS, MAX_PLAYERS } from '@/lib/constants';
import { Settings, Share2, Palette, Info, Wand2, RefreshCwIcon, Users, Image as ImageIcon, XCircle } from 'lucide-react';
import type { BoardSettings, WinningCondition } from '@/types';
import React, { useRef, useState } from 'react';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Image from 'next/image';
import { TutorialModal } from './tutorial-modal';


export function AppSidebarContent() {
  const { state, dispatch, initializeNewBoard, randomizeTileVisuals } = useGame();
  const { t } = useLanguage();
  const { toast } = useToast();
  const boardSettings = state.boardConfig?.settings;
  const boardBgInputRef = useRef<HTMLInputElement>(null);
  const [isTutorialModalOpen, setIsTutorialModalOpen] = useState(false);

  const handleSettingChange = <K extends keyof BoardSettings>(key: K, value: BoardSettings[K]) => {
    dispatch({ type: 'UPDATE_BOARD_SETTINGS', payload: { [key]: value } });
  };
  
  const handleSliderChange = (key: 'numberOfTiles' | 'diceSides' | 'numberOfPlayers') => (value: number[]) => {
     if (boardSettings && value[0] !== boardSettings[key]) {
      handleSettingChange(key, value[0]);
    }
  };

  const handleBoardBackgroundImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUri = reader.result as string;
        handleSettingChange('boardBackgroundImage', dataUri);
      };
      reader.readAsDataURL(file);
    }
    if (event.target) {
      event.target.value = ''; // Reset file input
    }
  };

  const removeBoardBackgroundImage = () => {
    handleSettingChange('boardBackgroundImage', undefined);
    if (boardBgInputRef.current) {
      boardBgInputRef.current.value = '';
    }
  };


  const handleShare = () => {
    if (state.boardConfig) {
      try {
        const jsonString = JSON.stringify(state.boardConfig);
        const base64Data = btoa(jsonString);
        const shareUrl = `${window.location.origin}/play?board=${encodeURIComponent(base64Data)}`;
        navigator.clipboard.writeText(shareUrl)
          .then(() => {
            toast({
              title: t('sidebar.linkCopiedTitle'),
              description: t('sidebar.linkCopiedDescriptionPlay'),
            });
          })
          .catch(err => {
            console.error('Failed to copy URL: ', err);
            toast({
              variant: "destructive",
              title: t('sidebar.copyFailedTitle'),
              description: t('sidebar.copyFailedDescription'),
            });
          });
      } catch (error) {
        console.error("Error creating share link:", error);
        toast({
          variant: "destructive",
          title: t('sidebar.linkErrorTitle'),
          description: t('sidebar.linkErrorDescription'),
        });
      }
    }
  };

  const handleRandomizeVisuals = () => {
    randomizeTileVisuals();
    toast({
      title: t('sidebar.visualsRandomizedTitle'),
      description: t('sidebar.visualsRandomizedDescription'),
    });
  };


  return (
    <>
    <ScrollArea className="h-full flex-1">
      <SidebarMenu>
        <SidebarGroup>
          <SidebarGroupLabel className="font-headline">{t('sidebar.title')}</SidebarGroupLabel>
          <SidebarGroupContent className="space-y-4">
            <Button onClick={initializeNewBoard} className="w-full" variant="outline">
              <Wand2 className="mr-2 h-4 w-4" /> {t('sidebar.newBoard')}
            </Button>
             {boardSettings && (
              <Button onClick={handleShare} className="w-full">
                <Share2 className="mr-2 h-4 w-4" /> {t('sidebar.exportShareBoard')}
              </Button>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarSeparator />

        {boardSettings && (
          <>
            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center gap-2 font-headline">
                <Settings size={16} /> {t('sidebar.boardSettings')}
              </SidebarGroupLabel>
              <SidebarGroupContent className="space-y-4">
                <div>
                  <Label htmlFor="boardName" className="text-sm font-medium">{t('sidebar.boardName')}</Label>
                  <Input 
                    id="boardName" 
                    value={boardSettings.name} 
                    onChange={(e) => handleSettingChange('name', e.target.value)}
                    className="mt-1"
                  />
                </div>
                 <div>
                  <Label htmlFor="boardDescription" className="text-sm font-medium">{t('sidebar.description')}</Label>
                  <Input 
                    id="boardDescription" 
                    value={boardSettings.description || ''} 
                    onChange={(e) => handleSettingChange('description', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="numTiles" className="text-sm font-medium">
                    {t('sidebar.numberOfTiles', { count: boardSettings.numberOfTiles })}
                  </Label>
                  <Slider
                    id="numTiles"
                    min={MIN_TILES}
                    max={MAX_TILES}
                    step={1}
                    value={[boardSettings.numberOfTiles]}
                    onValueChange={handleSliderChange('numberOfTiles')}
                    className="mt-2"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="punishmentMode" className="text-sm font-medium">{t('sidebar.punishmentMode')}</Label>
                  <Switch
                    id="punishmentMode"
                    checked={boardSettings.punishmentMode}
                    onCheckedChange={(checked) => handleSettingChange('punishmentMode', checked)}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="randomizeTilesOnLoad" className="text-sm font-medium">{t('sidebar.randomizeTilesOnLoad')}</Label>
                  <Switch
                    id="randomizeTilesOnLoad"
                    checked={boardSettings.randomizeTiles} 
                    onCheckedChange={(checked) => handleSettingChange('randomizeTiles', checked)}
                  />
                </div>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />
            
            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center gap-2 font-headline">
                <ImageIcon size={16} /> {t('sidebar.boardAppearance')}
              </SidebarGroupLabel>
              <SidebarGroupContent className="space-y-2">
                 <div>
                    <Label htmlFor="boardBgImage" className="text-sm font-medium">{t('sidebar.boardBackgroundImage')}</Label>
                    {boardSettings.boardBackgroundImage && (
                      <div className="mt-2 relative w-full aspect-video border rounded-md overflow-hidden">
                        <Image src={boardSettings.boardBackgroundImage} alt={t('sidebar.boardBackgroundPreview')} layout="fill" objectFit="contain" unoptimized />
                        <Button 
                          variant="destructive" 
                          size="icon" 
                          className="absolute top-1 right-1 h-7 w-7 z-10"
                          onClick={removeBoardBackgroundImage}
                          aria-label={t('sidebar.removeBoardBackgroundImage')}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    <Input 
                      id="boardBgImage" 
                      type="file" 
                      accept="image/*" 
                      onChange={handleBoardBackgroundImageChange}
                      className="mt-1 text-xs"
                      ref={boardBgInputRef}
                    />
                    <p className="text-xs text-muted-foreground mt-1">{t('sidebar.boardBackgroundImageHelp')}</p>
                  </div>
              </SidebarGroupContent>
            </SidebarGroup>


            <SidebarSeparator />

            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center gap-2 font-headline">
                <Users size={16} /> {t('sidebar.playerSettings')}
              </SidebarGroupLabel>
              <SidebarGroupContent className="space-y-4">
                <div>
                  <Label htmlFor="numPlayers" className="text-sm font-medium">
                    {t('sidebar.numberOfPlayers', { count: boardSettings.numberOfPlayers })}
                  </Label>
                  <Slider
                    id="numPlayers"
                    min={MIN_PLAYERS}
                    max={MAX_PLAYERS}
                    step={1}
                    value={[boardSettings.numberOfPlayers]}
                    onValueChange={handleSliderChange('numberOfPlayers')}
                    className="mt-2"
                  />
                </div>
                 <div>
                  <Label htmlFor="winningCondition" className="text-sm font-medium">{t('sidebar.winningCondition')}</Label>
                   <Select
                    value={boardSettings.winningCondition}
                    onValueChange={(value: WinningCondition) => handleSettingChange('winningCondition', value)}
                  >
                    <SelectTrigger id="winningCondition" className="mt-1">
                      <SelectValue placeholder={t('sidebar.selectWinningCondition')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="firstToFinish">{t('sidebar.firstToFinish')}</SelectItem>
                      <SelectItem value="highestScore">{t('sidebar.highestScore')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />
            
            <SidebarGroup>
              <SidebarGroupLabel className="flex items-center gap-2 font-headline">
                 {/* Using an SVG for dice as Gem icon might be confusing */}
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-dice-3"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><path d="M16 8h.01"/><path d="M12 12h.01"/><path d="M8 16h.01"/></svg>
                {t('sidebar.diceConfiguration')}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <div>
                  <Label htmlFor="diceSides" className="text-sm font-medium">{t('sidebar.diceSides', { count: boardSettings.diceSides })}</Label>
                  <Slider
                    id="diceSides"
                    min={1}
                    max={12}
                    step={1}
                    value={[boardSettings.diceSides]}
                    onValueChange={handleSliderChange('diceSides')}
                    className="mt-2"
                  />
                </div>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator />
             <SidebarGroup>
                <SidebarGroupLabel className="flex items-center gap-2 font-headline">
                    <Palette size={16} /> {t('sidebar.tileCustomization')}
                </SidebarGroupLabel>
                <SidebarGroupContent className="space-y-2">
                    <p className="text-sm text-muted-foreground">{t('sidebar.selectTileToEdit')}</p>
                    <Button onClick={handleRandomizeVisuals} className="w-full" variant="outline">
                        <RefreshCwIcon className="mr-2 h-4 w-4" /> {t('sidebar.randomizeVisuals')}
                    </Button>
                </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
        
        <SidebarMenuItem>
          <SidebarMenuButton onClick={() => setIsTutorialModalOpen(true)} tooltip={t('sidebar.tutorialAndInfoTooltip')}>
            <Info size={16} /> {t('sidebar.tutorialAndInfo')}
          </SidebarMenuButton>
        </SidebarMenuItem>

      </SidebarMenu>
    </ScrollArea>
    <TutorialModal isOpen={isTutorialModalOpen} onClose={() => setIsTutorialModalOpen(false)} />
    </>
  );
}
