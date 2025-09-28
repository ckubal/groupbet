import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export async function POST() {
  try {
    const betId = '3TQb5AKpw6btfgLjwRsW';
    
    // Get the problematic bet
    const betRef = doc(db, 'bets', betId);
    const betDoc = await getDoc(betRef);
    
    if (!betDoc.exists()) {
      return NextResponse.json({
        success: false,
        error: 'Bet not found'
      });
    }
    
    const betData = betDoc.data();
    
    // Fix the corrupted gameData by removing undefined fields
    if (betData.gameData && betData.gameData.date === undefined) {
      const updatedGameData = { ...betData.gameData };
      delete updatedGameData.date;
      
      // Add gameTime if available from the game
      if (betData.gameData.gameTime) {
        updatedGameData.gameTime = betData.gameData.gameTime;
      }
      
      await updateDoc(betRef, {
        gameData: updatedGameData
      });
      
      console.log(`Fixed corrupted bet ${betId}`);
    }
    
    return NextResponse.json({
      success: true,
      betId,
      message: 'Fixed corrupted bet data'
    });
    
  } catch (error) {
    console.error('Error fixing corrupted bet:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}