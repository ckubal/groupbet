'use client';

import React from 'react';
import { useGroup } from '@/lib/group-context';
import LandingPage from '@/components/LandingPage';
import GamesPage from '@/app/games-page';
import { Game } from '@/types';

interface AppWrapperProps {
  initialGames: Game[];
  initialWeek: number;
}

export default function AppWrapper({ initialGames, initialWeek }: AppWrapperProps) {
  const { groupSession } = useGroup();

  console.log('🔐 AppWrapper - Group Session:', groupSession);

  // If no group session exists, show landing page
  if (!groupSession) {
    console.log('🚫 No group session found, showing landing page');
    return <LandingPage />;
  }

  console.log('✅ Group session found, showing main app');
  // If group session exists, show the main app
  return <GamesPage initialGames={initialGames} initialWeek={initialWeek} />;
}