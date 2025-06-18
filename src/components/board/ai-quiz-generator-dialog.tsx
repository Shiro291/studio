
"use client";

import React, { useState } from 'react';
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
import { useLanguage } from '@/context/language-context';
import { Loader2, AlertTriangle } from 'lucide-react';
import type { GenerateQuizOutput, GenerateQuizInput } from '@/ai/flows/quiz-generator-flow';
import { generateQuizQuestion } from '@/ai/flows/quiz-generator-flow';
import { ScrollArea } from '../ui/scroll-area';
import { toast } from '@/hooks/use-toast';


interface AIQuizGeneratorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerated: (data: GenerateQuizOutput) => void;
}

export function AIQuizGeneratorDialog({ isOpen, onClose, onGenerated }: AIQuizGeneratorDialogProps) {
  const { t } = useLanguage();
  const [sourceText, setSourceText] = useState('');
  const [numOptions, setNumOptions] = useState(4);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (sourceText.trim().length < 20) {
        setError(t('aiQuizGenerator.errorMinLength'));
        return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const input: GenerateQuizInput = { sourceText, numberOfOptions: numOptions };
      const result = await generateQuizQuestion(input);
      onGenerated(result);
      setSourceText(''); // Clear text after successful generation
      onClose();
    } catch (err) {
      console.error("AI Quiz Generation Error:", err);
      const errorMessage = (err instanceof Error && err.message) ? err.message : t('aiQuizGenerator.errorGeneral');
      setError(errorMessage);
      toast({
        variant: "destructive",
        title: t('aiQuizGenerator.errorTitle'),
        description: errorMessage,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-headline">{t('aiQuizGenerator.title')}</DialogTitle>
          <DialogDescription>{t('aiQuizGenerator.description')}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-grow pr-2 -mr-2">
          <div className="space-y-4 py-2 pr-4">
            <div>
              <Label htmlFor="sourceText">{t('aiQuizGenerator.sourceTextLabel')}</Label>
              <Textarea
                id="sourceText"
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder={t('aiQuizGenerator.sourceTextPlaceholder')}
                className="mt-1 min-h-[150px]"
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground mt-1">{t('aiQuizGenerator.sourceTextHelp')}</p>
            </div>
            <div>
              <Label htmlFor="numOptions">{t('aiQuizGenerator.numOptionsLabel')}</Label>
              <Input
                id="numOptions"
                type="number"
                value={numOptions}
                onChange={(e) => setNumOptions(Math.max(2, Math.min(5, parseInt(e.target.value, 10) || 2)))}
                min="2"
                max="5"
                className="mt-1 w-20"
                disabled={isLoading}
              />
            </div>
            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded-md">
                <AlertTriangle className="h-5 w-5" />
                <p>{error}</p>
              </div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter className="mt-auto pt-4">
          <DialogClose asChild>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              {t('tileEditor.cancel')}
            </Button>
          </DialogClose>
          <Button type="button" onClick={handleSubmit} disabled={isLoading || sourceText.trim().length < 20}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('aiQuizGenerator.generating')}
              </>
            ) : (
              t('aiQuizGenerator.generateButton')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
