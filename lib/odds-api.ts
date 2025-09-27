import { Game, PlayerProp, PlayerStats } from '@/types';
import { getCurrentNFLWeek, getNFLWeekBoundaries } from './utils';

interface OddsApiGame {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers: {
    key: string;
    title: string;
    last_update: string;
    markets: {
      key: string;
      last_update: string;
      outcomes: {
        name: string;
        price: number;
        point?: number;
        description?: string;
      }[];
    }[];
  }[];
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class OddsApiService {
  private baseUrl = 'https://api.the-odds-api.com/v4';
  private apiKey: string;
  private cache = new Map<string, CacheEntry<any>>();
  private CACHE_DURATION = 5 * 60 * 1000; // 5 minutes for upcoming game odds
  private LIVE_GAME_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes for live games (odds don't change)
  private FINAL_GAME_CACHE_DURATION = 60 * 60 * 1000; // 1 hour for final games

  constructor() {
    this.apiKey = process.env.NEXT_PUBLIC_ODDS_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('⚠️ The Odds API key not found. Using mock data.');
    }
  }

  private getCacheKey(endpoint: string, params?: Record<string, string>): string {
    const paramStr = params ? JSON.stringify(params) : '';
    return `${endpoint}:${paramStr}`;
  }

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache<T>(key: string, data: T, duration: number = this.CACHE_DURATION): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + duration,
    });
  }

  async getNFLGames(weekNumber?: number, forceRefresh = false, skipCaching = false): Promise<Game[]> {
    const currentWeek = weekNumber || getCurrentNFLWeek();
    const weekendId = `2025-week-${currentWeek}`;
    
    console.log(`📅 Getting Week ${currentWeek} NFL games with smart caching...`);
    if (forceRefresh) {
      console.log(`🔄 FORCE REFRESH REQUESTED - Clearing cache and fetching fresh data`);
    }
    if (skipCaching) {
      console.log(`⚠️ SKIP CACHING MODE - Will not save to Firebase to prevent circular dependencies`);
    }
    
    // Import services
    const { gameCacheService, finalGameService } = await import('./firebase-service');
    const { espnApi } = await import('./espn-api');
    
    // If force refresh, clear cache first
    if (forceRefresh) {
      console.log(`🧹 FORCE REFRESH: Clearing Firebase cache for ${weekendId}`);
      await gameCacheService.clearCachedGames(weekendId);
    }
    
    // First, check if we have final game results stored in Firebase (for completed weeks)
    console.log(`🔍 Checking for final game results in Firebase for ${weekendId}...`);
    const finalGames = await finalGameService.getFinalGamesForWeek(weekendId);
    
    if (finalGames.length > 0) {
      console.log(`💾 Found ${finalGames.length} final game results in Firebase - using stored data`);
      return finalGames;
    }
    
    // Next, check if we have valid cached data in Firebase
    if (!forceRefresh) {
      const cachedData = await gameCacheService.getCachedGames(weekendId);
      if (cachedData) {
        const { games: cachedGames, cachedAt } = cachedData;
        
        // CRITICAL: If we have less than expected games (16 for Week 2), force refresh
        const expectedMinGames = 14; // At least 14 games per NFL week
        if (cachedGames.length < expectedMinGames) {
          console.log(`⚠️ Cache has only ${cachedGames.length} games, expected at least ${expectedMinGames}. Forcing refresh...`);
          await gameCacheService.clearCachedGames(weekendId);
        } else if (gameCacheService.isCacheValid(cachedAt, cachedGames)) {
          console.log(`💾 Using valid cached data: ${cachedGames.length} games from Firebase`);
          return cachedGames;
        } else {
          console.log(`⏰ Cache expired or invalid, fetching fresh data...`);
        }
      } else {
        console.log(`📋 No cached data found, fetching fresh data...`);
      }
    }
    
    // Get fresh ESPN data
    console.log('📺 Fetching fresh ESPN data...');
    const espnData = await espnApi.getScoreboard(currentWeek);
    
    if (!espnData || !espnData.events || espnData.events.length === 0) {
      console.error('❌ CRITICAL: No ESPN data available');
      throw new Error('No real NFL data available. Cannot display fake data.');
    }
    
    console.log(`📺 Found ${espnData.events.length} games from ESPN`);
    
    // Convert ESPN events to our Game format
    let realGames: Game[];
    try {
      realGames = await this.convertESPNEventsToGames(espnData.events, weekendId);
      console.log(`✅ Successfully converted ${realGames.length} games to internal format`);
    } catch (error) {
      console.error('❌ CRITICAL ERROR in convertESPNEventsToGames:', error);
      throw new Error(`Failed to convert ESPN events to games: ${error}`);
    }
    
    // Enhance with betting lines using strategic caching system
    console.log('💰 Enhancing games with betting lines (strategic caching)...');
    let enhancedGames: Game[];
    try {
      enhancedGames = await this.enhanceGamesWithBettingLinesCache(realGames);
      console.log(`✅ Enhanced ${enhancedGames.filter(g => g.spread !== undefined).length}/${enhancedGames.length} games with betting lines`);
      
      // Fetch player props for games that haven't started yet (not live or final)
      // This preserves the pre-game betting lines and saves API calls
      console.log('🎯 Fetching player props for games that haven\'t started yet...');
      const currentTime = new Date();
      const gamesForProps = enhancedGames.filter(g => {
        // Only fetch for games that haven't started yet
        const gameTime = new Date(g.gameTime || (g as any).date);
        const hasNotStarted = gameTime > currentTime;
        const isNotLiveOrFinal = g.status !== 'live' && g.status !== 'final';
        console.log(`🔍 Game ${g.awayTeam} @ ${g.homeTeam}: gameTime=${gameTime.toISOString()}, hasNotStarted=${hasNotStarted}, status=${g.status}`);
        return hasNotStarted && isNotLiveOrFinal;
      });
      
      console.log(`📊 Found ${gamesForProps.length} games eligible for player props (haven't started yet)`);
      console.log(`⏭️  Skipping ${enhancedGames.length - gamesForProps.length} games (already started/live/final)`);
      
      for (const game of gamesForProps) {
        try {
          console.log(`🎯 Loading player props for ${game.awayTeam} @ ${game.homeTeam} (gameId: ${game.id})`);
          const props = await this.getPlayerProps(game.id, game.status); // This method now uses Firebase cache
          
          if (props.length > 0) {
            game.playerProps = props;
            console.log(`✅ Loaded ${props.length} player props for ${game.awayTeam} @ ${game.homeTeam}`);
          } else {
            console.log(`📭 No player props available for ${game.awayTeam} @ ${game.homeTeam}`);
          }
        } catch (error) {
          console.warn(`⚠️ Failed to fetch player props for ${game.awayTeam} @ ${game.homeTeam}:`, error);
          // Set empty array so the game still works
          game.playerProps = [];
        }
      }
      
    } catch (error) {
      console.warn('⚠️ Failed to enhance games with betting lines, using ESPN data only:', error);
      enhancedGames = realGames;
    }
    
    // CRITICAL: Deduplicate games by ID to ensure max 16 games per week
    const uniqueGames = enhancedGames.reduce((acc: Game[], game: Game) => {
      const existingGame = acc.find(g => g.id === game.id);
      if (!existingGame) {
        acc.push(game);
      } else {
        console.log(`🚫 Duplicate game detected and removed: ${game.awayTeam} @ ${game.homeTeam} (ID: ${game.id})`);
      }
      return acc;
    }, []);
    
    if (uniqueGames.length !== enhancedGames.length) {
      console.log(`🧹 Deduplication: ${enhancedGames.length} → ${uniqueGames.length} games (removed ${enhancedGames.length - uniqueGames.length} duplicates)`);
      enhancedGames = uniqueGames;
    }
    
    // Cache the enhanced games in Firebase for future use (unless skipCaching is true)
    if (!skipCaching) {
      try {
        await gameCacheService.saveGames(weekendId, enhancedGames);
        console.log(`💾 Cached ${enhancedGames.length} enhanced games to Firebase`);
      } catch (error) {
        console.error('❌ Failed to cache enhanced games:', error);
      }
      
      // Store final game results permanently (for completed games)
      try {
        await finalGameService.storeFinalGameResults(enhancedGames);
      } catch (error) {
        console.error('❌ Failed to store final game results:', error);
      }
    } else {
      console.log(`⚠️ Skipping Firebase caching to prevent circular dependencies`);
    }
    
    return enhancedGames;
  }

  /**
   * Enhance ESPN games with betting lines using strategic caching system
   */
  private async enhanceGamesWithBettingLinesCache(espnGames: Game[]): Promise<Game[]> {
    try {
      console.log('🎯 Using strategic betting lines cache system...');
      
      // Import betting lines cache service
      const { bettingLinesCacheService } = await import('./betting-lines-cache');
      
      // Process each game through the strategic cache system
      const enhancedGames = await Promise.all(espnGames.map(async (game) => {
        try {
          // Ensure betting lines are properly cached for this game
          await bettingLinesCacheService.ensureBettingLinesForGame(game);
          
          // Get the cached betting lines
          const cachedLines = await bettingLinesCacheService.getCachedBettingLines(game.id);
          
          if (cachedLines) {
            console.log(`💾 Applied cached betting lines to ${game.awayTeam} @ ${game.homeTeam}`);
            
            // Apply cached betting lines to the game
            return {
              ...game,
              spread: cachedLines.spread,
              spreadOdds: cachedLines.spreadOdds,
              overUnder: cachedLines.overUnder,
              overUnderOdds: cachedLines.overUnderOdds,
              homeMoneyline: cachedLines.homeMoneyline,
              awayMoneyline: cachedLines.awayMoneyline,
            };
          } else {
            console.log(`⚠️ No cached betting lines available for ${game.awayTeam} @ ${game.homeTeam}`);
            return game;
          }
        } catch (error) {
          console.warn(`⚠️ Error processing betting lines cache for ${game.awayTeam} @ ${game.homeTeam}:`, error);
          return game;
        }
      }));
      
      console.log(`✅ Processed ${enhancedGames.length} games through betting lines cache system`);
      return enhancedGames;
      
    } catch (error) {
      console.error('❌ Error in strategic betting lines cache system:', error);
      // Fallback to original method
      return this.enhanceGamesWithOdds(espnGames);
    }
  }

  /**
   * Enhance ESPN games with betting lines from Odds API (supports historical data)
   */
  private async enhanceGamesWithOdds(espnGames: Game[]): Promise<Game[]> {
    try {
      console.log('🎰 Fetching betting lines from Odds API (with historical support)...');
      
      // Categorize games: completed, live/started, and truly upcoming
      const completedGames = espnGames.filter(g => g.status === 'final');
      const liveGames = espnGames.filter(g => g.status === 'live');
      const upcomingGames = espnGames.filter(g => g.status === 'upcoming');
      
      console.log(`📊 Games breakdown: ${completedGames.length} completed, ${liveGames.length} live, ${upcomingGames.length} upcoming`);
      
      const enhancedGames: Game[] = [];
      
      // Handle truly upcoming games with live odds (only these should hit the API)
      if (upcomingGames.length > 0) {
        console.log('🔴 Fetching live odds for upcoming games only (not started/live games)...');
        const liveOddsResponse = await fetch(
          `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds?${new URLSearchParams({
            apiKey: this.apiKey,
            regions: 'us',
            markets: 'spreads,totals,h2h',
            oddsFormat: 'american',
            bookmakers: 'bovada,draftkings,fanduel',
          })}`
        );

        if (liveOddsResponse.ok) {
          const liveOddsData: OddsApiGame[] = await liveOddsResponse.json();
          console.log(`🔴 Found live odds for ${liveOddsData.length} games`);
          
          const enhancedUpcomingGames = await this.matchGamesWithOdds(upcomingGames, liveOddsData, 'live');
          
          // CRITICAL: Freeze odds for games starting within 1 hour
          const { preGameOddsService } = await import('./firebase-service');
          const now = new Date();
          
          for (const game of enhancedUpcomingGames) {
            const hoursUntilGame = (game.gameTime.getTime() - now.getTime()) / (1000 * 60 * 60);
            
            // Freeze odds if game starts within 1 hour and has betting lines
            if (hoursUntilGame <= 1 && hoursUntilGame >= 0 && game.spread !== undefined) {
              console.log(`🧊 Proactively freezing odds for game starting soon: ${game.awayTeam} @ ${game.homeTeam} (starts in ${Math.round(hoursUntilGame * 60)} minutes)`);
              
              await preGameOddsService.freezeOdds(game.id, {
                spread: game.spread,
                spreadOdds: game.spreadOdds,
                overUnder: game.overUnder,
                overUnderOdds: game.overUnderOdds,
                homeMoneyline: game.homeMoneyline,
                awayMoneyline: game.awayMoneyline,
                playerProps: game.playerProps
              });
            }
          }
          
          enhancedGames.push(...enhancedUpcomingGames);
        } else {
          console.warn('⚠️ Failed to fetch live odds, using games without odds');
          enhancedGames.push(...upcomingGames);
        }
      }
      
      // Handle live/started games: CRITICAL - Never overwrite existing betting lines!
      if (liveGames.length > 0) {
        console.log('🔥 CRITICAL: Preserving pre-game odds for live/started games (NEVER update lines after kickoff)...');
        const { gameCacheService, preGameOddsService } = await import('./firebase-service');
        
        for (const game of liveGames) {
          let preservedOdds = false;
          
          // FIRST PRIORITY: Check for frozen pre-game odds snapshot
          try {
            const frozenOdds = await preGameOddsService.getFrozenOdds(game.id);
            if (frozenOdds) {
              console.log(`🧊 Using FROZEN pre-game odds for live game: ${game.awayTeam} @ ${game.homeTeam}`);
              // Use frozen pre-game odds - these should NEVER change after game starts
              game.spread = frozenOdds.spread;
              game.spreadOdds = frozenOdds.spreadOdds;
              game.overUnder = frozenOdds.overUnder;
              game.overUnderOdds = frozenOdds.overUnderOdds;
              game.homeMoneyline = frozenOdds.homeMoneyline;
              game.awayMoneyline = frozenOdds.awayMoneyline;
              game.playerProps = frozenOdds.playerProps || [];
              preservedOdds = true;
            }
          } catch (error) {
            console.warn(`⚠️ Could not get frozen odds for live game ${game.awayTeam} @ ${game.homeTeam}:`, error);
          }
          
          // SECOND PRIORITY: Try to get odds from current week's cache
          if (!preservedOdds) {
            try {
              const weekendId = game.weekendId;
              const cachedData = await gameCacheService.getCachedGames(weekendId);
              
              if (cachedData && cachedData.games) {
                const cachedGame = cachedData.games.find(g => g.id === game.id);
                if (cachedGame && (cachedGame.spread !== undefined || cachedGame.homeMoneyline !== undefined)) {
                  console.log(`💾 Using cached odds for live game: ${game.awayTeam} @ ${game.homeTeam}`);
                  // Copy ALL betting lines from cached game
                  game.spread = cachedGame.spread;
                  game.spreadOdds = cachedGame.spreadOdds;
                  game.overUnder = cachedGame.overUnder;
                  game.overUnderOdds = cachedGame.overUnderOdds;
                  game.homeMoneyline = cachedGame.homeMoneyline;
                  game.awayMoneyline = cachedGame.awayMoneyline;
                  game.playerProps = cachedGame.playerProps || [];
                  
                  // CRITICAL: Create frozen snapshot now to prevent future overwrites
                  await preGameOddsService.freezeOdds(game.id, {
                    spread: game.spread,
                    spreadOdds: game.spreadOdds,
                    overUnder: game.overUnder,
                    overUnderOdds: game.overUnderOdds,
                    homeMoneyline: game.homeMoneyline,
                    awayMoneyline: game.awayMoneyline,
                    playerProps: game.playerProps
                  });
                  
                  preservedOdds = true;
                }
              }
            } catch (error) {
              console.warn(`⚠️ Could not get cached odds for live game ${game.awayTeam} @ ${game.homeTeam}:`, error);
            }
          }
          
          // LAST RESORT: If no odds found anywhere, log critical warning
          if (!preservedOdds) {
            console.error(`🚨 CRITICAL: No pre-game odds found for live game ${game.awayTeam} @ ${game.homeTeam}!`);
            console.error(`   This should never happen - betting lines must be preserved from before kickoff!`);
            // Keep existing odds if any, but don't set defaults that could be misleading
            // Leave as undefined to show "N/A" rather than fake "0" spreads
          }
        }
        
        enhancedGames.push(...liveGames);
      }
      
      // Handle completed games: Use betting lines from user bets instead of external APIs
      if (completedGames.length > 0) {
        console.log('🏁 Using betting lines from user bets for completed games...');
        const { gameCacheService, preGameOddsService } = await import('./firebase-service');
        
        for (const game of completedGames) {
          let preservedOdds = false;
          
          // FIRST PRIORITY: Check for frozen pre-game odds snapshot
          try {
            const frozenOdds = await preGameOddsService.getFrozenOdds(game.id);
            if (frozenOdds) {
              console.log(`🧊 Using FROZEN pre-game odds for completed game: ${game.awayTeam} @ ${game.homeTeam}`);
              // Use frozen pre-game odds - these should NEVER change after game starts
              game.spread = frozenOdds.spread;
              game.spreadOdds = frozenOdds.spreadOdds;
              game.overUnder = frozenOdds.overUnder;
              game.overUnderOdds = frozenOdds.overUnderOdds;
              game.homeMoneyline = frozenOdds.homeMoneyline;
              game.awayMoneyline = frozenOdds.awayMoneyline;
              game.playerProps = frozenOdds.playerProps || [];
              preservedOdds = true;
            }
          } catch (error) {
            console.warn(`⚠️ Could not get frozen odds for completed game ${game.awayTeam} @ ${game.homeTeam}:`, error);
          }
          
          // SECOND PRIORITY: Try to get odds from cache and freeze them
          if (!preservedOdds) {
            try {
              const weekendId = game.weekendId;
              const cachedData = await gameCacheService.getCachedGames(weekendId);
              
              if (cachedData && cachedData.games) {
                const cachedGame = cachedData.games.find(g => g.id === game.id);
                if (cachedGame && (cachedGame.spread !== undefined || cachedGame.homeMoneyline !== undefined)) {
                  console.log(`💾 Using cached odds for completed game: ${game.awayTeam} @ ${game.homeTeam}`);
                  // Copy ALL betting lines from cached game
                  game.spread = cachedGame.spread;
                  game.spreadOdds = cachedGame.spreadOdds;
                  game.overUnder = cachedGame.overUnder;
                  game.overUnderOdds = cachedGame.overUnderOdds;
                  game.homeMoneyline = cachedGame.homeMoneyline;
                  game.awayMoneyline = cachedGame.awayMoneyline;
                  game.playerProps = cachedGame.playerProps || [];
                  
                  // CRITICAL: Create frozen snapshot to prevent future overwrites
                  await preGameOddsService.freezeOdds(game.id, {
                    spread: game.spread,
                    spreadOdds: game.spreadOdds,
                    overUnder: game.overUnder,
                    overUnderOdds: game.overUnderOdds,
                    homeMoneyline: game.homeMoneyline,
                    awayMoneyline: game.awayMoneyline,
                    playerProps: game.playerProps
                  });
                  
                  preservedOdds = true;
                }
              }
            } catch (error) {
              console.warn(`⚠️ Could not get cached odds for completed game ${game.awayTeam} @ ${game.homeTeam}:`, error);
            }
          }
          
          // Note: We'll handle bet odds extraction in the calling function
          // This prevents the critical error logs while still tracking missing odds
          if (!preservedOdds) {
            console.log(`📊 No cached odds found for completed game ${game.awayTeam} @ ${game.homeTeam} - will use bet data if available`);
          }
        }
        
        enhancedGames.push(...completedGames);
      }
      
      console.log(`✅ Enhanced ${enhancedGames.filter(g => g.spread !== undefined).length}/${enhancedGames.length} games with betting lines`);
      return enhancedGames;
    } catch (error) {
      console.error('❌ Error enhancing games with odds:', error);
      throw error;
    }
  }

  /**
   * Group games by date to optimize historical API calls
   */
  private groupGamesByDate(games: Game[]): Record<string, Game[]> {
    return games.reduce((acc, game) => {
      const dateStr = game.gameTime.toISOString().split('T')[0]; // YYYY-MM-DD format
      if (!acc[dateStr]) {
        acc[dateStr] = [];
      }
      acc[dateStr].push(game);
      return acc;
    }, {} as Record<string, Game[]>);
  }

  /**
   * Fetch historical odds for a specific date
   */
  private async fetchHistoricalOdds(dateStr: string): Promise<OddsApiGame[] | null> {
    try {
      console.log(`📜 Fetching historical odds for ${dateStr}...`);
      
      // The Odds API historical endpoint
      const response = await fetch(
        `https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds-history?${new URLSearchParams({
          apiKey: this.apiKey,
          regions: 'us',
          markets: 'spreads,totals,h2h',
          oddsFormat: 'american',
          bookmakers: 'bovada,draftkings,fanduel',
          date: dateStr, // Historical data for this specific date
        })}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          console.log(`📜 No historical odds available for ${dateStr} (404)`);
          return null;
        }
        throw new Error(`Historical odds API failed: ${response.status}`);
      }

      const data: OddsApiGame[] = await response.json();
      console.log(`📜 Successfully fetched ${data.length} historical odds for ${dateStr}`);
      return data;
    } catch (error) {
      console.warn(`⚠️ Failed to fetch historical odds for ${dateStr}:`, error);
      return null;
    }
  }

  /**
   * Match games with odds data and extract betting lines
   */
  private async matchGamesWithOdds(games: Game[], oddsData: OddsApiGame[], type: 'live' | 'historical'): Promise<Game[]> {
    console.log(`🎯 Matching ${games.length} games with ${oddsData.length} ${type} odds...`);
    
    // Import game matching utilities
    const { doGamesMatch, generateGameId, generateReadableGameId } = require('./game-id-generator');
    
    const enhancedGames = await Promise.all(games.map(async espnGame => {
      // Find matching Odds API game using our consistent matching logic
      const matchingOddsGame = oddsData.find(oddsGame => {
        // Check if it's the same game based on teams and date
        return doGamesMatch(
          { 
            gameTime: espnGame.gameTime, 
            awayTeam: espnGame.awayTeam, 
            homeTeam: espnGame.homeTeam 
          },
          { 
            gameTime: oddsGame.commence_time, 
            awayTeam: oddsGame.away_team, 
            homeTeam: oddsGame.home_team 
          }
        );
      });

      if (!matchingOddsGame) {
        console.log(`⚠️ No ${type} odds found for ${espnGame.readableId || espnGame.id}`);
        return espnGame;
      }

      // Regenerate the ID to ensure consistency (in case Odds API has slightly different time)
      const consistentId = generateGameId(espnGame.gameTime, espnGame.awayTeam, espnGame.homeTeam);
      const readableId = generateReadableGameId(espnGame.gameTime, espnGame.awayTeam, espnGame.homeTeam);

      // Extract betting lines from the best bookmaker
      const bookmaker = matchingOddsGame.bookmakers.find(b => 
        ['bovada', 'draftkings', 'fanduel'].includes(b.key)
      ) || matchingOddsGame.bookmakers[0];

      if (!bookmaker) {
        console.log(`⚠️ No bookmaker data for ${readableId}`);
        return espnGame;
      }

      // Extract spread
      const spreadMarket = bookmaker.markets.find(m => m.key === 'spreads');
      const homeSpread = spreadMarket?.outcomes.find(o => o.name === matchingOddsGame.home_team);
      
      // Extract totals
      const totalsMarket = bookmaker.markets.find(m => m.key === 'totals');
      const overTotal = totalsMarket?.outcomes.find(o => o.name === 'Over');
      
      // Extract moneylines
      const h2hMarket = bookmaker.markets.find(m => m.key === 'h2h');
      const homeML = h2hMarket?.outcomes.find(o => o.name === matchingOddsGame.home_team);
      const awayML = h2hMarket?.outcomes.find(o => o.name === matchingOddsGame.away_team);

      console.log(`💰 Enhanced ${readableId} with ${type} odds`);
      
      // Store the mapping between our internal ID and Odds API ID for future use
      const { gameIdMappingService } = await import('./firebase-service');
      try {
        await gameIdMappingService.storeGameIdMapping(consistentId, {
          espnId: espnGame.espnId,
          oddsApiId: matchingOddsGame.id,
          awayTeam: espnGame.awayTeam,
          homeTeam: espnGame.homeTeam,
          gameTime: espnGame.gameTime
        });
      } catch (error) {
        console.warn('⚠️ Failed to store game ID mapping:', error);
        // Don't throw - this is not critical for the main flow
      }
      console.log(`   Spread: ${homeSpread?.point || 'N/A'} | O/U: ${overTotal?.point || 'N/A'}`);

      return {
        ...espnGame,
        id: consistentId, // Ensure consistent ID
        readableId,
        spread: homeSpread?.point,
        spreadOdds: homeSpread?.price || -110,
        overUnder: overTotal?.point,
        overUnderOdds: overTotal?.price || -110,
        homeMoneyline: homeML?.price,
        awayMoneyline: awayML?.price,
      };
    }));
    
    return enhancedGames;
  }

  /**
   * Normalize team names for matching between APIs
   */
  private normalizeTeamName(teamName: string): string {
    return teamName
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/rams|chargers|giants|jets/, (match) => {
        // Handle teams that moved cities or have similar names
        const mapping: Record<string, string> = {
          'rams': 'losangelesrams',
          'chargers': 'losangeleschargers',
          'giants': 'newyorkgiants',
          'jets': 'newyorkjets'
        };
        return mapping[match] || match;
      });
  }

  /**
   * Converts real ESPN events to our internal Game format - NO HARDCODED DATA
   */
  private async convertESPNEventsToGames(espnEvents: any[], weekendId: string): Promise<Game[]> {
    console.log('🔄 Converting ESPN events to Game format - REAL DATA ONLY');
    console.log(`📊 CONVERSION SUMMARY: Processing ${espnEvents.length} ESPN events`);
    
    // Import game ID generator and ESPN API
    const { generateGameId, generateReadableGameId } = require('./game-id-generator');
    const { espnApi } = await import('./espn-api');
    
    const convertedGames = await Promise.all(espnEvents.map(async (event, index) => {
      const competition = event.competitions[0];
      const homeCompetitor = competition.competitors.find((c: any) => c.homeAway === 'home');
      const awayCompetitor = competition.competitors.find((c: any) => c.homeAway === 'away');
      
      if (!homeCompetitor || !awayCompetitor) {
        console.error(`❌ Invalid ESPN event structure for event ${event.id}`);
        throw new Error(`Invalid ESPN event data - missing competitors`);
      }
      
      // Determine game status from ESPN
      let gameStatus: Game['status'] = 'upcoming';
      if (competition.status.type.completed) {
        gameStatus = 'final';
      } else if (competition.status.type.state === 'in') {
        gameStatus = 'live';
      }
      
      // Get real scores from ESPN (or 0 if not available)
      const homeScore = homeCompetitor.score ? parseInt(homeCompetitor.score) : 0;
      const awayScore = awayCompetitor.score ? parseInt(awayCompetitor.score) : 0;
      
      // Extract live game situation data from ESPN
      let quarter: number | undefined;
      let timeRemaining: string | undefined;
      let possession: string | undefined;
      
      if (gameStatus === 'live') {
        quarter = competition.status.period || undefined;
        timeRemaining = competition.status.displayClock || undefined;
        // ESPN doesn't always provide possession in scoreboard API
        possession = undefined;
      }
      
      // Determine time slot based on actual game time
      let gameTime: Date;
      try {
        gameTime = new Date(event.date);
        if (isNaN(gameTime.getTime())) {
          console.error(`❌ Invalid date from ESPN: ${event.date} for ${awayCompetitor?.team?.displayName} @ ${homeCompetitor?.team?.displayName}`);
          // Return null to filter out this game
          return null;
        }
      } catch (error) {
        console.error(`❌ Failed to parse date: ${event.date}`, error);
        return null;
      }
      const timeSlot = this.getTimeSlot(gameTime);
      
      // Generate consistent game ID
      const homeTeam = homeCompetitor.team.displayName;
      const awayTeam = awayCompetitor.team.displayName;
      const gameId = generateGameId(gameTime, awayTeam, homeTeam);
      const readableId = generateReadableGameId(gameTime, awayTeam, homeTeam);
      
      // Extract week metadata
      const weekNumber = event.week?.number || parseInt(weekendId.split('-')[2]);
      const seasonYear = event.season?.year || 2025;
      const weekMetadata = `Week ${weekNumber}, ${seasonYear}`;
      
      console.log(`✅ CONVERTING GAME ${index + 1}/${espnEvents.length}:`);
      console.log(`   🏈 ${awayTeam} @ ${homeTeam}`);
      console.log(`   🏟️ Status: ${gameStatus} | Score: ${awayScore}-${homeScore}`);
      console.log(`   📅 Raw Date: ${event.date}`);
      console.log(`   🕐 Parsed Time: ${gameTime.toISOString()}`);
      console.log(`   🎰 Time Slot: ${timeSlot}`);
      console.log(`   🆔 Consistent ID: ${gameId} (${readableId})`);
      console.log(`   📆 ${weekMetadata}`);
      
      // Additional debug for time slot issues
      const dayOfWeek = gameTime.getDay();
      const hours = gameTime.getHours();
      const localTimeString = gameTime.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
      console.log(`   🐛 DEBUG: UTC Day ${dayOfWeek} Hour ${hours}, Eastern: ${localTimeString}`);
      
      // Fetch player stats for completed games
      let playerStats: PlayerStats[] = [];
      if (gameStatus === 'final') {
        console.log(`📊 Fetching player stats for completed game ${event.id}...`);
        const stats = await espnApi.getGameStats(event.id);
        if (stats) {
          // Convert stats object to array
          playerStats = Object.values(stats).map((stat: any) => ({
            playerId: stat.playerId,
            playerName: stat.playerName,
            team: stat.team,
            passingYards: stat.passingYards,
            passingTDs: stat.passingTDs,
            completions: stat.completions,
            attempts: stat.attempts,
            rushingYards: stat.rushingYards,
            rushingTDs: stat.rushingTDs,
            carries: stat.carries,
            receivingYards: stat.receivingYards,
            receivingTDs: stat.receivingTDs,
            receptions: stat.receptions,
          }));
          console.log(`✅ Got stats for ${playerStats.length} players`);
        }
      }
      
      // Store ESPN game ID mapping for future reference
      const { gameIdMappingService } = await import('./firebase-service');
      try {
        await gameIdMappingService.storeGameIdMapping(gameId, {
          espnId: event.id,
          awayTeam,
          homeTeam,
          gameTime
        });
      } catch (error) {
        console.warn('⚠️ Failed to store ESPN game ID mapping:', error);
        // Don't throw - this is not critical for the main flow
      }
      
      const game: Game = {
        id: gameId, // Use our consistent ID generator
        espnId: event.id, // Keep ESPN ID for reference
        readableId, // Human-readable version
        weekMetadata, // "Week 2, 2025"
        weekendId,
        homeTeam,
        awayTeam,
        gameTime,
        timeSlot,
        status: gameStatus,
        homeScore,
        awayScore,
        // Live game situation data
        quarter,
        timeRemaining,
        possession,
        // Note: ESPN doesn't provide betting lines, so these are undefined
        spread: undefined,
        spreadOdds: undefined,
        overUnder: undefined, 
        overUnderOdds: undefined,
        homeMoneyline: undefined,
        awayMoneyline: undefined,
        playerProps: [],
        playerStats // Add player statistics
      };
      
      return game;
    }));
    
    // Filter out null values (games with invalid dates)
    const validGames = convertedGames.filter((game): game is Game => game !== null);
    
    console.log(`🎯 CONVERSION COMPLETE: Successfully converted ${validGames.length}/${convertedGames.length} games (filtered out ${convertedGames.length - validGames.length} games with invalid dates)`);
    console.log('📋 TIME SLOT BREAKDOWN:');
    const timeSlotCounts = validGames.reduce((acc, game) => {
      acc[game.timeSlot] = (acc[game.timeSlot] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    Object.entries(timeSlotCounts).forEach(([slot, count]) => {
      console.log(`   ${slot}: ${count} games`);
    });
    
    return validGames;
  }

  /**
   * Determines if we should refresh odds data from API based on game timing
   */
  private shouldRefreshOddsFromAPI(games: Game[], cachedAt: Date): boolean {
    const now = new Date();
    const cacheAgeMinutes = (now.getTime() - cachedAt.getTime()) / (1000 * 60);
    
    // Never refresh if cache is less than 30 minutes old
    if (cacheAgeMinutes < 30) {
      return false;
    }
    
    // Check if any games are starting soon or live
    const hasUpcomingGames = games.some(game => {
      const gameTime = new Date(game.gameTime);
      const hoursUntilGame = (gameTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      
      // Don't refresh if game has started (we use ESPN for live updates)
      if (game.status === 'live' || game.status === 'final') {
        return false;
      }
      
      // Refresh if game starts within 2 hours
      return hoursUntilGame <= 2 && hoursUntilGame > 0;
    });
    
    if (hasUpcomingGames) {
      console.log('🎯 Games starting within 2 hours - will refresh odds');
      return true;
    }
    
    // For games more than 2 hours away, refresh once per day max
    const hoursOld = cacheAgeMinutes / 60;
    if (hoursOld >= 24) {
      console.log('📅 Cache is 24+ hours old - will refresh for daily update');
      return true;
    }
    
    console.log(`⏰ Cache is ${Math.round(cacheAgeMinutes)} minutes old - no refresh needed`);
    return false;
  }

  async getPlayerProps(gameId: string, gameStatus?: string): Promise<PlayerProp[]> {
    console.log(`🎯 getPlayerProps called for gameId: ${gameId}, API key exists: ${!!this.apiKey}`);
    
    // Import Firebase services
    const { playerPropsService, gameIdMappingService } = await import('./firebase-service');
    
    // First, check Firebase cache for player props
    console.log(`🔍 Checking Firebase cache for player props for game ${gameId}...`);
    const cachedData = await playerPropsService.getCachedPlayerProps(gameId);
    
    if (cachedData) {
      const { props, cachedAt } = cachedData;
      
      // Smart caching policy for player props:
      // - Cache permanently for completed games
      // - For upcoming games, use strategic refresh windows
      if (gameStatus === 'final' || gameStatus === 'live') {
        console.log(`💾 Using permanently cached player props for ${gameStatus} game: ${props.length} props`);
        return props;
      }
      
      // For upcoming games, determine if we need a refresh based on game timing
      const shouldRefresh = this.shouldRefreshPlayerProps(cachedAt, gameId);
      if (!shouldRefresh) {
        console.log(`💾 Using valid cached player props (strategic timing): ${props.length} props from Firebase`);
        return props;
      } else {
        console.log(`🔄 Strategic refresh needed for player props...`);
      }
    } else {
      console.log(`📋 No cached player props found, fetching fresh data...`);
    }

    // Check in-memory cache as fallback
    const cacheKey = this.getCacheKey('player-props', { gameId });
    const memoryCache = this.getFromCache<PlayerProp[]>(cacheKey);
    
    if (memoryCache) {
      console.log('📦 Returning in-memory cached player props');
      return memoryCache;
    }

    if (!this.apiKey) {
      console.error('❌ CRITICAL: No Odds API key found! Cannot fetch player props without API key.');
      throw new Error('Odds API key is required to fetch player props');
    }

    // Get the Odds API ID from our game ID mapping
    console.log(`🆔 Looking up Odds API ID for internal game ID: ${gameId}`);
    const oddsApiId = await gameIdMappingService.getOddsApiId(gameId);
    
    if (!oddsApiId) {
      console.error(`❌ No Odds API ID found for internal game ID: ${gameId}`);
      console.log(`💡 This means the game wasn't matched during odds enhancement. Player props unavailable.`);
      return [];
    }

    try {
      console.log(`🌐 Fetching fresh player props from Odds API for game ${oddsApiId} (internal: ${gameId})...`);
      const response = await fetch(
        `${this.baseUrl}/sports/americanfootball_nfl/events/${oddsApiId}/odds?` +
        new URLSearchParams({
          apiKey: this.apiKey,
          regions: 'us',
          markets: 'player_pass_yds,player_rush_yds,player_reception_yds',
          oddsFormat: 'american',
          bookmakers: 'bovada,draftkings,fanduel,betmgm,caesars,pointsbet',
        })
      );

      if (!response.ok) {
        if (response.status === 422) {
          console.warn(`⚠️ Player props not available for this game from Odds API (game ${oddsApiId})`);
          return []; // Return empty array instead of mock data
        }
        throw new Error(`Odds API error: ${response.status}`);
      }

      const data: OddsApiGame = await response.json();
      const props = this.extractPlayerProps(data);
      
      console.log(`✅ Fetched ${props.length} player props from Odds API for game ${oddsApiId}`);
      
      // Cache the results in both memory and Firebase using our internal game ID
      this.setCache(cacheKey, props);
      
      // Cache in Firebase for persistent storage
      try {
        await playerPropsService.cachePlayerProps(gameId, props);
      } catch (error) {
        console.error('❌ Failed to cache player props in Firebase:', error);
        // Don't throw - we still have the props from API
      }
      
      return props;
    } catch (error) {
      console.error('❌ Failed to fetch player props from Odds API:', error);
      return []; // Return empty array instead of mock data
    }
  }

  private filterGamesByWeek(apiGames: OddsApiGame[], weekNumber: number): Game[] {
    const { start, end } = getNFLWeekBoundaries(weekNumber, 2025);
    console.log(`🗓️ Filtering games for Week ${weekNumber} (2025 season): ${start.toISOString()} - ${end.toISOString()}`);
    
    const filteredGames = apiGames.filter(game => {
      const gameTime = new Date(game.commence_time);
      // Include games that fall within the week boundary, regardless of completion status
      const isInWeek = gameTime >= start && gameTime <= end;
      
      if (isInWeek) {
        console.log(`✅ Game included: ${game.away_team} @ ${game.home_team} on ${gameTime.toISOString()} (${gameTime.toDateString()})`);
      } else {
        console.log(`❌ Game excluded: ${game.away_team} @ ${game.home_team} on ${gameTime.toISOString()} (${gameTime.toDateString()})`);
      }
      
      return isInWeek;
    });
    
    console.log(`📊 Total games found for Week ${weekNumber}: ${filteredGames.length}`);
    return filteredGames.map(game => this.transformApiGame(game, weekNumber));
  }

  private transformApiGame(apiGame: OddsApiGame, weekNumber?: number): Game {
    // Find best bookmaker - prefer Bovada, then other major books
    const bookmaker = apiGame.bookmakers.find(b => 
      ['bovada', 'draftkings', 'fanduel', 'betmgm'].includes(b.key)
    ) || apiGame.bookmakers[0];

    if (!bookmaker) {
      throw new Error('No bookmaker data found');
    }

    // Extract markets
    const spreads = bookmaker.markets.find(m => m.key === 'spreads');
    const totals = bookmaker.markets.find(m => m.key === 'totals');
    const moneyline = bookmaker.markets.find(m => m.key === 'h2h');

    // Get betting lines
    const homeSpread = spreads?.outcomes.find(o => o.name === apiGame.home_team);
    const overTotal = totals?.outcomes.find(o => o.name === 'Over');
    const homeML = moneyline?.outcomes.find(o => o.name === apiGame.home_team);
    const awayML = moneyline?.outcomes.find(o => o.name === apiGame.away_team);

    // Determine time slot
    const gameTime = new Date(apiGame.commence_time);
    const timeSlot = this.getTimeSlot(gameTime);

    return {
      id: apiGame.id,
      weekendId: `2025-week-${weekNumber || getCurrentNFLWeek()}`,
      homeTeam: apiGame.home_team,
      awayTeam: apiGame.away_team,
      gameTime,
      timeSlot,
      status: 'upcoming',
      spread: homeSpread?.point,
      spreadOdds: homeSpread?.price || -110,
      overUnder: overTotal?.point,
      overUnderOdds: overTotal?.price || -110,
      homeMoneyline: homeML?.price,
      awayMoneyline: awayML?.price,
    };
  }

  private getTimeSlot(gameTime: Date): Game['timeSlot'] {
    // Create proper timezone-aware dates using Intl.DateTimeFormat
    const easternTimeOptions: Intl.DateTimeFormatOptions = { 
      timeZone: "America/New_York", 
      year: "numeric", month: "2-digit", day: "2-digit", 
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false 
    };
    const pacificTimeOptions: Intl.DateTimeFormatOptions = { 
      timeZone: "America/Los_Angeles", 
      year: "numeric", month: "2-digit", day: "2-digit", 
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false 
    };
    
    // Get timezone-aware components
    const easternParts = new Intl.DateTimeFormat('en-CA', easternTimeOptions).formatToParts(gameTime);
    const pacificParts = new Intl.DateTimeFormat('en-CA', pacificTimeOptions).formatToParts(gameTime);
    
    // Extract values
    const easternHour = parseInt(easternParts.find(p => p.type === 'hour')?.value || '0');
    const easternDay = new Date(`${easternParts.find(p => p.type === 'year')?.value}-${easternParts.find(p => p.type === 'month')?.value}-${easternParts.find(p => p.type === 'day')?.value}`).getDay();
    const pacificHour = parseInt(pacificParts.find(p => p.type === 'hour')?.value || '0');
    
    console.log(`🕐 Time slot calculation for ${gameTime.toISOString()}:`);
    console.log(`   UTC: ${gameTime.toISOString()}`);
    console.log(`   ET: Day ${easternDay}, Hour ${easternHour}`);
    console.log(`   PT: Hour ${pacificHour}`);
    console.log(`   Day names: ${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][easternDay]}`);
    console.log(`🔥 CRITICAL DEBUG: Time slot function IS BEING CALLED for game time ${gameTime.toISOString()}`);

    if (easternDay === 4) { // Thursday
      console.log('📅 Classified as: Thursday Night');
      return 'thursday';
    }
    if (easternDay === 1) { // Monday
      console.log('📅 Classified as: Monday Night');
      return 'monday';
    }
    if (easternDay === 0) { // Sunday
      // Use Pacific time for Sunday game categorization
      if (pacificHour < 12) { // Before noon PT
        console.log('📅 Classified as: Sunday Morning (before noon PT)');
        return 'sunday_early';
      }
      if (pacificHour < 15) { // Noon to 3pm PT
        console.log('📅 Classified as: Sunday Afternoon (noon-3pm PT)');
        return 'sunday_afternoon';
      }
      console.log('📅 Classified as: Sunday Night (3pm+ PT / SNF)');
      return 'sunday_night';        // 3pm+ PT (SNF)
    }
    if (easternDay === 6) { // Saturday
      console.log('📅 Classified as: Saturday (putting in Sunday Early)');
      return 'sunday_early'; // Saturday games go in early slot
    }
    
    // For any other day (Tuesday, Wednesday, Friday), put in early slot
    console.log(`📅 Classified as: Other day (${easternDay}) - putting in Sunday Early`);
    return 'sunday_early';
  }

  private extractPlayerProps(game: OddsApiGame): PlayerProp[] {
    const props: PlayerProp[] = [];
    
    // Use Bovada only - prefer consistency over completeness
    const preferredBookmaker = game.bookmakers.find(b => b.key === 'bovada');
    
    if (!preferredBookmaker) {
      console.log('⚠️ Bovada not found for player props');
      return props;
    }
    
    console.log(`🎯 Using Bovada for player props`);
    
    preferredBookmaker.markets.forEach(market => {
      if (market.key.startsWith('player_')) {
        const propType = this.mapPropType(market.key);
        if (!propType) return;

        // Group outcomes by player name to avoid duplicates
        const playerOutcomes = new Map<string, any[]>();
        
        market.outcomes.forEach(outcome => {
          if (outcome.description) {
            if (!playerOutcomes.has(outcome.description)) {
              playerOutcomes.set(outcome.description, []);
            }
            playerOutcomes.get(outcome.description)!.push(outcome);
          }
        });

        // Process each player's outcomes
        playerOutcomes.forEach((outcomes, playerName) => {
          // Look for over/under pairs
          const overOutcome = outcomes.find(o => o.name === 'Over');
          const underOutcome = outcomes.find(o => o.name === 'Under');
          
          if (overOutcome && underOutcome && overOutcome.point) {
            props.push({
              playerId: `${playerName.replace(/\s+/g, '-').toLowerCase()}-${propType}-${overOutcome.point}`,
              playerName,
              propType,
              line: overOutcome.point,
              overOdds: overOutcome.price,
              underOdds: underOutcome.price,
            });
          }
        });
      }
    });

    console.log(`📊 Extracted ${props.length} unique player props from ${preferredBookmaker.key}`);
    return props;
  }

  private mapPropType(marketKey: string): PlayerProp['propType'] | null {
    const mapping: Record<string, PlayerProp['propType']> = {
      'player_pass_yds': 'passing_yards',
      'player_rush_yds': 'rushing_yards',
      'player_reception_yds': 'receiving_yards',
    };
    return mapping[marketKey] || null;
  }

  /**
   * Determine if player props should be refreshed based on strategic timing
   * - Initial fetch: 2+ days before game (when props first become available)
   * - Final refresh: 2-6 hours before game (for line movements)
   * - Otherwise: use cached data
   */
  private async shouldRefreshPlayerProps(cachedAt: Date, gameId: string): Promise<boolean> {
    try {
      // Get game data to check timing
      const { gamesCacheService } = await import('./games-cache');
      const game = await gamesCacheService.getGameById(gameId);
      
      if (!game || (!game.gameTime && !(game as any).date)) {
        console.log('⚠️ Game not found or no date, allowing refresh');
        return true;
      }
      
      const now = new Date();
      const gameTime = new Date(game.gameTime || (game as any).date);
      const hoursUntilGame = (gameTime.getTime() - now.getTime()) / (1000 * 60 * 60);
      const hoursSinceLastFetch = (now.getTime() - cachedAt.getTime()) / (1000 * 60 * 60);
      
      console.log(`⏰ Game timing: ${hoursUntilGame.toFixed(1)}h until game, ${hoursSinceLastFetch.toFixed(1)}h since last fetch`);
      
      // Game has passed or is very soon - don't refresh
      if (hoursUntilGame <= 1) {
        console.log('🚫 Game starting soon or has started, using cached props');
        return false;
      }
      
      // Strategic refresh windows:
      
      // Window 1: 2-6 hours before game (final refresh for line movements)
      if (hoursUntilGame >= 2 && hoursUntilGame <= 6 && hoursSinceLastFetch >= 1) {
        console.log('🎯 Final refresh window (2-6h before game)');
        return true;
      }
      
      // Window 2: More than 6 hours before game, but props haven't been fetched in 12+ hours
      if (hoursUntilGame > 6 && hoursSinceLastFetch >= 12) {
        console.log('🎯 Initial/early refresh window (6+ hours before game)');
        return true;
      }
      
      // Window 3: Very first fetch (no recent cache)
      if (hoursSinceLastFetch >= 24) {
        console.log('🎯 First time fetch (no recent cache)');
        return true;
      }
      
      console.log('✋ Using cached props - not in refresh window');
      return false;
      
    } catch (error) {
      console.warn('⚠️ Error checking refresh timing, defaulting to refresh:', error);
      return true;
    }
  }








  // Clear cache method for manual refresh
  clearCache(): void {
    this.cache.clear();
    console.log('🧹 Cache cleared');
  }
}

export const oddsApi = new OddsApiService();