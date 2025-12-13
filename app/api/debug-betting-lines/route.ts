import { NextRequest, NextResponse } from 'next/server';
import { gamesCacheService } from '@/lib/games-cache';
import { bettingLinesCacheService } from '@/lib/betting-lines-cache';
import { getCurrentNFLWeek } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');
    const weekNumber = week ? parseInt(week) : getCurrentNFLWeek();
    
    console.log(`🔍 DEBUG: Checking betting lines for Week ${weekNumber}`);
    
    // Get games
    const games = await gamesCacheService.getGamesForWeek(weekNumber, false);
    console.log(`📊 Found ${games.length} games for Week ${weekNumber}`);
    
    // Check betting lines for each game
    const debugInfo = await Promise.all(games.slice(0, 5).map(async (game) => {
      const cachedLines = await bettingLinesCacheService.getCachedBettingLines(game.id);
      
      return {
        gameId: game.id,
        teams: `${game.awayTeam} @ ${game.homeTeam}`,
        gameTime: game.gameTime instanceof Date ? game.gameTime.toISOString() : game.gameTime,
        gameSpread: game.spread,
        gameSpreadOdds: game.spreadOdds,
        gameOverUnder: game.overUnder,
        gameOverUnderOdds: game.overUnderOdds,
        gameHomeMoneyline: game.homeMoneyline,
        gameAwayMoneyline: game.awayMoneyline,
        cachedLines: cachedLines ? {
          spread: cachedLines.spread,
          spreadOdds: cachedLines.spreadOdds,
          overUnder: cachedLines.overUnder,
          overUnderOdds: cachedLines.overUnderOdds,
          homeMoneyline: cachedLines.homeMoneyline,
          awayMoneyline: cachedLines.awayMoneyline,
          fetchedAt: cachedLines.fetchedAt instanceof Date ? cachedLines.fetchedAt.toISOString() : cachedLines.fetchedAt,
          source: cachedLines.source,
          bookmaker: cachedLines.bookmaker,
        } : null,
      };
    }));
    
    return NextResponse.json({
      week: weekNumber,
      totalGames: games.length,
      sampleGames: debugInfo,
      summary: {
        gamesWithSpread: games.filter(g => g.spread !== undefined).length,
        gamesWithOverUnder: games.filter(g => g.overUnder !== undefined).length,
        gamesWithMoneyline: games.filter(g => g.homeMoneyline !== undefined || g.awayMoneyline !== undefined).length,
        uniqueSpreads: [...new Set(games.map(g => g.spread).filter(Boolean))],
        uniqueOverUnders: [...new Set(games.map(g => g.overUnder).filter(Boolean))],
      }
    });
  } catch (error) {
    console.error('❌ DEBUG ERROR:', error);
    return NextResponse.json({
      error: 'Failed to debug betting lines',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
