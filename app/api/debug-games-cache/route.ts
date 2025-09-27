import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const week = parseInt(searchParams.get('week') || '3');
    
    console.log(`🔍 Debug: Looking for games with weekendId: 2025-week-${week}`);
    
    // Check all games in Firebase
    const allGamesSnapshot = await getDocs(collection(db, 'games'));
    console.log(`📊 Total games in Firebase: ${allGamesSnapshot.docs.length}`);
    
    const allGames = allGamesSnapshot.docs.map(doc => ({
      id: doc.id,
      weekendId: doc.data().weekendId,
      awayTeam: doc.data().awayTeam,
      homeTeam: doc.data().homeTeam,
      playerPropsCount: doc.data().playerProps?.length || 0
    }));
    
    // Check games for specific week
    const weekGamesQuery = query(
      collection(db, 'games'),
      where('weekendId', '==', `2025-week-${week}`)
    );
    
    const weekGamesSnapshot = await getDocs(weekGamesQuery);
    console.log(`📊 Week ${week} games in Firebase: ${weekGamesSnapshot.docs.length}`);
    
    const weekGames = weekGamesSnapshot.docs.map(doc => ({
      id: doc.id,
      awayTeam: doc.data().awayTeam,
      homeTeam: doc.data().homeTeam,
      playerPropsCount: doc.data().playerProps?.length || 0
    }));
    
    return NextResponse.json({
      success: true,
      week,
      searchedWeekendId: `2025-week-${week}`,
      totalGamesInFirebase: allGames.length,
      weekGamesInFirebase: weekGames.length,
      allGames: allGames,
      weekGames: weekGames,
      chiefsGiantsGame: allGames.find(g => 
        (g.awayTeam === 'Kansas City Chiefs' && g.homeTeam === 'New York Giants') ||
        (g.homeTeam === 'Kansas City Chiefs' && g.awayTeam === 'New York Giants')
      )
    });
    
  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({ 
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}