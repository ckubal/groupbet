/**
 * Arbitrage Detection
 * 
 * Identifies guaranteed profit opportunities by betting both sides on different platforms
 */

import { calculateImpliedProbability } from './betting-odds';
import { ParsedKalshiMarket } from './kalshi-api';
import { Game } from '@/types';

export interface ArbitrageOpportunity {
  game: Game;
  marketType: 'moneyline' | 'spread' | 'over_under';
  kalshiMarket: ParsedKalshiMarket;
  bovadaOdds: number;
  kalshiSide: 'yes' | 'no';
  bovadaSide: string;
  profitMargin: number; // Percentage profit
  totalStake: number; // Recommended total stake
  kalshiStake: number; // Amount to bet on Kalshi
  bovadaStake: number; // Amount to bet on Bovada
  guaranteedReturn: number; // Total return regardless of outcome
  guaranteedProfit: number; // Profit after subtracting total stake
}

/**
 * Detect arbitrage opportunity between Kalshi and Bovada
 */
export function detectArbitrage(
  kalshiMarket: ParsedKalshiMarket,
  bovadaOdds: number,
  marketType: 'moneyline' | 'spread' | 'over_under',
  game: Game
): ArbitrageOpportunity | null {
  // Get Kalshi odds (use yes or no depending on which side we're comparing)
  const kalshiYesOdds = kalshiMarket.yesAmericanOdds || 0;
  const kalshiNoOdds = kalshiMarket.noAmericanOdds || 0;

  // Calculate implied probabilities
  const kalshiYesProb = calculateImpliedProbability(kalshiYesOdds);
  const kalshiNoProb = calculateImpliedProbability(kalshiNoOdds);
  const bovadaProb = calculateImpliedProbability(bovadaOdds);

  // Check for arbitrage: if sum of probabilities < 100%, we have arbitrage
  // For moneyline: compare Kalshi Yes vs Bovada opposite side
  // For spread/over_under: compare both sides

  let arbitrageExists = false;
  let kalshiSide: 'yes' | 'no' = 'yes';
  let profitMargin = 0;

  if (marketType === 'moneyline') {
    // Moneyline arbitrage: bet on team to win on one platform, opposite on other
    // If Kalshi Yes + Bovada opposite < 100%, arbitrage exists
    // But we need to know which team the Bovada odds are for
    
    // For now, check both combinations
    const yesBovadaSum = kalshiYesProb + bovadaProb;
    const noBovadaSum = kalshiNoProb + bovadaProb;
    
    if (yesBovadaSum < 1.0) {
      arbitrageExists = true;
      kalshiSide = 'yes';
      profitMargin = (1.0 - yesBovadaSum) * 100;
    } else if (noBovadaSum < 1.0) {
      arbitrageExists = true;
      kalshiSide = 'no';
      profitMargin = (1.0 - noBovadaSum) * 100;
    }
  } else {
    // For spread/over_under, we need both sides from Bovada
    // This is a simplified check - in practice, we'd compare both sides
    // For now, just check if there's a significant price difference
    const kalshiOdds = kalshiSide === 'yes' ? kalshiYesOdds : kalshiNoOdds;
    const oddsDiff = Math.abs(kalshiOdds - bovadaOdds);
    
    // If odds are very different, there might be arbitrage with the other side
    // This is a simplified check - full implementation would compare all combinations
    if (oddsDiff > 50) {
      // Potential arbitrage, but need more data
      return null;
    }
  }

  if (!arbitrageExists || profitMargin < 0.5) {
    return null; // No arbitrage or profit too small
  }

  // Calculate optimal bet sizing
  const totalStake = 1000; // Base stake of $1000
  const { kalshiStake, bovadaStake, guaranteedReturn, guaranteedProfit } = 
    calculateOptimalBetSizing(
      kalshiSide === 'yes' ? kalshiYesOdds : kalshiNoOdds,
      bovadaOdds,
      totalStake
    );

  return {
    game,
    marketType,
    kalshiMarket,
    bovadaOdds,
    kalshiSide,
    bovadaSide: marketType === 'moneyline' ? 'opposite' : 'same',
    profitMargin,
    totalStake,
    kalshiStake,
    bovadaStake,
    guaranteedReturn,
    guaranteedProfit,
  };
}

/**
 * Calculate optimal bet sizing for arbitrage
 * Uses equal profit method: bet amounts so profit is same regardless of outcome
 */
function calculateOptimalBetSizing(
  kalshiOdds: number,
  bovadaOdds: number,
  totalStake: number
): {
  kalshiStake: number;
  bovadaStake: number;
  guaranteedReturn: number;
  guaranteedProfit: number;
} {
  // Calculate payouts for $1 bet
  const kalshiPayout = calculatePayoutForOdds(1, kalshiOdds);
  const bovadaPayout = calculatePayoutForOdds(1, bovadaOdds);

  // For equal profit, we need:
  // kalshiStake * kalshiPayout = bovadaStake * bovadaPayout
  // And: kalshiStake + bovadaStake = totalStake

  // Solve for kalshiStake:
  // kalshiStake * kalshiPayout = (totalStake - kalshiStake) * bovadaPayout
  // kalshiStake * kalshiPayout = totalStake * bovadaPayout - kalshiStake * bovadaPayout
  // kalshiStake * (kalshiPayout + bovadaPayout) = totalStake * bovadaPayout
  // kalshiStake = (totalStake * bovadaPayout) / (kalshiPayout + bovadaPayout)

  const kalshiStake = (totalStake * bovadaPayout) / (kalshiPayout + bovadaPayout);
  const bovadaStake = totalStake - kalshiStake;

  // Calculate guaranteed return (same regardless of which side wins)
  const guaranteedReturn = kalshiStake * kalshiPayout;
  const guaranteedProfit = guaranteedReturn - totalStake;

  return {
    kalshiStake: Math.round(kalshiStake * 100) / 100,
    bovadaStake: Math.round(bovadaStake * 100) / 100,
    guaranteedReturn: Math.round(guaranteedReturn * 100) / 100,
    guaranteedProfit: Math.round(guaranteedProfit * 100) / 100,
  };
}

/**
 * Calculate payout for $1 bet at given odds
 */
function calculatePayoutForOdds(stake: number, odds: number): number {
  if (odds > 0) {
    return stake + (stake * odds) / 100;
  } else {
    return stake + stake / (Math.abs(odds) / 100);
  }
}

/**
 * Find best arbitrage opportunities from a list of comparisons
 */
export function findBestArbitrageOpportunities(
  opportunities: ArbitrageOpportunity[]
): ArbitrageOpportunity[] {
  return opportunities
    .filter(opp => opp.profitMargin > 0.5) // Minimum 0.5% profit
    .sort((a, b) => b.profitMargin - a.profitMargin) // Sort by profit margin
    .slice(0, 20); // Top 20 opportunities
}

/**
 * Calculate arbitrage for moneyline with both teams
 */
export function detectMoneylineArbitrage(
  kalshiMarket: ParsedKalshiMarket,
  bovadaHomeOdds: number,
  bovadaAwayOdds: number,
  game: Game
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = [];

  // Check Kalshi Yes vs Bovada Away
  const opp1 = detectArbitrage(kalshiMarket, bovadaAwayOdds, 'moneyline', game);
  if (opp1) {
    opp1.bovadaSide = game.awayTeam;
    opportunities.push(opp1);
  }

  // Check Kalshi No vs Bovada Home
  const kalshiNoMarket = { ...kalshiMarket, yesAmericanOdds: kalshiMarket.noAmericanOdds };
  const opp2 = detectArbitrage(kalshiNoMarket, bovadaHomeOdds, 'moneyline', game);
  if (opp2) {
    opp2.kalshiSide = 'no';
    opp2.bovadaSide = game.homeTeam;
    opportunities.push(opp2);
  }

  return opportunities;
}
