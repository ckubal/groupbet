import { NextRequest, NextResponse } from 'next/server';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('gameId') || 'eb481205d478f654835594acded077f3';
    
    const gameDoc = await getDoc(doc(db, 'games', gameId));
    
    if (!gameDoc.exists()) {
      return NextResponse.json({
        success: false,
        message: 'Game not found in Firebase',
        gameId
      });
    }
    
    const gameData = gameDoc.data();
    
    return NextResponse.json({
      success: true,
      gameId,
      awayTeam: gameData.awayTeam,
      homeTeam: gameData.homeTeam,
      playerProps: gameData.playerProps || [],
      playerPropsCount: gameData.playerProps?.length || 0,
      hasPlayerProps: !!(gameData.playerProps && gameData.playerProps.length > 0)
    });
    
  } catch (error) {
    console.error('Error checking Firebase game:', error);
    return NextResponse.json({ 
      error: 'Failed to check Firebase game',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}