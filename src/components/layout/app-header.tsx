
"use client";

import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/icons/logo';
import Link from 'next/link';
import { Sun, Moon, Languages } from 'lucide-react';
import { useTheme } from 'next-themes';
import React from 'react';
import { useLanguage } from '@/context/language-context';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AppHeaderProps {
  isPlayMode?: boolean;
}

export function AppHeader({ isPlayMode = false }: AppHeaderProps) {
  const { toggleSidebar } = useSidebar(); // This call is fine if SidebarProvider is always a parent or conditionally used
  const [mounted, setMounted] = React.useState(false);
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  React.useEffect(() => setMounted(true), []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur md:px-6">
      {!isPlayMode && <SidebarTrigger className="md:hidden" />}
      <Link href="/" className="flex items-center gap-2">
        <Logo className="h-8 w-auto" />
      </Link>
      <div className="ml-auto flex items-center gap-2">
        {mounted && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t('appHeader.language')}>
                <Languages className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setLanguage('en')} disabled={language === 'en'}>
                {t('appHeader.english')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage('id')} disabled={language === 'id'}>
                {t('appHeader.indonesian')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {mounted && (
          <Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={t('appHeader.toggleTheme')}>
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        )}
      </div>
    </header>
  );
}
