import { NextRequest, NextResponse } from 'next/server';
import { playerPropsService } from '@/lib/firebase-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');
    
    if (!gameId) {
      return NextResponse.json({ 
        error: 'gameId parameter is required' 
      }, { status: 400 });
    }
    
    console.log(`🔍 Checking Firebase cache for game: ${gameId}`);
    
    // Check Firebase cache
    const cachedData = await playerPropsService.getCachedPlayerProps(gameId);
    
    if (cachedData) {
      const { props, cachedAt } = cachedData;
      const isValid = playerPropsService.isCacheValid(cachedAt, 60);
      
      return NextResponse.json({
        success: true,
        cached: true,
        gameId,
        cachedAt: cachedAt.toISOString(),
        isValid,
        cacheAgeMinutes: Math.round((Date.now() - cachedAt.getTime()) / (1000 * 60)),
        playerPropsCount: props.length,
        sampleProps: props.slice(0, 3) // Show first 3 props as sample
      });
    } else {
      return NextResponse.json({
        success: true,
        cached: false,
        gameId,
        message: 'No cached data found in Firebase'
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking Firebase cache:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}