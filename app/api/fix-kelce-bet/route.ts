import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 Looking for Travis Kelce bet to fix...');
    
    // Find the Travis Kelce bet that was incorrectly added as UNDER
    const betsQuery = query(
      collection(db, 'bets'),
      where('playerName', '==', 'Travis Kelce'),
      where('weekendId', '==', '2025-week-3')
    );
    
    const snapshot = await getDocs(betsQuery);
    
    if (snapshot.empty) {
      console.log('❌ No Travis Kelce bet found');
      return NextResponse.json({
        success: false,
        error: 'Travis Kelce bet not found'
      }, { status: 404 });
    }
    
    let fixedCount = 0;
    const updates: any[] = [];
    
    for (const betDoc of snapshot.docs) {
      const bet = betDoc.data();
      console.log(`📋 Found bet ${betDoc.id}: ${bet.selection}`);
      
      // Fix the bet to show as OVER and mark as LOST
      const updateData = {
        selection: 'Travis Kelce Over 65.5 receiving yards',
        status: 'lost',
        result: 'Travis Kelce: 26 receiving yards (needed over 65.5)',
        placedBy: 'rosen', // Update from system to rosen
        resolvedAt: new Date()
      };
      
      await updateDoc(doc(db, 'bets', betDoc.id), updateData);
      
      updates.push({
        betId: betDoc.id,
        oldSelection: bet.selection,
        newSelection: updateData.selection,
        status: updateData.status,
        placedBy: updateData.placedBy
      });
      
      fixedCount++;
      console.log(`✅ Fixed bet ${betDoc.id} to OVER 65.5 and marked as LOST`);
    }
    
    return NextResponse.json({
      success: true,
      message: `Fixed ${fixedCount} Travis Kelce bet(s)`,
      updates
    });
    
  } catch (error) {
    console.error('❌ Error fixing Kelce bet:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}