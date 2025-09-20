import { Game } from '@/types';
import { format } from 'date-fns';

interface GameIdentifiers {
  internalId: string;
  espnId?: string;
  oddsApiId?: string;
  teams: {
    home: string;
    away: string;
  };
  gameTime: Date;
  week: number;
  season: number;
}

interface MatchingMetadata {
  confidence: number; // 0-100
  method: 'exact_id' | 'team_time' | 'team_week' | 'fuzzy_team' | 'manual';
  timestamp: Date;
}

/**
 * Robust Game Matching Service
 * 
 * Provides multiple fallback strategies for matching games across APIs:
 * 1. Exact ID matching (primary)
 * 2. Team names + game time (±2 hours)
 * 3. Team names + NFL week
 * 4. Fuzzy team name matching
 * 5. Manual override capability
 */
export class RobustGameMatchingService {
  
  /**
   * Generate a deterministic game signature based on immutable properties
   */
  static generateGameSignature(
    homeTeam: string, 
    awayTeam: string, 
    gameTime: Date, 
    week: number, 
    season: number = 2025
  ): string {
    // Normalize team names (remove spaces, lowercase, common abbreviations)
    const normalizeTeam = (team: string) => {
      return team
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/49ers/g, 'fortyniners')
        .replace(/patriots/g, 'newenglandpatriots')
        .replace(/giants/g, 'newyorkgiants')
        .replace(/jets/g, 'newyorkjets');
    };
    
    const home = normalizeTeam(homeTeam);
    const away = normalizeTeam(awayTeam);
    const date = format(gameTime, 'yyyy-MM-dd');
    
    // Create signature: season-week-date-away@home
    return `${season}-w${week}-${date}-${away}@${home}`;
  }
  
  /**
   * Extract team name variants for fuzzy matching
   */
  static getTeamVariants(teamName: string): string[] {
    const variants = [teamName];
    
    // City + nickname variants
    const parts = teamName.split(' ');
    if (parts.length >= 2) {
      variants.push(parts[parts.length - 1]); // Just nickname (e.g., "Bills")
      variants.push(parts.slice(0, -1).join(' ')); // Just city (e.g., "Buffalo")
    }
    
    // Common abbreviations and variants
    const abbrevMap: Record<string, string[]> = {
      'San Francisco 49ers': ['49ers', 'SF', 'Niners'],
      'New England Patriots': ['Patriots', 'NE', 'Pats'],
      'New York Giants': ['Giants', 'NYG'],
      'New York Jets': ['Jets', 'NYJ'],
      'Los Angeles Rams': ['Rams', 'LAR'],
      'Los Angeles Chargers': ['Chargers', 'LAC'],
      'Las Vegas Raiders': ['Raiders', 'LV', 'LVR'],
      'Tampa Bay Buccaneers': ['Bucs', 'TB', 'Buccaneers'],
      'Green Bay Packers': ['Packers', 'GB'],
      'Kansas City Chiefs': ['Chiefs', 'KC'],
      // Add more as needed
    };
    
    if (abbrevMap[teamName]) {
      variants.push(...abbrevMap[teamName]);
    }
    
    return [...new Set(variants)]; // Remove duplicates
  }
  
  /**
   * Calculate match confidence between two games
   */
  static calculateMatchConfidence(game1: GameIdentifiers, game2: GameIdentifiers): number {
    let confidence = 0;
    
    // Exact ID match = 100% confidence
    if (game1.espnId && game2.espnId && game1.espnId === game2.espnId) return 100;
    if (game1.oddsApiId && game2.oddsApiId && game1.oddsApiId === game2.oddsApiId) return 100;
    
    // Team matching (50 points max)
    const game1HomeVariants = this.getTeamVariants(game1.teams.home);
    const game1AwayVariants = this.getTeamVariants(game1.teams.away);
    const game2HomeVariants = this.getTeamVariants(game2.teams.home);
    const game2AwayVariants = this.getTeamVariants(game2.teams.away);
    
    const homeMatch = game1HomeVariants.some(v1 => 
      game2HomeVariants.some(v2 => v1.toLowerCase() === v2.toLowerCase())
    );
    const awayMatch = game1AwayVariants.some(v1 => 
      game2AwayVariants.some(v2 => v1.toLowerCase() === v2.toLowerCase())
    );
    
    if (homeMatch && awayMatch) {
      confidence += 50;
    } else if (homeMatch || awayMatch) {
      confidence += 20; // Partial team match
    }
    
    // Time matching (30 points max)
    const timeDiff = Math.abs(game1.gameTime.getTime() - game2.gameTime.getTime());
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    
    if (hoursDiff <= 0.5) confidence += 30; // Within 30 minutes
    else if (hoursDiff <= 2) confidence += 25; // Within 2 hours
    else if (hoursDiff <= 6) confidence += 15; // Within 6 hours
    else if (hoursDiff <= 24) confidence += 5; // Same day
    
    // Week matching (20 points max)
    if (game1.week === game2.week && game1.season === game2.season) {
      confidence += 20;
    }
    
    return Math.min(confidence, 100);
  }
  
  /**
   * Find best match for a game from a list of candidates
   */
  static findBestMatch(
    targetGame: GameIdentifiers, 
    candidates: GameIdentifiers[],
    minConfidence: number = 70
  ): { match: GameIdentifiers; confidence: number; method: MatchingMetadata['method'] } | null {
    
    let bestMatch: GameIdentifiers | null = null;
    let bestConfidence = 0;
    let method: MatchingMetadata['method'] = 'fuzzy_team';
    
    for (const candidate of candidates) {
      const confidence = this.calculateMatchConfidence(targetGame, candidate);
      
      if (confidence > bestConfidence && confidence >= minConfidence) {
        bestMatch = candidate;
        bestConfidence = confidence;
        
        // Determine method based on confidence level
        if (confidence === 100) method = 'exact_id';
        else if (confidence >= 95) method = 'team_time';
        else if (confidence >= 85) method = 'team_week';
        else method = 'fuzzy_team';
      }
    }
    
    return bestMatch ? { match: bestMatch, confidence: bestConfidence, method } : null;
  }
  
  /**
   * Create comprehensive game identifiers from various sources
   */
  static createGameIdentifiers(
    id: string,
    homeTeam: string,
    awayTeam: string,
    gameTime: Date | string,
    week: number,
    season: number = 2025,
    espnId?: string,
    oddsApiId?: string
  ): GameIdentifiers {
    return {
      internalId: id,
      espnId,
      oddsApiId,
      teams: {
        home: homeTeam,
        away: awayTeam
      },
      gameTime: typeof gameTime === 'string' ? new Date(gameTime) : gameTime,
      week,
      season
    };
  }
  
  /**
   * Validate and repair game mappings
   */
  static validateGameMapping(
    internalGame: GameIdentifiers,
    espnGame?: GameIdentifiers,
    oddsGame?: GameIdentifiers
  ): {
    isValid: boolean;
    issues: string[];
    repairs: Array<{ action: string; confidence: number }>;
  } {
    const issues: string[] = [];
    const repairs: Array<{ action: string; confidence: number }> = [];
    
    // Check ESPN mapping
    if (espnGame) {
      const espnConfidence = this.calculateMatchConfidence(internalGame, espnGame);
      if (espnConfidence < 70) {
        issues.push(`ESPN mapping confidence too low: ${espnConfidence}%`);
        repairs.push({ action: 'research_espn_mapping', confidence: espnConfidence });
      }
    } else {
      issues.push('Missing ESPN mapping');
    }
    
    // Check Odds API mapping
    if (oddsGame) {
      const oddsConfidence = this.calculateMatchConfidence(internalGame, oddsGame);
      if (oddsConfidence < 70) {
        issues.push(`Odds API mapping confidence too low: ${oddsConfidence}%`);
        repairs.push({ action: 'research_odds_mapping', confidence: oddsConfidence });
      }
    } else {
      issues.push('Missing Odds API mapping');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      repairs
    };
  }
}

/**
 * Multi-strategy game matching with automatic fallbacks
 */
export async function matchGameWithFallbacks(
  internalGame: Game,
  espnGames: any[] = [],
  oddsGames: any[] = []
): Promise<{
  espnMatch?: any;
  oddsMatch?: any;
  confidence: number;
  method: string;
  fallbacksUsed: string[];
}> {
  const fallbacksUsed: string[] = [];
  let bestConfidence = 0;
  let bestMethod = 'none';
  let espnMatch: any = null;
  let oddsMatch: any = null;
  
  // Extract week from internal game
  const weekMatch = internalGame.weekendId?.match(/week-(\d+)/);
  const week = weekMatch ? parseInt(weekMatch[1]) : 3;
  
  const internalGameId = RobustGameMatchingService.createGameIdentifiers(
    internalGame.id,
    internalGame.homeTeam,
    internalGame.awayTeam,
    internalGame.gameTime,
    week
  );
  
  // Strategy 1: Exact ID matching (if available)
  if (internalGame.espnId) {
    espnMatch = espnGames.find(g => g.id === internalGame.espnId);
    if (espnMatch) {
      bestConfidence = 100;
      bestMethod = 'exact_espn_id';
    }
  }
  
  // Strategy 2: Team + time matching
  if (!espnMatch && espnGames.length > 0) {
    fallbacksUsed.push('team_time_matching');
    
    const espnCandidates = espnGames.map(g => 
      RobustGameMatchingService.createGameIdentifiers(
        g.id,
        g.homeTeam || g.home_team,
        g.awayTeam || g.away_team,
        g.gameTime || g.commence_time,
        week,
        2025,
        g.id
      )
    );
    
    const espnResult = RobustGameMatchingService.findBestMatch(internalGameId, espnCandidates, 60);
    if (espnResult) {
      espnMatch = espnGames.find(g => g.id === espnResult.match.espnId);
      bestConfidence = Math.max(bestConfidence, espnResult.confidence);
      bestMethod = espnResult.method;
    }
  }
  
  // Strategy 3: Find Odds API match
  if (oddsGames.length > 0) {
    const oddsCandidates = oddsGames.map(g => 
      RobustGameMatchingService.createGameIdentifiers(
        g.id,
        g.home_team,
        g.away_team,
        g.commence_time,
        week,
        2025,
        undefined,
        g.id
      )
    );
    
    const oddsResult = RobustGameMatchingService.findBestMatch(internalGameId, oddsCandidates, 60);
    if (oddsResult) {
      oddsMatch = oddsGames.find(g => g.id === oddsResult.match.oddsApiId);
      bestConfidence = Math.max(bestConfidence, oddsResult.confidence);
      if (oddsResult.confidence > bestConfidence) {
        bestMethod = oddsResult.method + '_odds';
      }
    }
  }
  
  return {
    espnMatch,
    oddsMatch,
    confidence: bestConfidence,
    method: bestMethod,
    fallbacksUsed
  };
}