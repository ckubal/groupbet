import { oddsApi } from '@/lib/odds-api';
import GamesPage from './games-page';
import { Game } from '@/types';

interface HomeProps {
  searchParams: Promise<{ week?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  // Get week from URL params or default to 2
  const resolvedSearchParams = await searchParams;
  const week = resolvedSearchParams.week ? parseInt(resolvedSearchParams.week) : 2;
  
  // Server-side data fetching to bypass hydration issues
  let games: Game[] = [];
  
  try {
    console.log(`🖥️ SERVER: Fetching games for Week ${week} on server-side`);
    // Force refresh to get all games for the specified week
    const forceRefresh = true;
    games = await oddsApi.getNFLGames(week, forceRefresh);
    console.log(`✅ SERVER: Successfully fetched ${games.length} games for Week ${week} on server-side`);
    
    // Log game breakdown
    console.log('📊 SERVER: Game breakdown by time slot:');
    const slotCounts: Record<string, number> = {};
    games.forEach(game => {
      slotCounts[game.timeSlot] = (slotCounts[game.timeSlot] || 0) + 1;
    });
    Object.entries(slotCounts).forEach(([slot, count]) => {
      console.log(`   ${slot}: ${count} games`);
    });
  } catch (error) {
    console.error(`❌ SERVER: Failed to fetch Week ${week} games on server-side:`, error);
    games = [];
  }

  return <GamesPage initialGames={games} initialWeek={week} />;
}