import { NextRequest, NextResponse } from 'next/server';
import { collection, addDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
    
    // Add default fields
    const newBet = {
      weekendId: '2025-week-2',
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