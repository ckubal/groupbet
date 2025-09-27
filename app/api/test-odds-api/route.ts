import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const { getCurrentNFLWeek } = await import('@/lib/utils');
    const week = parseInt(searchParams.get('week') || getCurrentNFLWeek().toString());
    
    const apiKey = process.env.NEXT_PUBLIC_ODDS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 500 });
    }
    
    console.log(`🧪 Testing direct Odds API call for Week ${week}...`);
    
    // Get current week boundaries  
    const { getNFLWeekBoundaries } = await import('@/lib/utils');
    const { start, end } = getNFLWeekBoundaries(week, 2025);
    
    // Call Odds API directly
    const url = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?` +
      new URLSearchParams({
        apiKey,
        regions: 'us',
        markets: 'h2h,spreads,totals',
        oddsFormat: 'american',
        bookmakers: 'bovada,draftkings,fanduel,betmgm,caesars',
      }).toString();
    
    console.log(`🌐 Calling: ${url.replace(apiKey, 'API_KEY_HIDDEN')}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Odds API error: ${response.status} ${response.statusText}: ${errorText}`);
      return NextResponse.json({ 
        error: `Odds API error: ${response.status}`,
        details: errorText 
      }, { status: response.status });
    }
    
    const data = await response.json();
    console.log(`✅ Odds API returned ${data.length} games`);
    
    // Filter by week
    const weekGames = data.filter((game: any) => {
      const gameTime = new Date(game.commence_time);
      return gameTime >= start && gameTime < end;
    });
    
    console.log(`📅 ${weekGames.length} games fall within Week ${week} boundaries`);
    
    // Look for Thursday night game (Dolphins @ Bills)
    const thursdayGame = weekGames.find((game: any) => 
      (game.away_team === 'Miami Dolphins' && game.home_team === 'Buffalo Bills') ||
      (game.away_team === 'Buffalo Bills' && game.home_team === 'Miami Dolphins')
    );
    
    return NextResponse.json({
      success: true,
      week,
      totalGames: data.length,
      weekGames: weekGames.length,
      thursdayGameFound: !!thursdayGame,
      thursdayGame: thursdayGame || null,
      allGames: weekGames.map((g: any) => ({
        id: g.id,
        commence_time: g.commence_time,
        home_team: g.home_team,
        away_team: g.away_team
      }))
    });
    
  } catch (error) {
    console.error('❌ Direct Odds API test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}