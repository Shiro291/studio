
"use client";

import React, { useState, useEffect, useRef } from 'react';
import type { Tile, TileType, TileConfigQuiz, TileConfigInfo, TileConfigReward, QuizOption } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DEFAULT_TILE_COLOR, TILE_TYPE_EMOJIS, DIFFICULTY_POINTS } from '@/lib/constants';
import { nanoid } from 'nanoid';
import { HexColorPicker } from "react-colorful";
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { Trash2, XCircle, Sparkles } from 'lucide-react';
import { useLanguage } from '@/context/language-context';
import Image from 'next/image';
import { AIQuizGeneratorDialog } from './ai-quiz-generator-dialog'; // Import the new dialog
import type { GenerateQuizOutput } from '@/ai/flows/quiz-generator-flow';

interface TileEditorModalProps {
  tile: Tile;
  onSave: (updatedTile: Tile) => void;
  onClose: () => void;
}

const availableTileTypes: TileType[] = ['empty', 'quiz', 'info', 'reward'];

export function TileEditorModal({ tile, onSave, onClose }: TileEditorModalProps) {
  const [editableTile, setEditableTile] = useState<Tile>(JSON.parse(JSON.stringify(tile)));
  const [colorPickerVisible, setColorPickerVisible] = useState(false);
  const [isAiGeneratorOpen, setIsAiGeneratorOpen] = useState(false); // State for AI dialog
  const { t } = useLanguage();

  const fileInputRefs = {
    questionImage: useRef<HTMLInputElement>(null),
    infoImage: useRef<HTMLInputElement>(null),
    quizOptions: [] as React.RefObject<HTMLInputElement>[],
  };


  useEffect(() => {
    setEditableTile(JSON.parse(JSON.stringify(tile)));
  }, [tile]);

  const handleTypeChange = (newType: TileType) => {
    let newConfig: Tile['config'] = undefined;
    switch (newType) {
      case 'quiz':
        newConfig = {
          question: '',
          options: [{id: nanoid(), text: '', isCorrect: true}, {id: nanoid(), text: '', isCorrect: false}],
          difficulty: 1,
          points: DIFFICULTY_POINTS[1],
        } as TileConfigQuiz;
        break;
      case 'info':
        newConfig = { message: '' } as TileConfigInfo;
        break;
      case 'reward':
        newConfig = { message: '', points: 0 } as TileConfigReward;
        break;
    }
    setEditableTile(prev => ({
      ...prev,
      type: newType,
      config: newConfig,
      ui: { ...prev.ui, icon: TILE_TYPE_EMOJIS[newType] || TILE_TYPE_EMOJIS.empty }
    }));
  };

  const handleImageChange = (
    event: React.ChangeEvent<HTMLInputElement>,
    target: 'questionImage' | 'infoImage' | `quizOptionImage-${number}`
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUri = reader.result as string;
        setEditableTile(prev => {
          const newConfig = { ...prev.config };
          if (target === 'questionImage' && prev.type === 'quiz') {
            (newConfig as TileConfigQuiz).questionImage = dataUri;
          } else if (target === 'infoImage' && prev.type === 'info') {
            (newConfig as TileConfigInfo).image = dataUri;
          } else if (target.startsWith('quizOptionImage-') && prev.type === 'quiz') {
            const optionIndex = parseInt(target.split('-')[1]);
            if ((newConfig as TileConfigQuiz).options[optionIndex]) {
              (newConfig as TileConfigQuiz).options[optionIndex].image = dataUri;
            }
          }
          return { ...prev, config: newConfig };
        });
      };
      reader.readAsDataURL(file);
    }
    if (event.target) {
        event.target.value = '';
    }
  };

  const removeImage = (target: 'questionImage' | 'infoImage' | `quizOptionImage-${number}`) => {
    setEditableTile(prev => {
      const newConfig = { ...prev.config };
      if (target === 'questionImage' && prev.type === 'quiz') {
        (newConfig as TileConfigQuiz).questionImage = undefined;
      } else if (target === 'infoImage' && prev.type === 'info') {
        (newConfig as TileConfigInfo).image = undefined;
      } else if (target.startsWith('quizOptionImage-') && prev.type === 'quiz') {
        const optionIndex = parseInt(target.split('-')[1]);
         if ((newConfig as TileConfigQuiz).options[optionIndex]) {
            (newConfig as TileConfigQuiz).options[optionIndex].image = undefined;
          }
      }
      return { ...prev, config: newConfig };
    });
  };


  const handleQuizOptionChange = (index: number, field: keyof QuizOption, value: string | boolean) => {
    const newOptions = [...(editableTile.config as TileConfigQuiz).options];
    if (field === 'isCorrect') {
      newOptions.forEach((opt, i) => opt.isCorrect = i === index ? (value as boolean) : false);
      if (!newOptions.some(opt => opt.isCorrect) && newOptions.length > 0) newOptions[0].isCorrect = true;
    } else {
       newOptions[index] = { ...newOptions[index], [field]: value };
    }
    setEditableTile(prev => ({
      ...prev,
      config: { ...(prev.config as TileConfigQuiz), options: newOptions },
    }));
  };

  const addQuizOption = () => {
    const newOptions = [...(editableTile.config as TileConfigQuiz).options, { id: nanoid(), text: '', isCorrect: false }];
     setEditableTile(prev => ({
      ...prev,
      config: { ...(prev.config as TileConfigQuiz), options: newOptions },
    }));
  };

  const removeQuizOption = (index: number) => {
    let newOptions = [...(editableTile.config as TileConfigQuiz).options];
    newOptions.splice(index, 1);
    if (newOptions.length === 0) newOptions.push({ id: nanoid(), text: '', isCorrect: true });
    if (!newOptions.some(opt => opt.isCorrect) && newOptions.length > 0) newOptions[0].isCorrect = true;
     setEditableTile(prev => ({
      ...prev,
      config: { ...(prev.config as TileConfigQuiz), options: newOptions },
    }));
  };

  const handleInputChange = (field: keyof TileConfigQuiz | keyof TileConfigInfo | keyof TileConfigReward, value: any) => {
    if(editableTile.type === 'quiz' && field === 'difficulty') {
      const difficulty = parseInt(value) as 1 | 2 | 3;
      setEditableTile(prev => ({
        ...prev,
        config: { ...(prev.config as TileConfigQuiz), difficulty, points: DIFFICULTY_POINTS[difficulty] },
      }));
    } else {
      setEditableTile(prev => ({
        ...prev,
        config: { ...prev.config, [field]: value } as any,
      }));
    }
  };

  const handleColorChange = (newColor: string) => {
    setEditableTile(prev => ({ ...prev, ui: { ...prev.ui, color: newColor }}));
  };

  const handleIconChange = (newIcon: string) => {
     setEditableTile(prev => ({ ...prev, ui: { ...prev.ui, icon: newIcon }}));
  };

  const handleSubmit = () => {
    onSave(editableTile);
  };

  const handleAiGeneratedQuiz = (data: GenerateQuizOutput) => {
    const newDifficulty = parseInt(data.suggestedDifficulty, 10) as 1 | 2 | 3;
    const newOptions = data.options.map(opt => ({
        id: nanoid(), // Ensure fresh client-side ID
        text: opt.text,
        isCorrect: opt.isCorrect,
        image: opt.image, // Keep image if provided, though current flow doesn't
    }));

     // Ensure at least one option is correct, and only one
    let correctExists = newOptions.some(opt => opt.isCorrect);
    if (!correctExists && newOptions.length > 0) {
        newOptions[0].isCorrect = true;
    } else if (newOptions.filter(opt => opt.isCorrect).length > 1) {
        let firstCorrectFound = false;
        newOptions.forEach(opt => {
            if (opt.isCorrect) {
                if (firstCorrectFound) opt.isCorrect = false;
                else firstCorrectFound = true;
            }
        });
    }


    setEditableTile(prev => ({
        ...prev,
        type: 'quiz', // Ensure type is quiz
        config: {
            ...(prev.config as TileConfigQuiz), // Keep existing quiz config like image if any
            question: data.question,
            options: newOptions,
            difficulty: newDifficulty,
            points: DIFFICULTY_POINTS[newDifficulty] || DIFFICULTY_POINTS[1],
        }
    }));
    setIsAiGeneratorOpen(false);
  };


  const isConfigurableType = (type: TileType) => ['quiz', 'info', 'reward'].includes(type);

  const renderImageUpload = (
    labelKey: string,
    target: 'questionImage' | 'infoImage' | `quizOptionImage-${number}`,
    currentImageUri?: string,
    inputRef?: React.RefObject<HTMLInputElement>
  ) => (
    <div className="space-y-2">
      <Label>{t(labelKey)}</Label>
      {currentImageUri && (
        <div className="relative w-32 h-32 border rounded-md overflow-hidden">
          <Image src={currentImageUri} alt={t('tileEditor.imagePreview')} layout="fill" objectFit="cover" unoptimized />
          <Button
            variant="destructive"
            size="icon"
            className="absolute top-1 right-1 h-6 w-6"
            onClick={() => removeImage(target)}
            aria-label={t('tileEditor.removeImage')}
          >
            <XCircle className="h-4 w-4" />
          </Button>
        </div>
      )}
      <Input
        type="file"
        accept="image/*"
        onChange={(e) => handleImageChange(e, target)}
        className="text-sm"
        ref={inputRef}
      />
    </div>
  );

  if (editableTile.type === 'quiz' && editableTile.config) {
    const numOptions = (editableTile.config as TileConfigQuiz).options.length;
    while (fileInputRefs.quizOptions.length < numOptions) {
      fileInputRefs.quizOptions.push(React.createRef<HTMLInputElement>());
    }
    if (fileInputRefs.quizOptions.length > numOptions) {
      fileInputRefs.quizOptions.length = numOptions;
    }
  }


  return (
    <Dialog open={true} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="font-headline">{t('tileEditor.editTileTitle', { position: tile.position + 1 })}</DialogTitle>
          <DialogDescription>
            {t('tileEditor.customizeProperties')}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-200px)] p-1">
        <div className="grid gap-4 py-4 pr-4">
          {(tile.type !== 'start' && tile.type !== 'finish') && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="tile-type" className="text-right">{t('tileEditor.type')}</Label>
              <Select value={editableTile.type} onValueChange={(value: TileType) => handleTypeChange(value)}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder={t('tileEditor.selectTileType')} />
                </SelectTrigger>
                <SelectContent>
                  {availableTileTypes.map(typeOpt => (
                    <SelectItem key={typeOpt} value={typeOpt} className="capitalize">{t(`capitalize.${typeOpt}` as any)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isConfigurableType(editableTile.type) && editableTile.config && (
            <>
              {editableTile.type === 'quiz' && (
                <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium text-primary">{t('tileEditor.quizConfiguration')}</h4>
                    <Button variant="outline" size="sm" onClick={() => setIsAiGeneratorOpen(true)}>
                        <Sparkles className="mr-2 h-4 w-4" /> {t('tileEditor.generateWithAI')}
                    </Button>
                  </div>
                  <div>
                    <Label htmlFor="quiz-question">{t('tileEditor.question')}</Label>
                    <Textarea id="quiz-question" value={(editableTile.config as TileConfigQuiz).question} onChange={e => handleInputChange('question', e.target.value)} className="mt-1"/>
                  </div>
                  {renderImageUpload('tileEditor.questionImage', 'questionImage', (editableTile.config as TileConfigQuiz).questionImage, fileInputRefs.questionImage)}
                  <div>
                    <Label htmlFor="quiz-difficulty">{t('tileEditor.difficulty')}</Label>
                    <Select
                      value={(editableTile.config as TileConfigQuiz).difficulty.toString()}
                      onValueChange={val => handleInputChange('difficulty', val)}
                    >
                      <SelectTrigger id="quiz-difficulty" className="mt-1">
                        <SelectValue placeholder={t('tileEditor.selectDifficulty')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">{t('tileEditor.level1', { points: DIFFICULTY_POINTS[1] })}</SelectItem>
                        <SelectItem value="2">{t('tileEditor.level2', { points: DIFFICULTY_POINTS[2] })}</SelectItem>
                        <SelectItem value="3">{t('tileEditor.level3', { points: DIFFICULTY_POINTS[3] })}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                     <Label>{t('tileEditor.options')}</Label>
                     {(editableTile.config as TileConfigQuiz).options.map((opt, index) => (
                        <div key={opt.id} className="flex flex-col gap-2 mt-2 border p-2 rounded-md">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              checked={opt.isCorrect}
                              onCheckedChange={(checked) => handleQuizOptionChange(index, 'isCorrect', !!checked)}
                              aria-label={`Mark option ${index + 1} as correct`}
                            />
                            <Input
                              value={opt.text}
                              onChange={e => handleQuizOptionChange(index, 'text', e.target.value)}
                              placeholder={t('tileEditor.option', { number: index + 1})}
                              className="flex-grow"
                            />
                            {(editableTile.config as TileConfigQuiz).options.length > 1 && ( // Allow removing if more than 1 option
                              <Button variant="ghost" size="icon" onClick={() => removeQuizOption(index)} aria-label={t('tileEditor.removeOption')}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            )}
                          </div>
                           {renderImageUpload('tileEditor.optionImage', `quizOptionImage-${index}`, opt.image, fileInputRefs.quizOptions[index])}
                        </div>
                     ))}
                     {(editableTile.config as TileConfigQuiz).options.length < 5 && ( // Max 5 options
                        <Button variant="outline" size="sm" onClick={addQuizOption} className="mt-2">{t('tileEditor.addOption')}</Button>
                     )}
                  </div>
                </div>
              )}
              {editableTile.type === 'info' && (
                 <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                  <h4 className="font-medium text-primary">{t('tileEditor.infoConfiguration')}</h4>
                  <div>
                    <Label htmlFor="info-message">{t('tileEditor.infoMessage')}</Label>
                    <Textarea id="info-message" value={(editableTile.config as TileConfigInfo).message} onChange={e => handleInputChange('message', e.target.value)} className="mt-1"/>
                  </div>
                  {renderImageUpload('tileEditor.infoImage', 'infoImage', (editableTile.config as TileConfigInfo).image, fileInputRefs.infoImage)}
                </div>
              )}
              {editableTile.type === 'reward' && (
                 <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                    <h4 className="font-medium text-primary">{t('tileEditor.rewardConfiguration')}</h4>
                    <div>
                        <Label htmlFor="reward-message">{t('tileEditor.rewardMessage')}</Label>
                        <Input id="reward-message" value={(editableTile.config as TileConfigReward).message} onChange={e => handleInputChange('message', e.target.value)} className="mt-1"/>
                    </div>
                    <div>
                        <Label htmlFor="reward-points">{t('tileEditor.rewardPoints')}</Label>
                        <Input type="number" id="reward-points" value={(editableTile.config as TileConfigReward).points || ''} onChange={e => handleInputChange('points', parseInt(e.target.value) || 0)} className="mt-1"/>
                    </div>
                 </div>
              )}
            </>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">{t('tileEditor.color')}</Label>
            <div className="col-span-3 relative">
              <Button
                variant="outline"
                onClick={() => setColorPickerVisible(!colorPickerVisible)}
                className="w-full justify-start"
              >
                <span className="w-5 h-5 rounded-sm border mr-2" style={{backgroundColor: editableTile.ui.color || DEFAULT_TILE_COLOR}}></span>
                {editableTile.ui.color || DEFAULT_TILE_COLOR}
              </Button>
              {colorPickerVisible && (
                <div className="absolute z-10 mt-1 left-0 bg-card p-2 rounded-md shadow-lg">
                   <HexColorPicker color={editableTile.ui.color || DEFAULT_TILE_COLOR} onChange={handleColorChange} />
                   <Button size="sm" variant="ghost" onClick={() => setColorPickerVisible(false)} className="mt-1 w-full">{t('tileEditor.closeColorPicker')}</Button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="tile-icon" className="text-right">{t('tileEditor.iconEmoji')}</Label>
            <Input
              id="tile-icon"
              value={editableTile.ui.icon || ''}
              onChange={e => handleIconChange(e.target.value)}
              className="col-span-3"
              maxLength={2}
              placeholder={TILE_TYPE_EMOJIS[editableTile.type] || t('tileEditor.iconPlaceholder')}
            />
          </div>
          <p className="text-xs text-muted-foreground col-span-4 text-center">{t('tileEditor.emojiTip')}</p>

        </div>
        </ScrollArea>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" onClick={onClose}>{t('tileEditor.cancel')}</Button>
          </DialogClose>
          <Button type="submit" onClick={handleSubmit}>{t('tileEditor.saveChanges')}</Button>
        </DialogFooter>
      </DialogContent>
      {isAiGeneratorOpen && (
        <AIQuizGeneratorDialog
            isOpen={isAiGeneratorOpen}
            onClose={() => setIsAiGeneratorOpen(false)}
            onGenerated={handleAiGeneratedQuiz}
        />
      )}
    </Dialog>
  );
}
