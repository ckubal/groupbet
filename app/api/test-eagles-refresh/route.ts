import { NextRequest, NextResponse } from 'next/server';
import { gamesCacheService } from '@/lib/games-cache';
import { bettingLinesCacheService } from '@/lib/betting-lines-cache';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 TEST: Starting Eagles/Chargers betting lines refresh test...');
    
    // Get Week 14 games
    const games = await gamesCacheService.getGamesForWeek(14, false);
    console.log(`📊 Found ${games.length} games for Week 14`);
    
    // Find Eagles game
    const eaglesGame = games.find(g => 
      (g.awayTeam.toLowerCase().includes('eagles') || g.homeTeam.toLowerCase().includes('eagles')) &&
      (g.awayTeam.toLowerCase().includes('chargers') || g.homeTeam.toLowerCase().includes('chargers'))
    );
    
    if (!eaglesGame) {
      return NextResponse.json({
        error: 'Eagles/Chargers game not found',
        games: games.map(g => ({ id: g.id, awayTeam: g.awayTeam, homeTeam: g.homeTeam, gameTime: g.gameTime }))
      }, { status: 404 });
    }
    
    console.log(`🏈 Found Eagles game:`, {
      id: eaglesGame.id,
      awayTeam: eaglesGame.awayTeam,
      homeTeam: eaglesGame.homeTeam,
      gameTime: eaglesGame.gameTime,
      gameTimeType: typeof eaglesGame.gameTime,
      gameTimeIsDate: eaglesGame.gameTime instanceof Date,
      hasGameTime: !!eaglesGame.gameTime
    });
    
    // Check current cached lines
    const cachedLines = await bettingLinesCacheService.getCachedBettingLines(eaglesGame.id);
    console.log(`💾 Current cached lines:`, cachedLines ? {
      hasLines: true,
      spread: cachedLines.spread,
      overUnder: cachedLines.overUnder,
      bookmaker: cachedLines.bookmaker,
      fetchedAt: cachedLines.fetchedAt
    } : { hasLines: false });
    
    // Check game time
    const now = new Date();
    let hoursUntilGame = 0;
    if (eaglesGame.gameTime) {
      const gameTime = eaglesGame.gameTime instanceof Date ? eaglesGame.gameTime : new Date(eaglesGame.gameTime);
      hoursUntilGame = (gameTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      console.log(`⏰ Hours until game: ${hoursUntilGame.toFixed(2)}`);
    }
    
    // Try to refresh
    console.log(`🔄 Attempting to refresh betting lines...`);
    try {
      await bettingLinesCacheService.ensureBettingLinesForGame(eaglesGame);
      console.log(`✅ Refresh completed`);
    } catch (error) {
      console.error(`❌ Refresh failed:`, error);
      return NextResponse.json({
        error: 'Refresh failed',
        details: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      }, { status: 500 });
    }
    
    // Check updated cached lines
    const updatedLines = await bettingLinesCacheService.getCachedBettingLines(eaglesGame.id);
    console.log(`💾 Updated cached lines:`, updatedLines ? {
      hasLines: true,
      spread: updatedLines.spread,
      spreadOdds: updatedLines.spreadOdds,
      overUnder: updatedLines.overUnder,
      overUnderOdds: updatedLines.overUnderOdds,
      homeMoneyline: updatedLines.homeMoneyline,
      awayMoneyline: updatedLines.awayMoneyline,
      bookmaker: updatedLines.bookmaker,
      fetchedAt: updatedLines.fetchedAt
    } : { hasLines: false });
    
    return NextResponse.json({
      success: true,
      game: {
        id: eaglesGame.id,
        awayTeam: eaglesGame.awayTeam,
        homeTeam: eaglesGame.homeTeam,
        gameTime: eaglesGame.gameTime instanceof Date ? eaglesGame.gameTime.toISOString() : eaglesGame.gameTime,
        hoursUntilGame: hoursUntilGame.toFixed(2)
      },
      before: cachedLines ? {
        spread: cachedLines.spread,
        overUnder: cachedLines.overUnder,
        bookmaker: cachedLines.bookmaker
      } : null,
      after: updatedLines ? {
        spread: updatedLines.spread,
        spreadOdds: updatedLines.spreadOdds,
        overUnder: updatedLines.overUnder,
        overUnderOdds: updatedLines.overUnderOdds,
        homeMoneyline: updatedLines.homeMoneyline,
        awayMoneyline: updatedLines.awayMoneyline,
        bookmaker: updatedLines.bookmaker,
        fetchedAt: updatedLines.fetchedAt.toISOString()
      } : null,
      message: updatedLines?.spread ? `✅ Successfully fetched odds! Spread: ${updatedLines.spread}, O/U: ${updatedLines.overUnder}` : '⚠️ No odds fetched'
    });
  } catch (error) {
    console.error('❌ Test failed:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}
