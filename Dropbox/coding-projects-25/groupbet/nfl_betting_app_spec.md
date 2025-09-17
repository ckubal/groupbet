# NFL Group Betting Tracker - Technical Specification

## Project Overview

Build a mobile-first web application for tracking group bets on NFL games. The app focuses on simplicity, ease of bet input, real-time tracking, and automated settlement calculations for a consistent friend group.

## Core User Flows

### 1. Weekly Betting Cycle
- Automatic weekly rollover (Tuesday night/Wednesday morning)
- Games grouped by start time: Thursday Night, Sunday 10am PT, Sunday 1pm PT, Sunday Night, Monday Night
- Current week is primary view with navigation to previous weeks (read-only archive)

### 2. Bet Placement Flow
- Tap any bet cell on a game card to open bet popup
- Popup auto-fills with selected bet details (spread, over/under, player prop, etc.)
- Default: 4 people × $50 = $200 total (both fields independently editable)
- Select bet placer and participants from friend group
- Allow editing of odds/lines if user found better elsewhere

### 3. Real-time Tracking
- Persistent weekend summary header showing: total wagered, bets won/lost/in-progress, net position
- Visual indicators on game cards: upcoming (gray), live (green/pulsing), final (score overlay)
- Highlight placed bets with colored borders/backgrounds on relevant cells
- "My Active Bets" view showing only current user's live bets with status

### 4. Settlement & Payment
- Automatic bet resolution when games go final (won/lost/unknown status)
- Net settlement calculation at weekend end
- Simple payment tracking: either party can mark as paid
- Expandable details showing bet-by-bet breakdown leading to net amounts

## Technical Architecture

### Frontend Stack
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS (mobile-first)
- **State Management**: React Query + Context API
- **Real-time Updates**: Firebase Realtime Database listeners

### Backend Stack
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth (simple PIN-based system)
- **API Integration**: Cloud Functions for sports data
- **Hosting**: Firebase Hosting

### External APIs
- **Primary**: ESPN API or The Odds API for live scores and basic stats
- **Backup**: Manual entry fallback for missing data
- **Caching**: Firebase Functions with scheduled updates every 2-3 minutes during games

## Data Models

### User
```typescript
interface User {
  id: string;
  name: string;
  pin: string; // 4-digit PIN
  createdAt: Date;
}
```

### Weekend
```typescript
interface Weekend {
  id: string; // e.g., "2025-week-16"
  weekNumber: number;
  season: number;
  startDate: Date;
  endDate: Date;
  status: 'upcoming' | 'active' | 'settling' | 'archived';
  createdAt: Date;
}
```

### Game
```typescript
interface Game {
  id: string;
  weekendId: string;
  homeTeam: string;
  awayTeam: string;
  gameTime: Date;
  timeSlot: 'thursday' | 'sunday_early' | 'sunday_late' | 'sunday_night' | 'monday';
  status: 'upcoming' | 'live' | 'final';
  homeScore?: number;
  awayScore?: number;
  
  // Betting lines
  spread?: number; // negative means home team favored
  spreadOdds?: number; // e.g., -110
  overUnder?: number;
  overUnderOdds?: number;
  homeMoneyline?: number;
  awayMoneyline?: number;
  
  // Player props (if available)
  playerProps?: PlayerProp[];
}
```

### PlayerProp
```typescript
interface PlayerProp {
  playerId: string;
  playerName: string;
  propType: 'passing_yards' | 'rushing_yards' | 'receiving_yards';
  line: number;
  overOdds: number;
  underOdds: number;
}
```

### Bet
```typescript
interface Bet {
  id: string;
  weekendId: string;
  gameId: string;
  placedBy: string; // userId
  participants: string[]; // userIds
  
  // Bet details
  betType: 'spread' | 'over_under' | 'moneyline' | 'player_prop';
  selection: string; // e.g., "over", "under", "home", "away"
  line?: number; // the actual line bet on
  odds: number; // e.g., -110
  
  // Player prop specific
  playerId?: string;
  playerName?: string;
  propType?: 'passing_yards' | 'rushing_yards' | 'receiving_yards';
  
  // Financial
  totalAmount: number;
  amountPerPerson: number;
  
  // Status
  status: 'active' | 'won' | 'lost' | 'unknown' | 'cancelled';
  result?: string; // description of outcome
  
  createdAt: Date;
  resolvedAt?: Date;
}
```

### Settlement
```typescript
interface Settlement {
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
```

## UI Components & Layout

### Mobile-First Game Cards
```jsx
// Game Card Structure
<GameCard>
  <GameHeader> {/* Team names, time, score if live/final */}
    <GameStatus /> {/* Visual indicator: upcoming/live/final */}
  </GameHeader>
  
  <BettingGrid>
    <BetRow>
      <BetCell type="spread" highlight={userHasBet} />
      <BetCell type="moneyline" highlight={userHasBet} />
    </BetRow>
    <BetRow>
      <BetCell type="over" highlight={userHasBet} />
      <BetCell type="under" highlight={userHasBet} />
    </BetRow>
    <CollapsibleSection label="Player Props">
      {playerProps.map(prop => 
        <BetRow key={prop.id}>
          <BetCell type="prop_over" highlight={userHasBet} />
          <BetCell type="prop_under" highlight={userHasBet} />
        </BetRow>
      )}
      <ManualPropEntry /> {/* Fallback for missing props */}
    </CollapsibleSection>
  </BettingGrid>
</GameCard>
```

### Weekend Summary Header
```jsx
<WeekendSummary>
  <WeekNavigation /> {/* Previous/Next week arrows */}
  <SummaryStats>
    <Stat label="Total Wagered" value="$1,200" />
    <Stat label="Bets" value="2W • 1L • 3 Active" />
    <Stat label="Your Position" value="+$75" highlight="positive" />
    <Stat label="In Play" value="$150" />
  </SummaryStats>
  <ExpandableSection label="My Active Bets">
    <ActiveBetsList />
  </ExpandableSection>
</WeekendSummary>
```

### Bet Placement Popup
```jsx
<BetPopup>
  <BetSummary> {/* Auto-filled bet details */}
    <EditableField label="Line" value={line} />
    <EditableField label="Odds" value={odds} />
  </BetSummary>
  
  <BetAmount>
    <EditableField label="People" value={4} />
    <EditableField label="Total Amount" value={200} />
    <CalculatedField label="Per Person" value={50} />
  </BetAmount>
  
  <ParticipantSelector>
    <UserSelect label="Bet Placer" required />
    <UserMultiSelect label="Participants" defaultCount={4} />
  </ParticipantSelector>
  
  <ActionButtons>
    <Button variant="secondary" onClick={cancel}>Cancel</Button>
    <Button variant="primary" onClick={placeBet}>Place Bet</Button>
  </ActionButtons>
</BetPopup>
```

## Key Features Implementation

### 1. Real-time Data Updates
- Firebase Realtime Database listeners for live game scores
- Cloud Functions scheduled every 2-3 minutes during game hours
- User-initiated refresh always fetches fresh data
- Graceful degradation when APIs are unavailable

### 2. Automatic Bet Resolution
- Cloud Function triggered when games go final
- Compare final stats against bet parameters
- Mark bets as won/lost/unknown (for manual review)
- Calculate settlement amounts for each user

### 3. Settlement System
- Net settlement calculation across all weekend bets
- Expandable detail view showing contributing bets
- Dual-party payment confirmation system
- Dispute handling for incorrectly resolved bets

### 4. Simple Authentication
- Cookie-based user identification
- 4-digit PIN for light security
- Friend group pre-configured (no registration flow)
- Session persistence across devices

## Development Phases

### Phase 1: Core MVP
1. Basic game display and bet placement
2. Manual odds entry (no API integration yet)
3. Simple bet tracking and status updates
4. Weekend rollover functionality

### Phase 2: Dual-API Real-time Integration  
1. The Odds API integration for pre-game betting lines and player props
2. ESPN API integration for live player statistics and game state
3. Data enrichment system combining both API sources
4. Live progress tracking for player prop bets (e.g., "Mahomes: 187/275.5 yards")
5. Real-time UI updates with progress bars and completion percentages
6. Automatic bet resolution using final stats from ESPN API

### Phase 3: Advanced Features
1. Settlement automation and payment tracking
2. Historical week navigation
3. Manual bet resolution interface
4. Advanced player prop support

### Phase 4: Polish & Optimization
1. Enhanced mobile UX and animations
2. Performance optimization and caching
3. Error handling and offline support
4. User feedback and refinements

## Firebase Configuration

### Firestore Collections
```
/users/{userId}
/weekends/{weekendId}
/games/{gameId}
/bets/{betId}
/settlements/{settlementId}
```

### Security Rules
- Users can only modify their own bets and settlements
- All users in friend group can read all data
- Cloud Functions have elevated permissions for data updates

### Cloud Functions
- `updateGameScores` - Scheduled function for live data
- `resolveWeekendBets` - Triggered when all games complete
- `rolloverWeekend` - Scheduled for Tuesday night
- `calculateSettlements` - Compute net positions

## Success Metrics
- **Ease of Use**: Average time to place a bet < 30 seconds
- **Real-time Accuracy**: Score updates within 3 minutes of actual events
- **Settlement Accuracy**: < 5% manual corrections needed
- **Mobile Performance**: Page load times < 2 seconds on 3G

## Technical Considerations
- **Responsive Design**: Mobile-first with tablet/desktop optimization
- **Performance**: Lazy loading for historical weeks, efficient re-renders
- **Error Handling**: Graceful API failures with manual entry fallbacks
- **Data Consistency**: Optimistic updates with rollback on conflicts
- **Accessibility**: Proper ARIA labels, keyboard navigation support

This specification provides a complete roadmap for building a robust, user-friendly NFL betting tracker that handles the complexities of group betting while maintaining simplicity in the user experience.