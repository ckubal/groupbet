// Utility functions for parlay betting

/**
 * Convert American odds to decimal odds
 * @param americanOdds The American odds (e.g., -110, +150)
 * @returns Decimal odds (e.g., 1.91, 2.50)
 */
export function americanToDecimal(americanOdds: number): number {
  if (americanOdds > 0) {
    return (americanOdds / 100) + 1;
  } else {
    return (100 / Math.abs(americanOdds)) + 1;
  }
}

/**
 * Convert decimal odds back to American odds
 * @param decimalOdds The decimal odds
 * @returns American odds
 */
export function decimalToAmerican(decimalOdds: number): number {
  if (decimalOdds >= 2) {
    return Math.round((decimalOdds - 1) * 100);
  } else {
    return Math.round(-100 / (decimalOdds - 1));
  }
}

/**
 * Calculate parlay odds from individual leg odds
 * @param legOdds Array of American odds for each leg
 * @returns Combined American odds for the parlay
 */
export function calculateParlayOdds(legOdds: number[]): number {
  if (legOdds.length < 2) {
    throw new Error('Parlay must have at least 2 legs');
  }

  // Convert all American odds to decimal
  const decimalOdds = legOdds.map(americanToDecimal);
  
  // Multiply all decimal odds together
  const parlayMultiplier = decimalOdds.reduce((acc, odds) => acc * odds, 1);
  
  // Convert back to American odds
  return decimalToAmerican(parlayMultiplier);
}

/**
 * Calculate parlay payout
 * @param stake The amount bet
 * @param parlayOdds The combined American odds
 * @returns Total payout (stake + profit) and profit
 */
export function calculateParlayPayout(stake: number, parlayOdds: number): { totalPayout: number; profit: number } {
  const decimalOdds = americanToDecimal(parlayOdds);
  const totalPayout = stake * decimalOdds;
  const profit = totalPayout - stake;
  
  return {
    totalPayout: Math.round(totalPayout * 100) / 100,
    profit: Math.round(profit * 100) / 100
  };
}

/**
 * Format parlay description for display
 * @param legs Array of parlay leg descriptions
 * @returns Formatted string like "2-leg parlay: 49ers ML + Jaguars ML"
 */
export function formatParlayDescription(legs: Array<{ selection: string }>): string {
  const legCount = legs.length;
  const selections = legs.map(leg => leg.selection).join(' + ');
  return `${legCount}-leg parlay: ${selections}`;
}