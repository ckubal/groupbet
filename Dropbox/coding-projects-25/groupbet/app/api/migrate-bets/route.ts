import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// Mapping from old game IDs to new game IDs based on bet analysis
const gameIdMapping: Record<string, string> = {
  // Jacksonville Jaguars ML bet -> Jaguars @ Bengals game
  'ec75e45d75691f810f347e0c5ff25d6e': '6ed5b648a0845d4e9d67c98e3ea0729e',
  
  // Buffalo Bills +6 spread bet -> Bills @ Jets game  
  'cd0fd9335b5182d3bfed35ab8d5ab6fb': '5c38fcc81bc1466ca49ceee86883c475',
  
  // New England Patriots ML bet -> Patriots @ Dolphins game
  '575c1b169aab675ec72372ccb0f4c55f': '120f7593218cb994870bd0aa8a80557d',
  
  // Dallas Cowboys -4.5 spread bet -> Giants @ Cowboys game
  '05a5b084f4e19535b2d3f91ef5c00169': '38dcd81359e8bfaf92a37cbd095e5f7c',
  
  // Detroit Lions -6 spread bet -> Bears @ Lions game
  '1ee9ea2c8256bc6be5dd92e60f6c17de': 'af695dfbdc8a089d9a2357a86409447e',
  
  // Both DeAndre Hopkins and Derrick Henry player props -> Browns @ Ravens game
  '553edb8bf2452482b37dde58e832a6fb': '52daa27d8a4676123ac2ff71386637c3'
};

export async function POST(request: NextRequest) {
  console.log('🔄 Starting bet ID migration...');
  
  try {
    // Get all bets for Week 2 2025
    const betsQuery = query(
      collection(db, 'bets'),
      where('weekendId', '==', '2025-week-2')
    );
    
    const betsSnapshot = await getDocs(betsQuery);
    console.log(`📊 Found ${betsSnapshot.docs.length} bets to potentially migrate`);
    
    let migratedCount = 0;
    const migrations: any[] = [];
    
    for (const betDoc of betsSnapshot.docs) {
      const bet = betDoc.data();
      const oldGameId = bet.gameId;
      const newGameId = gameIdMapping[oldGameId];
      
      if (newGameId) {
        console.log(`🔧 Migrating bet ${betDoc.id}:`);
        console.log(`   Old ID: ${oldGameId}`);
        console.log(`   New ID: ${newGameId}`);
        console.log(`   Bet: ${bet.betType.toUpperCase()} - ${bet.selection}`);
        
        await updateDoc(doc(db, 'bets', betDoc.id), {
          gameId: newGameId
        });
        
        migrations.push({
          betId: betDoc.id,
          oldGameId,
          newGameId,
          betDescription: `${bet.betType.toUpperCase()} - ${bet.selection}`
        });
        
        migratedCount++;
        console.log(`   ✅ Updated successfully`);
      } else {
        console.log(`⚠️  No mapping found for bet ${betDoc.id} with gameId: ${oldGameId}`);
        console.log(`   Bet: ${bet.betType.toUpperCase()} - ${bet.selection}`);
      }
    }
    
    console.log(`\n🎉 Migration complete! Updated ${migratedCount} bet(s)`);
    
    return NextResponse.json({
      success: true,
      migratedCount,
      migrations,
      message: `Successfully migrated ${migratedCount} bet(s)`
    });
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}