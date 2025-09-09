// database-schema.js
// Database schemas for the NFL betting app

/**
 * Firestore collection schemas and helper functions
 */

// Users collection schema
const UserSchema = {
  id: 'string', // Firebase auth UID
  name: 'string',
  email: 'string',
  joinedAt: 'timestamp',
  isActive: 'boolean',
  preferences: {
    notifications: 'boolean',
    defaultBetAmount: 'number'
  }
};

// Games collection schema
const GameSchema = {
  id: 'string', // generated ID
  week: 'string', // '2025-week-1'
  season: 'number', // 2025
  homeTeam: 'string',
  awayTeam: 'string',
  gameTime: 'timestamp',
  timeSlot: 'string', // 'thursday', 'sunday-early', 'sunday-late', 'sunday-night', 'monday'
  status: 'string', // 'scheduled', 'live', 'final'
  homeScore: 'number',
  awayScore: 'number',
  odds: {
    spread: { line: 'string', odds: 'string' },
    total: { line: 'string', odds: 'string' },
    moneyline: { home: 'string', away: 'string' }
  },
  updatedAt: 'timestamp'
};

// Votes collection schema
const VoteSchema = {
  id: 'string',
  userId: 'string',
  gameId: 'string',
  week: 'string',
  voteType: 'string', // 'thumbs-up', 'thumbs-down'
  betCategory: 'string', // 'spread', 'total', 'moneyline'
  createdAt: 'timestamp'
};

// Bets collection schema
const BetSchema = {
  id: 'string',
  weekId: 'string', // '2025-week-1'
  platform: 'string', // 'bovada', 'str8play'
  
  // Bet details
  betType: 'string', // 'single', 'parlay'
  gameId: 'string', // reference to Games collection
  betCategory: 'string', // 'spread', 'total', 'moneyline', 'prop'
  line: 'string', // '-7.5', 'over 48.5'
  odds: 'string', // '-110'
  
  // For parlays
  legs: [
    {
      gameId: 'string',
      betCategory: 'string',
      line: 'string',
      odds: 'string'
    }
  ],
  
  // Financial
  riskAmount: 'number',
  toWinAmount: 'number',
  actualPayout: 'number', // null until settled
  
  // Group tracking
  participants: ['string'], // array of user IDs
  placedBy: 'string', // user ID who placed the bet
  
  // Platform tracking
  platformReference: 'string', // ticket number or reference
  
  // Status
  status: 'string', // 'pending', 'won', 'lost', 'push', 'cancelled'
  settledAt: 'timestamp',
  
  // Metadata
  createdAt: 'timestamp',
  updatedAt: 'timestamp',
  parsedFrom: 'string' // 'manual', 'paste', 'ocr'
};

// Weekly settlements
const SettlementSchema = {
  id: 'string',
  weekId: 'string',
  season: 'number',
  
  // User balances for the week
  userBalances: {
    // userId: net amount (positive = owed money, negative = owes money)
    'user1': 'number',
    'user2': 'number'
  },
  
  // Simplified transactions (who pays whom)
  transactions: [
    {
      from: 'string', // user ID
      to: 'string', // user ID  
      amount: 'number'
    }
  ],
  
  status: 'string', // 'pending', 'completed'
  createdAt: 'timestamp',
  settledAt: 'timestamp'
};

/**
 * Firestore helper functions
 */
class BettingDatabase {
  constructor(firestore) {
    this.db = firestore;
  }

  // User management
  async createUser(userData) {
    const userRef = this.db.collection('users').doc(userData.id);
    await userRef.set({
      ...userData,
      joinedAt: new Date(),
      isActive: true
    });
    return userData.id;
  }

  async getActiveUsers() {
    const snapshot = await this.db.collection('users')
      .where('isActive', '==', true)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Game management
  async saveGame(gameData) {
    const gameRef = this.db.collection('games').doc();
    await gameRef.set({
      ...gameData,
      updatedAt: new Date()
    });
    return gameRef.id;
  }

  async getGamesByWeek(weekId) {
    const snapshot = await this.db.collection('games')
      .where('week', '==', weekId)
      .orderBy('gameTime')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Voting
  async castVote(voteData) {
    // Remove existing vote for this user/game/category
    const existingVote = await this.db.collection('votes')
      .where('userId', '==', voteData.userId)
      .where('gameId', '==', voteData.gameId)
      .where('betCategory', '==', voteData.betCategory)
      .get();
    
    existingVote.forEach(doc => doc.ref.delete());

    // Add new vote
    const voteRef = this.db.collection('votes').doc();
    await voteRef.set({
      ...voteData,
      createdAt: new Date()
    });
    return voteRef.id;
  }

  async getVotesByWeek(weekId) {
    const snapshot = await this.db.collection('votes')
      .where('week', '==', weekId)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  // Bet management
  async saveBet(betData) {
    const betRef = this.db.collection('bets').doc();
    await betRef.set({
      ...betData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    return betRef.id;
  }

  async getBetsByWeek(weekId) {
    const snapshot = await this.db.collection('bets')
      .where('weekId', '==', weekId)
      .orderBy('createdAt')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async updateBetStatus(betId, status, actualPayout = null) {
    const betRef = this.db.collection('bets').doc(betId);
    const updateData = {
      status,
      updatedAt: new Date()
    };
    
    if (actualPayout !== null) {
      updateData.actualPayout = actualPayout;
      updateData.settledAt = new Date();
    }
    
    await betRef.update(updateData);
  }

  // Settlement
  async createWeeklySettlement(weekId, userBalances, transactions) {
    const settlementRef = this.db.collection('settlements').doc();
    await settlementRef.set({
      weekId,
      season: new Date().getFullYear(),
      userBalances,
      transactions,
      status: 'pending',
      createdAt: new Date()
    });
    return settlementRef.id;
  }

  async getSettlementByWeek(weekId) {
    const snapshot = await this.db.collection('settlements')
      .where('weekId', '==', weekId)
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
  }
}

/**
 * Settlement calculation helper
 */
function calculateWeeklySettlement(bets, users) {
  const userBalances = {};
  
  // Initialize balances
  users.forEach(user => {
    userBalances[user.id] = 0;
  });

  // Calculate net winnings/losses for each user
  bets.forEach(bet => {
    if (bet.status === 'won') {
      // Distribute winnings among participants
      const winPerParticipant = bet.actualPayout / bet.participants.length;
      bet.participants.forEach(userId => {
        userBalances[userId] += winPerParticipant;
      });
    } else if (bet.status === 'lost') {
      // Distribute losses among participants
      const lossPerParticipant = bet.riskAmount / bet.participants.length;
      bet.participants.forEach(userId => {
        userBalances[userId] -= lossPerParticipant;
      });
    }
    // Pushes don't affect balances
  });

  // Calculate simplified transactions
  const transactions = simplifyDebts(userBalances);
  
  return { userBalances, transactions };
}

/**
 * Debt simplification algorithm
 */
function simplifyDebts(balances) {
  const transactions = [];
  const creditors = []; // People owed money (positive balance)
  const debtors = []; // People who owe money (negative balance)
  
  // Separate creditors and debtors
  Object.entries(balances).forEach(([userId, amount]) => {
    if (amount > 0.01) { // Ignore tiny amounts
      creditors.push({ userId, amount });
    } else if (amount < -0.01) {
      debtors.push({ userId, amount: Math.abs(amount) });
    }
  });
  
  // Sort by amount (largest first)
  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);
  
  let i = 0, j = 0;
  
  while (i < creditors.length && j < debtors.length) {
    const creditor = creditors[i];
    const debtor = debtors[j];
    
    const paymentAmount = Math.min(creditor.amount, debtor.amount);
    
    transactions.push({
      from: debtor.userId,
      to: creditor.userId,
      amount: Math.round(paymentAmount * 100) / 100 // Round to cents
    });
    
    creditor.amount -= paymentAmount;
    debtor.amount -= paymentAmount;
    
    if (creditor.amount < 0.01) i++;
    if (debtor.amount < 0.01) j++;
  }
  
  return transactions;
}

module.exports = {
  UserSchema,
  GameSchema,
  VoteSchema,
  BetSchema,
  SettlementSchema,
  BettingDatabase,
  calculateWeeklySettlement,
  simplifyDebts
};

// Example usage:
/*
const admin = require('firebase-admin');
const db = admin.firestore();
const bettingDB = new BettingDatabase(db);

// Save a parsed bet
const betData = {
  weekId: '2025-week-1',
  platform: 'bovada',
  betType: 'single',
  gameId: 'game-123',
  betCategory: 'spread',
  line: '+3.0',
  odds: '-115',
  riskAmount: 100,
  toWinAmount: 86.96,
  participants: ['user1', 'user2'],
  placedBy: 'user1',
  platformReference: '25092528197395',
  status: 'pending',
  parsedFrom: 'paste'
};

await bettingDB.saveBet(betData);
*/