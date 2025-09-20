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

  // If no group session exists, show landing page
  if (!groupSession) {
    return <LandingPage />;
  }

  // If group session exists, show the main app
  return <GamesPage initialGames={initialGames} initialWeek={initialWeek} />;
}