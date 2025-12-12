import { collection, doc, getDocs, getDoc, setDoc, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getAdminDb } from '@/lib/firebase-admin';
import { oddsApi } from '@/lib/odds-api';
import { cleanFirebaseData } from '@/lib/firebase-utils';
import { Game } from '@/types';

export class GamesCacheService {
  
  async getGamesForWeek(week: number, forceRefresh = false): Promise<Game[]> {
    console.log(`🎯 GamesCacheService: Getting Week ${week} games (forceRefresh: ${forceRefresh})`);
    
    try {
      // Check Firebase cache first (unless force refresh)
      if (!forceRefresh) {
        console.log(`🔍 Checking Firebase cache for Week ${week} games...`);
        const cachedGames = await this.getGamesFromFirebase(week);
        
        if (cachedGames.length > 0) {
          console.log(`✅ Found ${cachedGames.length} games in Firebase cache for Week ${week}`);
          return cachedGames;
        } else {
          console.log(`📭 No games found in Firebase cache for Week ${week}`);
        }
      }
      
      // Get from Odds API with skipCaching to prevent circular dependencies
      console.log(`📡 Fetching Week ${week} games from Odds API...`);
      try {
        const apiGames = await oddsApi.getNFLGames(week, forceRefresh, true);
        
        if (apiGames.length > 0) {
          console.log(`✅ Got ${apiGames.length} games from Odds API`);
          
          // Enhance games with betting lines (even if they come from API)
          const enhancedApiGames = await this.enhanceGamesWithBettingLines(apiGames);
          
          // Cache the games for future use (unless force refresh)
          if (!forceRefresh) {
            // Simple cache without merge logic
            await this.simpleCacheGames(enhancedApiGames);
          }
          
          return enhancedApiGames;
        } else {
          console.warn(`⚠️ Odds API returned 0 games for Week ${week}`);
          // Try to return cached games as fallback even if they're stale
          if (!forceRefresh) {
            const staleCachedGames = await this.getGamesFromFirebase(week);
            if (staleCachedGames.length > 0) {
              console.log(`📦 Returning ${staleCachedGames.length} stale cached games as fallback`);
              // getGamesFromFirebase already enhances with betting lines, so we can return directly
              return staleCachedGames;
            }
          }
        }
      } catch (apiError) {
        console.error(`❌ Error fetching from Odds API:`, apiError);
        // Try to return cached games as fallback
        if (!forceRefresh) {
          const fallbackGames = await this.getGamesFromFirebase(week);
          if (fallbackGames.length > 0) {
            console.log(`📦 Returning ${fallbackGames.length} cached games as fallback after API error`);
            // getGamesFromFirebase already enhances with betting lines, so we can return directly
            return fallbackGames;
          }
        }
        throw apiError; // Re-throw if no fallback available
      }
      
      return [];
    } catch (error) {
      console.error('❌ Error in getGamesForWeek:', error);
      console.error('❌ Error details:', error instanceof Error ? error.message : String(error));
      return [];
    }
  }
  
  private mergeGamesWithPlayerProps(apiGames: Game[], cachedGames: Game[]): Game[] {
    console.log(`🔄 Merging ${apiGames.length} API games with ${cachedGames.length} cached games`);
    
    // Start with API games as the source of truth
    const merged = [...apiGames];
    const matchedCachedGameIds = new Set<string>();
    
    // For each cached game, find matching API game and merge data
    cachedGames.forEach(cachedGame => {
      const apiGameIndex = merged.findIndex(apiGame => 
        this.gamesMatch(apiGame, cachedGame)
      );
      
      if (apiGameIndex >= 0) {
        // Found matching API game - merge cached data into it
        console.log(`🔄 Merging cached data into ${cachedGame.awayTeam} @ ${cachedGame.homeTeam}`);
        
        merged[apiGameIndex] = {
          ...merged[apiGameIndex],
          // Preserve player props from cache
          playerProps: cachedGame.playerProps || [],
          // Preserve any other cached data that might be useful
          ...((cachedGame as any).cachedAt && { cachedAt: (cachedGame as any).cachedAt }),
          ...((cachedGame as any).playerPropsUpdatedAt && { playerPropsUpdatedAt: (cachedGame as any).playerPropsUpdatedAt }),
          // Keep updated timeSlot from time slot fixes (prefer cached if it was fixed)
          timeSlot: (cachedGame as any).timeSlotFixed ? cachedGame.timeSlot : (merged[apiGameIndex].timeSlot || cachedGame.timeSlot)
        };
        
        matchedCachedGameIds.add(cachedGame.id);
      } else {
        // No matching API game found - this cached game might be stale or from a different week
        console.log(`⚠️ Cached game not found in API: ${cachedGame.awayTeam} @ ${cachedGame.homeTeam}`);
      }
    });
    
    console.log(`✅ Merge complete: ${apiGames.length} API games + ${cachedGames.length} cached games → ${merged.length} final games`);
    return merged;
  }
  
  private gamesMatch(game1: Game, game2: Game): boolean {
    return Boolean(
      (game1.awayTeam === game2.awayTeam && 
       game1.homeTeam === game2.homeTeam &&
       game1.weekendId === game2.weekendId) ||
      game1.id === game2.id ||
      (game1.espnId && game1.espnId === game2.espnId) ||
      (game1.readableId && game1.readableId === game2.readableId)
    );
  }

  private generateConsistentGameId(game: Game): string {
    try {
      // Create a consistent ID based on teams and week to prevent duplicates
      // This ensures same game always gets same Firebase document ID regardless of source
      
      // Validate required fields
      if (!game.awayTeam || !game.homeTeam) {
        console.warn(`⚠️ Game missing team names:`, game);
        return game.id || `fallback-${Date.now()}`;
      }
      
      const normalizeTeam = (team: string) => team.replace(/[^a-zA-Z]/g, '').toLowerCase();
      const awayTeam = normalizeTeam(game.awayTeam);
      const homeTeam = normalizeTeam(game.homeTeam);
      
      // Use weekendId if available, otherwise extract from date
      let week = game.weekendId;
      if (!week && (game.gameTime || (game as any).date)) {
        const gameDate = new Date(game.gameTime || (game as any).date);
        if (!isNaN(gameDate.getTime())) {
          // Extract week from date (simplified approach)
          const startOfSeason = new Date('2025-09-01'); // Approximate start of NFL season
          const weekNumber = Math.ceil((gameDate.getTime() - startOfSeason.getTime()) / (7 * 24 * 60 * 60 * 1000));
          week = `2025-week-${Math.max(1, Math.min(18, weekNumber))}`;
        } else {
          week = '2025-week-unknown';
        }
      } else if (!week) {
        week = '2025-week-unknown';
      }
      
      // Generate simple hash-like ID based on game details
      const gameString = `${awayTeam}-${homeTeam}-${week}`;
      let hash = 0;
      
      // Simple hash function with safeguards
      for (let i = 0; i < Math.min(gameString.length, 100); i++) { // Limit to prevent infinite loops
        const char = gameString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
      }
      
      // Convert to positive hex string and pad to ensure consistent length
      const hashStr = Math.abs(hash).toString(16).padStart(8, '0');
      const consistentId = `${awayTeam.substring(0, 3)}${homeTeam.substring(0, 3)}${hashStr}`;
      
      console.log(`🔑 Generated consistent ID for ${game.awayTeam} @ ${game.homeTeam}: ${consistentId}`);
      return consistentId;
      
    } catch (error) {
      console.error(`❌ Error generating consistent ID for game:`, error, game);
      return game.id || `error-${Date.now()}`;
    }
  }
  
  private async getGamesFromFirebase(week: number): Promise<Game[]> {
    try {
      // Use Admin SDK for server-side operations to bypass security rules
      const adminDbInstance = await getAdminDb();
      
      // Check if it's Admin SDK (has .collection method) or client SDK
      if (adminDbInstance && typeof adminDbInstance.collection === 'function') {
        // Admin SDK
        const gamesQuery = adminDbInstance.collection('games')
          .where('weekendId', '==', `2025-week-${week}`);
        
        const snapshot = await gamesQuery.get();
        const games: Game[] = [];
        
        snapshot.forEach((doc: any) => {
          const gameData = doc.data() as Game;
          // Convert Firebase Timestamps to JavaScript Dates
          const convertedGameData = {
            ...gameData,
            id: doc.id,
            gameTime: (gameData as any).gameTime?.toDate ? (gameData as any).gameTime.toDate() : 
                     (gameData.gameTime instanceof Date ? gameData.gameTime : new Date(gameData.gameTime)),
            // Convert any other timestamp fields that might exist
            ...(((gameData as any).cachedAt?.toDate) && { cachedAt: (gameData as any).cachedAt.toDate() }),
            ...(((gameData as any).playerPropsUpdatedAt?.toDate) && { playerPropsUpdatedAt: (gameData as any).playerPropsUpdatedAt.toDate() })
          };
          games.push(convertedGameData);
        });
        
        // Enhance games with betting lines from cache
        return await this.enhanceGamesWithBettingLines(games);
      } else {
        // Fallback to client SDK
        const gamesQuery = query(
          collection(db, 'games'),
          where('weekendId', '==', `2025-week-${week}`)
        );
        
        const snapshot = await getDocs(gamesQuery);
        const games: Game[] = [];
        
        snapshot.forEach((doc: any) => {
          const gameData = doc.data() as Game;
          // Convert Firebase Timestamps to JavaScript Dates
          const convertedGameData = {
            ...gameData,
            id: doc.id,
            gameTime: (gameData as any).gameTime?.toDate ? (gameData as any).gameTime.toDate() : gameData.gameTime,
            // Convert any other timestamp fields that might exist
            ...(((gameData as any).cachedAt?.toDate) && { cachedAt: (gameData as any).cachedAt.toDate() }),
            ...(((gameData as any).playerPropsUpdatedAt?.toDate) && { playerPropsUpdatedAt: (gameData as any).playerPropsUpdatedAt.toDate() })
          };
          games.push(convertedGameData);
        });
        
        // Enhance games with betting lines from cache
        return await this.enhanceGamesWithBettingLines(games);
      }
    } catch (error) {
      console.error('❌ Error reading games from Firebase:', error);
      return [];
    }
  }

  /**
   * Enhance games with betting lines from the betting lines cache
   * Also proactively ensures betting lines are fetched if needed (respecting refresh timing)
   */
  private async enhanceGamesWithBettingLines(games: Game[]): Promise<Game[]> {
    try {
      const { bettingLinesCacheService } = await import('./betting-lines-cache');
      
      const enhancedGames = await Promise.all(games.map(async (game) => {
        try {
          // Proactively ensure betting lines are fetched/cached (respects refresh timing)
          // This will check Firebase cache first, then decide if API call is needed based on timing
          await bettingLinesCacheService.ensureBettingLinesForGame(game);
          
          // Get cached betting lines for this game (after ensuring they're fetched)
          const cachedLines = await bettingLinesCacheService.getCachedBettingLines(game.id);
          
          if (cachedLines) {
            // Apply cached betting lines to the game (only if they exist - don't overwrite with undefined)
            return {
              ...game,
              spread: cachedLines.spread !== undefined ? cachedLines.spread : game.spread,
              spreadOdds: cachedLines.spreadOdds !== undefined ? cachedLines.spreadOdds : game.spreadOdds,
              overUnder: cachedLines.overUnder !== undefined ? cachedLines.overUnder : game.overUnder,
              overUnderOdds: cachedLines.overUnderOdds !== undefined ? cachedLines.overUnderOdds : game.overUnderOdds,
              homeMoneyline: cachedLines.homeMoneyline !== undefined ? cachedLines.homeMoneyline : game.homeMoneyline,
              awayMoneyline: cachedLines.awayMoneyline !== undefined ? cachedLines.awayMoneyline : game.awayMoneyline,
            };
          }
          
          return game;
        } catch (error) {
          console.warn(`⚠️ Error enhancing game ${game.id} with betting lines:`, error);
          return game;
        }
      }));
      
      return enhancedGames;
    } catch (error) {
      console.error('❌ Error enhancing games with betting lines:', error);
      return games; // Return original games if enhancement fails
    }
  }
  
  private async cacheGamesInFirebase(games: Game[]): Promise<void> {
    try {
      console.log(`💾 Caching ${games.length} games in Firebase...`);
      
      const promises = games.map(async (game) => {
        try {
          // For now, use original game ID to avoid infinite loops
          // TODO: Implement consistent ID generation after testing
          const gameId = game.id;
          
          // Clean the game data to remove undefined fields
          const cleanedGame = cleanFirebaseData(game);
          
          // Ensure playerProps array exists
          if (!cleanedGame.playerProps) {
            cleanedGame.playerProps = [];
          }
          
          // Add game ID mapping for cross-reference
          cleanedGame.gameIds = {
            oddsApi: game.id,
            espn: game.espnId || null,
            readable: game.readableId || null
          };
          
          // Use Admin SDK for server-side operations to bypass security rules
          const adminDbInstance = await getAdminDb();
          
          // Check if it's Admin SDK (has .collection method) or client SDK
          if (adminDbInstance && typeof adminDbInstance.collection === 'function') {
            // Admin SDK
            const gameRef = adminDbInstance.collection('games').doc(gameId);
            const existingGameDoc = await gameRef.get();
            
            if (existingGameDoc.exists) {
              const existingData = existingGameDoc.data();
              console.log(`🔄 Preserving data for existing game ${gameId}: ${existingData?.awayTeam} @ ${existingData?.homeTeam}`);
              
              // Preserve existing player props if they exist
              if (existingData?.playerProps && existingData.playerProps.length > 0) {
                console.log(`📦 Preserving ${existingData.playerProps.length} player props for ${existingData.awayTeam} @ ${existingData.homeTeam}`);
                cleanedGame.playerProps = existingData.playerProps;
              }
              
              // Preserve existing game ID mappings if they exist
              if (existingData?.gameIds) {
                cleanedGame.gameIds = {
                  ...cleanedGame.gameIds,
                  ...existingData.gameIds
                };
              }
            }
            
            // Use set with merge to ensure we preserve existing data
            await gameRef.set(cleanedGame, { merge: true });
          } else {
            // Fallback to client SDK
            // Check if game already exists to preserve any manually added player props
            const existingGameDoc = await getDoc(doc(db, 'games', gameId));
            
            if (existingGameDoc.exists()) {
              const existingData = existingGameDoc.data();
              console.log(`🔄 Preserving data for existing game ${gameId}: ${existingData.awayTeam} @ ${existingData.homeTeam}`);
              
              // Preserve existing player props if they exist
              if (existingData.playerProps && existingData.playerProps.length > 0) {
                console.log(`📦 Preserving ${existingData.playerProps.length} player props for ${existingData.awayTeam} @ ${existingData.homeTeam}`);
                cleanedGame.playerProps = existingData.playerProps;
              }
              
              // Preserve existing game ID mappings if they exist
              if (existingData.gameIds) {
                cleanedGame.gameIds = {
                  ...cleanedGame.gameIds,
                  ...existingData.gameIds
                };
              }
            }
            
            // Use setDoc with merge to ensure we preserve existing data
            await setDoc(doc(db, 'games', gameId), cleanedGame, { merge: true });
          }
          
        } catch (error) {
          console.error(`❌ Error caching individual game:`, error, game);
        }
      });
      
      await Promise.all(promises);
      console.log(`✅ Successfully cached ${games.length} games in Firebase with ID mappings`);
    } catch (error) {
      console.error('❌ Error caching games in Firebase:', error);
    }
  }

  private async simpleCacheGames(games: Game[]): Promise<void> {
    try {
      console.log(`💾 Simple caching ${games.length} games in Firebase...`);
      
      // Use Admin SDK for server-side operations to bypass security rules
      const adminDbInstance = await getAdminDb();
      
      const promises = games.map(async (game) => {
        try {
          const gameId = game.id;
          const cleanedGame = cleanFirebaseData(game);
          
          // Convert JavaScript dates to Firebase Timestamps before storing
          if (cleanedGame.gameTime && cleanedGame.gameTime instanceof Date) {
            // Check if it's Admin SDK or client SDK
            if (adminDbInstance && typeof adminDbInstance.collection === 'function') {
              // Admin SDK - use Admin Timestamp
              const { Timestamp: AdminTimestamp } = await import('firebase-admin/firestore');
              cleanedGame.gameTime = AdminTimestamp.fromDate(cleanedGame.gameTime);
            } else {
              // Client SDK
              cleanedGame.gameTime = Timestamp.fromDate(cleanedGame.gameTime);
            }
          }
          
          // Check if it's Admin SDK (has .collection method) or client SDK
          if (adminDbInstance && typeof adminDbInstance.collection === 'function') {
            // Admin SDK
            const gameRef = adminDbInstance.collection('games').doc(gameId);
            await gameRef.set(cleanedGame, { merge: true });
          } else {
            // Fallback to client SDK
            await setDoc(doc(db, 'games', gameId), cleanedGame, { merge: true });
          }
        } catch (error) {
          console.error(`❌ Error caching game ${game.id}:`, error);
        }
      });
      
      await Promise.all(promises);
      console.log(`✅ Simple cached ${games.length} games`);
    } catch (error) {
      console.error('❌ Error in simple cache:', error);
    }
  }

  async findGameByAnyId(gameId: string): Promise<Game | null> {
    try {
      // Use Admin SDK for server-side operations to bypass security rules
      const adminDbInstance = await getAdminDb();
      
      // Check if it's Admin SDK (has .collection method) or client SDK
      if (adminDbInstance && typeof adminDbInstance.collection === 'function') {
        // Admin SDK
        // First try direct ID lookup
        const directDoc = await adminDbInstance.collection('games').doc(gameId).get();
        if (directDoc.exists) {
          return { id: directDoc.id, ...directDoc.data() } as Game;
        }

        // Then search by stored game IDs
        const snapshot = await adminDbInstance.collection('games').get();
        
        for (const docSnapshot of snapshot.docs) {
          const gameData = docSnapshot.data() as Game;
          const gameIds = (gameData as any).gameIds;
          
          if (gameIds?.oddsApi === gameId || 
              gameIds?.espn === gameId || 
              gameIds?.readable === gameId ||
              gameIds?.consistent === gameId ||
              (gameData as any).originalId === gameId ||
              gameData.espnId === gameId ||
              gameData.readableId === gameId) {
            return { ...gameData, id: docSnapshot.id };
          }
        }
      } else {
        // Fallback to client SDK
        // First try direct ID lookup
        const directDoc = await getDoc(doc(db, 'games', gameId));
        if (directDoc.exists()) {
          return { id: directDoc.id, ...directDoc.data() } as Game;
        }

        // Then search by stored game IDs
        const gamesQuery = query(collection(db, 'games'));
        const snapshot = await getDocs(gamesQuery);
        
        for (const docSnapshot of snapshot.docs) {
          const gameData = docSnapshot.data() as Game;
          const gameIds = (gameData as any).gameIds;
          
          if (gameIds?.oddsApi === gameId || 
              gameIds?.espn === gameId || 
              gameIds?.readable === gameId ||
              gameIds?.consistent === gameId ||
              (gameData as any).originalId === gameId ||
              gameData.espnId === gameId ||
              gameData.readableId === gameId) {
            return { ...gameData, id: docSnapshot.id };
          }
        }
      }
      
      return null;
    } catch (error) {
      console.error('❌ Error finding game by ID:', error);
      return null;
    }
  }

  async getGameById(gameId: string): Promise<Game | null> {
    try {
      // Use Admin SDK for server-side operations to bypass security rules
      const adminDbInstance = await getAdminDb();
      
      // Check if it's Admin SDK (has .collection method) or client SDK
      if (adminDbInstance && typeof adminDbInstance.collection === 'function') {
        // Admin SDK
        const gameDoc = await adminDbInstance.collection('games').doc(gameId).get();
        
        if (gameDoc.exists) {
          return {
            id: gameDoc.id,
            ...gameDoc.data()
          } as Game;
        }
      } else {
        // Fallback to client SDK
        const gameDoc = await getDoc(doc(db, 'games', gameId));
        
        if (gameDoc.exists()) {
          return {
            id: gameDoc.id,
            ...gameDoc.data()
          } as Game;
        }
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Error getting game ${gameId} from Firebase:`, error);
      return null;
    }
  }
  
}

export const gamesCacheService = new GamesCacheService();