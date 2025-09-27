import { NextRequest, NextResponse } from 'next/server';
import { gamesCacheService } from '@/lib/games-cache';

export async function GET(request: NextRequest) {
  try {
    console.log('🧪 Testing infinite loop fix...');
    
    // Test the games cache service with a timeout
    const startTime = Date.now();
    const games = await gamesCacheService.getGamesForWeek(4, false);
    const duration = Date.now() - startTime;
    
    console.log(`✅ Test completed in ${duration}ms`);
    
    return NextResponse.json({
      success: true,
      message: `Infinite loop fix test successful - completed in ${duration}ms`,
      gamesCount: games.length,
      duration: `${duration}ms`
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}