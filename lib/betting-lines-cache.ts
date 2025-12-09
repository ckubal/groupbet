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
  private readonly FREQUENT_REFRESH_START = 3; // Start frequent refreshes 3 hours before game
  private readonly FREEZE_THRESHOLD = 0; // Freeze at game start (0 hours = game time)
  
  // Cache refresh intervals (in milliseconds)
  private readonly DAILY_REFRESH_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours = 1x per day
  private readonly FREQUENT_REFRESH_INTERVAL = 30 * 60 * 1000; // 30 minutes

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
      
    } else if (hoursUntilGame <= this.FREQUENT_REFRESH_START) {
      // FREQUENT REFRESH WINDOW: 0-3 hours before game - refresh every 30 minutes
      // (When hoursUntilGame <= 0, game has started and we freeze instead)
      await this.handleFrequentRefreshWindow(game, cachedLines);
      
    } else {
      // DAILY REFRESH WINDOW: More than 3 hours before game - refresh once per day
      await this.handleDailyRefreshWindow(game, cachedLines);
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
   * Handle frequent refresh window (0-3 hours before game) - refresh every 30 minutes
   */
  private async handleFrequentRefreshWindow(game: Game, cachedLines: BettingLinesCache | null): Promise<void> {
    const now = Date.now();
    const shouldRefresh = !cachedLines || 
      (now - cachedLines.fetchedAt.getTime()) >= this.FREQUENT_REFRESH_INTERVAL;
    
    if (shouldRefresh) {
      const hoursUntilGame = (game.gameTime.getTime() - now) / (1000 * 60 * 60);
      console.log(`🔄 Frequent refresh window (${hoursUntilGame.toFixed(1)}h until game): Refreshing betting lines for ${game.awayTeam} @ ${game.homeTeam}`);
      await this.fetchAndCacheBettingLines(game, { isInitialFetch: false, isFinalRefresh: true });
    } else {
      const minutesSinceFetch = Math.round((now - cachedLines.fetchedAt.getTime()) / (60 * 1000));
      const nextRefreshIn = Math.round((this.FREQUENT_REFRESH_INTERVAL - (now - cachedLines.fetchedAt.getTime())) / (60 * 1000));
      console.log(`✅ Lines refreshed ${minutesSinceFetch} minutes ago for ${game.awayTeam} @ ${game.homeTeam} (next refresh in ${nextRefreshIn} min)`);
    }
  }

  /**
   * Handle daily refresh window (more than 3 hours before game) - refresh once per day
   */
  private async handleDailyRefreshWindow(game: Game, cachedLines: BettingLinesCache | null): Promise<void> {
    const now = Date.now();
    const shouldRefresh = !cachedLines || 
      (now - cachedLines.fetchedAt.getTime()) >= this.DAILY_REFRESH_INTERVAL;
    
    if (shouldRefresh) {
      const hoursUntilGame = (game.gameTime.getTime() - now) / (1000 * 60 * 60);
      console.log(`📅 Daily refresh window (${hoursUntilGame.toFixed(1)}h until game): Refreshing betting lines for ${game.awayTeam} @ ${game.homeTeam}`);
      await this.fetchAndCacheBettingLines(game, { isInitialFetch: !cachedLines, isFinalRefresh: false });
    } else {
      const hoursSinceFetch = Math.round((now - cachedLines.fetchedAt.getTime()) / (60 * 60 * 1000));
      const nextRefreshIn = Math.round((this.DAILY_REFRESH_INTERVAL - (now - cachedLines.fetchedAt.getTime())) / (60 * 60 * 1000));
      console.log(`✅ Lines refreshed ${hoursSinceFetch} hours ago for ${game.awayTeam} @ ${game.homeTeam} (next refresh in ${nextRefreshIn} hours)`);
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
        
        const matches = doGamesMatch(
          { 
            gameTime: game.gameTime, 
            awayTeam: game.awayTeam, 
            homeTeam: game.homeTeam 
          },
          { 
            gameTime: oddsGame.commence_time, 
            awayTeam: oddsGame.away_team, 
            homeTeam: oddsGame.home_team 
          },
          true // Use strict time checking
        );
        
        if (matches) {
          console.log(`✅ Matched ${game.awayTeam} @ ${game.homeTeam} with Odds API game: ${oddsGame.away_team} @ ${oddsGame.home_team}`);
        }
        
        return matches;
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
      const availableBookmakers = matchingOddsGame.bookmakers.map((b: any) => b.key);
      const bookmaker = matchingOddsGame.bookmakers.find((b: any) => 
        ['bovada', 'draftkings', 'fanduel'].includes(b.key)
      ) || matchingOddsGame.bookmakers[0];

      if (!bookmaker) {
        throw new Error('No bookmaker data found in Odds API response');
      }
      
      // Log which bookmaker was selected
      const isBovada = bookmaker.key === 'bovada';
      if (!isBovada) {
        console.warn(`⚠️ Bovada not available for ${game.awayTeam} @ ${game.homeTeam}, using ${bookmaker.key} instead. Available: ${availableBookmakers.join(', ')}`);
      } else {
        console.log(`✅ Using Bovada odds for ${game.awayTeam} @ ${game.homeTeam}`);
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
      
      // VALIDATION: Log what we're caching to verify it matches the game
      console.log(`💾 Caching betting lines for ${game.awayTeam} @ ${game.homeTeam}:`, {
        gameId: game.id,
        gameTime: game.gameTime instanceof Date ? game.gameTime.toISOString() : game.gameTime,
        bookmaker: bookmaker.key,
        spread: homeSpread?.point,
        overUnder: overTotal?.point,
        homeMoneyline: homeML?.price,
        awayMoneyline: awayML?.price,
        matchedOddsGame: `${matchingOddsGame.away_team} @ ${matchingOddsGame.home_team} at ${matchingOddsGame.commence_time}`
      });
      
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
      
      // CRITICAL: Remove undefined values to prevent Firebase errors
      Object.keys(data).forEach(key => {
        if (data[key as keyof typeof data] === undefined) {
          delete data[key as keyof typeof data];
        }
      });
      
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
      
      // CRITICAL: Remove undefined values to prevent Firebase errors
      const cleanedUpdates = { ...updates };
      Object.keys(cleanedUpdates).forEach(key => {
        if (cleanedUpdates[key as keyof typeof cleanedUpdates] === undefined) {
          delete cleanedUpdates[key as keyof typeof cleanedUpdates];
        }
      });
      
      await setDoc(docRef, cleanedUpdates, { merge: true });
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