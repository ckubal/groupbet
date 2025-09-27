import { NextRequest, NextResponse } from 'next/server';
import { gamesCacheService } from '@/lib/games-cache';

export async function GET(request: NextRequest) {
  try {
    const games = await gamesCacheService.getGamesForWeek(4, false);
    
    const cardinalsGame = games.find(game => 
      game.homeTeam === 'Arizona Cardinals' || game.awayTeam === 'Arizona Cardinals'
    );
    
    if (!cardinalsGame) {
      return NextResponse.json({
        success: false,
        error: 'Cardinals game not found in Week 4'
      });
    }
    
    return NextResponse.json({
      success: true,
      game: {
        id: cardinalsGame.id,
        teams: `${cardinalsGame.awayTeam} @ ${cardinalsGame.homeTeam}`,
        gameTime: cardinalsGame.gameTime,
        timeSlot: cardinalsGame.timeSlot,
        homeScore: cardinalsGame.homeScore,
        awayScore: cardinalsGame.awayScore,
        status: cardinalsGame.status
      }
    });
    
  } catch (error) {
    console.error('❌ Error finding Cardinals game:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}