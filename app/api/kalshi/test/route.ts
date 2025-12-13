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

    const diagnostics: any = {
      authentication: {
        hasCredentials: !!(process.env.KALSHI_API_KEY_ID && process.env.KALSHI_PRIVATE_KEY),
        apiKeyIdPresent: !!process.env.KALSHI_API_KEY_ID,
        privateKeyPresent: !!process.env.KALSHI_PRIVATE_KEY,
      },
    };

    // Test 1: Get sports filters
    let sportsFilters;
    try {
      sportsFilters = await kalshiApi.getSportsFilters();
      diagnostics.sportsFilters = {
        available: !!sportsFilters,
        sports: sportsFilters ? Object.keys(sportsFilters.filters_by_sports || {}) : [],
        sportOrdering: sportsFilters?.sport_ordering || [],
      };
    } catch (err) {
      diagnostics.sportsFilters = {
        error: err instanceof Error ? err.message : 'Failed',
      };
    }
    
    // Test 2: Discover NFL series ticker
    let nflSeriesTicker;
    try {
      nflSeriesTicker = await kalshiApi.discoverNFLSeriesTicker();
      diagnostics.nflSeriesTicker = {
        discovered: nflSeriesTicker,
      };
    } catch (err) {
      diagnostics.nflSeriesTicker = {
        error: err instanceof Error ? err.message : 'Failed',
      };
    }
    
    // Test 3: Try fetching ALL markets (no week filter) to see if any exist
    let allMarkets: any[] = [];
    try {
      console.log(`🧪 TEST: Fetching ALL markets (no week filter)...`);
      allMarkets = await kalshiApi.fetchNFLMarkets(undefined); // No week filter
      diagnostics.allMarkets = {
        count: allMarkets.length,
        sample: allMarkets.slice(0, 3).map(m => ({
          ticker: m.ticker,
          title: m.title,
          close_time: m.close_time,
          status: m.status,
        })),
        dateRange: allMarkets.length > 0 ? {
          earliest: allMarkets.reduce((earliest, m) => {
            if (!m.close_time) return earliest;
            const date = new Date(m.close_time);
            return !earliest || date < earliest ? date : earliest;
          }, null as Date | null)?.toISOString(),
          latest: allMarkets.reduce((latest, m) => {
            if (!m.close_time) return latest;
            const date = new Date(m.close_time);
            return !latest || date > latest ? date : latest;
          }, null as Date | null)?.toISOString(),
        } : null,
      };
    } catch (err) {
      diagnostics.allMarkets = {
        error: err instanceof Error ? err.message : 'Failed',
      };
    }
    
    // Test 4: Fetch markets for specific week
    let weekMarkets: any[] = [];
    try {
      console.log(`🧪 TEST: Fetching markets for Week ${weekNumber}...`);
      weekMarkets = await kalshiApi.fetchNFLMarkets(weekNumber);
      diagnostics.weekMarkets = {
        count: weekMarkets.length,
        sample: weekMarkets.slice(0, 3).map(m => ({
          ticker: m.ticker,
          title: m.title,
          close_time: m.close_time,
          status: m.status,
        })),
      };
    } catch (err) {
      diagnostics.weekMarkets = {
        error: err instanceof Error ? err.message : 'Failed',
      };
    }
    
    // Test 5: Process markets
    let processedMarkets: any[] = [];
    try {
      processedMarkets = kalshiApi.processMarkets(weekMarkets);
      diagnostics.processedMarkets = {
        count: processedMarkets.length,
        sample: processedMarkets.slice(0, 2).map(m => ({
          ticker: m.ticker,
          title: m.title,
          marketType: m.marketType,
          teamName: m.teamName,
          gameDate: m.gameDate,
          yesAmericanOdds: m.yesAmericanOdds,
          noAmericanOdds: m.noAmericanOdds,
        })),
      };
    } catch (err) {
      diagnostics.processedMarkets = {
        error: err instanceof Error ? err.message : 'Failed',
      };
    }
    
    return NextResponse.json({
      success: true,
      week: weekNumber,
      tests: diagnostics,
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
