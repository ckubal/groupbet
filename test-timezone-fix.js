// Test script to verify the timezone fix works correctly

function testTimeSlotCalculation() {
  console.log('🧪 Testing Timezone Fix for Time Slot Calculation\n');
  
  // Test cases based on actual NFL game times
  const testGames = [
    {
      name: 'Thursday Night Football',
      utc: '2025-09-19T00:15:00.000Z', // Friday in UTC, Thursday 8:15 PM ET
      expectedSlot: 'thursday'
    },
    {
      name: 'Monday Night Football', 
      utc: '2025-09-16T01:15:00.000Z', // Tuesday in UTC, Monday 9:15 PM ET
      expectedSlot: 'monday'
    },
    {
      name: 'Sunday Early Game',
      utc: '2025-09-15T17:00:00.000Z', // Sunday 1:00 PM ET, 10:00 AM PT
      expectedSlot: 'sunday_early'
    },
    {
      name: 'Sunday Afternoon Game',
      utc: '2025-09-15T20:25:00.000Z', // Sunday 4:25 PM ET, 1:25 PM PT  
      expectedSlot: 'sunday_afternoon'
    },
    {
      name: 'Sunday Night Football',
      utc: '2025-09-16T00:20:00.000Z', // Sunday 8:20 PM ET, 5:20 PM PT
      expectedSlot: 'sunday_night'
    }
  ];

  // BUGGY version (old code)
  function calculateTimeSlotBuggy(gameTime) {
    const easternTimeOptions = { 
      timeZone: "America/New_York", 
      year: "numeric", month: "2-digit", day: "2-digit", 
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false 
    };
    const pacificTimeOptions = { 
      timeZone: "America/Los_Angeles", 
      year: "numeric", month: "2-digit", day: "2-digit", 
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false 
    };
    
    const easternParts = new Intl.DateTimeFormat('en-CA', easternTimeOptions).formatToParts(gameTime);
    const pacificParts = new Intl.DateTimeFormat('en-CA', pacificTimeOptions).formatToParts(gameTime);
    
    // BUGGY: This creates date in local timezone, not Eastern
    const easternDay = new Date(`${easternParts.find(p => p.type === 'year')?.value}-${easternParts.find(p => p.type === 'month')?.value}-${easternParts.find(p => p.type === 'day')?.value}`).getDay();
    const pacificHour = parseInt(pacificParts.find(p => p.type === 'hour')?.value || '0');
    
    if (easternDay === 4) return 'thursday';
    if (easternDay === 1) return 'monday';
    if (easternDay === 0) {
      if (pacificHour < 12) return 'sunday_early';
      if (pacificHour < 15) return 'sunday_afternoon';
      return 'sunday_night';
    }
    return 'sunday_early'; // default
  }

  // FIXED version (new code)
  function calculateTimeSlotFixed(gameTime) {
    const pacificTimeOptions = { 
      timeZone: "America/Los_Angeles", 
      year: "numeric", month: "2-digit", day: "2-digit", 
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false 
    };
    
    const pacificParts = new Intl.DateTimeFormat('en-CA', pacificTimeOptions).formatToParts(gameTime);
    
    // FIXED: Get Eastern day directly from original game time in Eastern timezone
    const easternDate = new Date(gameTime.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const easternDay = easternDate.getDay();
    const pacificHour = parseInt(pacificParts.find(p => p.type === 'hour')?.value || '0');
    
    if (easternDay === 4) return 'thursday';
    if (easternDay === 1) return 'monday';
    if (easternDay === 0) {
      if (pacificHour < 12) return 'sunday_early';
      if (pacificHour < 15) return 'sunday_afternoon';
      return 'sunday_night';
    }
    return 'sunday_early'; // default
  }

  let allPassed = true;

  testGames.forEach(test => {
    const gameTime = new Date(test.utc);
    const buggyResult = calculateTimeSlotBuggy(gameTime);
    const fixedResult = calculateTimeSlotFixed(gameTime);
    
    console.log(`\n📅 ${test.name}`);
    console.log(`   UTC: ${test.utc}`);
    console.log(`   Eastern: ${gameTime.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`);
    console.log(`   Pacific: ${gameTime.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`);
    console.log(`   Expected: ${test.expectedSlot}`);
    console.log(`   Buggy:    ${buggyResult} ${buggyResult === test.expectedSlot ? '✅' : '❌'}`);
    console.log(`   Fixed:    ${fixedResult} ${fixedResult === test.expectedSlot ? '✅' : '❌'}`);
    
    if (fixedResult !== test.expectedSlot) {
      allPassed = false;
    }
  });

  console.log(`\n🎯 Overall Result: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);
  return allPassed;
}

testTimeSlotCalculation();