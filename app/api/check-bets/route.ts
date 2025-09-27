import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCurrentNFLWeek } from '@/lib/utils';

export async function GET(request: NextRequest) {
  console.log('🔍 Checking all bets in database...');
  
  try {
    const { searchParams } = new URL(request.url);
    const week = searchParams.get('week');
    const weekNumber = week ? parseInt(week) : getCurrentNFLWeek();
    const weekendId = `2025-week-${weekNumber}`;
    
    console.log(`🔍 Checking bets for ${weekendId}...`);
    
    // Get all bets for the specified week
    const betsQuery = query(
      collection(db, 'bets'),
      where('weekendId', '==', weekendId)
    );
    
    const betsSnapshot = await getDocs(betsQuery);
    console.log(`📊 Found ${betsSnapshot.docs.length} total bets`);
    
    const allBets = betsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt
    }));
    
    // Group by participants to see user IDs
    const userIds = new Set();
    allBets.forEach((bet: any) => {
      if (bet.participants) {
        bet.participants.forEach((id: string) => userIds.add(id));
      }
      if (bet.placedBy) {
        userIds.add(bet.placedBy);
      }
    });
    
    console.log('👥 User IDs found:', Array.from(userIds));
    
    return NextResponse.json({
      success: true,
      totalBets: allBets.length,
      userIds: Array.from(userIds),
      bets: allBets.map((bet: any) => ({
        id: bet.id,
        gameId: bet.gameId,
        betType: bet.betType,
        selection: bet.selection,
        participants: bet.participants,
        placedBy: bet.placedBy,
        status: bet.status,
        amountPerPerson: bet.amountPerPerson
      }))
    });
    
  } catch (error) {
    console.error('❌ Failed to check bets:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}