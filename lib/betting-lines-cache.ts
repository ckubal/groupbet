/**
 * Automatic Betting Lines Caching System
 * 
 * Strategic system for fetching, caching, and managing betting lines
 * to minimize API calls while ensuring comprehensive coverage.
 */

import { collection, doc, getDocs, getDoc, setDoc, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Game } from '@/types';
import { getCurrentNFLWeek } from '@/lib/utils';
import { gamesCacheService } from '@/lib/games-cache';
import { preGameOddsService } from '@/lib/firebase-service';

export interface BettingLinesCache {
  gameId: string;
  spread?: number;
  spreadOdds?: number;
  overUnder?: number;
  overUnderOdds?: number;
  homeMoneyline?: number;
  awayMoneyline?: number;
  // Metadata
  fetchedAt: Date;
  source: 'odds_api' | 'user_bets' | 'frozen';
  gameTime: Date;
  weekendId: string;
  bookmaker?: string; // Which bookmaker provided the lines
  // Cache strategy flags
  isInitialFetch: boolean; // Was this the first time we got lines for this game?
  isFinalRefresh: boolean; // Was this the pre-game final refresh?
  isFrozen: boolean; // Are these lines permanently frozen?
}

export interface BettingLinesStatus {
  gameId: string;
  awayTeam: string;
  homeTeam: string;
  hasLines: boolean;
  isFrozen: boolean;
  needsFetch: boolean;
  source?: string;
  fetchedAt?: Date;
  hoursUntilGame: number;
}

export interface WeekBettingLinesStatus {
  week: number;
  games: BettingLinesStatus[];
  summary: {
    totalGames: number;
    gamesWithLines: number;
    gamesFrozen: number;
    gamesNeedingFetch: number;
  };
}

export class BettingLinesCacheService {
  // Strategic timing constants (in hours)
  private readonly INITIAL_FETCH_HOURS = 48; // 2+ days before game
  private readonly FINAL_REFRESH_START = 6; // 6 hours before game
  private readonly FINAL_REFRESH_END = 2; // 2 hours before game
  private readonly FREEZE_THRESHOLD = 1; // 1 hour before game

  /**
   * Main entry point: Ensure betting lines are cached for all games in a week
   */
  async ensureBettingLinesForWeek(weekNumber: number): Promise<void> {
    console.log(`🎯 BettingLinesCache: Processing Week ${weekNumber}...`);
    
    try {
      const games = await gamesCacheService.getGamesForWeek(weekNumber);
      
      if (games.length === 0) {
        console.log(`📭 No games found for Week ${weekNumber}`);
        return;
      }
      
      console.log(`🏈 Found ${games.length} games for Week ${weekNumber}`);
      
      let processed = 0;
      for (const game of games) {
        try {
          await this.ensureBettingLinesForGame(game);
          processed++;
        } catch (error) {
          console.error(`❌ Error processing betting lines for ${game.awayTeam} @ ${game.homeTeam}:`, error);
          // Continue processing other games
        }
      }
      
      console.log(`✅ Processed betting lines for ${processed}/${games.length} games in Week ${weekNumber}`);
    } catch (error) {
      console.error(`❌ Error ensuring betting lines for Week ${weekNumber}:`, error);
      throw error;
    }
  }

  /**
   * Strategic betting lines management for individual games
   */
  async ensureBettingLinesForGame(game: Game): Promise<void> {
    if (!game.gameTime || !(game.gameTime instanceof Date)) {
      console.warn(`⚠️ Invalid game time for ${game.awayTeam} @ ${game.homeTeam}, skipping betting lines`);
      return;
    }
    
    const now = new Date();
    const hoursUntilGame = (game.gameTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    console.log(`⏰ ${game.awayTeam} @ ${game.homeTeam}: ${hoursUntilGame.toFixed(1)} hours until game`);
    
    // Check if lines are already frozen (post-game)
    try {
      const frozenLines = await preGameOddsService.getFrozenOdds(game.id);
      if (frozenLines) {
        console.log(`🧊 Lines already frozen for ${game.awayTeam} @ ${game.homeTeam}`);
        return;
      }
    } catch (error) {
      console.warn(`⚠️ Could not check frozen odds for ${game.id}:`, error);
    }
    
    // Check existing cache
    const cachedLines = await this.getCachedBettingLines(game.id);
    
    // Strategic decision tree based on timing
    if (hoursUntilGame <= 0) {
      // GAME STARTED/COMPLETED: Freeze current lines
      await this.handleGameStarted(game, cachedLines);
      
    } else if (hoursUntilGame <= this.FREEZE_THRESHOLD) {
      // FREEZE WINDOW: Game starting very soon
      await this.handleFreezeWindow(game, cachedLines);
      
    } else if (hoursUntilGame >= this.FINAL_REFRESH_START && hoursUntilGame <= this.FINAL_REFRESH_END) {
      // FINAL REFRESH WINDOW: 2-6 hours before game
      await this.handleFinalRefreshWindow(game, cachedLines);
      
    } else if (hoursUntilGame >= this.INITIAL_FETCH_HOURS) {
      // INITIAL FETCH WINDOW: 2+ days before game
      await this.handleInitialFetchWindow(game, cachedLines);
      
    } else {
      // QUIET PERIOD: Between initial fetch and final refresh
      await this.handleQuietPeriod(game, cachedLines);
    }
  }

  /**
   * Handle game that has started or completed
   */
  private async handleGameStarted(game: Game, cachedLines: BettingLinesCache | null): Promise<void> {
    if (cachedLines && !cachedLines.isFrozen) {
      console.log(`⚡ Game started: Freezing betting lines for ${game.awayTeam} @ ${game.homeTeam}`);
      await this.freezeBettingLines(game, cachedLines);
    }
  }

  /**
   * Handle freeze window (1 hour before game)
   */
  private async handleFreezeWindow(game: Game, cachedLines: BettingLinesCache | null): Promise<void> {
    if (cachedLines && !cachedLines.isFrozen) {
      console.log(`🧊 Freeze window: Freezing betting lines for ${game.awayTeam} @ ${game.homeTeam}`);
      await this.freezeBettingLines(game, cachedLines);
    } else if (!cachedLines) {
      console.log(`⚠️ Emergency fetch in freeze window for ${game.awayTeam} @ ${game.homeTeam}`);
      await this.fetchAndCacheBettingLines(game, { isInitialFetch: false, isFinalRefresh: false });
    }
  }

  /**
   * Handle initial fetch window (2+ days before game)
   */
  private async handleInitialFetchWindow(game: Game, cachedLines: BettingLinesCache | null): Promise<void> {
    // Only fetch if we don't have any lines yet, or haven't tried in 24+ hours
    const shouldFetch = !cachedLines || 
      (Date.now() - cachedLines.fetchedAt.getTime()) > (24 * 60 * 60 * 1000);
    
    if (shouldFetch) {
      console.log(`🎯 Initial fetch window: Getting betting lines for ${game.awayTeam} @ ${game.homeTeam}`);
      await this.fetchAndCacheBettingLines(game, { isInitialFetch: true, isFinalRefresh: false });
    } else {
      console.log(`✅ Recent lines available for ${game.awayTeam} @ ${game.homeTeam}`);
    }
  }

  /**
   * Handle final refresh window (2-6 hours before game)
   */
  private async handleFinalRefreshWindow(game: Game, cachedLines: BettingLinesCache | null): Promise<void> {
    // Always do final refresh if we haven't done it yet
    const needsFinalRefresh = !cachedLines?.isFinalRefresh;
    
    if (needsFinalRefresh) {
      console.log(`🎯 Final refresh window: Updating betting lines for ${game.awayTeam} @ ${game.homeTeam}`);
      await this.fetchAndCacheBettingLines(game, { isInitialFetch: false, isFinalRefresh: true });
    } else {
      console.log(`✅ Final refresh already completed for ${game.awayTeam} @ ${game.homeTeam}`);
    }
  }

  /**
   * Handle quiet period (between initial and final)
   */
  private async handleQuietPeriod(game: Game, cachedLines: BettingLinesCache | null): Promise<void> {
    // Only fetch if we have no lines at all (emergency fallback)
    if (!cachedLines) {
      console.log(`⚠️ Emergency fetch in quiet period: No betting lines found for ${game.awayTeam} @ ${game.homeTeam}`);
      await this.fetchAndCacheBettingLines(game, { isInitialFetch: false, isFinalRefresh: false });
    } else {
      console.log(`😴 Quiet period: Lines cached for ${game.awayTeam} @ ${game.homeTeam}`);
    }
  }

  /**
   * Fetch betting lines from Odds API and cache them
   */
  private async fetchAndCacheBettingLines(
    game: Game, 
    options: { isInitialFetch: boolean; isFinalRefresh: boolean }
  ): Promise<void> {
    try {
      console.log(`📡 Fetching live betting lines for ${game.awayTeam} @ ${game.homeTeam}...`);
      
      // Import Odds API service
      const { oddsApi } = await import('./odds-api');
      
      // Get Odds API key
      const apiKey = process.env.NEXT_PUBLIC_ODDS_API_KEY;
      if (!apiKey) {
        console.warn('⚠️ No Odds API key found, cannot fetch live betting lines');
        throw new Error('Odds API key required for live betting lines');
      }
      
      // Fetch live odds for this specific game by looking up all current games
      const liveOddsResponse = await fetch(
        `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?${new URLSearchParams({
          apiKey,
          regions: 'us',
          markets: 'spreads,totals,h2h',
          oddsFormat: 'american',
          bookmakers: 'bovada,draftkings,fanduel',
        })}`
      );

      if (!liveOddsResponse.ok) {
        throw new Error(`Odds API failed: ${liveOddsResponse.status} ${liveOddsResponse.statusText}`);
      }

      const liveOddsData = await liveOddsResponse.json();
      console.log(`📊 Found ${liveOddsData.length} games with live odds`);
      
      // Find matching game in Odds API data
      const matchingOddsGame = liveOddsData.find((oddsGame: any) => {
        // Import game matching utilities
        const { doGamesMatch } = require('./game-id-generator');
        
        return doGamesMatch(
          { 
            gameTime: game.gameTime, 
            awayTeam: game.awayTeam, 
            homeTeam: game.homeTeam 
          },
          { 
            gameTime: oddsGame.commence_time, 
            awayTeam: oddsGame.away_team, 
            homeTeam: oddsGame.home_team 
          }
        );
      });

      if (!matchingOddsGame) {
        console.warn(`⚠️ No matching Odds API game found for ${game.awayTeam} @ ${game.homeTeam}`);
        
        // Create cache entry with no lines but proper metadata
        const bettingLines: BettingLinesCache = {
          gameId: game.id,
          spread: undefined,
          spreadOdds: undefined,
          overUnder: undefined,
          overUnderOdds: undefined,
          homeMoneyline: undefined,
          awayMoneyline: undefined,
          fetchedAt: new Date(),
          source: 'odds_api',
          gameTime: game.gameTime,
          weekendId: game.weekendId,
          bookmaker: undefined,
          isInitialFetch: options.isInitialFetch,
          isFinalRefresh: options.isFinalRefresh,
          isFrozen: false
        };
        
        await this.saveBettingLines(game.id, bettingLines);
        console.log(`💾 Cached empty betting lines for ${game.awayTeam} @ ${game.homeTeam} (no match found)`);
        return;
      }

      // Extract betting lines from best bookmaker
      const bookmaker = matchingOddsGame.bookmakers.find((b: any) => 
        ['bovada', 'draftkings', 'fanduel'].includes(b.key)
      ) || matchingOddsGame.bookmakers[0];

      if (!bookmaker) {
        throw new Error('No bookmaker data found in Odds API response');
      }

      // Extract spread
      const spreadMarket = bookmaker.markets.find((m: any) => m.key === 'spreads');
      const homeSpread = spreadMarket?.outcomes.find((o: any) => o.name === matchingOddsGame.home_team);
      
      // Extract totals
      const totalsMarket = bookmaker.markets.find((m: any) => m.key === 'totals');
      const overTotal = totalsMarket?.outcomes.find((o: any) => o.name === 'Over');
      
      // Extract moneylines
      const h2hMarket = bookmaker.markets.find((m: any) => m.key === 'h2h');
      const homeML = h2hMarket?.outcomes.find((o: any) => o.name === matchingOddsGame.home_team);
      const awayML = h2hMarket?.outcomes.find((o: any) => o.name === matchingOddsGame.away_team);

      console.log(`💰 Extracted lines: Spread ${homeSpread?.point || 'N/A'}, O/U ${overTotal?.point || 'N/A'}, ML ${homeML?.price || 'N/A'}/${awayML?.price || 'N/A'}`);
      
      // Create betting lines cache entry
      const bettingLines: BettingLinesCache = {
        gameId: game.id,
        spread: homeSpread?.point,
        spreadOdds: homeSpread?.price || -110,
        overUnder: overTotal?.point,
        overUnderOdds: overTotal?.price || -110,
        homeMoneyline: homeML?.price,
        awayMoneyline: awayML?.price,
        fetchedAt: new Date(),
        source: 'odds_api',
        gameTime: game.gameTime,
        weekendId: game.weekendId,
        bookmaker: bookmaker.key,
        isInitialFetch: options.isInitialFetch,
        isFinalRefresh: options.isFinalRefresh,
        isFrozen: false
      };
      
      await this.saveBettingLines(game.id, bettingLines);
      console.log(`✅ Cached live betting lines for ${game.awayTeam} @ ${game.homeTeam} from ${bookmaker.key}`);
      
    } catch (error) {
      console.error(`❌ Failed to fetch betting lines for ${game.awayTeam} @ ${game.homeTeam}:`, error);
      
      // Create cache entry to mark the attempt (prevents repeated failures)
      const fallbackLines: BettingLinesCache = {
        gameId: game.id,
        spread: undefined,
        spreadOdds: undefined,
        overUnder: undefined,
        overUnderOdds: undefined,
        homeMoneyline: undefined,
        awayMoneyline: undefined,
        fetchedAt: new Date(),
        source: 'odds_api',
        gameTime: game.gameTime,
        weekendId: game.weekendId,
        bookmaker: undefined,
        isInitialFetch: options.isInitialFetch,
        isFinalRefresh: options.isFinalRefresh,
        isFrozen: false
      };
      
      await this.saveBettingLines(game.id, fallbackLines);
      throw error;
    }
  }

  /**
   * Freeze betting lines permanently
   */
  private async freezeBettingLines(game: Game, cachedLines: BettingLinesCache): Promise<void> {
    try {
      console.log(`🧊 Freezing betting lines for ${game.awayTeam} @ ${game.homeTeam}`);
      
      // Freeze in the pre-game odds service
      await preGameOddsService.freezeOdds(game.id, {
        spread: cachedLines.spread,
        spreadOdds: cachedLines.spreadOdds,
        overUnder: cachedLines.overUnder,
        overUnderOdds: cachedLines.overUnderOdds,
        homeMoneyline: cachedLines.homeMoneyline,
        awayMoneyline: cachedLines.awayMoneyline
      });
      
      // Mark as frozen in cache
      await this.updateCacheMetadata(game.id, { isFrozen: true });
      
      console.log(`✅ Frozen betting lines for ${game.awayTeam} @ ${game.homeTeam}`);
    } catch (error) {
      console.error(`❌ Failed to freeze betting lines for ${game.awayTeam} @ ${game.homeTeam}:`, error);
    }
  }

  /**
   * Get cached betting lines for a game
   */
  async getCachedBettingLines(gameId: string): Promise<BettingLinesCache | null> {
    try {
      const docRef = doc(db, 'betting_lines_cache', gameId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          ...data,
          fetchedAt: data.fetchedAt?.toDate(),
          gameTime: data.gameTime?.toDate()
        } as BettingLinesCache;
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Error getting cached betting lines for ${gameId}:`, error);
      return null;
    }
  }

  /**
   * Save betting lines to cache
   */
  async saveBettingLines(gameId: string, lines: BettingLinesCache): Promise<void> {
    try {
      const docRef = doc(db, 'betting_lines_cache', gameId);
      const data = {
        ...lines,
        fetchedAt: Timestamp.fromDate(lines.fetchedAt),
        gameTime: Timestamp.fromDate(lines.gameTime)
      };
      
      await setDoc(docRef, data, { merge: true });
    } catch (error) {
      console.error(`❌ Error saving betting lines for ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Update cache metadata
   */
  async updateCacheMetadata(gameId: string, updates: Partial<BettingLinesCache>): Promise<void> {
    try {
      const docRef = doc(db, 'betting_lines_cache', gameId);
      await setDoc(docRef, updates, { merge: true });
    } catch (error) {
      console.error(`❌ Error updating cache metadata for ${gameId}:`, error);
    }
  }

  /**
   * Get betting lines status for a week
   */
  async getBettingLinesStatusForWeek(weekNumber: number): Promise<WeekBettingLinesStatus> {
    try {
      const games = await gamesCacheService.getGamesForWeek(weekNumber);
      const now = new Date();
      
      const gameStatuses: BettingLinesStatus[] = [];
      
      for (const game of games) {
        const cachedLines = await this.getCachedBettingLines(game.id);
        
        // Handle gameTime which might be a Firebase Timestamp or invalid Date
        let hoursUntilGame = 0;
        try {
          if (game.gameTime) {
            const gameDate = game.gameTime instanceof Date ? 
              game.gameTime : 
              new Date(game.gameTime);
            
            if (!isNaN(gameDate.getTime())) {
              hoursUntilGame = (gameDate.getTime() - now.getTime()) / (1000 * 60 * 60);
            }
          }
        } catch (error) {
          console.warn(`⚠️ Invalid gameTime for ${game.awayTeam} @ ${game.homeTeam}:`, game.gameTime);
        }
        
        gameStatuses.push({
          gameId: game.id,
          awayTeam: game.awayTeam,
          homeTeam: game.homeTeam,
          hasLines: !!cachedLines,
          isFrozen: cachedLines?.isFrozen || false,
          needsFetch: !cachedLines && hoursUntilGame > 0,
          source: cachedLines?.source,
          fetchedAt: cachedLines?.fetchedAt,
          hoursUntilGame
        });
      }
      
      const summary = {
        totalGames: gameStatuses.length,
        gamesWithLines: gameStatuses.filter(g => g.hasLines).length,
        gamesFrozen: gameStatuses.filter(g => g.isFrozen).length,
        gamesNeedingFetch: gameStatuses.filter(g => g.needsFetch).length
      };
      
      return {
        week: weekNumber,
        games: gameStatuses,
        summary
      };
    } catch (error) {
      console.error(`❌ Error getting betting lines status for Week ${weekNumber}:`, error);
      throw error;
    }
  }
}

export const bettingLinesCacheService = new BettingLinesCacheService();