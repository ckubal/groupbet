import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  console.log('🔧 Fixing participant IDs for new bets...');
  
  try {
    // Update the three new bets with correct participant IDs
    const betIdsToFix = [
      '8QpPVL1lLYxmeGSv3aX3', // Packers -3
      'f1BHazJEkv5RuS5j59El', // Jayden Daniels passing yards
      'prWbvmc96Nn5mfDQT3tK'  // Jayden Daniels rushing yards
    ];
    
    const correctParticipants = ["will", "dio", "rosen", "charlie"];
    const correctPlacedBy = "rosen";
    
    for (const betId of betIdsToFix) {
      await updateDoc(doc(db, 'bets', betId), {
        participants: correctParticipants,
        placedBy: correctPlacedBy
      });
      console.log(`✅ Updated bet ${betId} with correct participants`);
    }
    
    return NextResponse.json({
      success: true,
      updatedBets: betIdsToFix.length,
      message: 'Successfully updated participant IDs'
    });
    
  } catch (error) {
    console.error('❌ Failed to fix participants:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}