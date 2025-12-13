import { NextRequest, NextResponse } from 'next/server';
import { kalshiApi } from '@/lib/kalshi-api';
import { getCurrentNFLWeek } from '@/lib/utils';

/**
 * Debug endpoint to inspect Kalshi API responses
 * Helps diagnose why markets aren't matching
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');
    
    const weekNumber = week ? parseInt(week) : getCurrentNFLWeek();
    
    console.log(`🔍 DEBUG: Fetching Kalshi data for Week ${weekNumber}...`);

    // Fetch raw markets
    const rawMarkets = await kalshiApi.fetchNFLMarkets(weekNumber);
    
    // Process markets
    const processedMarkets = kalshiApi.processMarkets(rawMarkets);
    
    // Return detailed debug info
    return NextResponse.json({
      success: true,
      week: weekNumber,
      rawMarketsCount: rawMarkets.length,
      processedMarketsCount: processedMarkets.length,
      sampleRawMarkets: rawMarkets.slice(0, 5).map(m => ({
        ticker: m.ticker,
        title: m.title,
        subtitle: m.subtitle,
        series_ticker: m.series_ticker,
        event_ticker: m.event_ticker,
        status: m.status,
        close_time: m.close_time,
        yes_price: m.yes_price,
        no_price: m.no_price,
      })),
      sampleProcessedMarkets: processedMarkets.slice(0, 5).map(m => ({
        ticker: m.ticker,
        title: m.title,
        marketType: m.marketType,
        teamName: m.teamName,
        opponentName: m.opponentName,
        spread: m.spread,
        total: m.total,
        gameDate: m.gameDate,
        yesAmericanOdds: m.yesAmericanOdds,
        noAmericanOdds: m.noAmericanOdds,
      })),
      marketTypeBreakdown: {
        moneyline: processedMarkets.filter(m => m.marketType === 'moneyline').length,
        spread: processedMarkets.filter(m => m.marketType === 'spread').length,
        over_under: processedMarkets.filter(m => m.marketType === 'over_under').length,
        unknown: processedMarkets.filter(m => !m.marketType).length,
      },
      teamNameBreakdown: processedMarkets
        .filter(m => m.teamName)
        .reduce((acc, m) => {
          acc[m.teamName!] = (acc[m.teamName!] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
    });
  } catch (error) {
    console.error('❌ DEBUG: Error fetching Kalshi data:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to fetch debug data',
      success: false,
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
