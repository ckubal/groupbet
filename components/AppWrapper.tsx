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

  // Always show the main app - research can be viewed without a group
  // Group is only required for placing bets or viewing bets tab
  return <GamesPage initialGames={initialGames} initialWeek={initialWeek} />;
}