import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Fixing Week 4 game statuses...');
    
    const currentDate = new Date('2025-09-24'); // Current date from context
    
    // Get all games for Week 4
    const gamesQuery = query(
      collection(db, 'games'),
      where('weekendId', '==', '2025-week-4')
    );
    
    const gamesSnapshot = await getDocs(gamesQuery);
    console.log(`📋 Found ${gamesSnapshot.docs.length} games for Week 4`);
    
    let fixedCount = 0;
    const fixes: any[] = [];
    
    for (const gameDoc of gamesSnapshot.docs) {
      const game = gameDoc.data();
      
      // Get game time
      let gameTime: Date;
      if (game.gameTime && game.gameTime.seconds) {
        gameTime = new Date(game.gameTime.seconds * 1000);
      } else if (game.date) {
        gameTime = new Date(game.date);
      } else {
        console.log(`⚠️ No valid date found for ${game.awayTeam} @ ${game.homeTeam}`);
        continue;
      }
      
      // Determine correct status based on current date
      let correctStatus: string;
      if (gameTime > currentDate) {
        correctStatus = 'upcoming';
      } else {
        // For simplicity, assume games in the past are final
        // In reality, we'd check ESPN API for actual status
        correctStatus = 'final';
      }
      
      // Fix if status is incorrect
      if (game.status !== correctStatus || game.status === 'final' && gameTime > currentDate) {
        console.log(`🔄 Fixing ${game.awayTeam} @ ${game.homeTeam}: ${game.status} → ${correctStatus}`);
        console.log(`   Game time: ${gameTime.toISOString()}, Current: ${currentDate.toISOString()}`);
        
        await updateDoc(doc(db, 'games', gameDoc.id), {
          status: correctStatus,
          statusFixed: true,
          statusFixedAt: new Date()
        });
        
        fixes.push({
          gameId: gameDoc.id,
          teams: `${game.awayTeam} @ ${game.homeTeam}`,
          gameTime: gameTime.toISOString(),
          oldStatus: game.status,
          newStatus: correctStatus
        });
        
        fixedCount++;
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Fixed ${fixedCount} game statuses for Week 4`,
      totalGames: gamesSnapshot.docs.length,
      currentDate: currentDate.toISOString(),
      fixes
    });
    
  } catch (error) {
    console.error('❌ Error fixing game statuses:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}