import { NextRequest, NextResponse } from 'next/server';
import { gamesCacheService } from '@/lib/games-cache';

export async function GET(request: NextRequest) {
  try {
    console.log('🕐 Debugging time slot assignments...');
    
    const games = await gamesCacheService.getGamesForWeek(4, false);
    
    const timeSlotBreakdown = games.map(game => {
      // Handle potential invalid date
      let gameDate;
      let gameTimeISO = 'Invalid Date';
      let easternTime = 'Invalid Date';
      let pacificTime = 'Invalid Date';
      
      try {
        gameDate = new Date(game.gameTime);
        if (!isNaN(gameDate.getTime())) {
          gameTimeISO = gameDate.toISOString();
          
          easternTime = gameDate.toLocaleString('en-US', { 
            timeZone: 'America/New_York',
            weekday: 'long',
            month: 'short', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
          });
          
          pacificTime = gameDate.toLocaleString('en-US', { 
            timeZone: 'America/Los_Angeles',
            weekday: 'long',
            month: 'short', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
          });
        }
      } catch (error) {
        console.error(`❌ Invalid gameTime for ${game.awayTeam} @ ${game.homeTeam}:`, game.gameTime);
      }
      
      return {
        teams: `${game.awayTeam} @ ${game.homeTeam}`,
        gameTime: game.gameTime,
        gameTimeType: typeof game.gameTime,
        gameTimeISO,
        timeSlot: game.timeSlot,
        status: game.status,
        easternTime,
        pacificTime,
      };
    });
    
    // Group by time slot
    const groupedBySlot = timeSlotBreakdown.reduce((acc, game) => {
      const slot = game.timeSlot || 'unknown';
      if (!acc[slot]) acc[slot] = [];
      acc[slot].push(game);
      return acc;
    }, {} as Record<string, any[]>);
    
    return NextResponse.json({
      success: true,
      totalGames: games.length,
      timeSlotBreakdown,
      groupedBySlot,
      slotCounts: Object.keys(groupedBySlot).map(slot => ({
        slot,
        count: groupedBySlot[slot].length,
        games: groupedBySlot[slot].map(g => g.teams)
      }))
    });
    
  } catch (error) {
    console.error('❌ Debug time slots error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}