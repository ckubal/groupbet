import { NextRequest, NextResponse } from 'next/server';
import { gamesCacheService } from '@/lib/games-cache';
import { bettingLinesCacheService } from '@/lib/betting-lines-cache';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const awayTeam = searchParams.get('awayTeam');
    const homeTeam = searchParams.get('homeTeam');
    const week = searchParams.get('week');
    const gameId = searchParams.get('gameId');
    
    if (!gameId && (!awayTeam || !homeTeam)) {
      return NextResponse.json({ 
        error: 'Either gameId or both awayTeam and homeTeam parameters required' 
      }, { status: 400 });
    }
    
    let game;
    
    if (gameId) {
      // Find game by ID
      game = await gamesCacheService.getGameById(gameId);
    } else {
      // Find game by team names
      const weekNumber = week ? parseInt(week) : null;
      const games = weekNumber 
        ? await gamesCacheService.getGamesForWeek(weekNumber, false)
        : [];
      
      game = games.find(g => 
        g.awayTeam.toLowerCase().includes(awayTeam!.toLowerCase()) &&
        g.homeTeam.toLowerCase().includes(homeTeam!.toLowerCase())
      );
    }
    
    if (!game) {
      return NextResponse.json({ 
        error: `Game not found: ${awayTeam || 'N/A'} @ ${homeTeam || 'N/A'}`,
        gameId
      }, { status: 404 });
    }
    
    console.log(`🔄 Force refreshing odds for ${game.awayTeam} @ ${game.homeTeam} (gameId: ${game.id})`);
    
    // Force refresh by calling ensureBettingLinesForGame
    // This will bypass cache and fetch fresh odds
    await bettingLinesCacheService.ensureBettingLinesForGame(game);
    
    // Get the updated cached lines
    const updatedLines = await bettingLinesCacheService.getCachedBettingLines(game.id);
    
    return NextResponse.json({
      success: true,
      game: {
        id: game.id,
        awayTeam: game.awayTeam,
        homeTeam: game.homeTeam,
        gameTime: game.gameTime
      },
      refreshedOdds: updatedLines ? {
        bookmaker: updatedLines.bookmaker,
        spread: updatedLines.spread,
        spreadOdds: updatedLines.spreadOdds,
        overUnder: updatedLines.overUnder,
        overUnderOdds: updatedLines.overUnderOdds,
        homeMoneyline: updatedLines.homeMoneyline,
        awayMoneyline: updatedLines.awayMoneyline,
        fetchedAt: updatedLines.fetchedAt,
        isFrozen: updatedLines.isFrozen
      } : null,
      message: `Odds refreshed for ${game.awayTeam} @ ${game.homeTeam}${updatedLines?.bookmaker ? ` from ${updatedLines.bookmaker}` : ''}`
    });
  } catch (error) {
    console.error('❌ Error force refreshing odds:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
