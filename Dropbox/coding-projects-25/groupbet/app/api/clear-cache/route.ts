import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('🧹 Clearing all caches...');
  
  try {
    // Import and clear ESPN API cache
    const { espnApi } = await import('@/lib/espn-api');
    espnApi.clearCache();
    
    // Import and clear Odds API cache  
    const { oddsApi } = await import('@/lib/odds-api');
    oddsApi.clearCache();
    
    console.log('✅ All caches cleared successfully');
    
    return NextResponse.json({
      success: true,
      message: 'All caches cleared successfully'
    });
    
  } catch (error) {
    console.error('❌ Failed to clear caches:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}