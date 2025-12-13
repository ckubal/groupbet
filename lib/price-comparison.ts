/**
 * Price Comparison Service
 * 
 * Compares odds and lines between Kalshi and Bovada to identify value bets
 */

import { ParsedKalshiMarket } from './kalshi-api';
import { Game } from '@/types';
import { calculateImpliedProbability, formatOdds } from './betting-odds';

export interface PriceComparison {
  game: Game;
  marketType: 'moneyline' | 'spread' | 'over_under';
  kalshiMarket?: ParsedKalshiMarket;
  bovadaLine?: number;
  bovadaOdds?: number;
  kalshiOdds?: number;
  kalshiLine?: number;
  betterPlatform: 'kalshi' | 'bovada' | 'equal' | 'unknown';
  priceDifference: number; // Difference in implied probability percentage points
  valueBet?: {
    platform: 'kalshi' | 'bovada';
    expectedValue: number; // Expected value percentage
    recommendation: string;
  };
}

export interface LineComparison {
  game: Game;
  marketType: 'spread' | 'over_under';
  kalshiLine?: number;
  bovadaLine?: number;
  lineDifference: number;
  hasDifference: boolean;
}

/**
 * Compare moneyline odds between Kalshi and Bovada
 */
export function compareMoneyline(
  kalshiMarket: ParsedKalshiMarket | undefined,
  bovadaHomeOdds: number | undefined,
  bovadaAwayOdds: number | undefined,
  game: Game
): PriceComparison[] {
  const comparisons: PriceComparison[] = [];

  if (!kalshiMarket || (!bovadaHomeOdds && !bovadaAwayOdds)) {
    return comparisons;
  }

  const kalshiYesOdds = kalshiMarket.yesAmericanOdds || 0;
  const kalshiNoOdds = kalshiMarket.noAmericanOdds || 0;

  // Compare Kalshi Yes (team wins) vs Bovada odds
  if (bovadaHomeOdds && kalshiMarket.teamName) {
    // Determine which team the Kalshi market is for
    const normalizedKalshiTeam = kalshiMarket.teamName.toLowerCase();
    const normalizedHomeTeam = game.homeTeam.toLowerCase();
    const normalizedAwayTeam = game.awayTeam.toLowerCase();

    let bovadaOdds: number | undefined;
    let teamName: string;

    if (normalizedKalshiTeam.includes(normalizedHomeTeam.split(' ').pop() || '') ||
        normalizedHomeTeam.includes(normalizedKalshiTeam)) {
      bovadaOdds = bovadaHomeOdds;
      teamName = game.homeTeam;
    } else if (normalizedKalshiTeam.includes(normalizedAwayTeam.split(' ').pop() || '') ||
               normalizedAwayTeam.includes(normalizedKalshiTeam)) {
      bovadaOdds = bovadaAwayOdds;
      teamName = game.awayTeam;
    } else {
      return comparisons; // Can't match teams
    }

    if (bovadaOdds) {
      const comparison = createComparison(
        game,
        'moneyline',
        kalshiMarket,
        undefined,
        bovadaOdds,
        kalshiYesOdds
      );
      comparison.valueBet = calculateValueBet(kalshiYesOdds, bovadaOdds);
      comparisons.push(comparison);
    }
  }

  return comparisons;
}

/**
 * Compare spread lines and odds
 */
export function compareSpread(
  kalshiMarket: ParsedKalshiMarket | undefined,
  bovadaSpread: number | undefined,
  bovadaSpreadOdds: number | undefined,
  game: Game
): PriceComparison {
  const comparison = createComparison(
    game,
    'spread',
    kalshiMarket,
    bovadaSpread,
    bovadaSpreadOdds,
    kalshiMarket?.yesAmericanOdds
  );
  comparison.kalshiLine = kalshiMarket?.spread;

  if (kalshiMarket?.spread && bovadaSpread !== undefined) {
    comparison.valueBet = calculateValueBet(
      kalshiMarket.yesAmericanOdds || 0,
      bovadaSpreadOdds || 0
    );
  }

  return comparison;
}

/**
 * Compare over/under lines and odds
 */
export function compareOverUnder(
  kalshiMarket: ParsedKalshiMarket | undefined,
  bovadaTotal: number | undefined,
  bovadaOverOdds: number | undefined,
  bovadaUnderOdds: number | undefined,
  game: Game
): PriceComparison[] {
  const comparisons: PriceComparison[] = [];

  if (!kalshiMarket || bovadaTotal === undefined) {
    return comparisons;
  }

  const kalshiTotal = kalshiMarket.total;
  const kalshiYesOdds = kalshiMarket.yesAmericanOdds || 0;
  const kalshiNoOdds = kalshiMarket.noAmericanOdds || 0;

  // Compare Over
  if (bovadaOverOdds) {
    const overComparison = createComparison(
      game,
      'over_under',
      kalshiMarket,
      bovadaTotal,
      bovadaOverOdds,
      kalshiYesOdds
    );
    overComparison.kalshiLine = kalshiTotal;
    overComparison.valueBet = calculateValueBet(kalshiYesOdds, bovadaOverOdds);
    comparisons.push(overComparison);
  }

  // Compare Under
  if (bovadaUnderOdds) {
    const underComparison = createComparison(
      game,
      'over_under',
      kalshiMarket,
      bovadaTotal,
      bovadaUnderOdds,
      kalshiNoOdds
    );
    underComparison.kalshiLine = kalshiTotal;
    underComparison.valueBet = calculateValueBet(kalshiNoOdds, bovadaUnderOdds);
    comparisons.push(underComparison);
  }

  return comparisons;
}

/**
 * Create a price comparison object
 */
function createComparison(
  game: Game,
  marketType: 'moneyline' | 'spread' | 'over_under',
  kalshiMarket: ParsedKalshiMarket | undefined,
  bovadaLine: number | undefined,
  bovadaOdds: number | undefined,
  kalshiOdds: number | undefined
): PriceComparison {
  let betterPlatform: 'kalshi' | 'bovada' | 'equal' | 'unknown' = 'unknown';
  let priceDifference = 0;

  if (kalshiOdds && bovadaOdds) {
    const kalshiProb = calculateImpliedProbability(kalshiOdds);
    const bovadaProb = calculateImpliedProbability(bovadaOdds);
    priceDifference = Math.abs(kalshiProb - bovadaProb) * 100; // Convert to percentage points

    // Better platform is the one with higher implied probability (better odds for bettor)
    // Lower implied probability = better odds for bettor
    if (Math.abs(kalshiProb - bovadaProb) < 0.01) {
      betterPlatform = 'equal';
    } else if (kalshiProb < bovadaProb) {
      betterPlatform = 'kalshi'; // Kalshi has better odds (lower implied prob)
    } else {
      betterPlatform = 'bovada'; // Bovada has better odds
    }
  }

  return {
    game,
    marketType,
    kalshiMarket,
    bovadaLine,
    bovadaOdds,
    kalshiOdds,
    betterPlatform,
    priceDifference,
  };
}

/**
 * Calculate value bet - expected value of betting on one platform vs another
 */
export function calculateValueBet(
  kalshiOdds: number,
  bovadaOdds: number
): { platform: 'kalshi' | 'bovada'; expectedValue: number; recommendation: string } | undefined {
  if (!kalshiOdds || !bovadaOdds) return undefined;

  const kalshiProb = calculateImpliedProbability(kalshiOdds);
  const bovadaProb = calculateImpliedProbability(bovadaOdds);

  // Use the average implied probability as "true" probability
  const trueProb = (kalshiProb + bovadaProb) / 2;

  // Calculate expected value for each platform
  // EV = (trueProb * payout) - stake
  // For $100 bet:
  const kalshiPayout = kalshiOdds > 0 
    ? 100 + (100 * kalshiOdds / 100)
    : 100 + (100 / (Math.abs(kalshiOdds) / 100));
  const bovadaPayout = bovadaOdds > 0
    ? 100 + (100 * bovadaOdds / 100)
    : 100 + (100 / (Math.abs(bovadaOdds) / 100));

  const kalshiEV = (trueProb * kalshiPayout) - 100;
  const bovadaEV = (trueProb * bovadaPayout) - 100;

  // Determine which is better
  if (kalshiEV > bovadaEV && kalshiEV > 0) {
    return {
      platform: 'kalshi',
      expectedValue: kalshiEV,
      recommendation: `Bet on Kalshi - Expected value: $${kalshiEV.toFixed(2)} per $100 bet`,
    };
  } else if (bovadaEV > kalshiEV && bovadaEV > 0) {
    return {
      platform: 'bovada',
      expectedValue: bovadaEV,
      recommendation: `Bet on Bovada - Expected value: $${bovadaEV.toFixed(2)} per $100 bet`,
    };
  } else {
    return {
      platform: kalshiEV > bovadaEV ? 'kalshi' : 'bovada',
      expectedValue: Math.max(kalshiEV, bovadaEV),
      recommendation: 'No positive expected value on either platform',
    };
  }
}

/**
 * Compare lines (spread/total) between platforms
 */
export function compareLines(
  kalshiLine: number | undefined,
  bovadaLine: number | undefined,
  game: Game,
  marketType: 'spread' | 'over_under'
): LineComparison {
  const hasDifference = kalshiLine !== undefined && 
                       bovadaLine !== undefined && 
                       Math.abs(kalshiLine - bovadaLine) > 0.5; // 0.5 point threshold

  return {
    game,
    marketType,
    kalshiLine,
    bovadaLine,
    lineDifference: kalshiLine && bovadaLine ? kalshiLine - bovadaLine : 0,
    hasDifference,
  };
}
