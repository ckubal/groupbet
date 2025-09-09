# Allegedly 🏈
## NFL Betting Group Coordination App

A Progressive Web App built to help coordinate NFL betting within a group of friends, replacing text message coordination with real-time voting, bet tracking, and automatic settlements.

## ✨ Features

### 🟢 Phase 1 (LIVE)
- **Game Display**: View NFL games organized by time slots (Thursday, Sunday early/late, Monday)
- **Real-time Selection**: Select your picks from both sides of each bet (spread, totals, moneylines)
- **Group Alignment**: See which games have the most group consensus
- **Responsive Design**: Works on all devices as a Progressive Web App

### 🟡 Phase 2 (In Development)
- **Bet Tracking**: Log actual bets with participant tracking
- **Slip Parsing**: Auto-parse Bovada and Str8Play betting slips from text
- **Live Score Integration**: Real-time game scores and bet performance
- **Smart Bet Entry**: Pre-fill odds from API, manual editing supported

### ⚪ Phase 3 (Planned)
- **Automatic Settlement**: Weekend settlement calculations with debt simplification
- **Screenshot OCR**: Parse betting slips from screenshots
- **Push Notifications**: Game start times and bet updates
- **Historical Tracking**: Season-long performance and statistics

## 🚀 Tech Stack

- **Frontend**: Next.js 15 + TypeScript + Tailwind CSS
- **Backend**: Firebase (Firestore + Auth + Functions)
- **PWA**: Service Worker + Manifest for native app experience  
- **Real-time**: Firestore real-time subscriptions
- **Parsing**: Custom regex parsers for Bovada/Str8Play
- **Icons**: Lucide React + Heroicons
- **Build**: Turbopack for fast development

## 📦 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Firebase project (for production)

### Installation

```bash
# Clone and install
npm install

# Copy environment template
cp .env.local.example .env.local

# Start development server
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

### Environment Setup

Create `.env.local` with your Firebase configuration:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
ODDS_API_KEY=your_odds_api_key
```

## 🧪 Testing

### Betting Slip Parsers
Our parsers support Bovada and Str8Play formats:

```bash
# Run all parser tests
npm test

# Test with real slip data
node -e "
const { testWithRealData } = require('./docs/betting-parser-tests.js');
testWithRealData('paste your slip text here');
"
```

**Parser Features:**
- ✅ Auto-detects platform (Bovada vs Str8Play)
- ✅ Handles single bets, parlays, and player props
- ✅ Calculates payouts from American odds
- ✅ Validates against current odds (when integrated with API)
- ✅ 12/12 test cases passing

## 📱 PWA Features

- **Installable**: Add to home screen on mobile devices
- **Offline Support**: Core functionality works without internet
- **Fast Loading**: Optimized with Next.js and Turbopack
- **Mobile Optimized**: Touch-friendly interface design

## 🗂️ Project Structure

```
allegedly/
├── src/
│   ├── app/           # Next.js app router pages
│   ├── components/    # Reusable UI components  
│   ├── lib/          # Utilities and services
│   └── types/        # TypeScript type definitions
├── docs/             # Planning docs and original parsers
├── public/           # Static assets and PWA manifest
└── README.md
```

### Key Files
- `src/lib/betting-slip-parsers.js` - Bovada/Str8Play parsers
- `src/lib/database.ts` - Firebase database service
- `src/components/GameCard.tsx` - Individual game voting component
- `src/components/AlignmentView.tsx` - Group consensus display
- `src/app/games/page.tsx` - Main voting interface

## 🔥 Firebase Setup

### 1. Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project
3. Enable Firestore Database
4. Enable Authentication
5. Copy config to `.env.local`

### 2. Firestore Collections
The app uses these collections:
- `users` - Group member profiles
- `games` - NFL game data with odds
- `votes` - User votes on games
- `bets` - Actual wagers placed
- `settlements` - Weekly payout calculations

### 3. Security Rules
```javascript
// Firestore rules (basic example)
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 📊 Data Sources

### Current (Mock Data)
Phase 1 uses mock NFL game data for development and testing.

### Planned Integrations
- **The Odds API** - Real-time NFL odds and lines
- **ESPN API** - Live scores and game status
- **Firebase Functions** - Scheduled data updates

## 🔧 Development Scripts

```bash
# Development
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint code checking
npm test            # Run betting parser tests
```

## 🚀 Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard
```

### Manual Deployment
```bash
# Build for production
npm run build

# Deploy to your hosting platform
```

## 🤝 Contributing

### Phase 2 Priorities
1. **Odds API Integration** - Replace mock data with real odds
2. **Bet Entry Form** - Smart form with slip parsing
3. **Live Score Updates** - Real-time game tracking
4. **User Authentication** - Firebase Auth integration

### Phase 3 Priorities  
1. **Settlement Engine** - Automated payout calculations
2. **OCR Integration** - Screenshot betting slip parsing
3. **Push Notifications** - Game and bet alerts
4. **Analytics Dashboard** - Performance tracking

## 📋 Current Status

**✅ Completed:**
- Next.js app with PWA support
- Game display with time slot organization  
- Real-time selection system (both sides of each bet)
- Group consensus ranking
- Betting slip parsers (text-based)
- Firebase integration ready
- Responsive mobile-first design

**🚧 In Progress:**
- Odds API integration
- User authentication
- Bet tracking interface

**📅 Next Sprint:**
- Firebase project setup
- Real NFL odds data
- Bet entry form with parsing

## 📞 Support

For questions about the codebase or betting slip parsing:
- Check `docs/` folder for planning documentation
- Run `npm test` to verify parser functionality
- Review Firebase setup in `src/lib/firebase.ts`

---

**Note**: This app is for coordination among friends and does not involve real money transactions. All financial tracking is IOU-based between group members.