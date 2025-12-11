import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    // Search for any bets mentioning Packers
    const betsQuery = query(
      collection(db, 'bets'),
      where('weekendId', '==', '2025-week-3')
    );
    
    const betsSnapshot = await getDocs(betsQuery);
    const packersBets: any[] = [];
    
    betsSnapshot.forEach((doc: any) => {
      const bet = doc.data();
      if (bet.selection?.toLowerCase().includes('packers') || 
          bet.selection?.toLowerCase().includes('green bay')) {
        packersBets.push({
          id: doc.id,
          ...bet
        });
      }
    });
    
    return NextResponse.json({
      success: true,
      totalBets: betsSnapshot.docs.length,
      packersBets,
      gameInfo: {
        gameId: '44b485590b2af1e7e63ca5397f986f88',
        finalScore: 'Packers 10 - Browns 13',
        spread: 'Packers were -7 favorites',
        result: 'Packers lost by 3, did not cover -7 spread'
      }
    });
    
  } catch (error) {
    console.error('Error checking Packers bet:', error);
    return NextResponse.json({ 
      error: 'Failed to check Packers bet',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}