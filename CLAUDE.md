# CLAUDE.md - Critical Project Context

## 🚨 CRITICAL: CORRECT PROJECT FOLDER
- **ALWAYS USE**: `/Users/ckubal/Dropbox/coding-projects-25/groupbet`
- **NEVER USE**: `allegedly` folder (outdated, not connected to live site)
- **GITHUB REPO**: https://github.com/ckubal/groupbet.git
- **VERCEL DEPLOYMENT**: Connected to the `groupbet` GitHub repository

## 🚨 CURRENT DATE AND NFL SEASON CONTEXT
- **TODAY IS SEPTEMBER 24, 2025**
- **WE ARE IN THE 2025 NFL SEASON**
- **WEEK 3 IS COMPLETED (SEPTEMBER 18-24, 2025)**
- **ALL WEEK 3 GAMES ARE FINAL - BETS ARE RESOLVED**

## 🏈 NFL WEEK 3 2025 STATUS
- **ALL GAMES COMPLETED**: Week 3 games have finished
- **AUTOMATIC BET RESOLUTION**: System auto-resolves bets when games complete
- **CURRENT FOCUS**: Week 3 completed games with final scores and bet resolutions

## 🎯 CORE ARCHITECTURE REQUIREMENTS

### 1. ESPN API (PRIMARY SOURCE)
- **PRIMARY PURPOSE**: Get games, live scores, game status, and player stats
- **USAGE**: Primary source for all game data and live updates
- **CACHE DURATION**: 30 seconds for live games, 30 minutes for final games
- **REAL DATA**: Extract actual field position, stats, NOT mock data

### 2. FIREBASE CACHING
- **CRITICAL**: Save ESPN game data to Firebase to avoid repeated API calls
- **CACHE DURATION**: 
  - Live games: 30 seconds (ESPN cache)
  - Final games: 30 minutes (ESPN cache)
  - Firebase: Store games with proper IDs matching user bets
- **GAME IDs**: Must match between ESPN, Firebase, and user bets

### 3. ODDS API (FALLBACK)
- **SECONDARY PURPOSE**: Get betting lines when needed
- **ISSUE**: Currently returning wrong games for Week 2 2025
- **STATUS**: Temporarily disabled, using hardcoded games with correct IDs

### 4. BET MATCHING
- **CRITICAL**: User bets reference specific game IDs from Firebase
- **EXISTING BET IDs**: 
  - `ec75e45d75691f810f347e0c5ff25d6e` (Jaguars @ Dolphins)
  - `cd0fd9335b5182d3bfed35ab8d5ab6fb` (Bills @ Chiefs)
  - `575c1b169aab675ec72372ccb0f4c55f` (Jets @ Patriots)
  - `05a5b084f4e19535b2d3f91ef5c00169` (Cowboys @ Giants)
  - `1ee9ea2c8256bc6be5dd92e60f6c17de` (Lions @ Bears)
  - `553edb8bf2452482b37dde58e832a6fb` (Ravens @ Browns)

### 5. PLAYER PROPS DISPLAY
- **WRONG**: "DeAndre Hopkins over 19.5 receiving yards"
- **CORRECT**: "DeAndre Hopkins number of receiving yards today"
- **FORMAT**: "[Player Name] number of [stat type] today"

## 🚫 WHAT NOT TO DO - CRITICAL RULES
- ❌ **NEVER HARDCODE SCORES OR PLAYER STATS** - Always use real API data
- ❌ **NEVER INVENT OR HALLUCINATE GAME DATA** - If real data isn't available, show an error
- ❌ Don't use mock data when real APIs are available
- ❌ Don't mark bets as lost if games can't be matched
- ❌ Don't create new game IDs that don't match existing bets
- ❌ Don't assume dates - check current date context
- ❌ Don't make repeated API calls when Firebase cache exists

## 🚨 CRITICAL ERROR PATTERNS TO AVOID
- **HARDCODED SCORES**: Ravens 28 Browns 14 (fake), Lions 31 Bears 16 (fake)
- **MADE-UP MATCHUPS**: Wrong teams playing each other
- **FICTIONAL STATS**: Fake player performance numbers
- **MIXED DATA**: Some real, some fake - this creates confusion and breaks trust

## ✅ WHAT TO DO
- ✅ Use current date (September 15, 2025) for Week 2 games
- ✅ Load games from Odds API into Firebase cache
- ✅ Match game IDs between APIs and user bets
- ✅ Use ESPN API for live scores and stats
- ✅ Display all Week 2 games in proper time slots
- ✅ Show player props in descriptive format

## 🔧 TROUBLESHOOTING
If games aren't loading correctly:
1. Check if current date context is correct (September 2025)
2. Verify Odds API is being called with correct week boundaries
3. Ensure Firebase cache is being populated with Odds API data
4. Confirm game IDs match between all systems
5. Use ESPN API to update scores for cached games

## 📝 CURRENT STATUS
- Week 2 2025 games are COMPLETED (Sept 11-15, 2025)
- User has active bets on these completed games
- Need to show final scores and resolve bets correctly
- Player props need descriptive text format

## 🔧 RECENT FIXES (September 15, 2025)
- **CRITICAL FIX**: Fixed getTimeSlot function in odds-api.ts
  - **Issue**: Only 2 of 16 ESPN games were displaying (Monday night games only)
  - **Root Cause**: Function used UTC day instead of Eastern time day for classification
  - **Solution**: Changed `gameTime.getDay()` to use `easternTime.getDay()`
  - **Result**: All 16 Week 2 games now properly categorized into Thursday/Sunday/Monday slots

## 🚨 CRITICAL USER ID STANDARDS
- **D/O USER ID**: ALWAYS use "d/o" (with slash) - NEVER "dio" or other variations
- **STANDARD PARTICIPANTS**: `["will", "d/o", "rosen", "charlie"]`
- **DO NOT CHANGE**: User specifically requested d/o as the standard format
- **CONSISTENCY**: All bets, user lookups, and participant arrays must use "d/o"

## ✅ MAJOR IMPLEMENTATION: PROPER BETTING ODDS SYSTEM (September 15, 2025)

### 🎯 COMPLETED: Real Sports Betting Calculations
- **BEFORE**: Simple pot splitting ($50 pot ÷ 5 participants = $10 each)  
- **AFTER**: Industry-standard American odds calculations (+500, -110, etc.)

### 📊 Betting Odds Implementation (`/lib/betting-odds.ts`):
```typescript
// Examples of proper calculations:
// +500 odds: $10 stake → $60 total payout ($50 profit)
// -110 odds: $10 stake → $19.09 total payout ($9.09 profit)
// +1200 odds: $5 stake → $65 total payout ($60 profit)
// -500 odds: $10 stake → $12.00 total payout ($2.00 profit)
```

### 🎨 UI IMPROVEMENTS: Summary Dashboard & Compact Layout
- **NEW**: Week Summary Section at top showing:
  - Total Staked: $295.00
  - Total Payout: $472.50  
  - Net P&L: +$177.50 (color-coded green/red)
  - Record: 4W-3L format

### 🃏 FIXED: Bet Card Layout (`games-page.tsx` lines 191-259)
- **SOLUTION**: Used inline CSS to force 4 cards per row
- **WHY**: Tailwind grid classes weren't working properly
- **LAYOUT**: `style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}`
- **SIZING**: `width: 'calc(25% - 9px)', minWidth: '200px'`
- **RESULT**: Responsive layout that shows 4 cards per row on wide screens

### 🏆 CRITICAL SUCCESS FACTORS:
1. **Real betting math** - No more fake pot splitting
2. **Visual indicators** - ✓ wins, ✗ losses, ⏳ pending with proper colors
3. **Game scores displayed** - Shows final scores for completed games
4. **Forced CSS layout** - Inline styles bypass Tailwind issues
5. **Responsive design** - Cards wrap properly on smaller screens

### 🔒 LAYOUT IMPLEMENTATION (DO NOT CHANGE):
```jsx
// This specific implementation WORKS - do not modify:
<div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
  <div style={{ 
    width: 'calc(25% - 9px)', 
    minWidth: '200px',
    minHeight: '120px'
  }}>
    // Bet card content
  </div>
</div>
```

### 💡 USER EXPERIENCE:
- Immediate visual feedback on betting performance
- Clear profit/loss calculations using real odds
- Compact layout shows more information efficiently
- Professional sports betting interface

## ✅ MANUAL BET ADDITION SYSTEM (September 15, 2025)

### 🎯 COMPLETED: Add Historical Bets Functionality
Successfully implemented system to add bets from completed games and automatically resolve them.

### 📋 API ENDPOINTS FOR MANUAL BET ENTRY:
1. **`/api/add-bet`** - Add new bets manually
2. **`/api/resolve-bets`** - Auto-resolve bets from completed games  
3. **`/api/check-bets`** - Verify bet data and user IDs
4. **`/api/fix-participants`** - Fix participant ID mismatches

### 🔧 CRITICAL USER ID FORMAT:
- **CORRECT**: `["will", "dio", "rosen", "charlie"]`
- **WRONG**: `["charlie-user-id", "rosen-user-id", ...]`
- System only shows bets where user appears in participants array

### 📝 ADD BET EXAMPLE (Working Template):
```bash
curl -X POST http://localhost:3000/api/add-bet \
  -H "Content-Type: application/json" \
  -d '{
    "gameId": "1cb2a8bc861116912c595087ff777756",
    "placedBy": "rosen",
    "participants": ["will", "dio", "rosen", "charlie"],
    "betType": "spread",
    "selection": "Green Bay Packers -3",
    "odds": -120,
    "line": -3,
    "totalAmount": 240,
    "amountPerPerson": 60
  }'
```

### 🏆 SUCCESSFULLY ADDED HISTORICAL BETS:
1. **Packers -3** (Thursday) - WON (+$50 each)
2. **Jayden Daniels Over 226.5 pass yards** - LOST (-$25 each)
3. **Jayden Daniels Under 43.5 rush yards** - WON (+$23.81 each)
4. **49ers +4** vs Saints - WON 
5. **Eagles Pick 'em** vs Chiefs - WON

### 🔄 AUTO-RESOLUTION WORKFLOW:
1. Add bet with `add-bet` API
2. Run `resolve-bets` API for completed games
3. System automatically determines win/loss using real game data
4. Updates betting summary and individual bet status

### 💰 RESULT: Complete betting history with proper resolution!

## ✅ PARLAY BETTING SYSTEM (September 21, 2025)

### 🎯 COMPLETED: Full Parlay Implementation
- **Data Model**: Added 'parlay' bet type with parlayLegs array
- **Odds Calculation**: Proper American odds multiplication
- **UI Components**: ParlayBuilder modal for creating parlays
- **Bet Resolution**: All legs must win for parlay to win
- **Display**: Shows each leg status in bet cards

### 🏈 How Parlays Work:
1. **Create Parlay**: Click "Create Parlay" button in bets section
2. **Select Legs**: Choose 2+ active bets to combine
3. **Combined Odds**: Automatically calculates parlay odds
4. **All or Nothing**: All legs must win for payout

### 📊 Parlay Odds Calculation:
```typescript
// Example: 2-leg parlay with -120 and -110 odds
// Decimal: 1.833 × 1.909 = 3.498
// American: +250 (pay $250 profit on $100 bet)
```

## ✅ WEEK 3 CRITICAL FIXES (September 24, 2025)

### 🎯 COMPLETED: All Critical Week 3 Issues Resolved

1. **BET DISPLAY FIXES**:
   - ✅ Fixed bet cards displaying 1 per row → Now shows 2-3 per row responsively
   - ✅ Fixed game dates all showing as Sunday morning → Proper time slot categorization
   - ✅ Added subtle background colors: Green for wins, red for losses

2. **PARLAY BET RESOLUTION**:
   - ✅ Fixed Jacksonville ML + 49ers ML parlay bet resolution (2-leg parlay WON)
   - ✅ Enhanced parlay resolution logic to handle multiple game references
   - ✅ Fixed "game is not defined" and "updatedParlayLegs" errors in resolution

3. **AUTOMATIC BET RESOLUTION SYSTEM**:
   - ✅ Implemented auto-resolve when games are fetched (`/api/auto-resolve-bets`)
   - ✅ Checks multiple weeks for completed games automatically
   - ✅ No more manual bet resolution requests needed

4. **FIREBASE CACHING IMPROVEMENTS**:
   - ✅ Enhanced Firebase-first caching system (`/lib/games-cache.ts`)
   - ✅ Store both ESPN and Odds API game IDs to prevent ID mismatches
   - ✅ Preserve player props when refreshing game data
   - ✅ Fixed "Unsupported field value: undefined" Firebase errors

5. **PLAYER PROPS SYSTEM**:
   - ✅ Created `/api/add-player-prop` endpoint for manual prop addition
   - ✅ Player props cached in Firebase and displayed for past games
   - ✅ Added Travis Kelce Over 65.5 receiving yards (LOST - 26 yards)
   - ✅ Added Brown Under 50.5 receiving yards (WON - 42 yards)
   - ✅ **Strategic Props Caching Policy**:
     - **Initial fetch**: 2+ days before game (when props become available)
     - **Final refresh**: 2-6 hours before game (catch line movements)
     - **Otherwise**: Use Firebase cache to minimize API calls
   - ✅ **No Live Updates**: Preserves pre-game lines, saves API calls
   - ✅ **Firebase Cache**: Props cached permanently once game starts

6. **UI/UX ENHANCEMENTS (September 24, 2025)**:
   - ✅ **Futuristic Fintech Aesthetic**: Brighter green outlines and bold backgrounds for wins
   - ✅ **Enhanced Win Styling**: 2px green border with glow effect and 15% background opacity
   - ✅ **Responsive Layout**: 2 cards per row on mobile, 3 cards per row on tablets/laptops (768px+)
   - ✅ **Improved Spacing**: 12px gaps between cards with 20px internal padding
   - ✅ **Custom CSS Grid**: `.bet-grid` class with media queries for reliable responsive behavior

### 🔧 FILES MODIFIED:
- `/app/games-page.tsx` - Bet card layout, responsive grid, enhanced styling
- `/app/globals.css` - Futuristic fintech CSS classes and responsive grid
- `/lib/games-cache.ts` - Enhanced Firebase caching with dual ID storage
- `/app/api/resolve-bets/route.ts` - Fixed parlay resolution logic
- `/app/api/auto-resolve-bets/route.ts` - Automatic bet resolution system
- `/app/api/add-player-prop/route.ts` - Manual player prop addition
- `/lib/firebase-utils.ts` - Clean undefined fields utility

### 🎨 DESIGN SYSTEM:
- **Win Cards**: `rgba(16, 185, 129, 0.15)` background, 2px green border, box-shadow glow
- **Loss Cards**: `rgba(239, 68, 68, 0.05)` background, subtle red border
- **Grid Layout**: `grid-cols-2 md:grid-cols-3` with 12px gaps
- **Card Padding**: 20px internal padding (p-5)
- **Fintech Style**: Glassmorphism effects, gradient borders, pulsing animations