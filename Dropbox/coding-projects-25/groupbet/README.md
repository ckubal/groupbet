# GroupBet - NFL Betting Tracker

A clean, simple web application for tracking group bets on NFL games with your friends.

## Features

### ✅ Phase 1 - Core MVP
- **Game Display**: Clean, mobile-first game cards with betting lines
- **Bet Placement**: Interactive bet popup with customizable amounts and participants
- **User Management**: Simple user switching with cookie persistence
- **API Integration**: Real-time NFL odds from The Odds API with caching
- **Live Scores**: ESPN API integration for live game updates
- **Week Navigation**: Browse different NFL weeks

### 🚧 Coming Soon - Phase 2
- Firebase backend for bet storage
- Real-time bet tracking and settlement
- Player props integration
- Settlement calculations

## Tech Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Query (TanStack Query)
- **APIs**: The Odds API, ESPN API
- **Backend**: Firebase (pending setup)
- **Icons**: Lucide React

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- The Odds API key

### Installation

1. Clone the repository
```bash
git clone https://github.com/ckubal/groupbet.git
cd groupbet
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.local.example .env.local
```

Edit `.env.local` and add your API keys:
```env
NEXT_PUBLIC_ODDS_API_KEY=your_odds_api_key_here
```

4. Run the development server
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## API Setup

### The Odds API
1. Sign up at [The Odds API](https://the-odds-api.com/)
2. Get your API key from the dashboard
3. Add it to your `.env.local` file

The app includes intelligent caching to preserve your API quota:
- Game odds cached for 5 minutes
- Live scores cached for 30 seconds during games
- Player props cached for 5 minutes

### ESPN API
The ESPN API is used for live scores and doesn't require authentication. The integration includes:
- Live game scores and status
- Automatic cache management
- Fallback to The Odds API data

## Friend Group

The app is pre-configured with these users:
- Will
- Dio
- Rosen
- Charlie
- Pat

User management is cookie-based for simplicity.

## Project Structure

```
/
├── app/                    # Next.js app directory
│   ├── layout.tsx         # Root layout with providers
│   ├── page.tsx           # Main betting interface
│   └── providers.tsx      # React Query provider
├── components/            # React components
│   ├── GameCard.tsx       # Individual game display
│   ├── BetPopup.tsx       # Bet placement modal
│   └── UserSelector.tsx   # User switching component
├── lib/                   # Utilities and services
│   ├── odds-api.ts        # The Odds API integration
│   ├── espn-api.ts        # ESPN API integration
│   ├── firebase.ts        # Firebase configuration
│   ├── user-context.tsx   # User state management
│   └── utils.ts           # Helper functions
├── types/                 # TypeScript type definitions
│   └── index.ts          # Core data models
└── .env.local            # Environment variables
```

## Data Models

Key interfaces following the technical specification:

- **Game**: NFL game with betting lines and status
- **Bet**: Individual bet with participants and financial details
- **User**: Friend group member with PIN authentication
- **Weekend**: NFL week grouping with status tracking
- **Settlement**: End-of-week payment calculations

## Caching Strategy

To preserve API quota and improve performance:

1. **The Odds API**: 5-minute cache for betting lines
2. **ESPN API**: 30-second cache for live games, 30-minute for completed games
3. **Manual refresh**: Users can force refresh to get latest data
4. **Intelligent expiration**: Different cache durations based on game status

## Development

### Running the app
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### API Usage Monitoring

The app logs API usage to the console:
- The Odds API request counts and remaining quota
- Cache hit/miss information
- Error handling for rate limits

## Security

- Environment variables protected by `.gitignore`
- No API keys in source code
- Cookie-based user sessions (no sensitive data)
- Client-side API calls only for public sports data

## Firebase Setup (Next Phase)

When ready to set up Firebase:
1. Create a new Firebase project called "GroupBet"
2. Enable Firestore Database
3. Add your Firebase config to `.env.local`
4. Deploy Firestore security rules

## Contributing

This is a private friend group application. Features are prioritized based on the technical specification in `nfl_betting_app_spec.md`.

## License

Private project for friend group use.