# Code Duplication Analysis

This document identifies all instances of duplicated code that should be refactored into shared utilities.

## 1. Bet Resolution Logic

### Location 1: `/app/api/resolve-bets/route.ts` (lines 159-260)
- Moneyline resolution (lines 159-180)
- Over/Under resolution (lines 181-202)
- Spread resolution (lines 203-228)
- Player prop resolution (lines 229-260)

### Location 2: `/app/api/auto-resolve-bets/route.ts` (lines 97-229)
- Duplicates the same bet resolution logic
- Moneyline, Over/Under, Spread, Player Props
- Parlay resolution logic

### Duplication Pattern:
```typescript
// Moneyline (duplicated in both files)
const homeScore = game.homeScore || 0;
const awayScore = game.awayScore || 0;
const homeWon = homeScore > awayScore;
const betOnHome = bet.selection.toLowerCase().includes(game.homeTeam.toLowerCase());
if ((betOnHome && homeWon) || (betOnAway && awayWon)) {
  betResult = 'won';
}

// Over/Under (duplicated in both files)
const totalPoints = homeScore + awayScore;
const line = bet.line || 0;
const isOver = bet.selection.toLowerCase().includes('over');
betResult = isOver ? (totalPoints > line ? 'won' : 'lost') : (totalPoints < line ? 'won' : 'lost');

// Spread (duplicated in both files)
const homeAdjustedScore = homeScore + line;
const homeCovers = homeAdjustedScore > awayScore;
betResult = homeCovers ? 'won' : 'lost';
```

### Recommendation:
Create `/lib/bet-resolution.ts` with functions:
- `resolveMoneylineBet(bet, game): { result: 'won' | 'lost', description: string }`
- `resolveOverUnderBet(bet, game): { result: 'won' | 'lost', description: string }`
- `resolveSpreadBet(bet, game): { result: 'won' | 'lost', description: string }`
- `resolvePlayerPropBet(bet, game): { result: 'won' | 'lost', description: string }`
- `resolveParlayBet(bet, games): { result: 'won' | 'lost', description: string, legResults: any[] }`

## 2. User ID Normalization

### Location 1: `/app/api/fix-user-id-case/route.ts` (lines 20-32)
```typescript
if (participant === 'D/O' || participant === 'DIO' || participant === 'dio') {
  return 'd/o';
}
```

### Location 2: `/app/api/fix-user-names/route.ts` (lines 21-32)
```typescript
if (participant === 'dio' || participant === 'Dio' || participant === 'DIO' || participant === 'D/O') {
  return 'd/o';
}
```

### Location 3: Multiple hardcoded user arrays
- `/app/games-page.tsx` (lines 256, 433)
- `/app/api/games/route.ts` (line 43)
- `/app/api/weekly-settlement/route.ts` (line 44)

### Duplication Pattern:
```typescript
// Normalization logic duplicated
const normalized = ['D/O', 'DIO', 'dio', 'Dio'].includes(id) ? 'd/o' : id;

// User arrays hardcoded in multiple places
const allUserIds = ['will', 'd/o', 'rosen', 'charlie', 'pat'];
```

### Recommendation:
Create `/lib/user-utils.ts` with:
- `normalizeUserId(userId: string): string` - Normalizes user IDs to standard format
- `STANDARD_USER_IDS: string[]` - Single source of truth for user IDs
- `isValidUserId(userId: string): boolean` - Validates user IDs

## 3. Team Name Simplification

### Location 1: `/app/games-page.tsx` (lines 37-79)
```typescript
const simplifyTeamName = (text: string): string => {
  const teamReplacements: Record<string, string> = {
    'Green Bay Packers': 'Packers',
    'Kansas City Chiefs': 'Chiefs',
    // ... 30+ team mappings
  };
  // ...
}
```

### Location 2: `/app/games-page.tsx` (lines 82-125)
```typescript
const simplifyPlayerName = (text: string): string => {
  // Complex regex patterns for player name extraction
  // ...
}
```

### Recommendation:
Create `/lib/name-utils.ts` with:
- `simplifyTeamName(fullName: string): string`
- `simplifyPlayerName(fullName: string): string`
- `TEAM_NAME_MAPPINGS: Record<string, string>` - Centralized team mappings

## 4. Settlement Calculation

### Location 1: `/lib/firebase-service.ts` (settlementService, lines 298-363)
```typescript
// Calculate P&L for each bet
bets.forEach(bet => {
  if (bet.status === 'won' || bet.status === 'lost') {
    const amountPerPerson = bet.amountPerPerson;
    if (bet.status === 'won') {
      const totalPot = bet.totalAmount;
      const winnersShare = totalPot / bet.participants.length;
      // ...
    }
  }
});
```

### Location 2: `/app/api/weekly-settlement/route.ts`
- Similar settlement calculation logic

### Location 3: `/app/games-page.tsx` (lines 854-896)
- Client-side settlement calculation for display

### Recommendation:
Create `/lib/settlement-utils.ts` with:
- `calculateBetPayout(bet, odds): { profit: number, totalPayout: number }`
- `calculateUserSettlement(userId, bets): Settlement`
- `calculateWeekSettlement(weekendId, bets): Settlement[]`

## 5. Game ID Generation/Matching

### Location 1: `/lib/game-id-generator.ts`
- MD5 hash generation
- Readable ID generation

### Location 2: `/lib/firebase-service.ts` (gameIdMappingService)
- Game ID mapping logic

### Location 3: `/lib/odds-api.ts`
- Game ID generation during conversion

### Duplication Pattern:
- Multiple ways to generate/match game IDs
- Complex mapping logic scattered across files

### Recommendation:
Consolidate in `/lib/game-id-utils.ts`:
- `generateGameId(awayTeam, homeTeam, gameTime): string`
- `generateReadableId(awayTeam, homeTeam, gameTime): string`
- `matchGameById(gameId, games): Game | null`
- `matchGameByTeams(awayTeam, homeTeam, gameTime, games): Game | null`

## 6. Cache Validation Logic

### Location 1: `/lib/firebase-service.ts` (gameCacheService.isCacheValid, lines 473-495)
```typescript
isCacheValid(cachedAt: Date, games: Game[], maxAgeMinutes: number = 5): boolean {
  const ageInMinutes = (Date.now() - cachedAt.getTime()) / (1000 * 60);
  const hasCompletedGamesWithOdds = games.some(game => 
    game.status === 'final' && game.spread !== undefined
  );
  // ...
}
```

### Location 2: `/lib/firebase-service.ts` (playerPropsService.isCacheValid, lines 837-850)
```typescript
isCacheValid(cachedAt: Date, gameStatus?: string, maxAgeMinutes: number = 60): boolean {
  const ageInMinutes = (Date.now() - cachedAt.getTime()) / (1000 * 60);
  if (gameStatus === 'final') {
    return true;
  }
  // ...
}
```

### Location 3: In-memory cache in `OddsApiService` and `ESPNApiService`
- Similar cache validation patterns

### Recommendation:
Create `/lib/cache-utils.ts` with:
- `isCacheValid(cachedAt: Date, maxAge: number, options?: CacheOptions): boolean`
- `getCacheAge(cachedAt: Date): number` - Returns age in minutes
- Standardized cache duration constants

## 7. Weekend ID Generation

### Location 1: Multiple files use `2025-week-${week}` pattern
- `/app/games-page.tsx` (multiple locations)
- `/app/api/resolve-bets/route.ts`
- `/app/api/auto-resolve-bets/route.ts`
- `/lib/odds-api.ts`

### Duplication Pattern:
```typescript
const weekendId = `2025-week-${week}`;
```

### Recommendation:
Create `/lib/weekend-utils.ts` with:
- `generateWeekendId(week: number, year?: number): string`
- `parseWeekendId(weekendId: string): { week: number, year: number }`
- `CURRENT_SEASON_YEAR: number` - Single source of truth

## 8. Bet Status Checking

### Location 1: `/app/games-page.tsx` (lines 1119-1196)
```typescript
if (bet?.status === 'won') {
  // Calculate payout
} else if (bet?.status === 'lost') {
  // Calculate loss
} else {
  // Pending
}
```

### Location 2: `/components/GameCard.tsx` (lines 30-49)
```typescript
const getBetStatus = (betType: string, selection: string): 'active' | 'won' | 'lost' | null => {
  // Similar status checking logic
}
```

### Recommendation:
Create `/lib/bet-utils.ts` with:
- `getBetStatusDisplay(bet): { status: string, color: string, icon: string }`
- `calculateBetPayout(bet): { profit: number, totalPayout: number }`
- `isBetResolved(bet): boolean`

## Summary

### High Priority Refactoring:
1. **Bet Resolution Logic** - Used in 2+ files, complex logic
2. **User ID Normalization** - Used in multiple files, critical for data consistency
3. **Weekend ID Generation** - Used in 10+ files, simple but widespread

### Medium Priority Refactoring:
4. **Settlement Calculation** - Used in 3 files, important business logic
5. **Team/Player Name Simplification** - Used in UI, improves maintainability
6. **Cache Validation** - Used in multiple services, standardizes behavior

### Low Priority Refactoring:
7. **Game ID Generation** - Complex but less frequently used
8. **Bet Status Checking** - Simple logic, but used in multiple UI components

## Implementation Order

1. **Weekend ID Generation** (easiest, highest impact)
2. **User ID Normalization** (critical for data consistency)
3. **Bet Resolution Logic** (complex but high value)
4. **Settlement Calculation** (important business logic)
5. **Team/Player Name Utils** (UI improvements)
6. **Cache Validation** (standardization)
7. **Game ID Utils** (consolidation)
8. **Bet Status Utils** (UI improvements)

