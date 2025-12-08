# GroupBet Architecture Documentation

## System Overview

GroupBet is a Next.js 15 application for tracking group bets on NFL games. The architecture follows a server-side rendering pattern with client-side interactivity, using Firebase as the backend data store.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Browser                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   React UI   │  │  Next.js App │  │  Components  │      │
│  │  Components  │  │    Router    │  │  (Client)    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼────────────┘
          │                  │                  │
          │ HTTP Requests    │                  │
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼────────────┐
│                    Next.js Server                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   API Routes │  │ Server Pages │  │   Services   │      │
│  │  (App Router)│  │  (SSR/SSG)   │  │   (Lib)      │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼──────────────────┼──────────────────┼────────────┘
          │                  │                  │
          │                  │                  │
┌─────────▼──────────────────▼──────────────────▼────────────┐
│                    External APIs                             │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │  ESPN API   │  │  Odds API    │                        │
│  │  (Primary)  │  │  (Betting)   │                        │
│  └─────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
          │                  │
          │                  │
┌─────────▼──────────────────▼───────────────────────────────┐
│                    Firebase Firestore                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │    Bets      │  │    Games     │  │  Cache       │     │
│  │  Collection  │  │  Collection │  │  Collections │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Game Data Flow

```
ESPN API
   │
   │ (Fetch games for week)
   │
   ▼
OddsApiService.getNFLGames()
   │
   │ (Check Firebase cache)
   │
   ├─► Cache Hit? ──Yes──► Return cached games
   │
   └─► Cache Miss? ─No──► Fetch from ESPN API
          │
          │ (Enhance with betting lines)
          │
          ▼
      OddsApiService.enhanceGamesWithBettingLines()
          │
          │ (Fetch from Odds API)
          │
          ▼
      Save to Firebase Cache
          │
          ▼
      Return games to client
```

### 2. Bet Placement Flow

```
User clicks bet cell
   │
   ▼
BetPopup component opens
   │
   │ (User fills bet details)
   │
   ▼
betService.createBet()
   │
   │ (Client-side validation)
   │
   ▼
POST /api/add-bet
   │
   │ (Server-side validation)
   │
   ▼
Firebase Firestore
   │
   │ (Write to bets collection)
   │
   ▼
Return bet ID
   │
   ▼
Update UI with new bet
```

### 3. Bet Resolution Flow

```
Game completes (status = 'final')
   │
   ▼
Auto-resolve triggered
   │
   ├─► Scheduled job (cron)
   │   └─► /api/auto-resolve-bets
   │
   └─► Manual trigger
       └─► /api/resolve-bets
           │
           │ (Fetch active bets for week)
           │
           ▼
       For each active bet:
           │
           ├─► Moneyline? ──► Check winner
           ├─► Spread? ──► Check if covered
           ├─► Over/Under? ──► Check total points
           └─► Player Prop? ──► Check player stats
           │
           ▼
       Update bet status (won/lost)
           │
           ▼
       Save to Firebase
           │
           ▼
       Trigger settlement recalculation
```

### 4. Settlement Calculation Flow

```
Week ends (all games final)
   │
   ▼
GET /api/weekly-settlement?weekendId=2025-week-4
   │
   │ (Fetch all bets for week)
   │
   ▼
For each user:
   │
   ├─► Calculate wins (profit)
   ├─► Calculate losses (stake)
   └─► Net amount = wins - losses
   │
   ▼
Generate settlement transactions
   │
   │ (User A owes User B $X)
   │
   ▼
Return settlement data
   │
   ▼
Display in UI
```

## Caching Strategy

### Multi-Layer Caching Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Layer 1: In-Memory                    │
│              (OddsApiService, ESPNApiService)            │
│  • Duration: 5 min (upcoming), 30 sec (live)            │
│  • Scope: Per-service instance                           │
│  • Purpose: Reduce API calls during active use          │
└─────────────────────────────────────────────────────────┘
                        │
                        │ Cache miss
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Layer 2: Firebase Cache                    │
│              (gameCacheService)                         │
│  • Duration: 5 min (upcoming), 30 min (final)          │
│  • Scope: Shared across all users                       │
│  • Purpose: Persistent cache across sessions            │
└─────────────────────────────────────────────────────────┘
                        │
                        │ Cache miss
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Layer 3: External APIs                      │
│         (ESPN API, The Odds API)                        │
│  • Rate limited                                        │
│  • Strategic fetching (2+ days before, 2-6h before)     │
│  • Purpose: Source of truth                            │
└─────────────────────────────────────────────────────────┘
```

### Cache Invalidation Strategy

1. **Time-Based Expiration**:
   - Upcoming games: 5 minutes
   - Live games: 30 seconds (ESPN), 10 minutes (Odds API)
   - Final games: 30 minutes (ESPN), 1 hour (Odds API)

2. **Event-Based Invalidation**:
   - Game status changes (upcoming → live → final)
   - Force refresh requested by user
   - Cache corruption detected

3. **Strategic Caching**:
   - Betting lines: Fetch 2+ days before game, refresh 2-6h before
   - Player props: Fetch when available, freeze 1h before game
   - Final results: Store permanently in `final_games` collection

### Cache Collections

1. **`games`** - Current week games with betting lines
2. **`final_games`** - Completed games with final scores and stats
3. **`player_props`** - Player prop betting lines
4. **`pre_game_odds`** - Frozen betting lines (never change after game starts)
5. **`game_id_mappings`** - Maps between internal and external API IDs

## Component Architecture

### Component Hierarchy

```
App (Root)
├── RootLayout
│   ├── Providers (React Query)
│   ├── GroupProvider
│   └── UserProvider
│       └── Page (Server Component)
│           └── AppWrapper (Client Component)
│               └── GamesPage (Client Component)
│                   ├── UserSelector
│                   ├── BetSummary
│                   ├── SettlementPanel
│                   ├── BetCardsGrid
│                   │   └── BetCard (per bet)
│                   └── TimeSlotSections
│                       └── GameCard (per game)
│                           └── BettingOptions
│
├── BetPopup (Modal)
├── EditBetModal (Modal)
├── ParlayBuilder (Modal)
└── ParlayPanel (Floating)
```

### Key Components

1. **GamesPage** (`app/games-page.tsx`)
   - Main UI component (1567 lines)
   - Manages game state, bets, settlements
   - Handles week navigation
   - Coordinates bet placement and resolution

2. **GameCard** (`components/GameCard.tsx`)
   - Displays individual game
   - Shows betting lines (spread, over/under, moneyline)
   - Handles bet cell clicks
   - Shows bet status indicators

3. **BetPopup** (`components/BetPopup.tsx`)
   - Modal for placing bets
   - Handles bet type selection
   - Manages participants and amounts
   - Supports group and head-to-head bets

4. **ParlayBuilder** (`components/ParlayBuilder.tsx`)
   - Modal for creating parlay bets
   - Allows selecting multiple legs
   - Calculates combined odds
   - Validates parlay requirements

## Service Layer Architecture

### Service Organization

```
lib/
├── firebase-service.ts (1121 lines)
│   ├── betService
│   ├── gameCacheService
│   ├── finalGameService
│   ├── playerPropsService
│   ├── gameIdMappingService
│   ├── preGameOddsService
│   └── settlementService
│
├── odds-api.ts (1258 lines)
│   └── OddsApiService
│       ├── getNFLGames()
│       ├── enhanceGamesWithBettingLines()
│       ├── getPlayerProps()
│       └── getTimeSlot()
│
├── espn-api.ts
│   └── ESPNApiService
│       ├── getScoreboard()
│       ├── getGameDetails()
│       └── getPlayerStats()
│
├── betting-odds.ts
│   └── Betting odds calculations
│
├── time-slot-utils.ts (NEW)
│   └── getTimeSlot() - Shared utility
│
└── utils.ts
    └── Helper functions
```

### Service Responsibilities

1. **firebase-service.ts**:
   - All Firestore operations
   - Bet CRUD operations
   - Game caching
   - Settlement calculations

2. **odds-api.ts**:
   - The Odds API integration
   - Betting lines fetching
   - Player props fetching
   - Game data enhancement

3. **espn-api.ts**:
   - ESPN API integration
   - Live scores
   - Game status
   - Player statistics

## API Route Architecture

### Route Categories

1. **Production Routes** (11 endpoints):
   - `/api/games` - Fetch games
   - `/api/add-bet` - Create bet
   - `/api/update-bet` - Update bet
   - `/api/delete-bet` - Delete bet
   - `/api/resolve-bets` - Resolve bets
   - `/api/auto-resolve-bets` - Auto-resolve
   - `/api/weekly-settlement` - Calculate settlement
   - `/api/add-player-prop` - Add player prop
   - `/api/fetch-player-props` - Fetch props
   - `/api/manual-resolve-bet` - Manual resolve
   - `/api/store-final-results` - Store results

2. **Debug Routes** (15 endpoints) - To be removed
3. **Fix Routes** (16 endpoints) - To be removed
4. **Test Routes** (6 endpoints) - To be removed
5. **Cleanup Routes** (4 endpoints) - To be removed

## State Management

### Client-Side State

1. **React Context**:
   - `UserContext` - Current user, user switching
   - `GroupContext` - Group session management

2. **React Query** (TanStack Query):
   - Game data caching
   - Bet data caching
   - Automatic refetching
   - Optimistic updates

3. **Local State** (useState):
   - UI state (modals, selections)
   - Form state (bet popup)
   - Week navigation

### Server-Side State

- Firebase Firestore (source of truth)
- In-memory caches (API services)
- Server-side data fetching (Next.js App Router)

## Data Models

### Core Entities

1. **Game**:
   - Game information (teams, time, scores)
   - Betting lines (spread, over/under, moneyline)
   - Player props
   - Status (upcoming, live, final)

2. **Bet**:
   - Bet details (type, selection, odds, line)
   - Participants
   - Financial (amount, payout)
   - Status (active, won, lost, unknown, cancelled)

3. **Settlement**:
   - User net amounts
   - Bet breakdown
   - Payment tracking

4. **User**:
   - User ID, name, PIN
   - Friend group membership

## Security Architecture

### Current Security Model

1. **Authentication**: Cookie-based (no Firebase Auth)
2. **Authorization**: Client-side only (no security rules)
3. **Validation**: Limited server-side validation
4. **Data Access**: Direct Firestore access from client

### Recommended Security Model

1. **Authentication**: Firebase Auth or server-side sessions
2. **Authorization**: Firestore security rules
3. **Validation**: Comprehensive server-side validation
4. **Data Access**: API routes only (no direct client access)

## Deployment Architecture

### Vercel Deployment

```
GitHub Repository
   │
   │ (Push to branch)
   │
   ▼
Vercel (Connected to GitHub)
   │
   │ (Auto-deploy on push)
   │
   ▼
Build Process
   │
   ├─► Install dependencies
   ├─► Run build (next build)
   ├─► Optimize assets
   └─► Deploy to edge network
   │
   ▼
Production (groupbet.vercel.app)
```

### Environment Variables

- `NEXT_PUBLIC_FIREBASE_*` - Firebase configuration
- `NEXT_PUBLIC_ODDS_API_KEY` - The Odds API key
- (ESPN API requires no key)

## Performance Considerations

### Current Optimizations

1. **Server-Side Rendering**: Initial page load optimized
2. **Caching**: Multi-layer caching reduces API calls
3. **Code Splitting**: Next.js automatic code splitting

### Optimization Opportunities

1. **Bundle Size**: Large client bundle (~800KB-1.2MB)
2. **Lazy Loading**: Firebase SDK, modals, API services
3. **Component Splitting**: games-page.tsx (1567 lines)
4. **Tree Shaking**: date-fns, lucide-react icons

## Error Handling

### Current Approach

1. **Try-Catch Blocks**: In critical paths
2. **Error Logging**: Console logging
3. **Fallback Values**: Default to empty arrays/null
4. **User Feedback**: Limited error messages

### Recommended Improvements

1. **Error Boundaries**: React error boundaries
2. **Error Tracking**: Sentry or similar
3. **User-Friendly Messages**: Clear error messages
4. **Retry Logic**: Automatic retry for transient errors

## Monitoring & Observability

### Current State

- Console logging only
- No error tracking
- No performance monitoring
- No analytics

### Recommended

1. **Error Tracking**: Sentry
2. **Performance Monitoring**: Vercel Analytics
3. **API Monitoring**: Firebase usage tracking
4. **User Analytics**: Privacy-respecting analytics

## Future Architecture Considerations

1. **Microservices**: Split API routes into separate services
2. **GraphQL**: Consider GraphQL for flexible data fetching
3. **Real-time Updates**: WebSocket for live game updates
4. **Offline Support**: Service workers for offline functionality
5. **Mobile App**: React Native version using shared logic


