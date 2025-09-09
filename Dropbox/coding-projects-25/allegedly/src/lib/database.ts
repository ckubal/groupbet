// Database service using Firebase Firestore
import { 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';

// Type definitions
export interface User {
  id: string;
  name: string;
  email: string;
  joinedAt: Date;
  isActive: boolean;
  preferences: {
    notifications: boolean;
    defaultBetAmount: number;
  };
}

export interface Game {
  id: string;
  week: string;
  season: number;
  homeTeam: string;
  awayTeam: string;
  gameTime: Date;
  timeSlot: 'thursday' | 'sunday-early' | 'sunday-late' | 'sunday-night' | 'monday';
  status: 'scheduled' | 'live' | 'final';
  homeScore: number;
  awayScore: number;
  odds: {
    spread: { line: string; odds: string };
    total: { line: string; odds: string };
    moneyline: { home: string; away: string };
  };
  updatedAt: Date;
}

export interface Vote {
  id: string;
  userId: string;
  gameId: string;
  week: string;
  voteType: 'thumbs-up' | 'thumbs-down';
  betCategory: 'spread' | 'total' | 'moneyline';
  createdAt: Date;
}

export interface Bet {
  id: string;
  weekId: string;
  platform: 'bovada' | 'str8play';
  betType: 'single' | 'parlay';
  gameId: string;
  betCategory: 'spread' | 'total' | 'moneyline' | 'prop';
  line: string;
  odds: string;
  legs?: {
    gameId: string;
    betCategory: string;
    line: string;
    odds: string;
  }[];
  riskAmount: number;
  toWinAmount: number;
  actualPayout?: number;
  participants: string[];
  placedBy: string;
  platformReference: string;
  status: 'pending' | 'won' | 'lost' | 'push' | 'cancelled';
  settledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  parsedFrom: 'manual' | 'paste' | 'ocr';
}

export interface Settlement {
  id: string;
  weekId: string;
  season: number;
  userBalances: Record<string, number>;
  transactions: {
    from: string;
    to: string;
    amount: number;
  }[];
  status: 'pending' | 'completed';
  createdAt: Date;
  settledAt?: Date;
}

// Database service class
export class DatabaseService {
  // User operations
  static async createUser(userData: Omit<User, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'users'), {
      ...userData,
      joinedAt: Timestamp.fromDate(userData.joinedAt),
    });
    return docRef.id;
  }

  static async getUser(userId: string): Promise<User | null> {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        joinedAt: data.joinedAt.toDate(),
      } as User;
    }
    return null;
  }

  static async getActiveUsers(): Promise<User[]> {
    const q = query(
      collection(db, 'users'),
      where('isActive', '==', true)
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      joinedAt: doc.data().joinedAt.toDate(),
    })) as User[];
  }

  // Game operations
  static async saveGame(gameData: Omit<Game, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'games'), {
      ...gameData,
      gameTime: Timestamp.fromDate(gameData.gameTime),
      updatedAt: Timestamp.fromDate(gameData.updatedAt),
    });
    return docRef.id;
  }

  static async getGamesByWeek(weekId: string): Promise<Game[]> {
    const q = query(
      collection(db, 'games'),
      where('week', '==', weekId),
      orderBy('gameTime')
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      gameTime: doc.data().gameTime.toDate(),
      updatedAt: doc.data().updatedAt.toDate(),
    })) as Game[];
  }

  static async updateGameScore(gameId: string, homeScore: number, awayScore: number, status: Game['status']): Promise<void> {
    const docRef = doc(db, 'games', gameId);
    await updateDoc(docRef, {
      homeScore,
      awayScore,
      status,
      updatedAt: Timestamp.now(),
    });
  }

  // Vote operations
  static async castVote(voteData: Omit<Vote, 'id'>): Promise<string> {
    // Remove existing vote for this user/game/category
    const existingVotesQuery = query(
      collection(db, 'votes'),
      where('userId', '==', voteData.userId),
      where('gameId', '==', voteData.gameId),
      where('betCategory', '==', voteData.betCategory)
    );
    const existingVotes = await getDocs(existingVotesQuery);
    
    // Delete existing votes
    for (const voteDoc of existingVotes.docs) {
      await deleteDoc(voteDoc.ref);
    }

    // Add new vote
    const docRef = await addDoc(collection(db, 'votes'), {
      ...voteData,
      createdAt: Timestamp.fromDate(voteData.createdAt),
    });
    return docRef.id;
  }

  static async getVotesByWeek(weekId: string): Promise<Vote[]> {
    const q = query(
      collection(db, 'votes'),
      where('week', '==', weekId)
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt.toDate(),
    })) as Vote[];
  }

  // Bet operations
  static async saveBet(betData: Omit<Bet, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'bets'), {
      ...betData,
      createdAt: Timestamp.fromDate(betData.createdAt),
      updatedAt: Timestamp.fromDate(betData.updatedAt),
      settledAt: betData.settledAt ? Timestamp.fromDate(betData.settledAt) : null,
    });
    return docRef.id;
  }

  static async getBetsByWeek(weekId: string): Promise<Bet[]> {
    const q = query(
      collection(db, 'bets'),
      where('weekId', '==', weekId),
      orderBy('createdAt')
    );
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt.toDate(),
        updatedAt: data.updatedAt.toDate(),
        settledAt: data.settledAt?.toDate(),
      };
    }) as Bet[];
  }

  static async updateBetStatus(betId: string, status: Bet['status'], actualPayout?: number): Promise<void> {
    const updateData: any = {
      status,
      updatedAt: Timestamp.now(),
    };
    
    if (actualPayout !== undefined) {
      updateData.actualPayout = actualPayout;
      updateData.settledAt = Timestamp.now();
    }
    
    const docRef = doc(db, 'bets', betId);
    await updateDoc(docRef, updateData);
  }

  // Settlement operations
  static async createWeeklySettlement(settlementData: Omit<Settlement, 'id'>): Promise<string> {
    const docRef = await addDoc(collection(db, 'settlements'), {
      ...settlementData,
      createdAt: Timestamp.fromDate(settlementData.createdAt),
      settledAt: settlementData.settledAt ? Timestamp.fromDate(settlementData.settledAt) : null,
    });
    return docRef.id;
  }

  static async getSettlementByWeek(weekId: string): Promise<Settlement | null> {
    const q = query(
      collection(db, 'settlements'),
      where('weekId', '==', weekId),
      limit(1)
    );
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) return null;
    
    const doc = querySnapshot.docs[0];
    const data = doc.data();
    return {
      id: doc.id,
      ...data,
      createdAt: data.createdAt.toDate(),
      settledAt: data.settledAt?.toDate(),
    } as Settlement;
  }

  // Real-time subscriptions
  static subscribeToVotes(weekId: string, callback: (votes: Vote[]) => void) {
    const q = query(
      collection(db, 'votes'),
      where('week', '==', weekId)
    );
    
    return onSnapshot(q, (snapshot) => {
      const votes = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt.toDate(),
      })) as Vote[];
      callback(votes);
    });
  }

  static subscribeToGames(weekId: string, callback: (games: Game[]) => void) {
    const q = query(
      collection(db, 'games'),
      where('week', '==', weekId),
      orderBy('gameTime')
    );
    
    return onSnapshot(q, (snapshot) => {
      const games = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        gameTime: doc.data().gameTime.toDate(),
        updatedAt: doc.data().updatedAt.toDate(),
      })) as Game[];
      callback(games);
    });
  }
}