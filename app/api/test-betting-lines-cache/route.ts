import { NextRequest, NextResponse } from 'next/server';
import { bettingLinesCacheService } from '@/lib/betting-lines-cache';
import { getCurrentNFLWeek } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const { week } = await request.json();
    const targetWeek = week || getCurrentNFLWeek();
    
    console.log(`🧪 Testing betting lines cache integration for Week ${targetWeek}...`);
    
    // Test the full integration
    await bettingLinesCacheService.ensureBettingLinesForWeek(targetWeek);
    
    // Get status report
    const status = await bettingLinesCacheService.getBettingLinesStatusForWeek(targetWeek);
    
    return NextResponse.json({
      success: true,
      message: `Betting lines cache test completed for Week ${targetWeek}`,
      status,
      summary: {
        totalGames: status.summary.totalGames,
        gamesWithLines: status.summary.gamesWithLines,
        gamesFrozen: status.summary.gamesFrozen,
        gamesNeedingFetch: status.summary.gamesNeedingFetch,
        cacheCoverage: `${((status.summary.gamesWithLines / status.summary.totalGames) * 100).toFixed(1)}%`
      }
    });
    
  } catch (error) {
    console.error('❌ Error testing betting lines cache:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Betting lines cache integration test endpoint',
    usage: 'POST with { "week": 4 } to test cache for specific week'
  });
}