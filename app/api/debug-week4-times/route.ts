import { NextRequest, NextResponse } from 'next/server';
import { gamesCacheService } from '@/lib/games-cache';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debugging Week 4 game time slots...');
    
    // Get Week 4 games
    const week4Games = await gamesCacheService.getGamesForWeek(4, true);
    
    const debugInfo = week4Games.map(game => {
      // Handle different date formats
      let gameTime: Date;
      if (game.gameTime && typeof game.gameTime === 'object' && 'seconds' in game.gameTime) {
        // Firebase timestamp format
        gameTime = new Date((game.gameTime as any).seconds * 1000);
      } else if ((game as any).date) {
        // Regular date string or Date object
        gameTime = new Date((game as any).date);
      } else if (game.gameTime instanceof Date) {
        gameTime = game.gameTime;
      } else {
        console.log(`⚠️ No valid date found for ${game.awayTeam} @ ${game.homeTeam}`);
        return null;
      }
      
      // Recreate the same logic as getTimeSlot
      const easternTimeOptions: Intl.DateTimeFormatOptions = { 
        timeZone: "America/New_York", 
        year: "numeric", month: "2-digit", day: "2-digit", 
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false 
      };
      const pacificTimeOptions: Intl.DateTimeFormatOptions = { 
        timeZone: "America/Los_Angeles", 
        year: "numeric", month: "2-digit", day: "2-digit", 
        hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false 
      };
      
      // Get the date string in Eastern time
      const easternDateStr = gameTime.toLocaleString('en-US', { timeZone: 'America/New_York' });
      const easternDate = new Date(easternDateStr);
      const easternDay = easternDate.getDay();
      const easternHour = easternDate.getHours();
      
      // Get Pacific hour for Sunday time slot determination
      const pacificDateStr = gameTime.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
      const pacificDate = new Date(pacificDateStr);
      const pacificHour = pacificDate.getHours();
      
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      return {
        teams: `${game.awayTeam} @ ${game.homeTeam}`,
        originalDate: (game as any).date || game.gameTime,
        utcTime: gameTime.toISOString(),
        easternDay: easternDay,
        easternDayName: dayNames[easternDay],
        easternHour: easternHour,
        pacificHour: pacificHour,
        assignedTimeSlot: game.timeSlot,
        expectedTimeSlot: getExpectedTimeSlot(easternDay, pacificHour),
        match: game.timeSlot === getExpectedTimeSlot(easternDay, pacificHour)
      };
    }).filter(game => game !== null);
    
    // Group by assigned time slot
    const groupedBySlot = debugInfo.reduce((acc, game) => {
      if (!acc[game.assignedTimeSlot]) {
        acc[game.assignedTimeSlot] = [];
      }
      acc[game.assignedTimeSlot].push(game);
      return acc;
    }, {} as Record<string, any[]>);
    
    return NextResponse.json({
      success: true,
      totalGames: week4Games.length,
      debugInfo,
      groupedBySlot,
      summary: {
        thursday: groupedBySlot.thursday?.length || 0,
        sunday_early: groupedBySlot.sunday_early?.length || 0,
        sunday_afternoon: groupedBySlot.sunday_afternoon?.length || 0,
        sunday_night: groupedBySlot.sunday_night?.length || 0,
        monday: groupedBySlot.monday?.length || 0
      }
    });
    
  } catch (error) {
    console.error('❌ Error debugging Week 4 times:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function getExpectedTimeSlot(easternDay: number, pacificHour: number): string {
  if (easternDay === 4) return 'thursday';      // Thursday
  if (easternDay === 1) return 'monday';        // Monday
  if (easternDay === 0) {                       // Sunday
    if (pacificHour < 12) return 'sunday_early';     // Before noon PT
    if (pacificHour < 15) return 'sunday_afternoon'; // Noon to 3pm PT  
    return 'sunday_night';                            // 3pm+ PT
  }
  return 'sunday_early'; // Default for other days
}