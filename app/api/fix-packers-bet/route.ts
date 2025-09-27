import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  console.log('🔧 Fixing Packers bet: changing from -3 to -7 and re-resolving...');
  
  try {
    const packersBetId = '8QpPVL1lLYxmeGSv3aX3';
    
    // First, get the current bet to see its state
    const betDoc = await getDoc(doc(db, 'bets', packersBetId));
    if (!betDoc.exists()) {
      return NextResponse.json({
        success: false,
        error: 'Packers bet not found'
      }, { status: 404 });
    }
    
    const currentBet = betDoc.data();
    console.log('📋 Current Packers bet:', currentBet);
    
    // Update the bet: change selection to -7, set line to -7, mark as lost
    await updateDoc(doc(db, 'bets', packersBetId), {
      selection: 'Green Bay Packers -7',
      line: -7,
      status: 'lost',
      result: 'Packers lost 18-27 (did not cover -7)',
      resolvedAt: new Date()
    });
    
    console.log('✅ Successfully updated Packers bet to -7 and marked as lost');
    
    return NextResponse.json({
      success: true,
      message: 'Packers bet updated from -3 to -7 and marked as lost',
      originalBet: currentBet,
      updates: {
        selection: 'Green Bay Packers -7',
        line: -7,
        status: 'lost',
        result: 'Packers lost 18-27 (did not cover -7)'
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to fix Packers bet:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}