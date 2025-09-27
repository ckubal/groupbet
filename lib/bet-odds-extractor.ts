/**
 * Extract betting lines from user bets instead of external APIs
 * 
 * When games are completed, external APIs don't provide historical betting lines.
 * Instead, we use the odds that users recorded when they placed their bets.
 * This ensures we have accurate betting data for game display and resolution.
 */

import { Bet, Game } from '@/types';

export interface BettingLinesFromBets {
  spread?: number;
  spreadOdds?: number;
  overUnder?: number;
  overUnderOdds?: number;
  homeMoneyline?: number;
  awayMoneyline?: number;
}

/**
 * Extract betting lines from a collection of user bets for a specific game
 */
export function extractBettingLinesFromBets(
  gameId: string, 
  bets: Bet[], 
  game: Game
): BettingLinesFromBets {
  const result: BettingLinesFromBets = {};
  
  // Find all bets for this specific game
  const gameBets = bets.filter(bet => bet.gameId === gameId);
  
  if (gameBets.length === 0) {
    console.log(`📊 No bets found for game ${gameId}, cannot extract betting lines`);
    return result;
  }
  
  console.log(`📊 Extracting betting lines from ${gameBets.length} bet(s) for ${game.awayTeam} @ ${game.homeTeam}`);
  
  // Extract spread and odds
  const spreadBets = gameBets.filter(bet => bet.betType === 'spread');
  if (spreadBets.length > 0) {
    const spreadBet = spreadBets[0]; // Use first spread bet found
    result.spread = spreadBet.line;
    result.spreadOdds = spreadBet.odds;
    console.log(`   🎯 Spread: ${result.spread} (${result.spreadOdds})`);
  }
  
  // Extract over/under and odds
  const overUnderBets = gameBets.filter(bet => bet.betType === 'over_under');
  if (overUnderBets.length > 0) {
    const overUnderBet = overUnderBets[0]; // Use first over/under bet found
    result.overUnder = overUnderBet.line;
    result.overUnderOdds = overUnderBet.odds;
    console.log(`   🎯 Over/Under: ${result.overUnder} (${result.overUnderOdds})`);
  }
  
  // Extract moneylines
  const moneylineBets = gameBets.filter(bet => bet.betType === 'moneyline');
  for (const bet of moneylineBets) {
    const betOnHome = bet.selection.toLowerCase().includes(game.homeTeam.toLowerCase()) ||
                     bet.selection.toLowerCase().includes(game.homeTeam.split(' ').pop()?.toLowerCase() || '');
    const betOnAway = bet.selection.toLowerCase().includes(game.awayTeam.toLowerCase()) ||
                     bet.selection.toLowerCase().includes(game.awayTeam.split(' ').pop()?.toLowerCase() || '');
    
    if (betOnHome && !result.homeMoneyline) {
      result.homeMoneyline = bet.odds;
      console.log(`   🎯 Home ML (${game.homeTeam}): ${result.homeMoneyline}`);
    } else if (betOnAway && !result.awayMoneyline) {
      result.awayMoneyline = bet.odds;
      console.log(`   🎯 Away ML (${game.awayTeam}): ${result.awayMoneyline}`);
    }
  }
  
  return result;
}

/**
 * Enhance games with betting lines extracted from user bets
 */
export function enhanceGamesWithBetOdds(games: Game[], bets: Bet[]): Game[] {
  const enhancedGames = games.map(game => {
    // Skip if game already has betting lines
    if (game.spread !== undefined && game.homeMoneyline !== undefined) {
      return game;
    }
    
    // Extract betting lines from user bets
    const extractedLines = extractBettingLinesFromBets(game.id, bets, game);
    
    // Only update undefined values to preserve any existing data
    const enhancedGame = {
      ...game,
      spread: game.spread ?? extractedLines.spread,
      spreadOdds: game.spreadOdds ?? extractedLines.spreadOdds,
      overUnder: game.overUnder ?? extractedLines.overUnder,
      overUnderOdds: game.overUnderOdds ?? extractedLines.overUnderOdds,
      homeMoneyline: game.homeMoneyline ?? extractedLines.homeMoneyline,
      awayMoneyline: game.awayMoneyline ?? extractedLines.awayMoneyline
    };
    
    // Log what was enhanced
    const enhancements: string[] = [];
    if (game.spread === undefined && extractedLines.spread !== undefined) {
      enhancements.push(`spread (${extractedLines.spread})`);
    }
    if (game.overUnder === undefined && extractedLines.overUnder !== undefined) {
      enhancements.push(`o/u (${extractedLines.overUnder})`);
    }
    if (game.homeMoneyline === undefined && extractedLines.homeMoneyline !== undefined) {
      enhancements.push(`home ML (${extractedLines.homeMoneyline})`);
    }
    if (game.awayMoneyline === undefined && extractedLines.awayMoneyline !== undefined) {
      enhancements.push(`away ML (${extractedLines.awayMoneyline})`);
    }
    
    if (enhancements.length > 0) {
      console.log(`✅ Enhanced ${game.awayTeam} @ ${game.homeTeam} with: ${enhancements.join(', ')}`);
    }
    
    return enhancedGame;
  });
  
  const enhancedCount = enhancedGames.filter(g => 
    g.spread !== undefined || g.homeMoneyline !== undefined
  ).length;
  
  console.log(`📊 Enhanced ${enhancedCount}/${games.length} games with betting lines from user bets`);
  
  return enhancedGames;
}

/**
 * Get unique game IDs from a collection of bets
 */
export function getGameIdsFromBets(bets: Bet[]): string[] {
  const gameIds = new Set<string>();
  
  for (const bet of bets) {
    if (bet.betType === 'parlay' && bet.parlayLegs) {
      // Add game IDs from parlay legs
      for (const leg of bet.parlayLegs) {
        gameIds.add(leg.gameId);
      }
    } else {
      // Add game ID from regular bet
      gameIds.add(bet.gameId);
    }
  }
  
  return Array.from(gameIds);
}