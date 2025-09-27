import { NextRequest, NextResponse } from 'next/server';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(request: NextRequest) {
  try {
    const { week } = await request.json();
    const targetWeek = week || 4;
    
    console.log(`🔧 Fixing time slots for Week ${targetWeek}...`);
    
    // Get all games for the specified week
    const gamesQuery = query(
      collection(db, 'games'),
      where('weekendId', '==', `2025-week-${targetWeek}`)
    );
    
    const gamesSnapshot = await getDocs(gamesQuery);
    console.log(`📋 Found ${gamesSnapshot.docs.length} games for Week ${targetWeek}`);
    
    let fixedCount = 0;
    const fixes: any[] = [];
    
    for (const gameDoc of gamesSnapshot.docs) {
      const game = gameDoc.data();
      
      // Handle different date formats
      let gameTime: Date;
      if (game.gameTime && game.gameTime.seconds) {
        // Firebase timestamp format
        gameTime = new Date(game.gameTime.seconds * 1000);
      } else if (game.date) {
        // Regular date string or Date object
        gameTime = new Date(game.date);
      } else {
        console.log(`⚠️ No valid date found for ${game.awayTeam} @ ${game.homeTeam}`);
        continue;
      }
      
      // Recalculate time slot using the same logic as getTimeSlot
      const newTimeSlot = calculateTimeSlot(gameTime);
      
      if (game.timeSlot !== newTimeSlot) {
        console.log(`🔄 Fixing ${game.awayTeam} @ ${game.homeTeam}: ${game.timeSlot} → ${newTimeSlot}`);
        
        await updateDoc(doc(db, 'games', gameDoc.id), {
          timeSlot: newTimeSlot,
          timeSlotFixed: true,
          originalTimeSlot: game.timeSlot
        });
        
        fixes.push({
          gameId: gameDoc.id,
          teams: `${game.awayTeam} @ ${game.homeTeam}`,
          date: game.date,
          oldTimeSlot: game.timeSlot,
          newTimeSlot: newTimeSlot
        });
        
        fixedCount++;
      }
    }
    
    return NextResponse.json({
      success: true,
      message: `Fixed ${fixedCount} game time slots for Week ${targetWeek}`,
      totalGames: gamesSnapshot.docs.length,
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

function calculateTimeSlot(gameTime: Date): string {
  // Use EXACT same logic as firebase-service.ts getTimeSlot function
  if (!gameTime || isNaN(gameTime.getTime())) {
    console.warn('⚠️ Invalid game time provided to calculateTimeSlot:', gameTime);
    return 'sunday_early'; // Default fallback
  }

  // Create proper timezone-aware dates using Intl.DateTimeFormat (consistent with firebase-service.ts)
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
  
  // Get timezone-aware components using formatToParts (SAME as firebase-service.ts)
  const easternParts = new Intl.DateTimeFormat('en-CA', easternTimeOptions).formatToParts(gameTime);
  const pacificParts = new Intl.DateTimeFormat('en-CA', pacificTimeOptions).formatToParts(gameTime);
  
  // Extract values
  const easternHour = parseInt(easternParts.find(p => p.type === 'hour')?.value || '0');
  // FIXED: Get Eastern day of week directly from the original game time in Eastern timezone
  const easternDate = new Date(gameTime.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const easternDay = easternDate.getDay();
  const pacificHour = parseInt(pacificParts.find(p => p.type === 'hour')?.value || '0');
  
  console.log(`⏰ Fix time slot calculation for ${gameTime.toISOString()}:`);
  console.log(`   ET: Day ${easternDay}, Hour ${easternHour} (${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][easternDay]})`);
  console.log(`   PT: Hour ${pacificHour}`);

  if (easternDay === 4) { // Thursday
    console.log('📅 Fix classified as: Thursday Night');
    return 'thursday';
  }
  if (easternDay === 1) { // Monday
    console.log('📅 Fix classified as: Monday Night');
    return 'monday';
  }
  if (easternDay === 0) { // Sunday
    // Use Pacific time for Sunday game categorization
    if (pacificHour < 12) { // Before noon PT
      console.log('📅 Fix classified as: Sunday Morning (before noon PT)');
      return 'sunday_early';
    }
    if (pacificHour < 15) { // Noon to 3pm PT
      console.log('📅 Fix classified as: Sunday Afternoon (noon-3pm PT)');
      return 'sunday_afternoon';
    }
    console.log('📅 Fix classified as: Sunday Night (3pm+ PT / SNF)');
    return 'sunday_night';        // 3pm+ PT (SNF)
  }
  if (easternDay === 6) { // Saturday
    console.log('📅 Fix classified as: Saturday (putting in Sunday Early)');
    return 'sunday_early'; // Saturday games go in early slot
  }
  
  console.log('📅 Fix classified as: Default Sunday Early');
  return 'sunday_early'; // Default
}