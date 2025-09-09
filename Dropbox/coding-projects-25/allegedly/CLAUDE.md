# NFL Betting Coordination App - "Allegedly"

## Project Overview
A comprehensive NFL betting coordination app designed for a friend group to coordinate picks, track consensus, place actual bets, and manage settlements. The app helps groups make more informed betting decisions while maintaining transparency around performance and financial settlements.

## Architecture & Tech Stack
- **Framework**: Next.js 14 (React with TypeScript)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **External APIs**: The Odds API (with fallback to mock data)
- **Deployment**: Ready for Vercel/similar platforms

## Core Features

### Phase 1 - Consensus Building (Completed)
- **Multi-user voting system** for NFL games across spread, total, and moneyline
- **Consensus analysis** showing unanimous picks, strong consensus, and divided opinions  
- **Player props integration** with dynamic odds fetching
- **Real-time vote counting** and group alignment visualization
- **User selection management** with persistent user identification

### Phase 2 - Actual Betting & Tracking (Completed)
- **Actual bet tracking** with deduplication logic to prevent double-entry
- **Bet slip image uploads** for verification and record-keeping
- **Live game tracking** with real-time score updates and automatic bet result evaluation
- **Head-to-head betting** system with no vig between friends
- **Performance tracking** with P&L calculations and win rate analytics
- **Weekend settlement** system for automatic squaring up
- **Seasonal ledger** with running balance graphs and historical performance

## Key Components

### Core Betting Components
- **`GameCard.tsx`** - Individual game display with betting options and H2H creation
- **`ActualBetsTracker.tsx`** - Main bet entry and tracking interface
- **`HeadToHeadBetCreator.tsx`** - Modal for creating peer-to-peer bets
- **`ConsensusAnalysis.tsx`** - Group consensus visualization and analysis

### Performance & Analytics
- **`BettingPerformanceTracker.tsx`** - User leaderboards and recent activity
- **`WeekendSettlement.tsx`** - Automatic settlement calculations and payment tracking
- **`SeasonalLedger.tsx`** - Long-term performance with text-based charts
- **`LiveGameTracker.tsx`** - Real-time game monitoring and bet evaluation

### Supporting Components
- **`UserSelector.tsx`** - User identification and switching
- **`PlayerPropsDropdown.tsx`** - Dynamic player prop betting options

## Data Models

### ActualBet Interface
```typescript
interface ActualBet {
  id: string;
  type: 'standard' | 'player_prop' | 'head_to_head';
  gameId: string;
  game: Game;
  betDetails: {
    betType: 'spread' | 'total' | 'moneyline' | 'player_prop';
    selection: string;
    odds: number;
    stake: number;
  };
  creator: string;
  participants: string[];
  status: 'pending' | 'won' | 'lost' | 'push' | 'live';
  createdAt: Date;
  settledAt?: Date;
  imageUrl?: string;
  isVerified: boolean;
  notes?: string;
  h2h?: {
    sideA: { selection: string; participants: string[]; };
    sideB: { selection: string; participants: string[]; };
    amount: number;
    acceptedBy?: string[];
    isOpen: boolean;
  };
}
```

### WeeklySettlement Interface  
```typescript
interface WeeklySettlement {
  id: string;
  weekStart: Date;
  weekEnd: Date;
  userBalances: { [userId: string]: number };
  transactions: {
    from: string;
    to: string;
    amount: number;
    description: string;
  }[];
  totalAction: number;
  isSettled: boolean;
  settledAt?: Date;
}
```

## Friend Group Configuration
Default participants (hardcoded): Will, D.O., Rosen, Charlie, Pat
- Core 4 friends for H2H betting: Will, D.O., Rosen, Charlie
- Flexible participant management for different bet types

## Settlement Logic

### Standard Bets
- Proportional sharing of stakes among participants
- Winners split total pool based on individual contributions
- Automatic P&L calculation excluding bookie fronting costs

### Head-to-Head Bets  
- Even odds (no vig) between friends
- Winners split total pool evenly regardless of side size
- Clean settlement with no house edge

### Weekend Settlement
- Automatic detection when all weekend games complete
- Proportional settlement algorithm for fair payouts
- Transaction generation for who pays whom

## API Integration
- **The Odds API** for live NFL odds and scores
- **Graceful fallback** to mock data when API unavailable
- **Real-time score updates** every 30 seconds during live games
- **Automatic bet evaluation** based on game results

### Environment Setup
1. Copy `.env.example` to `.env.local`
2. Add your API key: `NEXT_PUBLIC_ODDS_API_KEY=your_key_here`
3. Never commit `.env.local` or any file containing API keys

### Testing Commands
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run lint     # Run ESLint
npm run type-check # Run TypeScript type checking (if available)
```

### Code Organization
- `/src/components/` - React components
- `/src/lib/` - Utilities and API services
- `/src/app/` - Next.js app router pages

## GitHub Repository Setup

### Initial Setup
1. Create a new repository on GitHub (private recommended)
2. Initialize git in the project:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/yourusername/allegedly.git
   git push -u origin main
   ```

### Security Checklist
Before pushing to GitHub, ensure:
- [ ] `.env.local` is in `.gitignore`
- [ ] No API keys in source code
- [ ] No hardcoded credentials
- [ ] No sensitive user data

### Recommended .gitignore
```
# Dependencies
/node_modules
/.pnp
.pnp.js

# Testing
/coverage

# Next.js
/.next/
/out/

# Production
/build

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local env files
.env*.local
.env

# Vercel
.vercel

# TypeScript
*.tsbuildinfo
next-env.d.ts
```

## Feature Cleanup Protocol

When completing major features:
1. Remove debugging console.log statements
2. Delete test/development pages (e.g., `/test-props/`)
3. Clean up commented code
4. Update this documentation
5. Commit with descriptive message: `feat: implement player props with real API data`

## Future Enhancements
- **Settlement payment tracking** - mark when payments are actually made (user request)
- **OCR integration** for automatic bet slip reading
- **Push notifications** for bet results and settlement reminders
- **Enhanced charts** with proper graphing libraries (Chart.js, D3)
- **Mobile app** version for better on-the-go usage
- **Firebase integration** for real-time collaboration

## Development Notes

### Performance Considerations
- Mock data fallback ensures app works without API keys
- Optimistic UI updates for better user experience  
- Efficient re-renders with proper React state management

## GitHub Workflow
- Clean up old code upon major feature completion
- Keep sensitive data and API keys out of repository
- Regular commits with descriptive messages
- Feature branches for major developments

## Test Coverage
All major features have been implemented and tested with mock data. The app gracefully handles API failures and provides a complete betting coordination experience even in offline/demo mode.

## Current State - Phase 2 Complete ✅

### All Core Features Implemented
- ✅ **Consensus Building** - Multi-user voting with group alignment analysis
- ✅ **Actual Bet Tracking** - Full bet lifecycle management with deduplication
- ✅ **Head-to-Head Betting** - Peer-to-peer bets with no vig
- ✅ **Live Game Tracking** - Real-time scores with automatic bet evaluation
- ✅ **Performance Analytics** - User leaderboards and P&L tracking
- ✅ **Weekend Settlement** - Automatic settlement calculations and payment workflows
- ✅ **Seasonal Ledger** - Long-term performance tracking with running balance graphs
- ✅ **Player Props Integration** - Dynamic odds fetching with position-based ordering
- ✅ **Image Upload** - Bet slip verification and record-keeping

### Production Ready Features
- Graceful API fallback to mock data
- Responsive design for mobile and desktop
- Type-safe TypeScript throughout
- Clean component architecture
- Persistent user identification
- Real-time data updates

---
*Last Updated: 2025-09-09 - Phase 2 Complete with Settlement & Ledger Systems*