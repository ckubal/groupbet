import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  console.log('🔄 Migrating existing bets to include NFL week numbers...');
  
  try {
    // Get all bets from Firebase
    const betsSnapshot = await getDocs(collection(db, 'bets'));
    const bets = betsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    console.log(`📊 Found ${bets.length} bets to check for migration`);
    
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const bet of bets) {
      // Skip if bet already has nflWeek field
      if ((bet as any).nflWeek) {
        skippedCount++;
        continue;
      }
      
      // Extract NFL week from weekendId
      let nflWeek = null;
      if ((bet as any).weekendId) {
        const weekMatch = (bet as any).weekendId.match(/week-(\d+)/);
        nflWeek = weekMatch ? parseInt(weekMatch[1]) : null;
      }
      
      // Default to week 2 if we can't determine the week
      if (!nflWeek) {
        nflWeek = 2;
        console.log(`⚠️  Could not determine week for bet ${bet.id}, defaulting to week 2`);
      }
      
      // Update the bet document
      try {
        await updateDoc(doc(db, 'bets', bet.id), {
          nflWeek: nflWeek
        });
        
        console.log(`✅ Updated bet ${bet.id}: added nflWeek = ${nflWeek}`);
        updatedCount++;
      } catch (error) {
        console.error(`❌ Failed to update bet ${bet.id}:`, error);
      }
    }
    
    console.log(`🎯 Migration complete! Updated: ${updatedCount}, Skipped: ${skippedCount}`);
    
    return NextResponse.json({
      success: true,
      message: `Migration complete! Updated ${updatedCount} bets, skipped ${skippedCount} bets that already had nflWeek`,
      stats: {
        total: bets.length,
        updated: updatedCount,
        skipped: skippedCount
      }
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}