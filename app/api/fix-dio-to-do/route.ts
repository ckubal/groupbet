import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  console.log('🔧 Fixing dio back to d/o - user wants d/o as standard...');
  
  try {
    // Get all bets that contain "dio" in participants  
    const betsCollection = collection(db, 'bets');
    const betsSnapshot = await getDocs(betsCollection);
    
    const batch = writeBatch(db);
    let fixedCount = 0;
    const updatedBets: any[] = [];
    
    for (const betDoc of betsSnapshot.docs) {
      const bet = betDoc.data();
      const betId = betDoc.id;
      
      // Check if this bet has "dio" in participants
      if (bet.participants && bet.participants.includes('dio')) {
        console.log(`📝 Fixing bet ${betId}: ${bet.selection}`);
        
        // Replace "dio" with "d/o" in participants array
        const updatedParticipants = bet.participants.map((p: string) => p === 'dio' ? 'd/o' : p);
        
        // Update placedBy if it's also "dio"
        const updatedPlacedBy = bet.placedBy === 'dio' ? 'd/o' : bet.placedBy;
        
        const updates = {
          participants: updatedParticipants,
          placedBy: updatedPlacedBy
        };
        
        batch.update(doc(db, 'bets', betId), updates);
        
        updatedBets.push({
          betId,
          selection: bet.selection,
          originalParticipants: bet.participants,
          updatedParticipants,
          originalPlacedBy: bet.placedBy,
          updatedPlacedBy
        });
        
        fixedCount++;
      }
    }
    
    // Apply all updates in a batch
    if (fixedCount > 0) {
      await batch.commit();
      console.log(`✅ Fixed ${fixedCount} bets with dio -> d/o`);
    }
    
    return NextResponse.json({
      success: true,
      message: `Fixed ${fixedCount} bets: changed dio back to d/o`,
      fixedCount,
      updatedBets
    });
    
  } catch (error) {
    console.error('❌ Failed to fix user ID inconsistency:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}