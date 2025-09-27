import { collection, doc, getDocs, getDoc, setDoc, query, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { oddsApi } from '@/lib/odds-api';
import { cleanFirebaseData } from '@/lib/firebase-utils';
import { Game } from '@/types';

export class GamesCacheService {
  
  async getGamesForWeek(week: number, forceRefresh = false): Promise<Game[]> {
    console.log(`🎯 GamesCacheService: Getting Week ${week} games (forceRefresh: ${forceRefresh})`);
    
    try {
      // Temporarily disable Firebase cache to isolate the infinite loop issue
      if (!forceRefresh) {
        console.log(`🔍 Checking Firebase cache for Week ${week} games...`);
        const cachedGames = await this.getGamesFromFirebase(week);
        
        if (cachedGames.length > 0) {
          console.log(`✅ Found ${cachedGames.length} games in Firebase cache for Week ${week}`);
          return cachedGames;
        }
      }
      
      // Get from Odds API with skipCaching to prevent circular dependencies
      console.log(`📡 Fetching Week ${week} games from Odds API...`);
      const apiGames = await oddsApi.getNFLGames(week, forceRefresh, true);
      
      if (apiGames.length > 0) {
        console.log(`✅ Got ${apiGames.length} games from Odds API`);
        
        // Skip complex merge and caching for now to avoid infinite loops
        if (!forceRefresh) {
          // Simple cache without merge logic
          await this.simpleCacheGames(apiGames);
        }
        
        return apiGames;
      }
      
      return [];
    } catch (error) {
      console.error('❌ Error in getGamesForWeek:', error);
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
      const gamesQuery = query(
        collection(db, 'games'),
        where('weekendId', '==', `2025-week-${week}`)
      );
      
      const snapshot = await getDocs(gamesQuery);
      const games: Game[] = [];
      
      snapshot.forEach(doc => {
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
      
      return games;
    } catch (error) {
      console.error('❌ Error reading games from Firebase:', error);
      return [];
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
      
      const promises = games.map(async (game) => {
        try {
          const gameId = game.id;
          const cleanedGame = cleanFirebaseData(game);
          
          // Convert JavaScript dates to Firebase Timestamps before storing
          if (cleanedGame.gameTime && cleanedGame.gameTime instanceof Date) {
            cleanedGame.gameTime = Timestamp.fromDate(cleanedGame.gameTime);
          }
          
          // Just store the basic game data without complex logic
          await setDoc(doc(db, 'games', gameId), cleanedGame, { merge: true });
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
      
      return null;
    } catch (error) {
      console.error('❌ Error finding game by ID:', error);
      return null;
    }
  }
  
  async getGameById(gameId: string): Promise<Game | null> {
    try {
      const gameDoc = await getDoc(doc(db, 'games', gameId));
      
      if (gameDoc.exists()) {
        return {
          id: gameDoc.id,
          ...gameDoc.data()
        } as Game;
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Error getting game ${gameId} from Firebase:`, error);
      return null;
    }
  }
  
}

export const gamesCacheService = new GamesCacheService();