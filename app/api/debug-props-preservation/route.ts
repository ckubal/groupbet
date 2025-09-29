import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, doc, getDoc } from 'firebase/firestore';

export async function GET() {
  try {
    // Check the Chiefs game specifically
    const gameId = '7da9ed1b967e5881e6443b794400ce78';
    
    // Get the game from Firebase directly
    const gameDoc = await getDoc(doc(db, 'games', gameId));
    
    if (!gameDoc.exists()) {
      return NextResponse.json({
        success: false,
        error: 'Game not found',
        gameId
      });
    }
    
    const gameData = gameDoc.data();
    
    // Also check all games for this week
    const gamesQuery = query(
      collection(db, 'games'),
      where('weekendId', '==', '2025-week-3')
    );
    
    const gamesSnapshot = await getDocs(gamesQuery);
    const allGames = gamesSnapshot.docs.map(doc => ({
      id: doc.id,
      awayTeam: doc.data().awayTeam,
      homeTeam: doc.data().homeTeam,
      playerProps: doc.data().playerProps || [],
      playerPropsCount: (doc.data().playerProps || []).length
    }));
    
    // Find Chiefs games
    const chiefsGames = allGames.filter(g => 
      g.awayTeam?.includes('Chiefs') || g.homeTeam?.includes('Chiefs')
    );
    
    return NextResponse.json({
      success: true,
      targetGame: {
        id: gameId,
        exists: true,
        awayTeam: gameData.awayTeam,
        homeTeam: gameData.homeTeam,
        playerProps: gameData.playerProps || [],
        playerPropsCount: (gameData.playerProps || []).length
      },
      allChiefsGames: chiefsGames,
      totalWeek3Games: allGames.length
    });
    
  } catch (error) {
    console.error('Error debugging props preservation:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}