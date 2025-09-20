import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { internalGameId, oddsApiId, awayTeam, homeTeam, gameTime } = await request.json();
    
    if (!internalGameId || !oddsApiId) {
      return NextResponse.json({ 
        error: 'internalGameId and oddsApiId are required' 
      }, { status: 400 });
    }
    
    console.log(`🔧 Manually creating game ID mapping: ${internalGameId} -> ${oddsApiId}`);
    
    // Import the service
    const { gameIdMappingService } = await import('@/lib/firebase-service');
    
    // Create the mapping
    await gameIdMappingService.storeGameIdMapping(internalGameId, {
      oddsApiId,
      espnId: 'manual-mapping', // Required field, but we don't have ESPN ID for this case
      awayTeam: awayTeam || 'Unknown',
      homeTeam: homeTeam || 'Unknown', 
      gameTime: gameTime ? new Date(gameTime) : new Date()
    });
    
    console.log(`✅ Game ID mapping created successfully`);
    
    return NextResponse.json({
      success: true,
      message: `Mapped ${internalGameId} to ${oddsApiId}`,
      mapping: {
        internalGameId,
        oddsApiId,
        awayTeam,
        homeTeam,
        gameTime
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to create game mapping:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}