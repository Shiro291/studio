
"use client";

import type { Tile } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/context/language-context';

interface TileInteractionAreaProps {
  tile: Tile | null; // The tile the current player landed on
  // Add more props as needed, e.g., onAnswer, onAcknowledge
}

export function TileInteractionArea({ tile }: TileInteractionAreaProps) {
  const { t } = useLanguage();

  // This is a placeholder.
  // In a real implementation, this would display different content
  // based on the tile type (quiz, info, reward) and handle interactions.

  if (!tile) {
    return (
       <Card className="bg-muted/30 shadow-sm">
        <CardHeader>
          <CardTitle className="font-headline text-lg">{t('playPage.tileInteractionTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t('playPage.noInteractionYet')}</p>
        </CardContent>
      </Card>
    );
  }
  
  // Example of what could be displayed based on tile type
  let interactionContent = null;
  switch (tile.type) {
    case 'quiz':
      interactionContent = (
        <div>
          <h3 className="font-semibold">{(tile.config as any)?.question || t('playPage.quizQuestion')}</h3>
          {/* Placeholder for quiz options and answer submission */}
          <Button className="mt-2 w-full">{t('playPage.submitAnswer')}</Button>
        </div>
      );
      break;
    case 'info':
      interactionContent = (
        <div>
          <p>{(tile.config as any)?.message || t('playPage.infoMessage')}</p>
          <Button className="mt-2 w-full">{t('playPage.acknowledge')}</Button>
        </div>
      );
      break;
    case 'reward':
       interactionContent = (
        <div>
          <p>{(tile.config as any)?.message || t('playPage.rewardMessage')}</p>
          {(tile.config as any)?.points && <p>{t('playPage.pointsAwarded', {points: (tile.config as any).points})}</p>}
          <Button className="mt-2 w-full">{t('playPage.collectReward')}</Button>
        </div>
      );
      break;
    default:
      interactionContent = <p className="text-sm text-muted-foreground">{t('playPage.landedOnEmpty', {type: tile.type})}</p>;
  }


  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="font-headline text-lg">{t('playPage.tileInteractionTitle')} - {t(`capitalize.${tile.type}` as any)}</CardTitle>
        {tile.position !== undefined && <CardDescription>{t('playPage.tileNumber', {number: tile.position + 1})}</CardDescription>}
      </CardHeader>
      <CardContent>
        {interactionContent}
      </CardContent>
    </Card>
  );
}
