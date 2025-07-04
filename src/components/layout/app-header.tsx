
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
  const { toggleSidebar } = useSidebar(); 
  const [mounted, setMounted] = React.useState(false);
  const { theme, setTheme } = useTheme();
  const { language, setLanguage, t } = useLanguage();

  React.useEffect(() => setMounted(true), []);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // Capture stable values for dependencies
  const currentLanguage = language;
  const englishText = t('appHeader.english');
  const indonesianText = t('appHeader.indonesian');


  return (
    <header className="sticky top-0 z-50 flex h-16 items-center gap-4 border-b bg-background/80 px-4 backdrop-blur md:px-6"> {/* Increased z-index for header */}
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
            <DropdownMenuContent align="end" className="z-[100]"> {/* Explicitly set higher z-index for content */}
              {/* Simplified Content for Debugging */}
              <DropdownMenuItem onClick={() => setLanguage('en')} disabled={currentLanguage === 'en'}>
                {englishText}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setLanguage('id')} disabled={currentLanguage === 'id'}>
                {indonesianText}
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

