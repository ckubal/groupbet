import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(amount: number): string {
  const absAmount = Math.abs(amount);
  const sign = amount < 0 ? '-' : amount > 0 ? '+' : '';
  return `${sign}$${absAmount.toFixed(2)}`;
}

export function formatOdds(odds: number): string {
  return odds > 0 ? `+${odds}` : `${odds}`;
}

export function calculatePayout(stake: number, odds: number): number {
  if (odds > 0) {
    // Positive odds: amount won per $100 bet
    return stake * (odds / 100);
  } else {
    // Negative odds: amount to bet to win $100
    return stake * (100 / Math.abs(odds));
  }
}

export function calculateTotalReturn(stake: number, odds: number): number {
  return stake + calculatePayout(stake, odds);
}

export function getNFLWeekBoundaries(weekNumber: number, year: number = 2025): { start: Date; end: Date } {
  // For 2025 NFL season, which starts in September 2025
  let seasonStart: Date;
  
  if (year === 2025) {
    // For 2025 season - Week 1 starts Thursday September 4, 2025
    seasonStart = new Date(2025, 8, 4); // September 4, 2025 (Thursday)
  } else if (year === 2024) {
    // Week 1 started September 5, 2024 (Thursday)
    seasonStart = new Date(2024, 8, 5); // September 5, 2024
  } else {
    // For other years, find first Thursday in September
    const septFirst = new Date(year, 8, 1);
    const firstThursday = new Date(septFirst);
    firstThursday.setDate(1 + ((4 - septFirst.getDay() + 7) % 7));
    seasonStart = firstThursday;
  }
  
  // Each NFL week starts on Thursday and ends the following Wednesday (not Tuesday!)
  const weekStart = new Date(seasonStart);
  weekStart.setDate(seasonStart.getDate() + (weekNumber - 1) * 7);
  
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // Thursday + 6 days = Wednesday
  
  // Set times to cover the full day range
  weekStart.setHours(0, 0, 0, 0); // Start of Thursday
  weekEnd.setHours(23, 59, 59, 999); // End of Wednesday
  
  console.log(`📅 Week ${weekNumber} boundaries: ${weekStart.toISOString()} to ${weekEnd.toISOString()}`);
  
  return { start: weekStart, end: weekEnd };
}

export function getCurrentNFLWeek(): number {
  // For development/testing, return Week 2 to match our mock data
  console.log('📅 Development mode: returning Week 2 for mock data testing');
  return 2;
}