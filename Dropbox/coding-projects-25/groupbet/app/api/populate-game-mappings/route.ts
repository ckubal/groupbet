import { NextRequest, NextResponse } from 'next/server';
import { oddsApi } from '@/lib/odds-api';
import { gameIdMappingService } from '@/lib/firebase-service';
import { doGamesMatch } from '@/lib/game-id-generator';

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 Manually populating game ID mappings...');
    
    // Get current games from ESPN (these have our internal IDs)
    const response = await fetch(`${request.nextUrl.origin}/api/games?week=2`);
    if (!response.ok) {
      throw new Error('Failed to fetch games');
    }
    const games = await response.json();
    console.log(`📊 Found ${games.length} games from ESPN`);
    
    // Get games from Odds API (these have Odds API IDs)
    const oddsApiResponse = await fetch(
      `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?apiKey=${process.env.NEXT_PUBLIC_ODDS_API_KEY}&regions=us&markets=spreads&oddsFormat=american`
    );
    
    if (!oddsApiResponse.ok) {
      throw new Error('Failed to fetch from Odds API');
    }
    
    const oddsApiGames = await oddsApiResponse.json();
    console.log(`📊 Found ${oddsApiGames.length} games from Odds API`);
    
    // Match games and store mappings
    let mappingsCreated = 0;
    
    for (const game of games) {
      // Find matching Odds API game
      const matchingOddsGame = oddsApiGames.find((oddsGame: any) => {
        return doGamesMatch(
          {
            gameTime: new Date(game.gameTime),
            awayTeam: game.awayTeam,
            homeTeam: game.homeTeam
          },
          {
            gameTime: oddsGame.commence_time,
            awayTeam: oddsGame.away_team,
            homeTeam: oddsGame.home_team
          }
        );
      });
      
      if (matchingOddsGame) {
        console.log(`🔗 Mapping ${game.awayTeam} @ ${game.homeTeam}: ${game.id} → ${matchingOddsGame.id}`);
        
        await gameIdMappingService.storeGameIdMapping(game.id, {
          espnId: game.espnId,
          oddsApiId: matchingOddsGame.id,
          awayTeam: game.awayTeam,
          homeTeam: game.homeTeam,
          gameTime: new Date(game.gameTime)
        });
        
        mappingsCreated++;
      } else {
        console.warn(`⚠️ No Odds API match found for ${game.awayTeam} @ ${game.homeTeam}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Created ${mappingsCreated} game ID mappings`,
      totalGames: games.length,
      mappingsCreated
    });
    
  } catch (error) {
    console.error('❌ Error populating game mappings:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}