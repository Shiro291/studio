
"use client";

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader as ShadSidebarHeader,
  SidebarContent as ShadSidebarContent,
  SidebarInset,
  SidebarRail,
} from '@/components/ui/sidebar';
import { AppHeader } from './app-header';
import { AppSidebarContent } from './app-sidebar-content';
import { useIsMobile } from '@/hooks/use-mobile';
import { useGame } from '@/components/game/game-provider';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/context/language-context'; // Import useLanguage

export function AppShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const isPlayMode = pathname === '/play';
  const { state: gameState } = useGame();
  const { t } = useLanguage(); // Get the translation function

  const applyEpilepsySafeMode = isPlayMode && gameState.boardConfig?.settings.epilepsySafeMode;

  const CreditFooter = () => (
    <footer className="mt-auto pt-8 pb-4 text-center text-xs text-muted-foreground">
      {t('appShell.madeBy')} Fathan Faqih Ali
    </footer>
  );

  if (isPlayMode) {
    return (
      <SidebarProvider defaultOpen={false}>
        <div className="flex min-h-svh w-full flex-col">
          <AppHeader isPlayMode={isPlayMode} />
          <main className={cn(
            "flex-1 flex flex-col p-4 md:p-6 lg:p-8 bg-background text-foreground",
            { 'epilepsy-safe-mode-active': applyEpilepsySafeMode }
          )}>
            <div className="flex-grow">{children}</div>
            <CreditFooter />
          </main>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <Sidebar variant="sidebar" collapsible={isMobile ? "offcanvas" : "icon"}>
        <ShadSidebarHeader>
        </ShadSidebarHeader>
        <ShadSidebarContent>
          <AppSidebarContent />
        </ShadSidebarContent>
      </Sidebar>
      <SidebarRail />
      <SidebarInset>
        <AppHeader isPlayMode={isPlayMode} /> 
        <main className="flex-1 flex flex-col p-4 md:p-6 lg:p-8">
          <div className="flex-grow">{children}</div>
          <CreditFooter />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
