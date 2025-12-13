import { NextRequest, NextResponse } from 'next/server';
import { kalshiApi } from '@/lib/kalshi-api';
import { getCurrentNFLWeek } from '@/lib/utils';

/**
 * Test endpoint to diagnose Kalshi API issues
 * Returns raw API responses for debugging
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');
    
    const weekNumber = week ? parseInt(week) : getCurrentNFLWeek();
    
    console.log(`🧪 TEST: Diagnosing Kalshi API for Week ${weekNumber}...`);

    // Test 1: Get sports filters
    const sportsFilters = await kalshiApi.getSportsFilters();
    
    // Test 2: Discover NFL series ticker
    const nflSeriesTicker = await kalshiApi.discoverNFLSeriesTicker();
    
    // Test 3: Fetch markets
    const markets = await kalshiApi.fetchNFLMarkets(weekNumber);
    
    // Test 4: Process markets
    const processedMarkets = kalshiApi.processMarkets(markets);
    
    return NextResponse.json({
      success: true,
      week: weekNumber,
      tests: {
        sportsFilters: {
          available: !!sportsFilters,
          sports: sportsFilters ? Object.keys(sportsFilters.filters_by_sports || {}) : [],
          sportOrdering: sportsFilters?.sport_ordering || [],
        },
        nflSeriesTicker: {
          discovered: nflSeriesTicker,
        },
        markets: {
          rawCount: markets.length,
          processedCount: processedMarkets.length,
          sampleRaw: markets.slice(0, 2).map(m => ({
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
          sampleProcessed: processedMarkets.slice(0, 2).map(m => ({
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
        },
      },
    });
  } catch (error) {
    console.error('❌ TEST: Error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Test failed',
      success: false,
      stack: error instanceof Error ? error.stack : undefined,
    }, { status: 500 });
  }
}
