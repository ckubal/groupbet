import { Game } from '@/types';
import { RobustGameMatchingService, matchGameWithFallbacks } from './robust-game-matching';
import { gameIdMappingService, gameCacheService } from './firebase-service';

/**
 * Enhanced Game Service with Robust Matching
 * 
 * Provides automatic game matching with fallbacks and self-healing capabilities
 */
export class EnhancedGameService {
  
  /**
   * Enhanced game loading with automatic matching and repair
   */
  static async loadGamesWithRobustMatching(
    week: number,
    season: number = 2025,
    forceRefresh: boolean = false
  ): Promise<Game[]> {
    console.log(`🔄 Loading games for Week ${week} with robust matching...`);
    
    try {
      // 1. Load games from primary source (ESPN + Cache)
      const { oddsApi } = await import('./odds-api');
      let games = await oddsApi.getNFLGames(week);
      
      // 2. Load external API data for matching
      const [espnGames, oddsApiGames] = await Promise.allSettled([
        this.fetchESPNGamesForWeek(week),
        this.fetchOddsApiGamesForWeek(week)
      ]);
      
      const espnData = espnGames.status === 'fulfilled' ? espnGames.value : [];
      const oddsData = oddsApiGames.status === 'fulfilled' ? oddsApiGames.value : [];
      
      console.log(`📊 Loaded ${games.length} internal games, ${espnData.length} ESPN games, ${oddsData.length} Odds API games`);
      
      // 3. Validate and repair mappings for each game
      const repairedGames: Game[] = [];
      const mappingIssues: Array<{ gameId: string; issues: string[] }> = [];
      
      for (const game of games) {
        try {
          const result = await this.validateAndRepairGameMapping(game, espnData, oddsData);
          repairedGames.push(result.game);
          
          if (result.issues.length > 0) {
            mappingIssues.push({ gameId: game.id, issues: result.issues });
          }
          
          // Log any repairs made
          if (result.repairsApplied.length > 0) {
            console.log(`🔧 Applied repairs for game ${game.awayTeam} @ ${game.homeTeam}:`, result.repairsApplied);
          }
          
        } catch (error) {
          console.error(`❌ Failed to validate game ${game.id}:`, error);
          // Keep original game as fallback
          repairedGames.push(game);
        }
      }
      
      // 4. Report mapping health
      if (mappingIssues.length > 0) {
        console.warn(`⚠️ Found ${mappingIssues.length} games with mapping issues:`, mappingIssues);
      } else {
        console.log(`✅ All ${repairedGames.length} games have valid mappings`);
      }
      
      return repairedGames;
      
    } catch (error) {
      console.error('❌ Enhanced game loading failed:', error);
      // Fallback to basic loading
      const { oddsApi } = await import('./odds-api');
      return await oddsApi.getNFLGames(week);
    }
  }
  
  /**
   * Validate and repair a single game's mapping
   */
  static async validateAndRepairGameMapping(
    game: Game,
    espnGames: any[] = [],
    oddsGames: any[] = []
  ): Promise<{
    game: Game;
    issues: string[];
    repairsApplied: string[];
  }> {
    const issues: string[] = [];
    const repairsApplied: string[] = [];
    
    // Get current mapping
    const currentMapping = await gameIdMappingService.getGameMapping(game.id);
    
    // Try to match with external APIs
    const matchResult = await matchGameWithFallbacks(game, espnGames, oddsGames);
    
    let updatedGame = { ...game };
    
    // Check if we need to create/update ESPN mapping
    if (matchResult.espnMatch && (!currentMapping?.espnId || matchResult.confidence > 80)) {
      if (!currentMapping?.espnId) {
        issues.push('Missing ESPN mapping');
      }
      
      try {
        await gameIdMappingService.storeGameIdMapping(game.id, {
          espnId: matchResult.espnMatch.id,
          oddsApiId: currentMapping?.oddsApiId || matchResult.oddsMatch?.id,
          awayTeam: game.awayTeam,
          homeTeam: game.homeTeam,
          gameTime: game.gameTime
        });
        
        repairsApplied.push(`ESPN mapping: ${matchResult.espnMatch.id} (${matchResult.confidence}% confidence)`);
      } catch (error) {
        console.error('Failed to store ESPN mapping:', error);
      }
    }
    
    // Check if we need to create/update Odds API mapping
    if (matchResult.oddsMatch && (!currentMapping?.oddsApiId || matchResult.confidence > 80)) {
      if (!currentMapping?.oddsApiId) {
        issues.push('Missing Odds API mapping');
      }
      
      try {
        await gameIdMappingService.storeGameIdMapping(game.id, {
          espnId: currentMapping?.espnId || matchResult.espnMatch?.id,
          oddsApiId: matchResult.oddsMatch.id,
          awayTeam: game.awayTeam,
          homeTeam: game.homeTeam,
          gameTime: game.gameTime
        });
        
        repairsApplied.push(`Odds API mapping: ${matchResult.oddsMatch.id} (${matchResult.confidence}% confidence)`);
      } catch (error) {
        console.error('Failed to store Odds API mapping:', error);
      }
    }
    
    // Enhance game with better data if available
    if (matchResult.espnMatch && matchResult.confidence > 90) {
      // Update with more accurate ESPN data
      updatedGame = {
        ...updatedGame,
        status: this.mapESPNStatus(matchResult.espnMatch.status),
        homeScore: matchResult.espnMatch.homeScore || updatedGame.homeScore,
        awayScore: matchResult.espnMatch.awayScore || updatedGame.awayScore,
        quarter: matchResult.espnMatch.quarter,
        timeRemaining: matchResult.espnMatch.timeRemaining
      };
    }
    
    return {
      game: updatedGame,
      issues,
      repairsApplied
    };
  }
  
  /**
   * Fetch ESPN games for a specific week
   */
  static async fetchESPNGamesForWeek(week: number): Promise<any[]> {
    try {
      console.log(`📡 Fetching ESPN games for Week ${week}...`);
      // Import ESPN service if available
      const { getNFLWeekBoundaries } = await import('./utils');
      const { start, end } = getNFLWeekBoundaries(week, 2025);
      
      // This would call ESPN API - for now return empty array
      // TODO: Implement ESPN API integration
      return [];
      
    } catch (error) {
      console.warn('Failed to fetch ESPN games:', error);
      return [];
    }
  }
  
  /**
   * Fetch Odds API games for a specific week
   */
  static async fetchOddsApiGamesForWeek(week: number): Promise<any[]> {
    try {
      console.log(`📡 Fetching Odds API games for Week ${week}...`);
      
      const apiKey = process.env.NEXT_PUBLIC_ODDS_API_KEY;
      if (!apiKey) return [];
      
      const response = await fetch(
        `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?` +
        new URLSearchParams({
          apiKey,
          regions: 'us',
          markets: 'h2h,spreads,totals',
          oddsFormat: 'american',
          bookmakers: 'bovada,draftkings,fanduel,betmgm',
        })
      );
      
      if (!response.ok) {
        throw new Error(`Odds API error: ${response.status}`);
      }
      
      const allGames = await response.json();
      
      // Filter by week
      const { getNFLWeekBoundaries } = await import('./utils');
      const { start, end } = getNFLWeekBoundaries(week, 2025);
      
      return allGames.filter((game: any) => {
        const gameTime = new Date(game.commence_time);
        return gameTime >= start && gameTime < end;
      });
      
    } catch (error) {
      console.warn('Failed to fetch Odds API games:', error);
      return [];
    }
  }
  
  /**
   * Map ESPN status to our game status
   */
  static mapESPNStatus(espnStatus: string): 'upcoming' | 'live' | 'final' {
    const status = espnStatus?.toLowerCase();
    if (status?.includes('final') || status?.includes('completed')) return 'final';
    if (status?.includes('live') || status?.includes('in_progress')) return 'live';
    return 'upcoming';
  }
  
  /**
   * Auto-repair all games with mapping issues
   */
  static async repairAllGameMappings(week: number): Promise<{
    repaired: number;
    failed: number;
    issues: Array<{ gameId: string; error: string }>;
  }> {
    console.log(`🔧 Starting auto-repair for Week ${week} game mappings...`);
    
    let repaired = 0;
    let failed = 0;
    const issues: Array<{ gameId: string; error: string }> = [];
    
    try {
      // Load current games
      const games = await this.loadGamesWithRobustMatching(week, 2025, true);
      
      for (const game of games) {
        try {
          const mapping = await gameIdMappingService.getGameMapping(game.id);
          
          if (!mapping?.oddsApiId) {
            // Try to repair missing Odds API mapping
            const oddsGames = await this.fetchOddsApiGamesForWeek(week);
            const matchResult = await matchGameWithFallbacks(game, [], oddsGames);
            
            if (matchResult.oddsMatch && matchResult.confidence > 70) {
              await gameIdMappingService.storeGameIdMapping(game.id, {
                espnId: mapping?.espnId || 'auto-repair',
                oddsApiId: matchResult.oddsMatch.id,
                awayTeam: game.awayTeam,
                homeTeam: game.homeTeam,
                gameTime: game.gameTime
              });
              
              repaired++;
              console.log(`✅ Repaired mapping for ${game.awayTeam} @ ${game.homeTeam}`);
            } else {
              failed++;
              issues.push({ gameId: game.id, error: 'No suitable match found' });
            }
          }
          
        } catch (error) {
          failed++;
          issues.push({ 
            gameId: game.id, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }
      
      console.log(`🎯 Auto-repair complete: ${repaired} repaired, ${failed} failed`);
      
    } catch (error) {
      console.error('❌ Auto-repair failed:', error);
    }
    
    return { repaired, failed, issues };
  }
}