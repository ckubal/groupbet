import { oddsApi } from '@/lib/odds-api';
import AppWrapper from '@/components/AppWrapper';
import { Game } from '@/types';
import { getCurrentNFLWeek } from '@/lib/utils';

interface HomeProps {
  searchParams: Promise<{ week?: string }>;
}

export default async function Home({ searchParams }: HomeProps) {
  // Get week from URL params or default to current NFL week
  const resolvedSearchParams = await searchParams;
  const week = resolvedSearchParams.week ? parseInt(resolvedSearchParams.week) : getCurrentNFLWeek();
  
  // Server-side data fetching to bypass hydration issues
  let games: Game[] = [];
  
  try {
    console.log(`🖥️ SERVER: Fetching games for Week ${week} on server-side`);
    // Try without force refresh first to use cache if available
    games = await oddsApi.getNFLGames(week, false);
    console.log(`✅ SERVER: Successfully fetched ${games.length} games for Week ${week} on server-side`);
    
    // If no games found, try force refresh
    if (games.length === 0) {
      console.log(`⚠️ SERVER: No games found in cache, trying force refresh...`);
      games = await oddsApi.getNFLGames(week, true);
      console.log(`✅ SERVER: Force refresh returned ${games.length} games for Week ${week}`);
    }
    
    // Log game breakdown
    if (games.length > 0) {
      console.log('📊 SERVER: Game breakdown by time slot:');
      const slotCounts: Record<string, number> = {};
      games.forEach(game => {
        slotCounts[game.timeSlot] = (slotCounts[game.timeSlot] || 0) + 1;
      });
      Object.entries(slotCounts).forEach(([slot, count]) => {
        console.log(`   ${slot}: ${count} games`);
      });
    } else {
      console.error(`❌ SERVER: No games found for Week ${week} after both cache and force refresh attempts`);
    }
  } catch (error) {
    console.error(`❌ SERVER: Failed to fetch Week ${week} games on server-side:`, error);
    console.error(`❌ SERVER: Error details:`, error instanceof Error ? error.message : String(error));
    games = [];
  }

  return <AppWrapper initialGames={games} initialWeek={week} />;
}