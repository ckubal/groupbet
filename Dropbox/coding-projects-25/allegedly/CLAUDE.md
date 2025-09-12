# GroupBet - NFL Betting Coordination App

## Project Overview
This is "GroupBet" - an NFL betting coordination app with futuristic glassmorphism UI design. The app helps groups coordinate betting decisions through voting, consensus analysis, and bet tracking.

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

## Git Repository
- **Repository**: https://github.com/ckubal/groupbet
- **User**: ckubal
- **Email**: ckubal+gh@gmail.com

### Initial Setup
1. Repository will be created on GitHub as "groupbet"
2. Initialize git in the project:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: GroupBet glassmorphism betting app"
   git branch -M main
   git remote add origin https://github.com/ckubal/groupbet.git
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

## Latest Development Session - September 11, 2025

### Glassmorphism UI Redesign - Complete ✅

**Objective**: Transform the betting interface with a modern glassmorphism aesthetic featuring horizontal game card layouts.

**Key Changes Implemented**:

#### 1. Complete Visual Redesign
- **Dark glassmorphism theme** with backdrop blur effects throughout
- **Bold accent colors**: Electric blue (#00d4ff), neon green (#00ff88), purple (#8b5cf6), pink (#ff006e) 
- **All lowercase text** styling across the entire interface
- **Generous rounded corners** (12-24px) for modern geometric feel
- **Minority Report-style** futuristic interface with floating glass panels

#### 2. Horizontal Game Card Layout (`GameCardHorizontal.tsx`)
- **Complete component redesign** from vertical to horizontal layout
- **Teams section on left** with team logos and home/away indicators
- **Three betting columns on right**: Spread, Total, Moneyline arranged horizontally
- **Glass panel styling** with transparency and backdrop blur
- **Inline CSS styling** to override specificity conflicts
- **Mobile-responsive grid** that stacks vertically on smaller screens

#### 3. Technical Implementation Details
- **CSS Custom Properties** added to `globals.css` for consistent theming
- **Glass effect utilities** with backdrop-filter and rgba backgrounds  
- **Betting button styling** with hover states and selection indicators
- **Fixed CSS specificity issues** by using inline styles for critical components
- **Updated PlayerPropsDropdown** to match glassmorphism aesthetic

#### 4. Files Modified
- `/src/app/globals.css` - Foundation dark theme with glass effects
- `/src/components/GameCardHorizontal.tsx` - Main horizontal layout component  
- `/src/components/TabLayout.tsx` - Glass navigation panels
- `/src/components/PlayerPropsDropdown.tsx` - Glassmorphism dropdown styling
- `/src/app/group/[groupId]/layout.tsx` - Fixed Next.js 15 async params
- `/src/app/consensus/page.tsx` - Fixed TypeScript type predicate

#### 5. Problem-Solving Process
1. **Initial layout issues** - Components floating/overlapping with poor mobile spacing
2. **CSS not applying** - Used debug red borders to identify rendering issues  
3. **Specificity conflicts** - Resolved with inline styling for critical glass effects
4. **Betting odds missing** - Fixed by implementing consistent button styling functions
5. **Next.js 15 compatibility** - Updated async/await params handling

#### 6. Final Result
- ✅ Horizontal layout working correctly with all betting columns visible
- ✅ Glass panel aesthetic with proper transparency and blur effects
- ✅ Mobile-responsive design with appropriate stacking
- ✅ All betting odds displaying properly (-2.5/-110, o 51.5/-110, +120/-140)
- ✅ Consistent glassmorphism theme throughout interface
- ✅ Lowercase text styling maintained across all components

**Commit**: `9160f5b` - "Implement horizontal glassmorphism game card layout"

## Latest Development Session - January 2, 2025

### UI Refinements & Bet Placement Redesign - Complete ✅

**Objective**: Fix layout issues, improve text readability, and redesign the alignment page for action-oriented bet placement.

**Key Changes Implemented**:

#### 1. Layout and Spacing Fixes
- **Fixed team column width** - Changed from `1fr` to `120px` for proper sizing
- **Centered team names** - Teams now centered with padding from left border
- **Reduced spacing** - Minimized gap between team names and betting columns
- **Player props toggle** - Changed from button to subtle text link with dropdown caret

#### 2. Text Readability Improvements
- **Fixed player props text color** - Changed from black to white/gray for dark backgrounds
- **Ensured all text is readable** - White text on dark glassmorphism backgrounds throughout
- **Proper contrast ratios** - Gray text (#d1d5db) for secondary information

#### 3. Complete Alignment Page Redesign
- **Created new `BetPlacer.tsx` component** - Action-oriented UI for bet placement
- **Shows only next game segment** - Focused view on upcoming games only
- **Expandable bet cards** with configuration:
  - Amount input with dollar sign icon
  - Odds editing capability
  - Bet placer selection (who's placing the bet)
  - Participants selection (who's in on the bet)
  - One-click "Place Bet" button
- **Visual feedback** - Green checkmark when bet is placed
- **Bet organization** - Unanimous → Strong Consensus → Majority

#### 4. Information Architecture
- **Removed complex analysis** - Focus on "what to bet" not "why"
- **Clear bet recommendations** - Shows exact picks based on group consensus
- **Simplified workflow** - Expand → Configure → Place → Track
- **Consistent glassmorphism** - Dark theme with blur effects throughout

#### 5. Files Modified
- `/src/components/GameCardHorizontal.tsx` - Fixed layout and text colors
- `/src/components/BetPlacer.tsx` - New action-oriented bet placement component
- `/src/app/consensus/page.tsx` - Redesigned to use BetPlacer component
- `/CLAUDE.md` - Updated documentation for GroupBet

#### 6. Key Design Principles Reinforced
- **Text must be readable** - No black text on dark backgrounds
- **Action-oriented UI** - Show what to do, not just data
- **Consistent spacing** - Proper padding and margins
- **Mobile-first** - Responsive design that works everywhere

**Repository Setup**: Ready to push to https://github.com/ckubal/groupbet

---
*Last Updated: 2025-01-02 - UI Refinements & Bet Placement Redesign Complete*