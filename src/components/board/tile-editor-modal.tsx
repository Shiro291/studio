"use client";

import React, { useState, useEffect } from 'react';
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
import { HexColorPicker } from "react-colorful"; // Needs to be installed: npm install react-colorful
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { Trash2 } from 'lucide-react'; // Added Trash2 import

interface TileEditorModalProps {
  tile: Tile;
  onSave: (updatedTile: Tile) => void;
  onClose: () => void;
}

const availableTileTypes: TileType[] = ['empty', 'quiz', 'info', 'reward'];

export function TileEditorModal({ tile, onSave, onClose }: TileEditorModalProps) {
  const [editableTile, setEditableTile] = useState<Tile>(JSON.parse(JSON.stringify(tile))); // Deep copy
  const [colorPickerVisible, setColorPickerVisible] = useState(false);


  useEffect(() => {
    setEditableTile(JSON.parse(JSON.stringify(tile))); // Reset when tile prop changes
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
  
  const handleQuizOptionChange = (index: number, field: keyof QuizOption, value: string | boolean) => {
    const newOptions = [...(editableTile.config as TileConfigQuiz).options];
    if (field === 'isCorrect') {
      // Ensure only one correct answer
      newOptions.forEach((opt, i) => opt.isCorrect = i === index ? (value as boolean) : false);
      if (!newOptions.some(opt => opt.isCorrect)) { // if unchecking the only correct one, make the first one correct
         if(newOptions.length > 0) newOptions[0].isCorrect = true;
      }
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
    // Ensure at least one option and one correct answer
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
  
  const isConfigurableType = (type: TileType) => ['quiz', 'info', 'reward'].includes(type);


  return (
    <Dialog open={true} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="font-headline">Edit Tile {tile.position + 1}</DialogTitle>
          <DialogDescription>
            Customize the properties of this tile.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-200px)] p-1">
        <div className="grid gap-4 py-4 pr-4">
          {(tile.type !== 'start' && tile.type !== 'finish') && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="tile-type" className="text-right">Type</Label>
              <Select value={editableTile.type} onValueChange={(value: TileType) => handleTypeChange(value)}>
                <SelectTrigger className="col-span-3">
                  <SelectValue placeholder="Select tile type" />
                </SelectTrigger>
                <SelectContent>
                  {availableTileTypes.map(typeOpt => (
                    <SelectItem key={typeOpt} value={typeOpt} className="capitalize">{typeOpt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isConfigurableType(editableTile.type) && editableTile.config && (
            <>
              {editableTile.type === 'quiz' && (
                <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                  <h4 className="font-medium text-primary">Quiz Configuration</h4>
                  <div>
                    <Label htmlFor="quiz-question">Question</Label>
                    <Textarea id="quiz-question" value={(editableTile.config as TileConfigQuiz).question} onChange={e => handleInputChange('question', e.target.value)} className="mt-1"/>
                  </div>
                  <div>
                    <Label htmlFor="quiz-difficulty">Difficulty</Label>
                    <Select 
                      value={(editableTile.config as TileConfigQuiz).difficulty.toString()} 
                      onValueChange={val => handleInputChange('difficulty', val)}
                    >
                      <SelectTrigger id="quiz-difficulty" className="mt-1">
                        <SelectValue placeholder="Select difficulty" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Level 1 ({DIFFICULTY_POINTS[1]} pts)</SelectItem>
                        <SelectItem value="2">Level 2 ({DIFFICULTY_POINTS[2]} pts)</SelectItem>
                        <SelectItem value="3">Level 3 ({DIFFICULTY_POINTS[3]} pts)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                     <Label>Options (select correct answer)</Label>
                     {(editableTile.config as TileConfigQuiz).options.map((opt, index) => (
                        <div key={opt.id} className="flex items-center gap-2 mt-2">
                           <Checkbox 
                            checked={opt.isCorrect} 
                            onCheckedChange={(checked) => handleQuizOptionChange(index, 'isCorrect', !!checked)}
                            aria-label={`Mark option ${index + 1} as correct`}
                           />
                           <Input 
                            value={opt.text} 
                            onChange={e => handleQuizOptionChange(index, 'text', e.target.value)} 
                            placeholder={`Option ${index + 1}`}
                            className="flex-grow"
                           />
                           {(editableTile.config as TileConfigQuiz).options.length > 2 && (
                            <Button variant="ghost" size="icon" onClick={() => removeQuizOption(index)} aria-label="Remove option">
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                           )}
                        </div>
                     ))}
                     <Button variant="outline" size="sm" onClick={addQuizOption} className="mt-2">Add Option</Button>
                  </div>
                  {/* Image upload placeholder */}
                   <div className="text-sm text-muted-foreground italic">Image uploads for questions/answers coming soon.</div>
                </div>
              )}
              {editableTile.type === 'info' && (
                 <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                  <h4 className="font-medium text-primary">Info Configuration</h4>
                  <div>
                    <Label htmlFor="info-message">Information Message</Label>
                    <Textarea id="info-message" value={(editableTile.config as TileConfigInfo).message} onChange={e => handleInputChange('message', e.target.value)} className="mt-1"/>
                  </div>
                  {/* Image upload placeholder */}
                   <div className="text-sm text-muted-foreground italic">Image upload for info tile coming soon.</div>
                </div>
              )}
              {editableTile.type === 'reward' && (
                 <div className="space-y-4 p-4 border rounded-md bg-muted/30">
                    <h4 className="font-medium text-primary">Reward Configuration</h4>
                    <div>
                        <Label htmlFor="reward-message">Reward Message</Label>
                        <Input id="reward-message" value={(editableTile.config as TileConfigReward).message} onChange={e => handleInputChange('message', e.target.value)} className="mt-1"/>
                    </div>
                    <div>
                        <Label htmlFor="reward-points">Points (optional)</Label>
                        <Input type="number" id="reward-points" value={(editableTile.config as TileConfigReward).points || ''} onChange={e => handleInputChange('points', parseInt(e.target.value) || 0)} className="mt-1"/>
                    </div>
                 </div>
              )}
            </>
          )}

          <div className="grid grid-cols-4 items-center gap-4">
            <Label className="text-right">Color</Label>
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
                <div className="absolute z-10 mt-1 left-0">
                   <HexColorPicker color={editableTile.ui.color || DEFAULT_TILE_COLOR} onChange={handleColorChange} />
                   <Button size="sm" variant="ghost" onClick={() => setColorPickerVisible(false)} className="mt-1 w-full">Close</Button>
                </div>
              )}
            </div>
          </div>
          
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="tile-icon" className="text-right">Icon (Emoji)</Label>
            <Input 
              id="tile-icon" 
              value={editableTile.ui.icon || ''} 
              onChange={e => handleIconChange(e.target.value)} 
              className="col-span-3"
              maxLength={2} // For single emoji
              placeholder={TILE_TYPE_EMOJIS[editableTile.type] || 'e.g., ⭐'}
            />
          </div>
          <p className="text-xs text-muted-foreground col-span-4 text-center">You can use standard emojis as icons.</p>

        </div>
        </ScrollArea>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </DialogClose>
          <Button type="submit" onClick={handleSubmit}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

