import { Game } from '@/types';

/**
 * Calculate the NFL time slot for a game based on its start time.
 * 
 * Time slots are determined by:
 * - Eastern timezone day of week (for Thursday/Monday classification)
 * - Pacific timezone hour (for Sunday game categorization)
 * 
 * @param gameTime - The game start time (Date object or ISO string)
 * @param enableLogging - Whether to log calculation details (default: false)
 * @returns The time slot: 'thursday' | 'sunday_early' | 'sunday_afternoon' | 'sunday_night' | 'monday'
 */
export function getTimeSlot(
  gameTime: Date | string,
  enableLogging: boolean = false
): Game['timeSlot'] {
  // Convert string to Date if needed
  let date: Date;
  if (typeof gameTime === 'string') {
    date = new Date(gameTime);
  } else {
    date = gameTime;
  }

  // Validate gameTime - return default if invalid
  if (!date || isNaN(date.getTime())) {
    if (enableLogging) {
      console.warn('⚠️ Invalid game time provided to getTimeSlot:', gameTime);
    }
    return 'sunday_early'; // Default fallback
  }

  // Create proper timezone-aware dates using Intl.DateTimeFormat
  const easternTimeOptions: Intl.DateTimeFormatOptions = {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  };
  const pacificTimeOptions: Intl.DateTimeFormatOptions = {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  };

  // Get timezone-aware components
  const easternParts = new Intl.DateTimeFormat('en-CA', easternTimeOptions).formatToParts(date);
  const pacificParts = new Intl.DateTimeFormat('en-CA', pacificTimeOptions).formatToParts(date);

  // Extract values
  const easternHour = parseInt(easternParts.find(p => p.type === 'hour')?.value || '0');
  // Calculate day of week from Eastern timezone parts directly
  const easternYear = parseInt(easternParts.find(p => p.type === 'year')?.value || '0');
  const easternMonth = parseInt(easternParts.find(p => p.type === 'month')?.value || '1') - 1; // Month is 0-indexed
  const easternDate = parseInt(easternParts.find(p => p.type === 'day')?.value || '1');
  // Create date in UTC to avoid local timezone issues
  const easternDateObj = new Date(Date.UTC(easternYear, easternMonth, easternDate));
  const easternDay = easternDateObj.getUTCDay();
  const pacificHour = parseInt(pacificParts.find(p => p.type === 'hour')?.value || '0');

  if (enableLogging) {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    console.log(`🕐 Time slot calculation for ${date.toISOString()}:`);
    console.log(`   UTC: ${date.toISOString()}`);
    console.log(`   ET: Day ${easternDay} (${dayNames[easternDay]}), Hour ${easternHour}`);
    console.log(`   PT: Hour ${pacificHour}`);
  }

  // Thursday (day 4)
  if (easternDay === 4) {
    if (enableLogging) {
      console.log('📅 Classified as: Thursday Night');
    }
    return 'thursday';
  }

  // Monday (day 1)
  if (easternDay === 1) {
    if (enableLogging) {
      console.log('📅 Classified as: Monday Night');
    }
    return 'monday';
  }

  // Sunday (day 0) - use Pacific time for categorization
  if (easternDay === 0) {
    if (pacificHour < 12) {
      // Before noon PT
      if (enableLogging) {
        console.log('📅 Classified as: Sunday Morning (before noon PT)');
      }
      return 'sunday_early';
    }
    if (pacificHour < 15) {
      // Noon to 3pm PT
      if (enableLogging) {
        console.log('📅 Classified as: Sunday Afternoon (noon-3pm PT)');
      }
      return 'sunday_afternoon';
    }
    // 3pm+ PT (SNF)
    if (enableLogging) {
      console.log('📅 Classified as: Sunday Night (3pm+ PT / SNF)');
    }
    return 'sunday_night';
  }

  // Saturday (day 6) - put in Sunday early slot
  if (easternDay === 6) {
    if (enableLogging) {
      console.log('📅 Classified as: Saturday (putting in Sunday Early)');
    }
    return 'sunday_early';
  }

  // For any other day (Tuesday, Wednesday, Friday), put in early slot
  if (enableLogging) {
    console.log(`📅 Classified as: Other day (${easternDay}) - putting in Sunday Early`);
  }
  return 'sunday_early';
}

