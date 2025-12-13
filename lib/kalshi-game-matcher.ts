/**
 * Kalshi Game Matcher
 * 
 * Matches Kalshi prediction markets to NFL games using existing game matching logic
 */

import { Game } from '@/types';
import { ParsedKalshiMarket } from './kalshi-api';
import { doGamesMatch, normalizeTeamName } from './game-id-generator';

export interface MatchedKalshiMarket extends ParsedKalshiMarket {
  matchedGame?: Game;
  matchConfidence: number;
  matchMethod: 'exact' | 'team_date' | 'partial';
}

export interface GameMarketGroup {
  game: Game;
  markets: MatchedKalshiMarket[];
}

/**
 * Match Kalshi markets to NFL games
 */
export function matchKalshiMarketsToGames(
  markets: ParsedKalshiMarket[],
  games: Game[]
): GameMarketGroup[] {
  const matched: MatchedKalshiMarket[] = [];
  const unmatched: ParsedKalshiMarket[] = [];

  for (const market of markets) {
    const match = findBestGameMatch(market, games);
    
    if (match) {
      matched.push({
        ...market,
        matchedGame: match.game,
        matchConfidence: match.confidence,
        matchMethod: match.method,
      });
    } else {
      unmatched.push(market);
    }
  }

  // Group matched markets by game
  const gameGroups = new Map<string, GameMarketGroup>();
  
  for (const matchedMarket of matched) {
    if (!matchedMarket.matchedGame) continue;
    
    const gameId = matchedMarket.matchedGame.id;
    
    if (!gameGroups.has(gameId)) {
      gameGroups.set(gameId, {
        game: matchedMarket.matchedGame,
        markets: [],
      });
    }
    
    gameGroups.get(gameId)!.markets.push(matchedMarket);
  }

  // Log matching results
  console.log(`🎯 Matched ${matched.length} Kalshi markets to ${gameGroups.size} games`);
  if (unmatched.length > 0) {
    console.log(`⚠️ ${unmatched.length} markets could not be matched`);
  }

  return Array.from(gameGroups.values());
}

/**
 * Find the best matching game for a Kalshi market
 */
function findBestGameMatch(
  market: ParsedKalshiMarket,
  games: Game[]
): { game: Game; confidence: number; method: 'exact' | 'team_date' | 'partial' } | null {
  let bestMatch: { game: Game; confidence: number; method: 'exact' | 'team_date' | 'partial' } | null = null;
  let bestConfidence = 0;

  for (const game of games) {
    const confidence = calculateMatchConfidence(market, game);
    
    if (confidence > bestConfidence && confidence >= 50) {
      bestConfidence = confidence;
      
      let method: 'exact' | 'team_date' | 'partial' = 'partial';
      if (confidence >= 90) method = 'exact';
      else if (confidence >= 70) method = 'team_date';
      
      bestMatch = { game, confidence, method };
    }
  }

  return bestMatch;
}

/**
 * Calculate match confidence between a market and a game
 */
function calculateMatchConfidence(
  market: ParsedKalshiMarket,
  game: Game
): number {
  let confidence = 0;

  // Date matching (30 points)
  if (market.gameDate) {
    const marketDate = new Date(market.gameDate);
    const gameDate = typeof game.gameTime === 'string' 
      ? new Date(game.gameTime) 
      : game.gameTime;
    
    const sameDay = (
      marketDate.getFullYear() === gameDate.getFullYear() &&
      marketDate.getMonth() === gameDate.getMonth() &&
      marketDate.getDate() === gameDate.getDate()
    );
    
    if (sameDay) {
      confidence += 30;
    } else {
      // Check if within 2 days (partial credit)
      const daysDiff = Math.abs(marketDate.getTime() - gameDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff <= 2) {
        confidence += 15;
      }
    }
  }

  // Team matching based on market type
  if (market.marketType === 'moneyline' && market.teamName) {
    const normalizedMarketTeam = normalizeTeamName(market.teamName);
    const normalizedGameHome = normalizeTeamName(game.homeTeam);
    const normalizedGameAway = normalizeTeamName(game.awayTeam);
    
    // Check if market team matches home or away
    if (normalizedMarketTeam === normalizedGameHome || normalizedMarketTeam === normalizedGameAway) {
      confidence += 40;
      
      // If opponent is also specified and matches, add more confidence
      if (market.opponentName) {
        const normalizedMarketOpponent = normalizeTeamName(market.opponentName);
        if (normalizedMarketOpponent === normalizedGameHome || normalizedMarketOpponent === normalizedGameAway) {
          confidence += 20;
        }
      }
    } else {
      // Partial match - team name might be in a different format
      const gameHomeLower = game.homeTeam.toLowerCase();
      const gameAwayLower = game.awayTeam.toLowerCase();
      const marketTeamLower = market.teamName.toLowerCase();
      
      if (gameHomeLower.includes(marketTeamLower) || gameAwayLower.includes(marketTeamLower) ||
          marketTeamLower.includes(gameHomeLower.split(' ').pop() || '') ||
          marketTeamLower.includes(gameAwayLower.split(' ').pop() || '')) {
        confidence += 20;
      }
    }
  } else if (market.marketType === 'spread' && market.teamName) {
    // Spread markets: "Will [Team] win by X+ points?"
    const normalizedMarketTeam = normalizeTeamName(market.teamName);
    const normalizedGameHome = normalizeTeamName(game.homeTeam);
    const normalizedGameAway = normalizeTeamName(game.awayTeam);
    
    if (normalizedMarketTeam === normalizedGameHome || normalizedMarketTeam === normalizedGameAway) {
      confidence += 50;
    }
  } else if (market.marketType === 'over_under') {
    // Over/under markets don't specify teams, so we rely on date matching
    // If we have a date match, this is likely the right game
    if (confidence >= 30) {
      confidence += 20; // Boost for over/under since they're game-specific
    }
  }

  // Market title contains team names (additional check)
  if (market.title) {
    const titleLower = market.title.toLowerCase();
    const gameHomeLower = game.homeTeam.toLowerCase();
    const gameAwayLower = game.awayTeam.toLowerCase();
    
    // Check if game teams appear in market title
    const homeInTitle = gameHomeLower.split(' ').some(word => 
      word.length > 3 && titleLower.includes(word)
    );
    const awayInTitle = gameAwayLower.split(' ').some(word => 
      word.length > 3 && titleLower.includes(word)
    );
    
    if (homeInTitle || awayInTitle) {
      confidence += 10;
    }
  }

  return Math.min(confidence, 100);
}

/**
 * Group markets by type for a game
 */
export function groupMarketsByType(markets: MatchedKalshiMarket[]) {
  return {
    moneylines: markets.filter(m => m.marketType === 'moneyline'),
    spreads: markets.filter(m => m.marketType === 'spread'),
    overUnders: markets.filter(m => m.marketType === 'over_under'),
  };
}
