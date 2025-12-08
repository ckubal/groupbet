import { NextRequest, NextResponse } from 'next/server';
import { gamesCacheService } from '@/lib/games-cache';
import { bettingLinesCacheService } from '@/lib/betting-lines-cache';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const awayTeam = searchParams.get('awayTeam');
    const homeTeam = searchParams.get('homeTeam');
    const week = searchParams.get('week');
    
    if (!awayTeam || !homeTeam) {
      return NextResponse.json({ 
        error: 'awayTeam and homeTeam parameters required' 
      }, { status: 400 });
    }
    
    const weekNumber = week ? parseInt(week) : null;
    const games = weekNumber 
      ? await gamesCacheService.getGamesForWeek(weekNumber, false)
      : [];
    
    // Find the game
    const game = games.find(g => 
      g.awayTeam.toLowerCase().includes(awayTeam.toLowerCase()) &&
      g.homeTeam.toLowerCase().includes(homeTeam.toLowerCase())
    );
    
    if (!game) {
      return NextResponse.json({ 
        error: `Game not found: ${awayTeam} @ ${homeTeam}`,
        availableGames: games.map(g => `${g.awayTeam} @ ${g.homeTeam}`)
      }, { status: 404 });
    }
    
    // Get cached betting lines
    const cachedLines = await bettingLinesCacheService.getCachedBettingLines(game.id);
    
    return NextResponse.json({
      game: {
        id: game.id,
        awayTeam: game.awayTeam,
        homeTeam: game.homeTeam,
        gameTime: game.gameTime,
        status: game.status,
        weekendId: game.weekendId
      },
      odds: {
        spread: game.spread,
        spreadOdds: game.spreadOdds,
        overUnder: game.overUnder,
        overUnderOdds: game.overUnderOdds,
        homeMoneyline: game.homeMoneyline,
        awayMoneyline: game.awayMoneyline
      },
      cache: cachedLines ? {
        bookmaker: cachedLines.bookmaker,
        source: cachedLines.source,
        fetchedAt: cachedLines.fetchedAt,
        isFrozen: cachedLines.isFrozen,
        spread: cachedLines.spread,
        spreadOdds: cachedLines.spreadOdds,
        overUnder: cachedLines.overUnder,
        overUnderOdds: cachedLines.overUnderOdds,
        homeMoneyline: cachedLines.homeMoneyline,
        awayMoneyline: cachedLines.awayMoneyline
      } : null,
      note: cachedLines?.bookmaker 
        ? `Current odds are from ${cachedLines.bookmaker}${cachedLines.bookmaker !== 'bovada' ? ' (Bovada was not available)' : ''}`
        : 'No cached odds found'
    });
  } catch (error) {
    console.error('❌ Error checking game odds:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
