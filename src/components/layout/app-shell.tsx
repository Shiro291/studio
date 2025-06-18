"use client";

import type { ReactNode } from 'react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader as ShadSidebarHeader,
  SidebarContent as ShadSidebarContent,
  SidebarInset,
  SidebarTrigger,
  SidebarRail,
} from '@/components/ui/sidebar';
import { AppHeader } from './app-header';
import { AppSidebarContent } from './app-sidebar-content';
import { useIsMobile } from '@/hooks/use-mobile';

export function AppShell({ children }: { children: ReactNode }) {
  const isMobile = useIsMobile();

  return (
    <SidebarProvider defaultOpen={!isMobile}>
      <Sidebar variant="sidebar" collapsible={isMobile ? "offcanvas" : "icon"}>
        <ShadSidebarHeader>
          {/* Placeholder for potential logo or trigger in header if needed */}
        </ShadSidebarHeader>
        <ShadSidebarContent>
          <AppSidebarContent />
        </ShadSidebarContent>
        {/* SidebarFooter can be added here if needed */}
      </Sidebar>
      <SidebarRail />
      <SidebarInset>
        <AppHeader />
        <main className="flex-1 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
