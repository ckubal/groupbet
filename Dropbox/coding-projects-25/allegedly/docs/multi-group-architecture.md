# Multi-Group Betting System Architecture

## Overview
Enhanced system supporting multiple betting groups, head-to-head private bets, and group-based bet coordination.

## Data Models

### User
```typescript
interface User {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  createdAt: Date;
  lastActive: Date;
}
```

### Group
```typescript
interface Group {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  members: GroupMember[];
  settings: GroupSettings;
  createdAt: Date;
  updatedAt: Date;
}

interface GroupMember {
  userId: string;
  role: 'admin' | 'member';
  joinedAt: Date;
  nickname?: string; // Optional group-specific nickname
}

interface GroupSettings {
  isPrivate: boolean;
  allowHeadToHeadBets: boolean;
  defaultBetAmounts: number[]; // e.g. [10, 25, 50, 100]
  minimumBetAmount: number;
  maximumBetAmount: number;
  settlementDay: 'sunday' | 'monday' | 'tuesday'; // When bets are settled
}
```

### Bet Types

#### 1. Group Consensus Bets (Current System Enhanced)
```typescript
interface GroupConsensusBet {
  id: string;
  groupId: string;
  gameId: string;
  betType: 'spread' | 'total' | 'moneyline' | 'player_prop';
  title: string; // "Week 1 - Chiefs vs Ravens Spread"
  description?: string;
  selections: GroupSelection[];
  status: 'open' | 'locked' | 'settled';
  settledAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface GroupSelection {
  userId: string;
  selection: string; // 'home', 'away', 'over', 'under', etc.
  confidence?: number; // 1-5 scale
  note?: string;
  createdAt: Date;
}
```

#### 2. Head-to-Head Private Bets (New)
```typescript
interface HeadToHeadBet {
  id: string;
  groupId: string;
  gameId?: string; // Optional - could be custom bet
  title: string;
  description: string;
  amount: number;
  currency: 'USD' | 'points'; // Real money or point system
  
  // Participants
  proposedBy: string; // User ID
  acceptedBy?: string; // User ID
  
  // Bet details
  betType: 'moneyline' | 'spread' | 'total' | 'custom';
  line?: string; // "Chiefs -3.5" or "Over 45.5"
  odds?: string; // American odds if different from standard
  customDescription?: string; // For non-standard bets
  
  // Status
  status: 'proposed' | 'accepted' | 'declined' | 'settled' | 'cancelled';
  proposedAt: Date;
  acceptedAt?: Date;
  settledAt?: Date;
  
  // Settlement
  winner?: string; // User ID
  settledBy?: string; // User ID who marked it settled
  disputeStatus?: 'none' | 'disputed' | 'resolved';
  
  // Metadata
  expiresAt?: Date; // Auto-decline if not accepted by this time
  notes?: string;
}
```

#### 3. Sportsbook Coordination (Enhanced)
```typescript
interface SportsbookBet {
  id: string;
  groupId: string;
  userId: string; // Who placed the bet
  gameId: string;
  
  // Bet details from slip parsing
  sportsbook: 'bovada' | 'draftkings' | 'fanduel' | 'other';
  betType: string;
  selection: string;
  odds: string;
  amount: number;
  potentialPayout: number;
  
  // Slip data
  slipText?: string; // Original slip text
  slipImage?: string; // Screenshot URL
  betSlipId?: string; // Sportsbook's bet ID
  
  // Group coordination
  isShared: boolean; // Shared with group for tracking
  followers: string[]; // Users who want to "tail" this bet
  
  // Status
  status: 'pending' | 'won' | 'lost' | 'pushed' | 'cancelled';
  settledAt?: Date;
  actualPayout?: number;
  
  createdAt: Date;
  updatedAt: Date;
}
```

## User Experience Flow

### 1. Group Management
```
- User Dashboard
  ├── My Groups
  │   ├── "College Friends" (5 members)
  │   ├── "Work League" (8 members) 
  │   └── "High Stakes" (3 members)
  ├── Group Invitations (2 pending)
  └── Create New Group
```

### 2. Group View
```
- Group: "College Friends"
  ├── Current Week Games
  │   ├── Group Consensus Bets
  │   ├── Head-to-Head Challenges
  │   └── Shared Sportsbook Bets
  ├── Leaderboard / Standings
  ├── Settlement Center
  └── Group Settings
```

### 3. Game View (Per Group)
```
- Chiefs vs Ravens
  ├── Group Consensus
  │   ├── Spread: KC -2.5 (3 votes home, 2 away)
  │   └── Total: 51.5 (4 over, 1 under)
  ├── Head-to-Head Bets
  │   ├── "John vs Mike: $50 on Chiefs ML" (pending)
  │   └── "Steve vs Dave: $25 on Over 51.5" (accepted)
  └── Sportsbook Bets
      ├── "John placed $100 on Chiefs -2.5 at DK"
      └── "Mike tailed John's bet for $50"
```

## Implementation Phases

### Phase 2A: Multi-Group Foundation
1. **Group Creation & Management**
   - Create/join groups
   - Group member management
   - Group-specific game views

2. **Enhanced User System**
   - User profiles
   - Group memberships
   - Group switching

### Phase 2B: Head-to-Head Bets
1. **Bet Proposal System**
   - Create private bet challenges
   - Accept/decline interface
   - Bet terms negotiation

2. **Settlement System**
   - Manual settlement interface
   - Dispute resolution
   - Payment tracking (IOU system)

### Phase 2C: Advanced Features
1. **Sportsbook Integration**
   - Enhanced slip parsing
   - Bet sharing and tailing
   - Performance tracking

2. **Social Features**
   - Group chat/comments
   - Leaderboards
   - Achievement system

## Technical Considerations

### Database Structure (Firebase)
```
users/
  {userId}/
    profile: User
    groupMemberships: GroupMember[]

groups/
  {groupId}/
    info: Group
    members: { [userId]: GroupMember }
    
groupBets/
  {groupId}/
    consensus/
      {betId}: GroupConsensusBet
    headToHead/
      {betId}: HeadToHeadBet
    sportsbook/
      {betId}: SportsbookBet

games/
  {gameId}/
    info: Game
    odds: OddsData
```

### UI Components Needed
1. **GroupSelector** - Switch between groups
2. **GroupManagement** - Create/manage groups
3. **HeadToHeadBetCard** - Propose/accept private bets
4. **BetSettlementCenter** - Resolve completed bets
5. **GroupStandings** - Leaderboard and statistics

### Business Logic
1. **Settlement Engine** - Calculate winnings/losses
2. **Notification System** - Bet proposals, settlements
3. **Permission System** - Group roles and access
4. **Conflict Resolution** - Disputed bet handling

## Migration Strategy

### From Current System
1. **Backward Compatibility** - Current single-group mode still works
2. **Data Migration** - Convert existing selections to first group
3. **Progressive Enhancement** - Add group features gradually
4. **User Onboarding** - Guide existing users through new features

This architecture supports:
✅ Multiple groups per user
✅ Head-to-head private betting
✅ Group consensus tracking
✅ Sportsbook bet coordination
✅ Flexible settlement systems
✅ Scalable to larger friend networks