import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCurrentNFLWeek } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const weekendId = searchParams.get('weekendId') || `2025-week-${getCurrentNFLWeek()}`;
    
    const betsQuery = query(
      collection(db, 'bets'),
      where('weekendId', '==', weekendId)
    );
    
    const betsSnapshot = await getDocs(betsQuery);
    const allBets = betsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];
    
    // Filter for head-to-head bets
    const headToHeadBets = allBets.filter((bet: any) => bet.bettingMode === 'head_to_head');
    
    return NextResponse.json({
      totalBets: allBets.length,
      headToHeadBets: headToHeadBets.length,
      headToHeadDetails: headToHeadBets.map((bet: any) => ({
        id: bet.id,
        placedBy: bet.placedBy,
        participants: bet.participants,
        selection: bet.selection,
        status: bet.status,
        amountPerPerson: bet.amountPerPerson,
        bettingMode: bet.bettingMode
      })),
      allBetsWithMode: allBets.map((bet: any) => ({
        id: bet.id,
        placedBy: bet.placedBy,
        participants: bet.participants,
        selection: bet.selection,
        status: bet.status,
        bettingMode: bet.bettingMode || 'NULL'
      }))
    });
    
  } catch (error) {
    return NextResponse.json({ 
      error: 'Failed to debug bets', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}