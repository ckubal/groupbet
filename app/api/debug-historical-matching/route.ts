import { NextRequest, NextResponse } from 'next/server';
import { getNFLWeekBoundaries } from '@/lib/utils';
import { normalizeTeamName, doGamesMatch } from '@/lib/game-id-generator';
import { espnApi } from '@/lib/espn-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = parseInt(searchParams.get('week') || '10');
    const year = parseInt(searchParams.get('year') || '2023');

    console.log(`🔍 Debugging historical matching for ${year} Week ${week}...`);

    // Calculate week boundaries
    const { start, end } = getNFLWeekBoundaries(week, year);

    // Fetch ESPN data
    const espnData = await espnApi.getScoreboard(week, year);
    if (!espnData || !espnData.events) {
      return NextResponse.json({
        error: `No ESPN data available for ${year} Week ${week}`,
      }, { status: 404 });
    }

    // Extract unique dates
    const dates: string[] = [];
    const currentDate = new Date(start);
    while (currentDate <= end) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Fetch historical odds for first date as sample
    const apiKey = process.env.NEXT_PUBLIC_ODDS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        error: 'Odds API key not found',
      }, { status: 500 });
    }

    const sampleDate = dates[0];
    const date = new Date(`${sampleDate}T18:00:00Z`);
    const minutes = date.getMinutes();
    const roundedMinutes = Math.floor(minutes / 5) * 5;
    date.setMinutes(roundedMinutes);
    date.setSeconds(0);
    date.setMilliseconds(0);
    const timestamp = date.toISOString().replace(/\.\d{3}Z$/, 'Z');

    const oddsResponse = await fetch(
      `https://api.the-odds-api.com/v4/historical/sports/americanfootball_nfl/odds?${new URLSearchParams({
        apiKey,
        regions: 'us',
        markets: 'spreads,totals,h2h',
        oddsFormat: 'american',
        bookmakers: 'bovada,draftkings,fanduel',
        date: timestamp,
      })}`
    );

    let oddsGames: any[] = [];
    if (oddsResponse.ok) {
      const responseData = await oddsResponse.json();
      oddsGames = responseData.data || [];
    }

    // Sample ESPN games
    const espnSamples = espnData.events.slice(0, 5).map(event => {
      const competition = event.competitions?.[0];
      const homeCompetitor = competition?.competitors?.find((c: any) => c.homeAway === 'home');
      const awayCompetitor = competition?.competitors?.find((c: any) => c.homeAway === 'away');
      
      return {
        espnId: event.id,
        awayTeam: awayCompetitor?.team.displayName,
        homeTeam: homeCompetitor?.team.displayName,
        gameTime: event.date,
        awayTeamNormalized: awayCompetitor?.team.displayName ? normalizeTeamName(awayCompetitor.team.displayName) : null,
        homeTeamNormalized: homeCompetitor?.team.displayName ? normalizeTeamName(homeCompetitor.team.displayName) : null,
        completed: competition?.status?.type?.completed || false,
      };
    });

    // Sample Odds API games
    const oddsSamples = oddsGames.slice(0, 5).map((game: any) => ({
      oddsApiId: game.id,
      awayTeam: game.away_team,
      homeTeam: game.home_team,
      commenceTime: game.commence_time,
      awayTeamNormalized: normalizeTeamName(game.away_team),
      homeTeamNormalized: normalizeTeamName(game.home_team),
    }));

    // Try matching first ESPN game with all odds games
    const matchingAttempts: any[] = [];
    if (espnSamples.length > 0 && oddsSamples.length > 0) {
      const firstEspn = espnSamples[0];
      oddsSamples.forEach((oddsGame: any) => {
        const matches = doGamesMatch(
          {
            gameTime: firstEspn.gameTime,
            awayTeam: firstEspn.awayTeam || '',
            homeTeam: firstEspn.homeTeam || '',
          },
          {
            gameTime: oddsGame.commenceTime,
            awayTeam: oddsGame.awayTeam,
            homeTeam: oddsGame.homeTeam,
          },
          true,
          true // debug mode
        );
        
        matchingAttempts.push({
          espn: `${firstEspn.awayTeam} @ ${firstEspn.homeTeam}`,
          odds: `${oddsGame.awayTeam} @ ${oddsGame.homeTeam}`,
          matches,
        });
      });
    }

    return NextResponse.json({
      week,
      year,
      sampleDate,
      timestamp,
      espnGames: {
        total: espnData.events.length,
        samples: espnSamples,
      },
      oddsGames: {
        total: oddsGames.length,
        samples: oddsSamples,
      },
      matchingAttempts,
      teamNameNormalizations: {
        note: 'This shows how team names are normalized for matching',
        examples: [
          { original: 'New York Jets', normalized: normalizeTeamName('New York Jets') },
          { original: 'Kansas City Chiefs', normalized: normalizeTeamName('Kansas City Chiefs') },
          { original: 'NY Jets', normalized: normalizeTeamName('NY Jets') },
        ],
      },
    });

  } catch (error) {
    console.error('❌ Error debugging historical matching:', error);
    return NextResponse.json({
      error: 'Failed to debug historical matching',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
