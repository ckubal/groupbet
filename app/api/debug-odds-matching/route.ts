import { NextRequest, NextResponse } from 'next/server';
import { gamesCacheService } from '@/lib/games-cache';
import { bettingLinesCacheService } from '@/lib/betting-lines-cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');
    const weekNumber = week ? parseInt(week) : 14;
    
    const games = await gamesCacheService.getGamesForWeek(weekNumber, false);
    
    // Get all cached betting lines
    const oddsAnalysis = await Promise.all(games.map(async (game) => {
      const cachedLines = await bettingLinesCacheService.getCachedBettingLines(game.id);
      
      return {
        game: {
          id: game.id,
          awayTeam: game.awayTeam,
          homeTeam: game.homeTeam,
          gameTime: game.gameTime,
          status: game.status
        },
        displayedOdds: {
          spread: game.spread,
          spreadOdds: game.spreadOdds,
          overUnder: game.overUnder,
          overUnderOdds: game.overUnderOdds,
          homeMoneyline: game.homeMoneyline,
          awayMoneyline: game.awayMoneyline
        },
        cachedOdds: cachedLines ? {
          bookmaker: cachedLines.bookmaker,
          fetchedAt: cachedLines.fetchedAt,
          spread: cachedLines.spread,
          spreadOdds: cachedLines.spreadOdds,
          overUnder: cachedLines.overUnder,
          overUnderOdds: cachedLines.overUnderOdds,
          homeMoneyline: cachedLines.homeMoneyline,
          awayMoneyline: cachedLines.awayMoneyline,
          isFrozen: cachedLines.isFrozen
        } : null,
        match: cachedLines?.bookmaker === 'bovada' ? '✅ Bovada' : 
               cachedLines?.bookmaker ? `⚠️ ${cachedLines.bookmaker}` : 
               '❌ No odds'
      };
    }));
    
    const bovadaCount = oddsAnalysis.filter(a => a.cachedOdds?.bookmaker === 'bovada').length;
    const noOddsCount = oddsAnalysis.filter(a => !a.cachedOdds).length;
    
    return NextResponse.json({
      week: weekNumber,
      totalGames: games.length,
      summary: {
        bovadaOdds: bovadaCount,
        otherBookmakers: oddsAnalysis.length - bovadaCount - noOddsCount,
        noOdds: noOddsCount
      },
      games: oddsAnalysis
    });
  } catch (error) {
    console.error('❌ Error debugging odds matching:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
