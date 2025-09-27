import { NextRequest, NextResponse } from 'next/server';
import { doc, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const betId = searchParams.get('betId');
    
    if (!betId) {
      return NextResponse.json({ 
        error: 'Missing betId parameter' 
      }, { status: 400 });
    }
    
    console.log(`🗑️ Attempting to delete bet: ${betId}`);
    
    // First check if the bet exists
    const betRef = doc(db, 'bets', betId);
    const betDoc = await getDoc(betRef);
    
    if (!betDoc.exists()) {
      return NextResponse.json({ 
        error: 'Bet not found' 
      }, { status: 404 });
    }
    
    const betData = betDoc.data();
    
    // Optionally, you could add checks here to prevent deletion of resolved bets
    // if (betData.status === 'won' || betData.status === 'lost') {
    //   return NextResponse.json({ 
    //     error: 'Cannot delete resolved bets' 
    //   }, { status: 403 });
    // }
    
    // Delete the bet
    await deleteDoc(betRef);
    
    console.log(`✅ Successfully deleted bet: ${betId}`);
    
    return NextResponse.json({ 
      success: true,
      message: `Bet ${betId} deleted successfully`,
      deletedBet: {
        id: betId,
        selection: betData.selection,
        status: betData.status
      }
    });
    
  } catch (error) {
    console.error('❌ Error deleting bet:', error);
    return NextResponse.json({ 
      error: 'Failed to delete bet', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}