import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    const betId = 'AwqzROWPXx5BRgS07Pcy';
    
    // Correct analysis:
    // Packers -7 means Packers need to win by more than 7 points
    // Final score: Packers 10 - Browns 13 (Packers lost by 3)
    // Therefore: Packers did NOT cover -7 spread = BET LOST
    
    const correctUpdate = {
      status: 'lost',
      result: 'Green Bay Packers did not cover -7 (lost 10-13)',
      resolvedAt: new Date()
    };
    
    await updateDoc(doc(db, 'bets', betId), correctUpdate);
    
    return NextResponse.json({
      success: true,
      message: 'Fixed Packers bet - correctly marked as LOST',
      betId,
      correction: {
        was: 'won - "Green Bay Packers covered +7 (10-13)"',
        now: 'lost - "Green Bay Packers did not cover -7 (lost 10-13)"',
        reasoning: 'Packers -7 requires them to win by more than 7. They lost the game 10-13, so they definitely did not cover the spread.'
      }
    });
    
  } catch (error) {
    console.error('Error fixing Packers bet:', error);
    return NextResponse.json({ 
      error: 'Failed to fix Packers bet',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}