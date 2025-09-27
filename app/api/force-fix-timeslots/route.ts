import { NextRequest, NextResponse } from 'next/server';
import { gamesCacheService } from '@/lib/games-cache';
import { collection, doc, updateDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    const { week } = await request.json();
    const targetWeek = week || 4;
    
    console.log(`🔧 Force fixing time slots for Week ${targetWeek}...`);
    
    // Get games from the cache service (which includes both Firebase and ESPN data)
    const games = await gamesCacheService.getGamesForWeek(targetWeek, true);
    
    console.log(`📋 Found ${games.length} games for Week ${targetWeek}`);
    
    let fixedCount = 0;
    const fixes: any[] = [];
    
    for (const game of games) {
      if (!game.gameTime) {
        console.log(`⚠️ No game time for ${game.awayTeam} @ ${game.homeTeam}`);
        continue;
      }
      
      // Recalculate time slot using proper timezone logic
      const newTimeSlot = calculateCorrectTimeSlot(game.gameTime);
      
      if (game.timeSlot !== newTimeSlot) {
        console.log(`🔄 Fixing ${game.awayTeam} @ ${game.homeTeam}: ${game.timeSlot} → ${newTimeSlot}`);
        
        // Update the timeSlot directly in Firebase
        try {
          // First, find the Firebase document
          const gamesQuery = query(
            collection(db, 'games'),
            where('weekendId', '==', `2025-week-${targetWeek}`)
          );
          const gamesSnapshot = await getDocs(gamesQuery);
          
          // Find the specific game document
          const gameDoc = gamesSnapshot.docs.find(doc => {
            const data = doc.data();
            return data.awayTeam === game.awayTeam && data.homeTeam === game.homeTeam;
          });
          
          if (gameDoc) {
            await updateDoc(doc(db, 'games', gameDoc.id), {
              timeSlot: newTimeSlot,
              timeSlotFixedAt: new Date().toISOString()
            });
            console.log(`✅ Updated Firebase document ${gameDoc.id} with timeSlot: ${newTimeSlot}`);
          } else {
            console.warn(`⚠️ Could not find Firebase document for ${game.awayTeam} @ ${game.homeTeam}`);
          }
        } catch (firebaseError) {
          console.error(`❌ Firebase update failed for ${game.awayTeam} @ ${game.homeTeam}:`, firebaseError);
        }
        
        fixes.push({
          gameId: game.id,
          teams: `${game.awayTeam} @ ${game.homeTeam}`,
          gameTime: game.gameTime,
          oldTimeSlot: game.timeSlot,
          newTimeSlot: newTimeSlot
        });
        
        fixedCount++;
      } else {
        console.log(`✓ Correct: ${game.awayTeam} @ ${game.homeTeam} = ${game.timeSlot}`);
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Force fixed ${fixedCount} game time slots for Week ${targetWeek}`,
      totalGames: games.length,
      fixes
    });
    
  } catch (error) {
    console.error('❌ Error force fixing time slots:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function calculateCorrectTimeSlot(gameTime: Date): string {
  if (!gameTime || isNaN(gameTime.getTime())) {
    console.warn('⚠️ Invalid game time provided to calculateCorrectTimeSlot:', gameTime);
    return 'sunday_early';
  }

  // Use exact same logic as firebase-service.ts getTimeSlot function
  const easternTimeOptions: Intl.DateTimeFormatOptions = { 
    timeZone: "America/New_York", 
    year: "numeric", month: "2-digit", day: "2-digit", 
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false 
  };
  const pacificTimeOptions: Intl.DateTimeFormatOptions = { 
    timeZone: "America/Los_Angeles", 
    year: "numeric", month: "2-digit", day: "2-digit", 
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false 
  };
  
  // Get timezone-aware components using formatToParts
  const easternParts = new Intl.DateTimeFormat('en-CA', easternTimeOptions).formatToParts(gameTime);
  const pacificParts = new Intl.DateTimeFormat('en-CA', pacificTimeOptions).formatToParts(gameTime);
  
  // Extract values
  const easternHour = parseInt(easternParts.find(p => p.type === 'hour')?.value || '0');
  // FIXED: Get Eastern day of week directly from the original game time in Eastern timezone
  const easternDate = new Date(gameTime.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const easternDay = easternDate.getDay();
  const pacificHour = parseInt(pacificParts.find(p => p.type === 'hour')?.value || '0');
  
  console.log(`⏰ Force fix calculation for ${gameTime.toISOString()}:`);
  console.log(`   ET: Day ${easternDay}, Hour ${easternHour} (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][easternDay]})`);
  console.log(`   PT: Hour ${pacificHour}`);

  if (easternDay === 4) { // Thursday
    console.log('📅 Force fix classified as: Thursday Night');
    return 'thursday';
  }
  if (easternDay === 1) { // Monday
    console.log('📅 Force fix classified as: Monday Night');
    return 'monday';
  }
  if (easternDay === 0) { // Sunday
    if (pacificHour < 12) {
      console.log('📅 Force fix classified as: Sunday Morning (before noon PT)');
      return 'sunday_early';
    }
    if (pacificHour < 15) {
      console.log('📅 Force fix classified as: Sunday Afternoon (noon-3pm PT)');
      return 'sunday_afternoon';
    }
    console.log('📅 Force fix classified as: Sunday Night (3pm+ PT / SNF)');
    return 'sunday_night';
  }
  if (easternDay === 6) { // Saturday
    console.log('📅 Force fix classified as: Saturday (putting in Sunday Early)');
    return 'sunday_early';
  }
  
  console.log('📅 Force fix classified as: Default Sunday Early');
  return 'sunday_early';
}