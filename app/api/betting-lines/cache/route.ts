import { NextRequest, NextResponse } from 'next/server';
import { bettingLinesCacheService } from '@/lib/betting-lines-cache';
import { gamesCacheService } from '@/lib/games-cache';
import { getCurrentNFLWeek } from '@/lib/utils';

/**
 * Cache betting lines for games
 * POST /api/betting-lines/cache
 * 
 * Body options:
 * - { week: number } - Cache lines for all games in a week
 * - { gameId: string } - Cache lines for a specific game
 * - { force: boolean } - Force refresh existing cache
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { week, gameId, force } = body;
    
    console.log('🎯 BettingLines Cache API:', { week, gameId, force });
    
    if (gameId) {
      // Cache lines for specific game
      console.log(`📊 Caching betting lines for game ${gameId}...`);
      
      const game = await gamesCacheService.findGameByAnyId(gameId);
      if (!game) {
        return NextResponse.json({ 
          error: 'Game not found',
          gameId 
        }, { status: 404 });
      }
      
      await bettingLinesCacheService.ensureBettingLinesForGame(game);
      
      return NextResponse.json({ 
        success: true,
        message: `Betting lines cached for ${game.awayTeam} @ ${game.homeTeam}`,
        gameId: game.id
      });
      
    } else if (week) {
      // Cache lines for entire week
      const weekNumber = parseInt(week.toString());
      
      if (isNaN(weekNumber) || weekNumber < 1 || weekNumber > 18) {
        return NextResponse.json({
          error: 'Week must be between 1 and 18',
          week: weekNumber
        }, { status: 400 });
      }
      
      console.log(`📊 Caching betting lines for Week ${weekNumber}...`);
      
      await bettingLinesCacheService.ensureBettingLinesForWeek(weekNumber);
      
      return NextResponse.json({ 
        success: true,
        message: `Betting lines cached for Week ${weekNumber}`,
        week: weekNumber
      });
      
    } else {
      // Default to current week
      const currentWeek = getCurrentNFLWeek();
      console.log(`📊 Caching betting lines for current Week ${currentWeek}...`);
      
      await bettingLinesCacheService.ensureBettingLinesForWeek(currentWeek);
      
      return NextResponse.json({ 
        success: true,
        message: `Betting lines cached for current Week ${currentWeek}`,
        week: currentWeek
      });
    }
    
  } catch (error) {
    console.error('❌ Error in betting lines cache API:', error);
    return NextResponse.json({ 
      error: 'Failed to cache betting lines',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

/**
 * Get betting lines cache status
 * GET /api/betting-lines/cache?week=4
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');
    
    const weekNumber = week ? parseInt(week) : getCurrentNFLWeek();
    
    if (isNaN(weekNumber) || weekNumber < 1 || weekNumber > 18) {
      return NextResponse.json({
        error: 'Week must be between 1 and 18',
        week: weekNumber
      }, { status: 400 });
    }
    
    console.log(`📊 Getting betting lines status for Week ${weekNumber}...`);
    
    const status = await bettingLinesCacheService.getBettingLinesStatusForWeek(weekNumber);
    
    return NextResponse.json({
      success: true,
      ...status
    });
    
  } catch (error) {
    console.error('❌ Error getting betting lines status:', error);
    return NextResponse.json({ 
      error: 'Failed to get betting lines status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}