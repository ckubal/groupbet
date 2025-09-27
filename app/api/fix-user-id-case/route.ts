import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Fixing user ID case mismatches...');
    
    // Get all bets
    const betsSnapshot = await getDocs(collection(db, 'bets'));
    let fixedCount = 0;
    const fixes: any[] = [];
    
    for (const betDoc of betsSnapshot.docs) {
      const bet = betDoc.data();
      let needsUpdate = false;
      let updatedParticipants = [...bet.participants];
      
      // Fix case mismatches in participants array
      updatedParticipants = updatedParticipants.map((participant: string) => {
        if (participant === 'D/O' || participant === 'DIO' || participant === 'dio') {
          needsUpdate = true;
          return 'd/o';
        }
        return participant;
      });
      
      // Fix case mismatch in placedBy field
      let updatedPlacedBy = bet.placedBy;
      if (bet.placedBy === 'D/O' || bet.placedBy === 'DIO' || bet.placedBy === 'dio') {
        updatedPlacedBy = 'd/o';
        needsUpdate = true;
      }
      
      // Update bet if needed
      if (needsUpdate) {
        await updateDoc(doc(db, 'bets', betDoc.id), {
          participants: updatedParticipants,
          placedBy: updatedPlacedBy
        });
        
        fixes.push({
          betId: betDoc.id,
          selection: bet.selection,
          oldParticipants: bet.participants,
          newParticipants: updatedParticipants,
          oldPlacedBy: bet.placedBy,
          newPlacedBy: updatedPlacedBy
        });
        
        fixedCount++;
        console.log(`✅ Fixed user ID in bet ${betDoc.id}: ${bet.selection}`);
      }
    }
    
    console.log(`🎉 Fixed ${fixedCount} bets with user ID case mismatches`);
    
    return NextResponse.json({
      success: true,
      fixedCount,
      fixes,
      message: `Successfully fixed ${fixedCount} bets with user ID case mismatches`
    });
    
  } catch (error) {
    console.error('❌ Error fixing user ID cases:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}