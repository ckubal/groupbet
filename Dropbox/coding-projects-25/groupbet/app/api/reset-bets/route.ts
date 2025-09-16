import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  console.log('🔄 Resetting bet statuses to active for re-resolution...');
  
  try {
    // Get all bets for Week 2 2025
    const betsQuery = query(
      collection(db, 'bets'),
      where('weekendId', '==', '2025-week-2')
    );
    
    const betsSnapshot = await getDocs(betsQuery);
    console.log(`🎰 Found ${betsSnapshot.docs.length} bets to reset`);
    
    let resetCount = 0;
    const resets: any[] = [];
    
    for (const betDoc of betsSnapshot.docs) {
      const bet = betDoc.data();
      
      if (bet.status !== 'active') {
        console.log(`🔧 Resetting bet ${betDoc.id} from ${bet.status} to active`);
        
        await updateDoc(doc(db, 'bets', betDoc.id), {
          status: 'active',
          result: null,
          resolvedAt: null
        });
        
        resets.push({
          betId: betDoc.id,
          betDescription: `${bet.betType.toUpperCase()} - ${bet.selection}`,
          oldStatus: bet.status,
          newStatus: 'active'
        });
        
        resetCount++;
      }
    }
    
    console.log(`\n🎉 Reset complete! Reset ${resetCount} bet(s) to active status`);
    
    return NextResponse.json({
      success: true,
      resetCount,
      resets,
      message: `Successfully reset ${resetCount} bet(s) to active status for re-resolution`
    });
    
  } catch (error) {
    console.error('❌ Reset failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}