import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');
    
    if (!gameId) {
      return NextResponse.json({ 
        error: 'gameId parameter is required' 
      }, { status: 400 });
    }
    
    console.log(`🔍 Testing game ID mapping for: ${gameId}`);
    
    // Import the service
    const { gameIdMappingService } = await import('@/lib/firebase-service');
    
    // Check what mapping exists
    const oddsApiId = await gameIdMappingService.getOddsApiId(gameId);
    
    console.log(`📋 Game ID mapping result: ${gameId} -> ${oddsApiId || 'NOT FOUND'}`);
    
    return NextResponse.json({
      success: true,
      internalGameId: gameId,
      oddsApiId: oddsApiId || null,
      found: !!oddsApiId
    });
    
  } catch (error) {
    console.error('❌ Game mapping test error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}