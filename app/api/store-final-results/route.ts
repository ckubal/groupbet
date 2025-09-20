import { NextRequest, NextResponse } from 'next/server';
import { finalGameService } from '@/lib/firebase-service';
import { oddsApi } from '@/lib/odds-api';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');
    
    if (!week) {
      return NextResponse.json({
        success: false,
        error: 'Week parameter is required'
      }, { status: 400 });
    }
    
    const weekNumber = parseInt(week);
    if (isNaN(weekNumber) || weekNumber < 1 || weekNumber > 18) {
      return NextResponse.json({
        success: false,
        error: 'Week must be between 1 and 18'
      }, { status: 400 });
    }
    
    console.log(`💾 Manual trigger: Storing final results for Week ${weekNumber}`);
    
    // Get current games for the week (this will fetch fresh data)
    const games = await oddsApi.getNFLGames(weekNumber, true); // Force refresh
    
    // Store final results
    await finalGameService.storeFinalGameResults(games);
    
    const finalGames = games.filter(g => g.status === 'final');
    
    return NextResponse.json({
      success: true,
      message: `Successfully stored final results for Week ${weekNumber}`,
      totalGames: games.length,
      finalGames: finalGames.length,
      finalGameResults: finalGames.map(g => ({
        id: g.id,
        teams: `${g.awayTeam} @ ${g.homeTeam}`,
        score: `${g.awayScore}-${g.homeScore}`,
        status: g.status
      }))
    });
    
  } catch (error) {
    console.error('❌ Failed to store final results:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}