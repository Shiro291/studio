
"use client";

import {
  SidebarMenu,
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
import { Settings, Palette, Info, Wand2, RefreshCwIcon, Users, Image as ImageIcon, XCircle, Link as LinkIcon, Download, Upload, Dices } from 'lucide-react';
import type { BoardSettings, WinningCondition, PunishmentType } from '@/types';
import React, { useRef } from 'react';
import { useLanguage } from '@/context/language-context';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import NextImage from 'next/image';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";


export function AppSidebarContent() {
  const { state, dispatch, initializeNewBoard, randomizeTileVisuals, loadBoardFromJson } = useGame();
  const { t } = useLanguage();
  const { toast } = useToast();
  const boardSettings = state.boardConfig?.settings;
  const boardBgInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const handleSettingChange = <K extends keyof BoardSettings>(key: K, value: BoardSettings[K]) => {
    dispatch({ type: 'UPDATE_BOARD_SETTINGS', payload: { [key]: value } });
  };
  
  const handleSliderChange = (key: 'numberOfTiles' | 'diceSides' | 'numberOfPlayers' | 'punishmentValue') => (value: number[]) => {
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
      event.target.value = ''; 
    }
  };

  const removeBoardBackgroundImage = () => {
    handleSettingChange('boardBackgroundImage', undefined);
    if (boardBgInputRef.current) {
      boardBgInputRef.current.value = '';
    }
  };


  const handleGeneratePlayLink = () => {
    if (state.boardConfig) {
      try {
        const jsonString = JSON.stringify(state.boardConfig);
        const utf8Encoded = unescape(encodeURIComponent(jsonString));
        const base64Data = btoa(utf8Encoded);
        const shareUrl = `${window.location.origin}/play?board=${encodeURIComponent(base64Data)}`;
        
        navigator.clipboard.writeText(shareUrl)
          .then(() => {
            toast({
              title: t('sidebar.linkCopiedTitle'),
              description: t('sidebar.linkCopiedDescriptionPlay'),
            });
            if (typeof window !== "undefined") {
              window.open(shareUrl, '_blank')?.focus();
            }
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
        console.error("Error creating play link:", error);
        toast({
          variant: "destructive",
          title: t('sidebar.linkErrorTitle'),
          description: t('sidebar.linkErrorDescription'),
        });
      }
    }
  };

  const handleExportBoardFile = () => {
    if (!state.boardConfig) {
      toast({ variant: "destructive", title: t('sidebar.exportErrorTitle'), description: t('sidebar.noBoardToExport') });
      return;
    }
    try {
      const jsonString = JSON.stringify(state.boardConfig, null, 2); 
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.boardConfig.settings.name.replace(/\s+/g, '-').toLowerCase() || 'boardwise-config'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: t('sidebar.boardExportedTitle'), description: t('sidebar.boardExportedDescription') });
    } catch (error) {
      console.error("Error exporting board file:", error);
      toast({ variant: "destructive", title: t('sidebar.exportErrorTitle'), description: t('sidebar.exportErrorDescription') });
    }
  };

  const handleImportBoardFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const jsonString = e.target?.result as string;
          if (loadBoardFromJson(jsonString)) {
            toast({ title: t('sidebar.boardImportedTitle'), description: t('sidebar.boardImportedDescription') });
          } else {
            toast({ variant: "destructive", title: t('sidebar.importErrorTitle'), description: t('sidebar.importErrorInvalidFile') });
          }
        } catch (error) {
          console.error("Error importing board file:", error);
          toast({ variant: "destructive", title: t('sidebar.importErrorTitle'), description: t('sidebar.importErrorDescription') });
        }
      };
      reader.onerror = () => {
        toast({ variant: "destructive", title: t('sidebar.importErrorTitle'), description: t('sidebar.fileReadError') });
      };
      reader.readAsText(file);
    }
    if (event.target) {
        event.target.value = '';
    }
  };

  const handleRandomizeVisuals = () => {
    randomizeTileVisuals();
    toast({
      title: t('sidebar.visualsRandomizedTitle'),
      description: t('sidebar.visualsRandomizedDescription'),
    });
  };

  const renderTooltip = (contentKey: string, children: React.ReactNode) => (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs">
        <p className="text-xs">{t(contentKey)}</p>
      </TooltipContent>
    </Tooltip>
  );

  return (
    <>
    <ScrollArea className="h-full flex-1">
      <SidebarMenu>
        <SidebarGroup>
          <SidebarGroupLabel className="font-headline">{t('sidebar.title')}</SidebarGroupLabel>
          <SidebarGroupContent className="space-y-2">
             {renderTooltip("tooltip.newBoard", 
              <Button onClick={initializeNewBoard} className="w-full" variant="outline">
                <Wand2 className="mr-2 h-4 w-4" /> {t('sidebar.newBoard')}
              </Button>
             )}
             {boardSettings && (
              <>
                {renderTooltip("tooltip.generatePlayLink",
                  <Button onClick={handleGeneratePlayLink} className="w-full">
                      <LinkIcon className="mr-2 h-4 w-4" /> {t('sidebar.generatePlayLink')}
                  </Button>
                )}
                {renderTooltip("tooltip.exportBoardFile",
                  <Button onClick={handleExportBoardFile} className="w-full" variant="outline">
                      <Download className="mr-2 h-4 w-4" /> {t('sidebar.exportBoardFile')}
                  </Button>
                )}
                {renderTooltip("tooltip.importBoardFile",
                  <Button asChild variant="outline" className="w-full cursor-pointer">
                    <Label htmlFor="import-board-file" className="flex items-center cursor-pointer w-full justify-center">
                      <Upload className="mr-2 h-4 w-4" /> {t('sidebar.importBoardFile')}
                    </Label>
                  </Button>
                )}
                <input 
                    type="file" 
                    id="import-board-file" 
                    ref={importFileInputRef}
                    accept=".json" 
                    onChange={handleImportBoardFile} 
                    className="hidden" 
                />
              </>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
        
        <SidebarSeparator />

        {boardSettings && (
          <Accordion type="multiple" className="w-full px-2">
            <AccordionItem value="board-settings">
              <AccordionTrigger className="text-sm hover:no-underline">
                <div className="flex items-center gap-2 font-medium">
                    <Settings size={16} /> {t('sidebar.boardSettings')}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2 pb-4">
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <Label htmlFor="boardName" className="text-xs font-medium">{t('sidebar.boardName')}</Label>
                    {renderTooltip("tooltip.boardName.description", <Info size={12} className="text-muted-foreground cursor-help" />)}
                  </div>
                  <Input 
                    id="boardName" 
                    value={boardSettings.name} 
                    onChange={(e) => handleSettingChange('name', e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                 <div>
                  <div className="flex items-center gap-1 mb-1">
                    <Label htmlFor="boardDescription" className="text-xs font-medium">{t('sidebar.description')}</Label>
                    {renderTooltip("tooltip.description.description", <Info size={12} className="text-muted-foreground cursor-help" />)}
                  </div>
                  <Input 
                    id="boardDescription" 
                    value={boardSettings.description || ''} 
                    onChange={(e) => handleSettingChange('description', e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <Label htmlFor="numTiles" className="text-xs font-medium">
                      {t('sidebar.numberOfTiles', { count: boardSettings.numberOfTiles })}
                    </Label>
                     {renderTooltip("tooltip.numberOfTiles.description", <Info size={12} className="text-muted-foreground cursor-help" />)}
                  </div>
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
                
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <Label htmlFor="punishmentType" className="text-xs font-medium">{t('sidebar.punishmentType.label')}</Label>
                    {renderTooltip("tooltip.punishmentType.description", <Info size={12} className="text-muted-foreground cursor-help" />)}
                  </div>
                  <Select
                    value={boardSettings.punishmentType}
                    onValueChange={(value: PunishmentType) => handleSettingChange('punishmentType', value)}
                  >
                    <SelectTrigger id="punishmentType" className="h-8 text-xs">
                      <SelectValue placeholder={t('sidebar.punishmentType.selectPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none" className="text-xs">{t('sidebar.punishmentType.none')}</SelectItem>
                      <SelectItem value="revertMove" className="text-xs">{t('sidebar.punishmentType.revertMove')}</SelectItem>
                      <SelectItem value="moveBackFixed" className="text-xs">{t('sidebar.punishmentType.moveBackFixed')}</SelectItem>
                      <SelectItem value="moveBackLevelBased" className="text-xs">{t('sidebar.punishmentType.moveBackLevelBased')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {boardSettings.punishmentType === 'moveBackFixed' && (
                  <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Label htmlFor="punishmentValue" className="text-xs font-medium">
                        {t('sidebar.punishmentValue', { count: boardSettings.punishmentValue })}
                      </Label>
                      {renderTooltip("tooltip.punishmentValue.description", <Info size={12} className="text-muted-foreground cursor-help" />)}
                    </div>
                    <Slider
                      id="punishmentValue"
                      min={1}
                      max={5} 
                      step={1}
                      value={[boardSettings.punishmentValue]}
                      onValueChange={handleSliderChange('punishmentValue')}
                      className="mt-2"
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="randomizeTilesOnLoad" className="text-xs font-medium">{t('sidebar.randomizeTilesOnLoad')}</Label>
                    {renderTooltip("tooltip.randomizeTiles.description", <Info size={12} className="text-muted-foreground cursor-help" />)}
                  </div>
                  <Switch
                    id="randomizeTilesOnLoad"
                    checked={boardSettings.randomizeTiles} 
                    onCheckedChange={(checked) => handleSettingChange('randomizeTiles', checked)}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="board-appearance">
              <AccordionTrigger className="text-sm hover:no-underline">
                <div className="flex items-center gap-2 font-medium">
                    <ImageIcon size={16} /> {t('sidebar.boardAppearance')}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-2 pt-2 pb-4">
                 <div>
                    <div className="flex items-center gap-1 mb-1">
                      <Label htmlFor="boardBgImage" className="text-xs font-medium">{t('sidebar.boardBackgroundImage')}</Label>
                      {renderTooltip("tooltip.boardBackground.description", <Info size={12} className="text-muted-foreground cursor-help" />)}
                    </div>
                    {boardSettings.boardBackgroundImage && (
                      <div className="mt-2 relative w-full aspect-video border rounded-md overflow-hidden">
                        <NextImage src={boardSettings.boardBackgroundImage} alt={t('sidebar.boardBackgroundPreview')} layout="fill" objectFit="contain" unoptimized />
                        <Button 
                          variant="destructive" 
                          size="icon" 
                          className="absolute top-1 right-1 h-6 w-6 z-10"
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
                      className="mt-1 text-xs h-8"
                      ref={boardBgInputRef}
                    />
                    <p className="text-xs text-muted-foreground mt-1">{t('sidebar.boardBackgroundImageHelp')}</p>
                  </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="player-settings">
              <AccordionTrigger className="text-sm hover:no-underline">
                 <div className="flex items-center gap-2 font-medium">
                    <Users size={16} /> {t('sidebar.playerSettings')}
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-4 pt-2 pb-4">
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <Label htmlFor="numPlayers" className="text-xs font-medium">
                      {t('sidebar.numberOfPlayers', { count: boardSettings.numberOfPlayers })}
                    </Label>
                    {renderTooltip("tooltip.numberOfPlayers.description", <Info size={12} className="text-muted-foreground cursor-help" />)}
                  </div>
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
                  <div className="flex items-center gap-1 mb-1">
                    <Label htmlFor="winningCondition" className="text-xs font-medium">{t('sidebar.winningCondition')}</Label>
                    {renderTooltip("tooltip.winningCondition.description", <Info size={12} className="text-muted-foreground cursor-help" />)}
                  </div>
                   <Select
                    value={boardSettings.winningCondition}
                    onValueChange={(value: WinningCondition) => handleSettingChange('winningCondition', value)}
                  >
                    <SelectTrigger id="winningCondition" className="h-8 text-xs">
                      <SelectValue placeholder={t('sidebar.selectWinningCondition')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="firstToFinish" className="text-xs">{t('sidebar.firstToFinish')}</SelectItem>
                      <SelectItem value="highestScore" className="text-xs">{t('sidebar.highestScore')}</SelectItem>
                      <SelectItem value="combinedOrderScore" className="text-xs">{t('sidebar.combinedOrderScore')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </AccordionContent>
            </AccordionItem>
            
            <AccordionItem value="dice-config">
              <AccordionTrigger className="text-sm hover:no-underline">
                <div className="flex items-center gap-2 font-medium">
                    <Dices size={16} /> {t('sidebar.diceConfiguration')}
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <div>
                  <div className="flex items-center gap-1 mb-1">
                    <Label htmlFor="diceSides" className="text-xs font-medium">{t('sidebar.diceSides', { count: boardSettings.diceSides })}</Label>
                    {renderTooltip("tooltip.diceSides.description", <Info size={12} className="text-muted-foreground cursor-help" />)}
                  </div>
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
              </AccordionContent>
            </AccordionItem>

             <AccordionItem value="tile-customization">
                <AccordionTrigger className="text-sm hover:no-underline">
                    <div className="flex items-center gap-2 font-medium">
                        <Palette size={16} /> {t('sidebar.tileCustomization')}
                    </div>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 pt-2 pb-4">
                    {renderTooltip("tooltip.tileCustomization.description",
                        <p className="text-xs text-muted-foreground">{t('sidebar.selectTileToEdit')}</p>
                    )}
                    {renderTooltip("tooltip.randomizeVisuals.description",
                        <Button onClick={handleRandomizeVisuals} className="w-full h-8 text-xs" variant="outline">
                            <RefreshCwIcon className="mr-2 h-3 w-3" /> {t('sidebar.randomizeVisuals')}
                        </Button>
                    )}
                </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
        
      </SidebarMenu>
    </ScrollArea>
    </>
  );
}

    