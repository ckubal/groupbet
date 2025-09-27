export interface User {
  id: string;
  name: string;
  pin: string; // 4-digit PIN
  createdAt: Date;
}

export interface Weekend {
  id: string; // e.g., "2025-week-16"
  weekNumber: number;
  season: number;
  startDate: Date;
  endDate: Date;
  status: 'upcoming' | 'active' | 'settling' | 'archived';
  createdAt: Date;
}

export interface Game {
  id: string; // Consistent MD5 hash ID generated from date + teams
  espnId?: string; // Original ESPN ID for reference
  readableId?: string; // Human-readable ID: YYYYMMDD-awayteam-hometeam
  weekMetadata?: string; // "Week 2, 2025" for easy display
  weekendId: string;
  homeTeam: string;
  awayTeam: string;
  gameTime: Date;
  timeSlot: 'thursday' | 'sunday_early' | 'sunday_afternoon' | 'sunday_night' | 'monday';
  status: 'upcoming' | 'live' | 'final';
  homeScore?: number;
  awayScore?: number;
  
  // Live game situation (only present when status is 'live')
  quarter?: number;
  timeRemaining?: string;
  possession?: string; // team name that has possession
  yardLine?: number; // yard line (0-50, where 50 is midfield)
  fieldPosition?: 'own' | 'opponent'; // own territory or opponent territory
  isRedZone?: boolean; // true if possessing team is in red zone (opponent's 20 yard line)
  
  // Betting lines
  spread?: number; // negative means home team favored
  spreadOdds?: number; // e.g., -110
  overUnder?: number;
  overUnderOdds?: number;
  homeMoneyline?: number;
  awayMoneyline?: number;
  
  // Player props (if available)
  playerProps?: PlayerProp[];
  
  // Player statistics (for completed games)
  playerStats?: PlayerStats[];
}

export interface PlayerStats {
  playerId: string;
  playerName: string;
  team: string;
  // Passing stats
  passingYards?: number;
  passingTDs?: number;
  completions?: number;
  attempts?: number;
  // Rushing stats
  rushingYards?: number;
  rushingTDs?: number;
  carries?: number;
  // Receiving stats
  receivingYards?: number;
  receivingTDs?: number;
  receptions?: number;
}

export interface PlayerProp {
  playerId: string;
  playerName: string;
  propType: 'passing_yards' | 'rushing_yards' | 'receiving_yards';
  line: number;
  overOdds: number;
  underOdds: number;
}

export interface Bet {
  id: string;
  weekendId: string;
  gameId: string;
  nflWeek?: number; // NFL week number for easier game matching
  placedBy: string; // userId
  participants: string[]; // userIds
  
  // Bet details
  betType: 'spread' | 'over_under' | 'moneyline' | 'player_prop' | 'parlay';
  selection: string; // e.g., "over", "under", "home", "away"
  line?: number; // the actual line bet on
  odds: number; // e.g., -110
  
  // Player prop specific
  playerId?: string;
  playerName?: string;
  propType?: 'passing_yards' | 'rushing_yards' | 'receiving_yards';
  
  // Parlay specific
  parlayLegs?: {
    betId: string;  // Reference to individual bet (or could be inline bet data)
    gameId: string;
    betType: 'spread' | 'over_under' | 'moneyline' | 'player_prop';
    selection: string;
    line?: number;
    odds: number;
    status?: 'pending' | 'won' | 'lost';
    result?: string;
  }[];
  parlayOdds?: number;  // Combined odds for the entire parlay
  
  // Betting mode
  bettingMode: 'group' | 'head_to_head' | 'parlay'; // Default: group (everyone on same side)
  
  // Head-to-head specific (when bettingMode is 'head_to_head')
  sideA?: {
    participants: string[]; // userIds on this side
    selection: string; // what this side is betting on
  };
  sideB?: {
    participants: string[]; // userIds on this side  
    selection: string; // what this side is betting on
  };
  
  // Financial
  totalAmount: number;
  amountPerPerson: number;
  
  // Status
  status: 'active' | 'won' | 'lost' | 'unknown' | 'cancelled';
  result?: string; // description of outcome
  winningSide?: 'A' | 'B'; // For head-to-head bets, which side won
  
  createdAt: Date;
  resolvedAt?: Date;
}

export interface Settlement {
  id: string;
  weekendId: string;
  userId: string;
  netAmount: number; // positive = owed money, negative = owes money
  betBreakdown: {
    betId: string;
    amount: number; // won or lost amount for this user
  }[];
  paidAmount: number;
  paidAt?: Date;
  paidBy?: string; // which user marked it as paid
  status: 'pending' | 'paid' | 'disputed';
}