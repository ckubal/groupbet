import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    const { betId, result, actualValue, playerStats, weekendId, nflWeek } = await request.json();
    
    if (!betId || !result) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: betId and result'
      }, { status: 400 });
    }
    
    // Get the bet document
    const betDocRef = doc(db, 'bets', betId);
    const betDoc = await getDoc(betDocRef);
    
    if (!betDoc.exists()) {
      return NextResponse.json({
        success: false,
        error: 'Bet not found'
      }, { status: 404 });
    }
    
    const bet = betDoc.data();
    
    // Update the bet with resolution
    const updates: any = {
      status: result === 'won' ? 'won' : 'lost',
      resolvedAt: new Date(),
    };
    
    if (actualValue !== undefined) {
      updates.actualValue = actualValue;
    }
    
    if (playerStats) {
      updates.playerStats = playerStats;
    }
    
    // Allow updating weekendId and nflWeek from request
    if (weekendId) {
      updates.weekendId = weekendId;
    }
    if (nflWeek) {
      updates.nflWeek = nflWeek;
    }
    
    await updateDoc(betDocRef, updates);
    
    return NextResponse.json({
      success: true,
      message: `Bet ${betId} resolved as ${result}`,
      bet: {
        ...bet,
        ...updates
      }
    });
    
  } catch (error) {
    console.error('❌ Error resolving bet:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}