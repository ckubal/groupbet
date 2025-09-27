import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Comprehensively fixing ALL Week 4 time slots...');
    
    // Get all games for Week 4
    const gamesQuery = query(
      collection(db, 'games'),
      where('weekendId', '==', '2025-week-4')
    );
    
    const gamesSnapshot = await getDocs(gamesQuery);
    console.log(`📋 Found ${gamesSnapshot.docs.length} games for Week 4`);
    
    // Group games by team matchup to identify duplicates
    const gamesByMatchup = new Map<string, any[]>();
    
    for (const gameDoc of gamesSnapshot.docs) {
      const game = gameDoc.data();
      const matchupKey = `${game.awayTeam} @ ${game.homeTeam}`;
      
      if (!gamesByMatchup.has(matchupKey)) {
        gamesByMatchup.set(matchupKey, []);
      }
      
      gamesByMatchup.get(matchupKey)!.push({
        id: gameDoc.id,
        ...game
      });
    }
    
    console.log(`🔍 Found ${gamesByMatchup.size} unique matchups`);
    
    let fixedCount = 0;
    let deletedCount = 0;
    const fixes: any[] = [];
    
    // Process each unique matchup
    for (const [matchupKey, games] of gamesByMatchup) {
      console.log(`\n🏈 Processing: ${matchupKey} (${games.length} copies)`);
      
      // Find the "best" game (prefer one with proper gameTime)
      const bestGame = games.reduce((best, current) => {
        // Prefer game with proper Firebase timestamp
        if (current.gameTime && current.gameTime.seconds && (!best.gameTime || !best.gameTime.seconds)) {
          return current;
        }
        // Prefer game with more complete data
        if ((current.playerProps?.length || 0) > (best.playerProps?.length || 0)) {
          return current;
        }
        return best;
      });
      
      console.log(`   📌 Best game ID: ${bestGame.id}`);
      
      // Get game time for time slot calculation
      let gameTime: Date;
      if (bestGame.gameTime && bestGame.gameTime.seconds) {
        gameTime = new Date(bestGame.gameTime.seconds * 1000);
      } else if (bestGame.date) {
        gameTime = new Date(bestGame.date);
      } else {
        console.log(`   ⚠️ No valid date found for ${matchupKey}`);
        continue;
      }
      
      // Calculate correct time slot
      const correctTimeSlot = calculateCorrectTimeSlot(gameTime);
      
      console.log(`   📅 Game time: ${gameTime.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
      console.log(`   🎯 Correct time slot: ${correctTimeSlot}`);
      
      // Update the best game with correct time slot
      if (bestGame.timeSlot !== correctTimeSlot) {
        await updateDoc(doc(db, 'games', bestGame.id), {
          timeSlot: correctTimeSlot,
          timeSlotFixed: true,
          timeSlotFixedAt: new Date(),
          originalTimeSlot: bestGame.timeSlot
        });
        
        fixes.push({
          gameId: bestGame.id,
          teams: matchupKey,
          gameTime: gameTime.toISOString(),
          oldTimeSlot: bestGame.timeSlot,
          newTimeSlot: correctTimeSlot
        });
        
        fixedCount++;
        console.log(`   ✅ Fixed: ${bestGame.timeSlot} → ${correctTimeSlot}`);
      } else {
        console.log(`   ✓ Already correct: ${correctTimeSlot}`);
      }
      
      // Delete duplicate games (keep only the best one)
      const duplicates = games.filter(g => g.id !== bestGame.id);
      for (const duplicate of duplicates) {
        console.log(`   🗑️ Deleting duplicate: ${duplicate.id}`);
        await deleteDoc(doc(db, 'games', duplicate.id));
        deletedCount++;
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Fixed ${fixedCount} time slots and deleted ${deletedCount} duplicates for Week 4`,
      totalGames: gamesSnapshot.docs.length,
      uniqueGames: gamesByMatchup.size,
      deletedDuplicates: deletedCount,
      fixes
    });
    
  } catch (error) {
    console.error('❌ Error fixing time slots:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function calculateCorrectTimeSlot(gameTime: Date): string {
  // Get the date in Eastern time
  const easternDateStr = gameTime.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const easternDate = new Date(easternDateStr);
  const easternDay = easternDate.getDay(); // 0=Sunday, 1=Monday, 4=Thursday
  const easternHour = easternDate.getHours();
  
  // Get Pacific hour for Sunday time slot determination
  const pacificDateStr = gameTime.toLocaleString('en-US', { timeZone: 'America/Los_Angeles' });
  const pacificDate = new Date(pacificDateStr);
  const pacificHour = pacificDate.getHours();
  
  console.log(`     🕐 Eastern: Day ${easternDay} (${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][easternDay]}), Hour ${easternHour}`);
  console.log(`     🕐 Pacific: Hour ${pacificHour}`);
  
  // Thursday night football
  if (easternDay === 4) { // Thursday
    return 'thursday';
  }
  
  // Monday night football  
  if (easternDay === 1) { // Monday
    return 'monday';
  }
  
  // Sunday games
  if (easternDay === 0) { // Sunday
    if (pacificHour < 12) {        // Before noon PT = 1pm ET
      return 'sunday_early';        // 1pm ET games
    }
    if (pacificHour < 15) {        // Noon-3pm PT = 4pm-6pm ET  
      return 'sunday_afternoon';    // 4pm ET games
    }
    return 'sunday_night';         // 8pm ET games (5pm+ PT)
  }
  
  // Saturday games (treat as early Sunday)
  if (easternDay === 6) { // Saturday
    return 'sunday_early';
  }
  
  // Default fallback
  return 'sunday_early';
}