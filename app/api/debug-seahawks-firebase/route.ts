import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Debugging Seahawks-Cardinals Firebase data...');
    
    // Get all games for Week 4
    const gamesQuery = query(
      collection(db, 'games'),
      where('weekendId', '==', '2025-week-4')
    );
    
    const gamesSnapshot = await getDocs(gamesQuery);
    console.log(`📋 Found ${gamesSnapshot.docs.length} games in Firebase for Week 4`);
    
    // Find all Seahawks-Cardinals games
    const seahawksGames = [];
    for (const gameDoc of gamesSnapshot.docs) {
      const game = gameDoc.data();
      if ((game.awayTeam?.includes('Seahawks') && game.homeTeam?.includes('Cardinals')) ||
          (game.awayTeam?.includes('Seattle') && game.homeTeam?.includes('Arizona'))) {
        seahawksGames.push({
          id: gameDoc.id,
          awayTeam: game.awayTeam,
          homeTeam: game.homeTeam,
          timeSlot: game.timeSlot,
          timeSlotFixed: game.timeSlotFixed,
          originalTimeSlot: game.originalTimeSlot,
          status: game.status,
          statusFixed: game.statusFixed,
          gameTime: game.gameTime,
          cachedAt: game.cachedAt
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      totalGames: gamesSnapshot.docs.length,
      seahawksGames,
      count: seahawksGames.length
    });
    
  } catch (error) {
    console.error('❌ Error checking Firebase:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}