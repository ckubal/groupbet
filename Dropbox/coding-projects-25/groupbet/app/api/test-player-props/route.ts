import { NextRequest, NextResponse } from 'next/server';
import { oddsApi } from '@/lib/odds-api';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId');
    
    if (!gameId) {
      return NextResponse.json({ 
        error: 'gameId parameter is required' 
      }, { status: 400 });
    }
    
    console.log(`🎯 Test API: Fetching player props for gameId: ${gameId}`);
    
    // Test the player props fetching directly
    const props = await oddsApi.getPlayerProps(gameId);
    
    console.log(`✅ Test API: Retrieved ${props.length} player props`);
    
    return NextResponse.json({
      success: true,
      gameId,
      playerProps: props,
      count: props.length
    });
    
  } catch (error) {
    console.error('❌ Test API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}