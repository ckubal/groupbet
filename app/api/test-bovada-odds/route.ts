import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');
    
    const apiKey = process.env.NEXT_PUBLIC_ODDS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 500 });
    }
    
    console.log(`🧪 Testing Bovada odds for game: ${gameId || 'all games'}`);
    
    // Fetch odds with Bovada included
    const url = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?` +
      new URLSearchParams({
        apiKey,
        regions: 'us',
        markets: 'spreads,totals,h2h',
        oddsFormat: 'american',
        bookmakers: 'bovada,draftkings,fanduel',
      }).toString();
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({ 
        error: `Odds API error: ${response.status}`,
        details: errorText 
      }, { status: response.status });
    }
    
    const data = await response.json();
    console.log(`✅ Odds API returned ${data.length} games`);
    
    // Analyze which bookmakers are available for each game
    const bookmakerAnalysis = data.map((game: any) => {
      const availableBookmakers = game.bookmakers?.map((b: any) => b.key) || [];
      const hasBovada = availableBookmakers.includes('bovada');
      const bovadaData = game.bookmakers?.find((b: any) => b.key === 'bovada');
      
      return {
        id: game.id,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        commenceTime: game.commence_time,
        availableBookmakers,
        hasBovada,
        bovadaMarkets: bovadaData ? {
          spreads: bovadaData.markets?.find((m: any) => m.key === 'spreads') ? 'Yes' : 'No',
          totals: bovadaData.markets?.find((m: any) => m.key === 'totals') ? 'Yes' : 'No',
          h2h: bovadaData.markets?.find((m: any) => m.key === 'h2h') ? 'Yes' : 'No',
        } : null,
        allBookmakers: game.bookmakers?.map((b: any) => ({
          key: b.key,
          title: b.title,
          markets: b.markets?.map((m: any) => m.key) || []
        })) || []
      };
    });
    
    const bovadaCount = bookmakerAnalysis.filter((g: any) => g.hasBovada).length;
    
    return NextResponse.json({
      success: true,
      totalGames: data.length,
      gamesWithBovada: bovadaCount,
      gamesWithoutBovada: data.length - bovadaCount,
      analysis: bookmakerAnalysis,
      summary: {
        bovadaAvailable: `${bovadaCount}/${data.length} games have Bovada odds`,
        preferredBookmaker: 'Bovada is first priority in selection logic',
        selectionOrder: ['bovada', 'draftkings', 'fanduel']
      }
    });
  } catch (error) {
    console.error('❌ TEST ERROR:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
