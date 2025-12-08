import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  console.log('🔧 Fixing user names from "dio" to "d/o"...');
  
  try {
    // Get all bets and update participant arrays
    const betsQuery = query(collection(db, 'bets'));
    const betsSnapshot = await getDocs(betsQuery);
    
    let updatedCount = 0;
    
    for (const betDoc of betsSnapshot.docs) {
      const bet = betDoc.data();
      let needsUpdate = false;
      
      // Fix participants array - convert "dio" to "d/o" (standard format)
      const updatedParticipants = bet.participants?.map((participant: string) => {
        if (participant === 'dio' || participant === 'Dio' || participant === 'DIO' || participant === 'D/O') {
          needsUpdate = true;
          return 'd/o'; // Standard lowercase format
        }
        return participant;
      });
      
      // Fix placedBy field
      let updatedPlacedBy = bet.placedBy;
      if (bet.placedBy === 'dio' || bet.placedBy === 'Dio' || bet.placedBy === 'DIO' || bet.placedBy === 'D/O') {
        updatedPlacedBy = 'd/o'; // Standard lowercase format
        needsUpdate = true;
      }
      
      if (needsUpdate) {
        await updateDoc(doc(db, 'bets', betDoc.id), {
          participants: updatedParticipants,
          placedBy: updatedPlacedBy
        });
        updatedCount++;
        console.log(`✅ Updated bet ${betDoc.id}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      updatedBets: updatedCount,
      message: `Successfully updated ${updatedCount} bet(s) from "dio" variants to "d/o" (standard format)`
    });
    
  } catch (error) {
    console.error('❌ Failed to fix user names:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}