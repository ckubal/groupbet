import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = parseInt(searchParams.get('week') || '4');
    
    console.log(`🔍 Auditing Week ${week} games in Firebase...`);
    
    // Get all games for the specified week
    const gamesQuery = query(
      collection(db, 'games'),
      where('weekendId', '==', `2025-week-${week}`)
    );
    
    const gamesSnapshot = await getDocs(gamesQuery);
    console.log(`📋 Found ${gamesSnapshot.docs.length} total documents for Week ${week}`);
    
    // Analyze all games
    const allGames = [];
    const gamesByMatchup = new Map();
    
    for (const gameDoc of gamesSnapshot.docs) {
      const game = gameDoc.data();
      const matchupKey = `${game.awayTeam} @ ${game.homeTeam}`;
      
      const gameInfo = {
        firebaseId: gameDoc.id,
        matchup: matchupKey,
        awayTeam: game.awayTeam,
        homeTeam: game.homeTeam,
        status: game.status,
        timeSlot: game.timeSlot,
        hasGameTime: !!(game.gameTime && (game.gameTime.seconds || game.gameTime instanceof Date)),
        hasPlayerProps: !!(game.playerProps && game.playerProps.length > 0),
        playerPropsCount: game.playerProps?.length || 0,
        hasCachedAt: !!game.cachedAt,
        hasEspnId: !!game.espnId,
        espnId: game.espnId,
        hasReadableId: !!game.readableId,
        readableId: game.readableId,
        timeSlotFixed: game.timeSlotFixed || false,
        statusFixed: game.statusFixed || false
      };
      
      allGames.push(gameInfo);
      
      // Group by matchup to find duplicates
      if (!gamesByMatchup.has(matchupKey)) {
        gamesByMatchup.set(matchupKey, []);
      }
      gamesByMatchup.get(matchupKey).push(gameInfo);
    }
    
    // Find duplicates
    const duplicates = [];
    const uniqueMatchups = [];
    
    for (const [matchup, games] of gamesByMatchup) {
      if (games.length > 1) {
        duplicates.push({
          matchup,
          count: games.length,
          games: games.map((g: any) => ({
            firebaseId: g.firebaseId,
            hasGameTime: g.hasGameTime,
            hasPlayerProps: g.hasPlayerProps,
            playerPropsCount: g.playerPropsCount,
            timeSlot: g.timeSlot,
            status: g.status,
            espnId: g.espnId,
            readableId: g.readableId
          }))
        });
      } else {
        uniqueMatchups.push({
          matchup,
          game: games[0]
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      week,
      summary: {
        totalDocuments: gamesSnapshot.docs.length,
        uniqueMatchups: gamesByMatchup.size,
        expectedGames: 16, // NFL has 16 games per week
        duplicateMatchups: duplicates.length,
        duplicateDocuments: gamesSnapshot.docs.length - gamesByMatchup.size
      },
      duplicates,
      uniqueMatchups: uniqueMatchups.slice(0, 5), // Show first 5 for brevity
      allGames: allGames.slice(0, 10) // Show first 10 for analysis
    });
    
  } catch (error) {
    console.error('❌ Error auditing Firebase games:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}