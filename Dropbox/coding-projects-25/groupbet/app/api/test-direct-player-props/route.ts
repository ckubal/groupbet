import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const oddsApiId = searchParams.get('oddsApiId') || 'aca5234c57e31b1931e51d2d0d6046f5'; // Thursday game default
    
    const apiKey = process.env.NEXT_PUBLIC_ODDS_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 500 });
    }
    
    console.log(`🧪 Testing direct player props API call for Odds API ID: ${oddsApiId}`);
    
    // Call player props API directly
    const url = `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/events/${oddsApiId}/odds?` +
      new URLSearchParams({
        apiKey,
        regions: 'us',
        markets: 'player_pass_yds,player_rush_yds,player_reception_yds',
        oddsFormat: 'american',
        bookmakers: 'bovada,draftkings,fanduel,betmgm,caesars,pointsbet',
      }).toString();
    
    console.log(`🌐 Calling: ${url.replace(apiKey, 'API_KEY_HIDDEN')}`);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Player props API error: ${response.status} ${response.statusText}: ${errorText}`);
      return NextResponse.json({ 
        error: `Player props API error: ${response.status}`,
        details: errorText 
      }, { status: response.status });
    }
    
    const data = await response.json();
    console.log(`✅ Player props API returned data for game ${oddsApiId}`);
    
    // Check for Bovada bookmaker
    const bovada = data.bookmakers?.find((b: any) => b.key === 'bovada');
    
    return NextResponse.json({
      success: true,
      oddsApiId,
      bookmakers: data.bookmakers?.map((b: any) => ({
        key: b.key,
        title: b.title,
        markets: b.markets?.map((m: any) => ({
          key: m.key,
          outcomes: m.outcomes?.length || 0
        })) || []
      })) || [],
      hasBovada: !!bovada,
      bovadaMarkets: bovada?.markets?.map((m: any) => ({
        key: m.key,
        outcomes: m.outcomes?.length || 0
      })) || [],
      rawData: data
    });
    
  } catch (error) {
    console.error('❌ Direct player props test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}