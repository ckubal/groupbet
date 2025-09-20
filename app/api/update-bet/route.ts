import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    const { betId, updates } = await request.json();
    
    if (!betId || !updates) {
      return NextResponse.json({
        error: 'betId and updates are required',
        success: false
      }, { status: 400 });
    }
    
    console.log(`🔄 Updating bet ${betId} with:`, updates);
    
    const betRef = doc(db, 'bets', betId);
    await updateDoc(betRef, updates);
    
    console.log('✅ Bet updated successfully');
    
    return NextResponse.json({
      success: true,
      message: `Bet ${betId} updated successfully`
    });
    
  } catch (error) {
    console.error('❌ Error updating bet:', error);
    return NextResponse.json({ 
      error: 'Failed to update bet', 
      details: error instanceof Error ? error.message : 'Unknown error',
      success: false 
    }, { status: 500 });
  }
}