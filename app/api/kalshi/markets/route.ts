import { NextRequest, NextResponse } from 'next/server';
import { kalshiApi } from '@/lib/kalshi-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');
    
    const weekNumber = week ? parseInt(week) : undefined;
    
    if (weekNumber && (weekNumber < 1 || weekNumber > 18)) {
      return NextResponse.json({
        error: 'Week must be between 1 and 18',
        success: false
      }, { status: 400 });
    }

    console.log(`📡 Fetching Kalshi markets${weekNumber ? ` for Week ${weekNumber}` : ''}...`);
    
    const markets = await kalshiApi.fetchNFLMarkets(weekNumber);
    const processedMarkets = kalshiApi.processMarkets(markets);

    return NextResponse.json({
      success: true,
      markets: processedMarkets,
      count: processedMarkets.length
    });
  } catch (error) {
    console.error('❌ Error fetching Kalshi markets:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to fetch Kalshi markets',
      success: false
    }, { status: 500 });
  }
}
