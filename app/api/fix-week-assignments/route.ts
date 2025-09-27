import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Fixing week assignments for games...');
    
    // Get the specific game that's incorrectly assigned to Week 2
    const falconsVikingsGame = doc(db, 'games', '2156db3a6d0daf553227ab6971c15a30');
    const gameDoc = await getDocs(query(collection(db, 'games'), where('__name__', '==', '2156db3a6d0daf553227ab6971c15a30')));
    
    let fixedCount = 0;
    const fixes: any[] = [];
    
    if (!gameDoc.empty) {
      const game = gameDoc.docs[0].data();
      console.log(`Found game: ${game.awayTeam} @ ${game.homeTeam}, weekendId: ${game.weekendId}`);
      
      // Fix this specific game
      await updateDoc(falconsVikingsGame, {
        weekendId: '2025-week-3',
        nflWeek: 3
      });
      
      fixes.push({
        gameId: '2156db3a6d0daf553227ab6971c15a30',
        teams: `${game.awayTeam} @ ${game.homeTeam}`,
        oldWeek: game.weekendId,
        newWeek: '2025-week-3'
      });
      fixedCount++;
    }
    
    // Look for other games that might have week assignment issues
    // Games played between Sept 18-24 should be Week 3
    const allGamesSnapshot = await getDocs(collection(db, 'games'));
    
    for (const gameDoc of allGamesSnapshot.docs) {
      const game = gameDoc.data();
      
      // Check if game date falls in Week 3 range
      if (game.date) {
        const gameDate = new Date(game.date);
        const week3Start = new Date('2025-09-18');
        const week3End = new Date('2025-09-24T23:59:59');
        
        if (gameDate >= week3Start && gameDate <= week3End && game.weekendId !== '2025-week-3') {
          console.log(`Fixing week assignment for ${game.awayTeam} @ ${game.homeTeam}`);
          
          await updateDoc(doc(db, 'games', gameDoc.id), {
            weekendId: '2025-week-3',
            nflWeek: 3
          });
          
          fixes.push({
            gameId: gameDoc.id,
            teams: `${game.awayTeam} @ ${game.homeTeam}`,
            oldWeek: game.weekendId,
            newWeek: '2025-week-3'
          });
          fixedCount++;
        }
      }
    }
    
    // Now also ensure all Week 3 bets can find their games
    const week3Bets = await getDocs(query(
      collection(db, 'bets'),
      where('weekendId', '==', '2025-week-3')
    ));
    
    console.log(`Checking ${week3Bets.docs.length} Week 3 bets...`);
    
    return NextResponse.json({
      success: true,
      message: `Fixed ${fixedCount} game(s) with incorrect week assignments`,
      fixes,
      totalBetsToCheck: week3Bets.docs.length
    });
    
  } catch (error) {
    console.error('❌ Error fixing week assignments:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}