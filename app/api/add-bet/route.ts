import { NextRequest, NextResponse } from 'next/server';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCurrentNFLWeek } from '@/lib/utils';

export async function POST(request: NextRequest) {
  console.log('🎰 Adding new bet manually...');
  
  try {
    const betData = await request.json();
    
    // Validate required fields
    const requiredFields = ['gameId', 'placedBy', 'participants', 'betType', 'selection', 'odds', 'totalAmount', 'amountPerPerson'];
    for (const field of requiredFields) {
      if (!betData[field]) {
        return NextResponse.json({
          success: false,
          error: `Missing required field: ${field}`
        }, { status: 400 });
      }
    }
    
    // Determine the correct week from the game data
    let nflWeek = betData.nflWeek;
    let weekendId = betData.weekendId;
    
    if (!nflWeek || !weekendId) {
      // Try to get the week from the game document
      try {
        const gameDoc = await getDoc(doc(db, 'games', betData.gameId));
        if (gameDoc.exists()) {
          const gameData = gameDoc.data();
          if (gameData.weekendId) {
            weekendId = gameData.weekendId;
            const weekMatch = gameData.weekendId.match(/week-(\d+)/);
            nflWeek = weekMatch ? parseInt(weekMatch[1]) : getCurrentNFLWeek();
          }
        }
      } catch (error) {
        console.warn('Could not fetch game data for week determination:', error);
      }
      
      // Final fallback to current NFL week
      if (!nflWeek) {
        nflWeek = getCurrentNFLWeek();
      }
      if (!weekendId) {
        weekendId = `2025-week-${nflWeek}`;
      }
    }
    
    // Add default fields
    const newBet = {
      weekendId,
      nflWeek, // Store the NFL week number
      status: 'active', // Will be resolved by the resolve-bets API
      createdAt: new Date(),
      ...betData
    };
    
    console.log('🎲 Creating bet:', {
      gameId: newBet.gameId,
      betType: newBet.betType,
      selection: newBet.selection,
      odds: newBet.odds,
      amount: newBet.amountPerPerson
    });
    
    // Add to Firebase
    const docRef = await addDoc(collection(db, 'bets'), newBet);
    
    console.log(`✅ Bet created with ID: ${docRef.id}`);
    
    return NextResponse.json({
      success: true,
      betId: docRef.id,
      bet: newBet,
      message: 'Bet added successfully'
    });
    
  } catch (error) {
    console.error('❌ Failed to add bet:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}