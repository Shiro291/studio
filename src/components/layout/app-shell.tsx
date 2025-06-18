
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

export function AppShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();
  const pathname = usePathname();
  const isPlayMode = pathname === '/play';

  if (isPlayMode) {
    return (
      <SidebarProvider defaultOpen={false}> {/* Provider still needed for useSidebar hook in AppHeader, but sidebar itself is not shown */}
        <div className="flex min-h-svh w-full flex-col">
          <AppHeader isPlayMode={isPlayMode} />
          <main className="flex-1 p-4 md:p-6 lg:p-8 bg-background text-foreground">
            {children}
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
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
