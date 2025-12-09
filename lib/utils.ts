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

  // Align week boundaries to run Tuesday -> Monday so the new week rolls over
  // right after the Monday night game (Tuesday 00:00 local time).
  const firstWeekStart = new Date(seasonStart);
  const daysSinceTuesday = (firstWeekStart.getDay() - 2 + 7) % 7; // 2 = Tuesday
  firstWeekStart.setDate(firstWeekStart.getDate() - daysSinceTuesday);
  firstWeekStart.setHours(0, 0, 0, 0); // Start of the Tuesday that anchors Week 1

  const weekStart = new Date(firstWeekStart);
  weekStart.setDate(firstWeekStart.getDate() + (weekNumber - 1) * 7);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6); // Tuesday + 6 days = Monday

  // Set times to cover the full day range
  weekStart.setHours(0, 0, 0, 0); // Start of Tuesday
  weekEnd.setHours(23, 59, 59, 999); // End of Monday

  console.log(`📅 Week ${weekNumber} boundaries: ${weekStart.toISOString()} to ${weekEnd.toISOString()}`);

  return { start: weekStart, end: weekEnd };
}

export function getCurrentNFLWeek(): number {
  const today = new Date();
  const year = today.getFullYear();

  // For 2025 NFL season - Week 1 starts Thursday September 4, 2025
  let seasonStart: Date;
  if (year === 2025) {
    seasonStart = new Date(2025, 8, 4); // September 4, 2025 (Thursday)
  } else if (year === 2024) {
    seasonStart = new Date(2024, 8, 5); // September 5, 2024
  } else {
    // For other years, find first Thursday in September
    const septFirst = new Date(year, 8, 1);
    const firstThursday = new Date(septFirst);
    firstThursday.setDate(1 + ((4 - septFirst.getDay() + 7) % 7));
    seasonStart = firstThursday;
  }

  // Anchor Week 1 to the Tuesday of the week that contains the season opener.
  // This makes the week roll over at midnight between Monday and Tuesday so
  // the upcoming slate shows as soon as MNF ends.
  const firstWeekStart = new Date(seasonStart);
  const daysSinceTuesday = (firstWeekStart.getDay() - 2 + 7) % 7; // 2 = Tuesday
  firstWeekStart.setDate(firstWeekStart.getDate() - daysSinceTuesday);
  firstWeekStart.setHours(0, 0, 0, 0);

  // Calculate weeks since the anchored Tuesday start
  const timeDiff = today.getTime() - firstWeekStart.getTime();
  const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
  const currentWeek = Math.floor(daysDiff / 7) + 1;

  // Ensure we're within valid NFL weeks (1-18 for regular season)
  const validWeek = Math.max(1, Math.min(18, currentWeek));

  console.log(`📅 Today: ${today.toDateString()}, Week 1 starts: ${firstWeekStart.toDateString()}, Current NFL Week: ${validWeek}`);
  return validWeek;
}