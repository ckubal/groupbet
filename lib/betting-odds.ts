/**
 * Utility functions for calculating betting odds payouts based on American odds format
 * Examples:
 * - Positive odds (+500): $100 bet wins $500 profit
 * - Negative odds (-110): $110 bet wins $100 profit
 */

export interface PayoutCalculation {
  stake: number;
  profit: number;
  totalPayout: number;
  odds: number;
}

/**
 * Calculate payout based on American odds format
 * @param stake - Amount wagered
 * @param americanOdds - American odds (e.g., +500, -110)
 * @returns PayoutCalculation object with stake, profit, and total payout
 */
export function calculatePayout(stake: number, americanOdds: number): PayoutCalculation {
  let profit: number;
  
  if (americanOdds > 0) {
    // Positive odds: profit = (stake * odds) / 100
    profit = (stake * americanOdds) / 100;
  } else {
    // Negative odds: profit = stake / (abs(odds) / 100)
    profit = stake / (Math.abs(americanOdds) / 100);
  }
  
  const totalPayout = stake + profit;
  
  return {
    stake,
    profit,
    totalPayout,
    odds: americanOdds
  };
}

/**
 * Convert American odds to decimal odds
 * @param americanOdds - American odds (e.g., +500, -110)
 * @returns Decimal odds
 */
export function americanToDecimal(americanOdds: number): number {
  if (americanOdds > 0) {
    return (americanOdds / 100) + 1;
  } else {
    return (100 / Math.abs(americanOdds)) + 1;
  }
}

/**
 * Format odds for display
 * @param americanOdds - American odds (e.g., +500, -110)
 * @returns Formatted string (e.g., "+500", "-110")
 */
export function formatOdds(americanOdds: number): string {
  if (americanOdds > 0) {
    return `+${americanOdds}`;
  }
  return americanOdds.toString();
}

/**
 * Calculate implied probability from American odds
 * @param americanOdds - American odds (e.g., +500, -110)
 * @returns Implied probability as percentage
 */
export function calculateImpliedProbability(americanOdds: number): number {
  if (americanOdds > 0) {
    return 100 / (americanOdds + 100);
  } else {
    return Math.abs(americanOdds) / (Math.abs(americanOdds) + 100);
  }
}

/**
 * Parse odds from various formats and convert to American odds
 * @param oddsString - Odds string (e.g., "+500", "-110", "1.5", "3/2")
 * @returns American odds number
 */
export function parseOdds(oddsString: string | number): number {
  if (typeof oddsString === 'number') {
    return oddsString;
  }
  
  const cleaned = oddsString.toString().trim();
  
  // American odds (already in correct format)
  if (cleaned.startsWith('+') || cleaned.startsWith('-')) {
    return parseInt(cleaned);
  }
  
  // Decimal odds (convert to American)
  const decimal = parseFloat(cleaned);
  if (decimal >= 2) {
    return (decimal - 1) * 100;
  } else {
    return -100 / (decimal - 1);
  }
}

/**
 * Calculate group bet payout for multiple participants
 * @param totalPot - Total amount in the pot
 * @param participants - Number of participants
 * @param winnerCount - Number of winners
 * @param userStake - Individual user's stake
 * @returns Payout information for the user
 */
export function calculateGroupPayout(
  totalPot: number,
  participants: number,
  winnerCount: number,
  userStake: number
): {
  payout: number;
  profit: number;
  isWinner: boolean;
} {
  if (winnerCount === 0) {
    return { payout: 0, profit: -userStake, isWinner: false };
  }
  
  const payoutPerWinner = totalPot / winnerCount;
  const profit = payoutPerWinner - userStake;
  
  return {
    payout: payoutPerWinner,
    profit,
    isWinner: true
  };
}