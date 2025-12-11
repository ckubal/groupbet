import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  query, 
  where, 
  orderBy,
  onSnapshot,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';
import { Bet, Game, Weekend, Settlement, PlayerProp } from '@/types';
import { getTimeSlot } from './time-slot-utils';

// Collections
const COLLECTIONS = {
  BETS: 'bets',
  GAMES: 'games',
  WEEKENDS: 'weekends',
  SETTLEMENTS: 'settlements',
  USERS: 'users',
  FINAL_GAMES: 'final_games', // Store completed games permanently
  PLAYER_PROPS: 'player_props', // Cache player props separately
  GAME_ID_MAPPINGS: 'game_id_mappings', // Map between internal IDs and external API IDs
  PRE_GAME_ODDS: 'pre_game_odds' // Freeze betting lines before games start - NEVER overwrite
};

// Bet Management
export const betService = {
  // Create a new bet
  async createBet(betData: Omit<Bet, 'id' | 'createdAt' | 'status'>): Promise<string> {
    try {
      const cleanedBetData = {
        ...betData,
        bettingMode: betData.bettingMode || 'group', // Default to group betting
        createdAt: Timestamp.now(),
        status: 'active'
      };
      
      // Remove undefined values to avoid Firebase errors
      Object.keys(cleanedBetData).forEach(key => {
        if (cleanedBetData[key as keyof typeof cleanedBetData] === undefined) {
          delete cleanedBetData[key as keyof typeof cleanedBetData];
        }
      });
      
      const docRef = await addDoc(collection(db, COLLECTIONS.BETS), cleanedBetData);
      
      console.log('✅ Bet created with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating bet:', error);
      throw error;
    }
  },

  // Get bets for a specific weekend
  async getBetsForWeekend(weekendId: string): Promise<Bet[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.BETS),
        where('weekendId', '==', weekendId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const bets: Bet[] = [];
      
      querySnapshot.forEach((doc: any) => {
        const data = doc.data();
        bets.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt.toDate(),
          resolvedAt: data.resolvedAt?.toDate()
        } as Bet);
      });
      
      return bets;
    } catch (error) {
      console.error('❌ Error fetching bets:', error);
      return [];
    }
  },

  // Get bets for a specific user
  async getBetsForUser(userId: string, weekendId?: string): Promise<Bet[]> {
    try {
      // Simplified query without orderBy to avoid index requirements for now
      let q = query(
        collection(db, COLLECTIONS.BETS),
        where('participants', 'array-contains', userId)
      );

      if (weekendId) {
        q = query(q, where('weekendId', '==', weekendId));
      }
      
      const querySnapshot = await getDocs(q);
      const bets: Bet[] = [];
      
      querySnapshot.forEach((doc: any) => {
        const data = doc.data();
        bets.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt.toDate(),
          resolvedAt: data.resolvedAt?.toDate()
        } as Bet);
      });
      
      return bets;
    } catch (error) {
      console.error('❌ Error fetching user bets:', error);
      return [];
    }
  },

  // Update bet status (for settlement)
  async updateBetStatus(betId: string, status: Bet['status'], result?: string): Promise<void> {
    try {
      const betRef = doc(db, COLLECTIONS.BETS, betId);
      const updateData: any = { status };
      
      if (result) {
        updateData.result = result;
      }
      
      if (status === 'won' || status === 'lost' || status === 'unknown') {
        updateData.resolvedAt = Timestamp.now();
      }
      
      await updateDoc(betRef, updateData);
      console.log('✅ Bet status updated:', betId, status);
    } catch (error) {
      console.error('❌ Error updating bet status:', error);
      throw error;
    }
  },

  // Subscribe to real-time bet updates
  subscribeToBets(weekendId: string, callback: (bets: Bet[]) => void): () => void {
    const q = query(
      collection(db, COLLECTIONS.BETS),
      where('weekendId', '==', weekendId),
      orderBy('createdAt', 'desc')
    );
    
    return onSnapshot(q, (snapshot) => {
      const bets: Bet[] = [];
      snapshot.forEach((doc: any) => {
        const data = doc.data();
        bets.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt.toDate(),
          resolvedAt: data.resolvedAt?.toDate()
        } as Bet);
      });
      callback(bets);
    });
  },

  // Delete a bet
  async deleteBet(betId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, COLLECTIONS.BETS, betId));
      console.log('✅ Bet deleted:', betId);
    } catch (error) {
      console.error('❌ Error deleting bet:', error);
      throw error;
    }
  }
};

// Weekend Management
export const weekendService = {
  // Create or update weekend
  async createWeekend(weekendData: Omit<Weekend, 'id' | 'createdAt'>): Promise<string> {
    try {
      const docRef = await addDoc(collection(db, COLLECTIONS.WEEKENDS), {
        ...weekendData,
        createdAt: Timestamp.now()
      });
      
      console.log('✅ Weekend created with ID:', docRef.id);
      return docRef.id;
    } catch (error) {
      console.error('❌ Error creating weekend:', error);
      throw error;
    }
  },

  // Get weekend by ID
  async getWeekend(weekendId: string): Promise<Weekend | null> {
    try {
      const q = query(
        collection(db, COLLECTIONS.WEEKENDS),
        where('id', '==', weekendId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const doc = querySnapshot.docs[0];
      const data = doc.data();
      
      return {
        id: doc.id,
        ...data,
        startDate: data.startDate.toDate(),
        endDate: data.endDate.toDate(),
        createdAt: data.createdAt.toDate()
      } as Weekend;
    } catch (error) {
      console.error('❌ Error fetching weekend:', error);
      return null;
    }
  }
};

// Settlement Management
export const settlementService = {
  // Calculate and create settlements for a weekend
  async calculateWeekendSettlement(weekendId: string): Promise<Settlement[]> {
    try {
      const bets = await betService.getBetsForWeekend(weekendId);
      const settlements: Record<string, Settlement> = {};
      
      // Initialize settlements for all users
      const allUsers = new Set<string>();
      bets.forEach(bet => {
        bet.participants.forEach(userId => allUsers.add(userId));
      });
      
      allUsers.forEach(userId => {
        settlements[userId] = {
          id: '', // Will be set when saved
          weekendId,
          userId,
          netAmount: 0,
          betBreakdown: [],
          paidAmount: 0,
          status: 'pending'
        };
      });
      
      // Calculate P&L for each bet
      bets.forEach(bet => {
        if (bet.status === 'won' || bet.status === 'lost') {
          const amountPerPerson = bet.amountPerPerson;
          
          if (bet.status === 'won') {
            // Winners split the total pot
            const totalPot = bet.totalAmount;
            const winnersShare = totalPot / bet.participants.length;
            
            bet.participants.forEach(userId => {
              if (settlements[userId]) {
                settlements[userId].netAmount += winnersShare - amountPerPerson;
                settlements[userId].betBreakdown.push({
                  betId: bet.id,
                  amount: winnersShare - amountPerPerson
                });
              }
            });
          } else if (bet.status === 'lost') {
            // Losers lose their stake
            bet.participants.forEach(userId => {
              if (settlements[userId]) {
                settlements[userId].netAmount -= amountPerPerson;
                settlements[userId].betBreakdown.push({
                  betId: bet.id,
                  amount: -amountPerPerson
                });
              }
            });
          }
        }
      });
      
      return Object.values(settlements);
    } catch (error) {
      console.error('❌ Error calculating settlement:', error);
      return [];
    }
  }
};

// Game Cache Management (for API data)
export const gameCacheService = {
  // Save games data to Firebase
  async saveGames(weekendId: string, games: Game[]): Promise<void> {
    try {
      // Delete existing games for this weekend first
      const existingGames = await getDocs(
        query(collection(db, COLLECTIONS.GAMES), where('weekendId', '==', weekendId))
      );
      
      const deletePromises = existingGames.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      // Add new games (clean undefined values for Firebase)
      const addPromises = games.map(game => {
        const cleanGame: any = {
          id: game.id,
          weekendId: game.weekendId,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          gameTime: Timestamp.fromDate(game.gameTime),
          timeSlot: game.timeSlot,
          status: game.status,
          homeScore: game.homeScore,
          awayScore: game.awayScore,
          playerProps: game.playerProps || [],
          cachedAt: Timestamp.now()
        };
        
        // Only add betting line fields if they have actual values
        if (game.spread !== undefined) cleanGame.spread = game.spread;
        if (game.spreadOdds !== undefined) cleanGame.spreadOdds = game.spreadOdds;
        if (game.overUnder !== undefined) cleanGame.overUnder = game.overUnder;
        if (game.overUnderOdds !== undefined) cleanGame.overUnderOdds = game.overUnderOdds;
        if (game.homeMoneyline !== undefined) cleanGame.homeMoneyline = game.homeMoneyline;
        if (game.awayMoneyline !== undefined) cleanGame.awayMoneyline = game.awayMoneyline;
        
        return addDoc(collection(db, COLLECTIONS.GAMES), cleanGame);
      });
      
      await Promise.all(addPromises);
      console.log(`✅ Cached ${games.length} games for ${weekendId}`);
    } catch (error) {
      console.error('❌ Error caching games:', error);
      throw error;
    }
  },

  // Get cached games from Firebase
  async getCachedGames(weekendId: string): Promise<{ games: Game[], cachedAt: Date } | null> {
    try {
      const q = query(
        collection(db, COLLECTIONS.GAMES),
        where('weekendId', '==', weekendId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }
      
      const games: Game[] = [];
      let oldestCache = new Date();
      
      querySnapshot.forEach((doc: any) => {
        const data = doc.data();
        const cachedAt = data.cachedAt?.toDate() || new Date();
        
        if (cachedAt < oldestCache) {
          oldestCache = cachedAt;
        }
        
        games.push({
          id: data.id,
          weekendId: data.weekendId,
          week: data.week || 0,
          homeTeam: data.homeTeam,
          awayTeam: data.awayTeam,
          gameTime: data.gameTime.toDate(),
          timeSlot: data.timeSlot,
          status: data.status,
          homeScore: data.homeScore,
          awayScore: data.awayScore,
          spread: data.spread,
          spreadOdds: data.spreadOdds,
          overUnder: data.overUnder,
          overUnderOdds: data.overUnderOdds,
          homeMoneyline: data.homeMoneyline,
          awayMoneyline: data.awayMoneyline,
          playerProps: data.playerProps
        });
      });
      
      console.log('📊 FIREBASE CACHE GAME MATCHING SUMMARY:');
      console.log(`📦 Retrieved ${games.length} games from Firebase cache for ${weekendId}`);
      console.log(`🕐 Cache age: ${Math.round((Date.now() - oldestCache.getTime()) / (1000 * 60))} minutes old`);
      games.forEach((game, index) => {
        console.log(`   ${index + 1}. ${game.awayTeam} @ ${game.homeTeam} | ${game.status} | ${game.gameTime.toISOString()} | ID: ${game.id}`);
      });
      
      return { games, cachedAt: oldestCache };
    } catch (error) {
      console.error('❌ Error fetching cached games:', error);
      return null;
    }
  },

  // Check if cache is still valid with smart logic for completed vs live games
  isCacheValid(cachedAt: Date, games: Game[], maxAgeMinutes: number = 5): boolean {
    const ageInMinutes = (Date.now() - cachedAt.getTime()) / (1000 * 60);
    
    // For completed games with betting lines already set, cache is valid for much longer (24 hours)
    const hasCompletedGamesWithOdds = games.some(game => 
      game.status === 'final' && 
      game.spread !== undefined && 
      game.overUnder !== undefined
    );
    
    if (hasCompletedGamesWithOdds) {
      const maxAgeForCompletedGames = 24 * 60; // 24 hours in minutes
      const isValidForCompleted = ageInMinutes < maxAgeForCompletedGames;
      console.log(`📊 Cache validation for completed games with odds: ${isValidForCompleted ? '✅ VALID' : '❌ EXPIRED'} (${Math.round(ageInMinutes)} min old)`);
      return isValidForCompleted;
    }
    
    // For live or upcoming games, use shorter cache duration
    const isValidForLive = ageInMinutes < maxAgeMinutes;
    console.log(`🔴 Cache validation for live/upcoming games: ${isValidForLive ? '✅ VALID' : '❌ EXPIRED'} (${Math.round(ageInMinutes)} min old)`);
    return isValidForLive;
  },

  // Clear cached games for a specific weekend
  async clearCachedGames(weekendId: string): Promise<void> {
    try {
      const q = query(
        collection(db, COLLECTIONS.GAMES),
        where('weekendId', '==', weekendId)
      );
      
      const querySnapshot = await getDocs(q);
      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      console.log(`✅ Cleared ${querySnapshot.docs.length} cached games for ${weekendId}`);
    } catch (error) {
      console.error('❌ Error clearing cached games:', error);
      throw error;
    }
  }
};

// Final Game Results Management (for completed games)
export const finalGameService = {
  // Store final game results permanently 
  async storeFinalGameResults(games: Game[]): Promise<void> {
    try {
      const finalGames = games.filter(game => game.status === 'final');
      
      if (finalGames.length === 0) {
        console.log('📊 No final games to store');
        return;
      }
      
      console.log(`💾 Storing ${finalGames.length} final game results in Firebase`);
      
      const storePromises = finalGames.map(async (game) => {
        // Check if this game result already exists
        const existingQuery = query(
          collection(db, COLLECTIONS.FINAL_GAMES),
          where('gameId', '==', game.id)
        );
        
        const existingResults = await getDocs(existingQuery);
        
        if (!existingResults.empty) {
          // Update existing result (clean undefined values)
          const updateData = this.cleanUndefinedValues({
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            playerStats: game.playerStats || [],
            lastUpdated: Timestamp.now()
          });
          
          const docRef = existingResults.docs[0].ref;
          await updateDoc(docRef, updateData);
          console.log(`🔄 Updated final result for ${game.awayTeam} @ ${game.homeTeam}`);
        } else {
          // Create new final result (clean undefined values for Firebase)
          const finalGameData = {
            gameId: game.id,
            weekendId: game.weekendId,
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            gameTime: Timestamp.fromDate(game.gameTime),
            homeScore: game.homeScore || 0,
            awayScore: game.awayScore || 0,
            playerStats: game.playerStats || [],
            storedAt: Timestamp.now(),
            lastUpdated: Timestamp.now(),
            // Optional fields - only if they have values
            ...(game.spread !== undefined && game.spread !== null && { spread: game.spread }),
            ...(game.spreadOdds !== undefined && game.spreadOdds !== null && { spreadOdds: game.spreadOdds }),
            ...(game.overUnder !== undefined && game.overUnder !== null && { overUnder: game.overUnder }),
            ...(game.overUnderOdds !== undefined && game.overUnderOdds !== null && { overUnderOdds: game.overUnderOdds }),
            ...(game.homeMoneyline !== undefined && game.homeMoneyline !== null && { homeMoneyline: game.homeMoneyline }),
            ...(game.awayMoneyline !== undefined && game.awayMoneyline !== null && { awayMoneyline: game.awayMoneyline }),
            ...(game.espnId !== undefined && game.espnId !== null && { espnId: game.espnId }),
            ...(game.readableId !== undefined && game.readableId !== null && { readableId: game.readableId }),
            ...(game.weekMetadata !== undefined && game.weekMetadata !== null && { weekMetadata: game.weekMetadata })
          };
          
          // Extra safety: Remove any undefined values that might have slipped through
          const cleanedData = this.cleanUndefinedValues(finalGameData);
          
          await addDoc(collection(db, COLLECTIONS.FINAL_GAMES), cleanedData);
          console.log(`✅ Stored final result for ${game.awayTeam} @ ${game.homeTeam} (${game.awayScore}-${game.homeScore})`);
        }
      });
      
      await Promise.all(storePromises);
      console.log(`💾 Successfully stored ${finalGames.length} final game results`);
    } catch (error) {
      console.error('❌ Error storing final game results:', error);
      throw error;
    }
  },

  // Helper function to recursively remove undefined values from objects
  cleanUndefinedValues(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.cleanUndefinedValues(item));
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
          cleaned[key] = this.cleanUndefinedValues(value);
        }
      }
      return cleaned;
    }
    
    return obj;
  },

  // Retrieve final game results from Firebase
  async getFinalGameResults(gameIds: string[]): Promise<Record<string, Game>> {
    try {
      if (gameIds.length === 0) return {};
      
      console.log(`🔍 Looking up ${gameIds.length} final game results from Firebase`);
      
      // Firebase 'in' queries are limited to 10 items, so batch them
      const batches: string[][] = [];
      for (let i = 0; i < gameIds.length; i += 10) {
        batches.push(gameIds.slice(i, i + 10));
      }
      
      const results: Record<string, Game> = {};
      
      for (const batch of batches) {
        const q = query(
          collection(db, COLLECTIONS.FINAL_GAMES),
          where('gameId', 'in', batch)
        );
        
        const querySnapshot = await getDocs(q);
        
        querySnapshot.forEach((doc: any) => {
          const data = doc.data();
          
          const game: Game = {
            id: data.gameId,
            weekendId: data.weekendId,
            week: data.week || 0,
            homeTeam: data.homeTeam,
            awayTeam: data.awayTeam,
            gameTime: data.gameTime.toDate(),
            timeSlot: getTimeSlot(data.gameTime.toDate(), true), // Calculate correct timeSlot with logging
            status: 'final',
            homeScore: data.homeScore,
            awayScore: data.awayScore,
            spread: data.spread,
            spreadOdds: -110, // Default for final games
            overUnder: data.overUnder,
            overUnderOdds: -110, // Default for final games
            homeMoneyline: data.homeMoneyline,
            awayMoneyline: data.awayMoneyline,
            playerProps: [],
            playerStats: data.playerStats || []
          };
          
          results[data.gameId] = game;
        });
      }
      
      console.log(`📊 Retrieved ${Object.keys(results).length}/${gameIds.length} final game results from Firebase`);
      return results;
    } catch (error) {
      console.error('❌ Error retrieving final game results:', error);
      return {};
    }
  },

  // Get all final games for a specific week
  async getFinalGamesForWeek(weekendId: string): Promise<Game[]> {
    try {
      const q = query(
        collection(db, COLLECTIONS.FINAL_GAMES),
        where('weekendId', '==', weekendId)
      );
      
      const querySnapshot = await getDocs(q);
      const games: Game[] = [];
      
      querySnapshot.forEach((doc: any) => {
        const data = doc.data();
        
        const gameTime = data.gameTime?.toDate ? data.gameTime.toDate() : data.gameTime;
        games.push({
          id: data.gameId,
          weekendId: data.weekendId,
          week: data.week || 0,
          homeTeam: data.homeTeam,
          awayTeam: data.awayTeam,
          gameTime: gameTime,
          timeSlot: getTimeSlot(gameTime, true), // Calculate correct timeSlot with logging
          status: 'final',
          homeScore: data.homeScore,
          awayScore: data.awayScore,
          spread: data.spread,
          spreadOdds: -110,
          overUnder: data.overUnder,
          overUnderOdds: -110,
          homeMoneyline: data.homeMoneyline,
          awayMoneyline: data.awayMoneyline,
          playerProps: [],
          playerStats: data.playerStats || []
        });
      });
      
      console.log(`📊 Retrieved ${games.length} final games for ${weekendId} from Firebase`);
      return games;
    } catch (error) {
      console.error('❌ Error retrieving final games for week:', error);
      return [];
    }
  }
};

// Player Props Cache Management
export const playerPropsService = {
  // Cache player props for a game
  async cachePlayerProps(gameId: string, props: PlayerProp[]): Promise<void> {
    try {
      if (!gameId || props.length === 0) {
        console.log('📊 No player props to cache');
        return;
      }
      
      console.log(`💾 Caching ${props.length} player props for game ${gameId}`);
      
      // Check if props already exist for this game
      const existingQuery = query(
        collection(db, COLLECTIONS.PLAYER_PROPS),
        where('gameId', '==', gameId)
      );
      
      const existingDocs = await getDocs(existingQuery);
      
      // Delete existing props first
      if (!existingDocs.empty) {
        const deletePromises = existingDocs.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
        console.log(`🗑️ Deleted ${existingDocs.docs.length} existing player props`);
      }
      
      // Add new props
      const addPromises = props.map(prop => {
        const propData = {
          gameId,
          playerId: prop.playerId,
          playerName: prop.playerName,
          propType: prop.propType,
          line: prop.line,
          overOdds: prop.overOdds,
          underOdds: prop.underOdds,
          cachedAt: Timestamp.now()
        };
        
        return addDoc(collection(db, COLLECTIONS.PLAYER_PROPS), propData);
      });
      
      await Promise.all(addPromises);
      console.log(`✅ Successfully cached ${props.length} player props for game ${gameId}`);
    } catch (error) {
      console.error('❌ Error caching player props:', error);
      throw error;
    }
  },

  // Get cached player props for a game
  async getCachedPlayerProps(gameId: string): Promise<{ props: PlayerProp[], cachedAt: Date } | null> {
    try {
      const q = query(
        collection(db, COLLECTIONS.PLAYER_PROPS),
        where('gameId', '==', gameId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log(`📭 No cached player props found for game ${gameId}`);
        return null;
      }
      
      const props: PlayerProp[] = [];
      let oldestCache = new Date();
      
      querySnapshot.forEach((doc: any) => {
        const data = doc.data();
        const cachedAt = data.cachedAt?.toDate() || new Date();
        
        if (cachedAt < oldestCache) {
          oldestCache = cachedAt;
        }
        
        props.push({
          playerId: data.playerId,
          playerName: data.playerName,
          propType: data.propType,
          line: data.line,
          overOdds: data.overOdds,
          underOdds: data.underOdds
        });
      });
      
      console.log(`📊 Retrieved ${props.length} cached player props for game ${gameId}`);
      console.log(`🕐 Cache age: ${Math.round((Date.now() - oldestCache.getTime()) / (1000 * 60))} minutes old`);
      
      return { props, cachedAt: oldestCache };
    } catch (error) {
      console.error('❌ Error retrieving cached player props:', error);
      return null;
    }
  },

  // Clear cached player props for a specific game
  async clearCachedPlayerProps(gameId: string): Promise<void> {
    try {
      const q = query(
        collection(db, COLLECTIONS.PLAYER_PROPS),
        where('gameId', '==', gameId)
      );
      
      const querySnapshot = await getDocs(q);
      const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);
      
      console.log(`✅ Cleared ${querySnapshot.docs.length} cached player props for game ${gameId}`);
    } catch (error) {
      console.error('❌ Error clearing cached player props:', error);
      throw error;
    }
  },

  // Check if player props cache is still valid
  isCacheValid(cachedAt: Date, gameStatus?: string, maxAgeMinutes: number = 60): boolean {
    const ageInMinutes = (Date.now() - cachedAt.getTime()) / (1000 * 60);
    
    // For completed games, player props cache never expires (allows historical betting)
    if (gameStatus === 'final') {
      console.log(`📊 Player props cache for FINAL game: ✅ ALWAYS VALID (${Math.round(ageInMinutes)} min old)`);
      return true;
    }
    
    const isValid = ageInMinutes < maxAgeMinutes;
    console.log(`📊 Player props cache validation: ${isValid ? '✅ VALID' : '❌ EXPIRED'} (${Math.round(ageInMinutes)} min old)`);
    return isValid;
  }
};

// Game ID Mapping Service (for API integration)
export const gameIdMappingService = {
  // Store mapping between internal game ID and external API IDs
  async storeGameIdMapping(internalId: string, externalIds: { 
    espnId?: string; 
    oddsApiId?: string; 
    awayTeam: string; 
    homeTeam: string; 
    gameTime: Date 
  }): Promise<void> {
    try {
      // Check if mapping already exists
      const existingQuery = query(
        collection(db, COLLECTIONS.GAME_ID_MAPPINGS),
        where('internalId', '==', internalId)
      );
      
      const existingDocs = await getDocs(existingQuery);
      
      const mappingData: any = {
        internalId,
        awayTeam: externalIds.awayTeam,
        homeTeam: externalIds.homeTeam,
        gameTime: Timestamp.fromDate(externalIds.gameTime),
        lastUpdated: Timestamp.now()
      };

      // Only add non-undefined fields
      if (externalIds.espnId !== undefined) {
        mappingData.espnId = externalIds.espnId;
      }
      if (externalIds.oddsApiId !== undefined) {
        mappingData.oddsApiId = externalIds.oddsApiId;
      }
      
      if (!existingDocs.empty) {
        // Update existing mapping
        const docRef = existingDocs.docs[0].ref;
        await updateDoc(docRef, mappingData);
        console.log(`🔄 Updated game ID mapping for ${internalId}`);
      } else {
        // Create new mapping
        await addDoc(collection(db, COLLECTIONS.GAME_ID_MAPPINGS), mappingData);
        console.log(`✅ Created game ID mapping for ${internalId}`);
      }
    } catch (error) {
      console.error('❌ Error storing game ID mapping:', error);
      throw error;
    }
  },

  // Get Odds API ID from internal ID
  // Get complete game mapping from internal ID
  async getGameMapping(internalId: string): Promise<{
    internalId: string;
    espnId?: string;
    oddsApiId?: string;
    awayTeam?: string;
    homeTeam?: string;
    gameTime?: Date;
    lastUpdated?: Date;
  } | null> {
    try {
      const q = query(
        collection(db, COLLECTIONS.GAME_ID_MAPPINGS),
        where('internalId', '==', internalId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log(`📭 No mapping found for internal ID: ${internalId}`);
        return null;
      }
      
      const doc = querySnapshot.docs[0];
      const mapping = doc.data();
      
      return {
        internalId: mapping.internalId,
        espnId: mapping.espnId,
        oddsApiId: mapping.oddsApiId,
        awayTeam: mapping.awayTeam,
        homeTeam: mapping.homeTeam,
        gameTime: mapping.gameTime?.toDate(),
        lastUpdated: mapping.lastUpdated?.toDate()
      };
      
    } catch (error) {
      console.error('❌ Error getting game mapping:', error);
      return null;
    }
  },

  // Get Odds API ID from internal ID (backwards compatibility)
  async getOddsApiId(internalId: string): Promise<string | null> {
    const mapping = await this.getGameMapping(internalId);
    return mapping?.oddsApiId || null;
  },

  // Find internal ID by matching teams and date
  async findInternalIdByTeamsAndDate(awayTeam: string, homeTeam: string, gameTime: Date): Promise<string | null> {
    try {
      // Convert date to start/end of day for matching
      const startOfDay = new Date(gameTime);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(gameTime);
      endOfDay.setHours(23, 59, 59, 999);
      
      const q = query(
        collection(db, COLLECTIONS.GAME_ID_MAPPINGS),
        where('awayTeam', '==', awayTeam),
        where('homeTeam', '==', homeTeam),
        where('gameTime', '>=', Timestamp.fromDate(startOfDay)),
        where('gameTime', '<=', Timestamp.fromDate(endOfDay))
      );
      
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log(`📭 No internal ID found for ${awayTeam} @ ${homeTeam} on ${gameTime.toDateString()}`);
        return null;
      }
      
      const mapping = querySnapshot.docs[0].data();
      console.log(`🆔 Found internal ID: ${mapping.internalId} for ${awayTeam} @ ${homeTeam}`);
      return mapping.internalId;
    } catch (error) {
      console.error('❌ Error finding internal ID:', error);
      return null;
    }
  },

  // Store Odds API ID for existing internal ID
  async linkOddsApiId(internalId: string, oddsApiId: string): Promise<void> {
    try {
      const q = query(
        collection(db, COLLECTIONS.GAME_ID_MAPPINGS),
        where('internalId', '==', internalId)
      );
      
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const docRef = querySnapshot.docs[0].ref;
        await updateDoc(docRef, {
          oddsApiId,
          lastUpdated: Timestamp.now()
        });
        console.log(`🔗 Linked Odds API ID ${oddsApiId} to internal ID ${internalId}`);
      } else {
        console.warn(`⚠️ No mapping found for internal ID ${internalId} to link Odds API ID`);
      }
    } catch (error) {
      console.error('❌ Error linking Odds API ID:', error);
      throw error;
    }
  }
};

// Pre-Game Odds Management - CRITICAL: Preserve betting lines forever once games start
export const preGameOddsService = {
  // Freeze betting odds permanently - these should NEVER change after a game starts
  async freezeOdds(gameId: string, odds: {
    spread?: number;
    spreadOdds?: number;
    overUnder?: number;
    overUnderOdds?: number;
    homeMoneyline?: number;
    awayMoneyline?: number;
    playerProps?: PlayerProp[];
  }): Promise<void> {
    try {
      // Check if already frozen to avoid overwrites
      const existingDoc = await this.getFrozenOdds(gameId);
      if (existingDoc) {
        // Silently skip if already cached (this is expected behavior)
        return;
      }

      const frozenOdds = {
        gameId,
        spread: odds.spread,
        spreadOdds: odds.spreadOdds,
        overUnder: odds.overUnder,
        overUnderOdds: odds.overUnderOdds,
        homeMoneyline: odds.homeMoneyline,
        awayMoneyline: odds.awayMoneyline,
        playerProps: odds.playerProps || [],
        frozenAt: Timestamp.now()
      };

      // Remove undefined values
      Object.keys(frozenOdds).forEach(key => {
        if (frozenOdds[key as keyof typeof frozenOdds] === undefined) {
          delete frozenOdds[key as keyof typeof frozenOdds];
        }
      });

      await addDoc(collection(db, COLLECTIONS.PRE_GAME_ODDS), frozenOdds);
      console.log(`🧊 FROZEN pre-game odds for game ${gameId} - these lines will NEVER change`);
    } catch (error) {
      console.error('❌ Error freezing pre-game odds:', error);
      throw error;
    }
  },

  // Get frozen pre-game odds - these are the definitive betting lines for started/completed games
  async getFrozenOdds(gameId: string): Promise<{
    spread?: number;
    spreadOdds?: number;
    overUnder?: number;
    overUnderOdds?: number;
    homeMoneyline?: number;
    awayMoneyline?: number;
    playerProps?: PlayerProp[];
  } | null> {
    try {
      const q = query(
        collection(db, COLLECTIONS.PRE_GAME_ODDS),
        where('gameId', '==', gameId)
      );

      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        return null;
      }

      const doc = querySnapshot.docs[0];
      const data = doc.data();
      
      return {
        spread: data.spread,
        spreadOdds: data.spreadOdds,
        overUnder: data.overUnder,
        overUnderOdds: data.overUnderOdds,
        homeMoneyline: data.homeMoneyline,
        awayMoneyline: data.awayMoneyline,
        playerProps: data.playerProps || []
      };
    } catch (error) {
      console.error('❌ Error getting frozen odds:', error);
      return null;
    }
  },

  // Get count of frozen odds (for debugging)
  async getFrozenOddsCount(): Promise<number> {
    try {
      const querySnapshot = await getDocs(collection(db, COLLECTIONS.PRE_GAME_ODDS));
      return querySnapshot.size;
    } catch (error) {
      console.error('❌ Error getting frozen odds count:', error);
      return 0;
    }
  }
};

export default {
  bet: betService,
  weekend: weekendService,
  settlement: settlementService,
  gameCache: gameCacheService,
  finalGame: finalGameService,
  playerProps: playerPropsService,
  gameIdMapping: gameIdMappingService,
  preGameOdds: preGameOddsService
};