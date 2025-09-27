import { NextRequest, NextResponse } from 'next/server';
import { gamesCacheService } from '@/lib/games-cache';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking Thursday night Cardinals-Seahawks game...');
    
    // Get Week 4 games
    const week4Games = await gamesCacheService.getGamesForWeek(4, false);
    
    // Find Cardinals-Seahawks game
    const thursdayGame = week4Games.find(g => 
      (g.awayTeam.includes('Cardinals') && g.homeTeam.includes('Seahawks')) ||
      (g.awayTeam.includes('Arizona') && g.homeTeam.includes('Seattle')) ||
      (g.awayTeam.includes('Seahawks') && g.homeTeam.includes('Cardinals')) ||
      (g.awayTeam.includes('Seattle') && g.homeTeam.includes('Arizona'))
    );
    
    if (!thursdayGame) {
      return NextResponse.json({
        success: false,
        message: 'Cardinals-Seahawks game not found in Week 4',
        totalGames: week4Games.length,
        allTeams: week4Games.map(g => `${g.awayTeam} @ ${g.homeTeam}`)
      });
    }
    
    // Check player props
    const hasPlayerProps = thursdayGame.playerProps && thursdayGame.playerProps.length > 0;
    
    return NextResponse.json({
      success: true,
      game: {
        id: thursdayGame.id,
        teams: `${thursdayGame.awayTeam} @ ${thursdayGame.homeTeam}`,
        date: thursdayGame.gameTime,
        status: thursdayGame.status,
        timeSlot: thursdayGame.timeSlot,
        hasPlayerProps,
        playerPropsCount: thursdayGame.playerProps?.length || 0,
        sampleProps: thursdayGame.playerProps?.slice(0, 3).map(p => ({
          player: p.playerName,
          type: p.propType,
          line: p.line
        }))
      },
      diagnostics: {
        gameStatus: thursdayGame.status,
        isUpcoming: thursdayGame.status === 'upcoming',
        willFetchProps: thursdayGame.status === 'upcoming',
        reason: thursdayGame.status !== 'upcoming' ? 
          `Player props only fetched for 'upcoming' games. This game has status: '${thursdayGame.status}'` : 
          'Game is upcoming, should fetch props'
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking Thursday game:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}