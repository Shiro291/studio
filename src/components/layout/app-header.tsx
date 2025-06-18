"use client";

import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/icons/logo';
import Link from 'next/link';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes'; // Will need to install next-themes
import React from 'react';

export function AppHeader() {
  const { toggleSidebar } = useSidebar();
  const [mounted, setMounted] = React.useState(false);
  // const { theme, setTheme } = useTheme(); // For theme toggle functionality

  React.useEffect(() => setMounted(true), []);

  // Theme toggle functionality (currently commented out, as useTheme not part of default scaffold)
  // const toggleTheme = () => {
  //   setTheme(theme === 'dark' ? 'light' : 'dark');
  // };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur md:px-6">
      <SidebarTrigger className="md:hidden" />
      <Link href="/" className="flex items-center gap-2">
        <Logo className="h-8 w-auto" />
      </Link>
      <div className="ml-auto flex items-center gap-2">
        {/* {mounted && (
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        )} */}
        {/* Placeholder for User profile / settings dropdown */}
      </div>
    </header>
  );
}
